import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

interface ShopifyVariantItem {
  id?: number | string;
  title?: string;
  price?: string | number;
  sku?: string | null;
  stock_quantity?: number;
}

interface ShopifyProductItem {
  id?: number | string;
  title: string;
  handle?: string | null;
  body_html?: string | null;
  description?: string | null;
  image_url?: string | null;
  image?: { src?: string } | null;
  images?: Array<{ src?: string }> | null;
  variants?: ShopifyVariantItem[];
}

/**
 * Helper to fetch all active products from Shopify store.
 * First attempts the Admin REST API, and falls back to the Storefront catalog JSON
 * if the access token has insufficient scope (e.g. requires merchant approval for read_products).
 */
async function fetchShopifyCatalog(shopDomain: string, apiVersion: string) {
  const adminToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  let activeAdminToken: string | null = adminToken && !adminToken.includes('placeholder') ? adminToken : null;

  // If Client Credentials are provided and no static token, try exchanging for an admin token
  if (!activeAdminToken && clientId && clientSecret) {
    try {
      const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
        cache: 'no-store',
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        activeAdminToken = tokenData.access_token || null;
      }
    } catch (err) {
      console.warn('[Shopify Sync] Client credentials exchange failed:', err);
    }
  }

  // 1. Try Admin API if token is present
  if (activeAdminToken) {
    try {
      const adminUrl = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250&status=active`;
      const adminRes = await fetch(adminUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': activeAdminToken,
        },
        cache: 'no-store',
      });

      if (adminRes.ok) {
        const adminData = await adminRes.json();
        if (Array.isArray(adminData.products) && adminData.products.length > 0) {
          return adminData.products;
        }
      } else {
        console.warn(`[Shopify Sync] Admin API returned ${adminRes.status}, falling back to public catalog`);
      }
    } catch (adminErr) {
      console.warn('[Shopify Sync] Admin API request failed, falling back:', adminErr);
    }
  }

  // 2. Reliable Fallback: Shopify Storefront / Public catalog endpoint (paginated)
  const products: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const publicUrl = `https://${shopDomain}/products.json?limit=250&page=${page}`;
    const pubRes = await fetch(publicUrl, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!pubRes.ok) {
      break;
    }

    const pubData = await pubRes.json();
    const batch = pubData.products || [];
    if (batch.length === 0) {
      hasMore = false;
    } else {
      products.push(...batch);
      if (batch.length < 250) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return products;
}

/**
 * Normalizes strings for robust matching (trims, lowercases, collapses whitespace & hyphens)
 */
function normalizeTitle(str: string): string {
  return (str || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-') // Normalize all hyphen/dash variants
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * GET /api/shopify/sync
 * Retrieves products from Shopify that do not exist yet in the local database.
 * Does NOT pull or include Shopify inventory quantity (strictly left to user input).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Verify admin access or internal secret
    let isAdmin = false;
    try {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin';
      }
    } catch {
      isAdmin = false;
    }

    if (!isAdmin) {
      const internalSecret = process.env.DASHBOARD_INTERNAL_SECRET;
      const headerSecret = req.headers.get('x-internal-secret');
      if (!internalSecret || headerSecret !== internalSecret) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || 'boyon-2.myshopify.com';
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    // 1. Fetch Shopify catalog
    const shopifyProducts = await fetchShopifyCatalog(shopDomain, apiVersion);

    // 2. Fetch existing products and variants from Supabase
    const { data: dbProducts, error: dbErr } = await supabase
      .from('products')
      .select('id, title, product_variants(id, title, sku, price, stock_quantity)');

    if (dbErr) {
      throw dbErr;
    }

    // Build lookup maps for existing products
    const dbTitleMap = new Set<string>();
    const dbSkuMap = new Set<string>();

    (dbProducts || []).forEach((p: any) => {
      if (p.title) {
        dbTitleMap.add(normalizeTitle(p.title));
      }
      (p.product_variants || []).forEach((v: any) => {
        if (v.sku && String(v.sku).trim()) {
          dbSkuMap.add(String(v.sku).trim().toLowerCase());
        }
      });
    });

    // 3. Find missing products
    const missingProducts: any[] = [];
    let syncedCount = 0;

    for (const sp of shopifyProducts) {
      const spTitleNorm = normalizeTitle(sp.title);
      let isAlreadyInDb = dbTitleMap.has(spTitleNorm);

      // Check variant SKUs if not matched by title
      if (!isAlreadyInDb && Array.isArray(sp.variants)) {
        for (const v of sp.variants) {
          if (v.sku && dbSkuMap.has(String(v.sku).trim().toLowerCase())) {
            isAlreadyInDb = true;
            break;
          }
        }
      }

      if (isAlreadyInDb) {
        syncedCount++;
      } else {
        // Format missing product card payload
        // NOTE: Strictly DO NOT pull or copy quantity from Shopify inventory
        const firstImage = sp.images?.[0]?.src || sp.image?.src || null;
        const variants = (sp.variants || []).map((v: any) => ({
          id: v.id,
          title: v.title && v.title !== 'Default Title' ? v.title : 'Default Title',
          price: v.price ? parseFloat(String(v.price)) : 0,
          sku: v.sku ? String(v.sku).trim() : null,
          // Notice: stock_quantity is deliberately omitted so user enters it manually
        }));

        missingProducts.push({
          id: sp.id,
          title: sp.title,
          handle: sp.handle || null,
          description: sp.body_html || sp.description || null,
          image_url: firstImage,
          price: variants[0]?.price || 0,
          variants,
        });
      }
    }

    return NextResponse.json({
      success: true,
      shop_domain: shopDomain,
      total_shopify: shopifyProducts.length,
      synced_count: syncedCount,
      missing_count: missingProducts.length,
      missing_products: missingProducts,
    });
  } catch (err: any) {
    console.error('[Shopify Sync GET Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to sync Shopify products' }, { status: 500 });
  }
}

/**
 * POST /api/shopify/sync
 * Creates a missing Shopify product in the local database.
 * Sets the initial stock quantity strictly based on the user-entered input.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Verify admin access or internal secret
    let isAdmin = false;
    try {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin';
      }
    } catch {
      isAdmin = false;
    }

    if (!isAdmin) {
      const internalSecret = process.env.DASHBOARD_INTERNAL_SECRET;
      const headerSecret = req.headers.get('x-internal-secret');
      if (!internalSecret || headerSecret !== internalSecret) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }
    }

    const body = await req.json();
    const { product, quantity } = body;

    if (!product || !product.title || !product.title.trim()) {
      return NextResponse.json({ error: 'Valid product with title is required' }, { status: 400 });
    }

    const trimmedTitle = product.title.trim();
    const enteredQty = Math.max(0, parseInt(String(quantity || 0), 10) || 0);

    // 1. Check if product already exists (idempotency guard)
    const { data: existingProd } = await supabase
      .from('products')
      .select('id, title, product_variants(*)')
      .ilike('title', trimmedTitle)
      .maybeSingle();

    if (existingProd) {
      return NextResponse.json({
        success: true,
        already_exists: true,
        message: `Product "${trimmedTitle}" already exists in the app.`,
        product: existingProd,
      });
    }

    // 2. Insert new product
    const { data: newProd, error: prodErr } = await supabase
      .from('products')
      .insert({
        title: trimmedTitle,
        description: product.description ? String(product.description).trim() : null,
        image_url: product.image_url ? String(product.image_url).trim() : null,
        handle: product.handle ? String(product.handle).trim() : null,
        is_active: enteredQty > 0,
        is_disabled: false,
      })
      .select()
      .single();

    if (prodErr || !newProd) {
      throw prodErr || new Error('Failed to create product in database');
    }

    // 3. Insert product variant(s)
    // If the product has multiple variants and user supplied specific variant quantities, use them;
    // otherwise apply the user-entered stock quantity.
    const rawVariants: ShopifyVariantItem[] = Array.isArray(product.variants) && product.variants.length > 0
      ? product.variants
      : [{ title: 'Default Title', price: product.price || 0, sku: null }];

    const variantsToInsert = rawVariants.map((v, idx) => {
      const vQty = v.stock_quantity !== undefined && v.stock_quantity !== null
        ? Math.max(0, parseInt(String(v.stock_quantity), 10) || 0)
        : enteredQty;

      const vPrice = typeof v.price === 'number'
        ? v.price
        : (parseFloat(String(v.price || 0)) || 0);

      return {
        product_id: newProd.id,
        title: (v.title || (rawVariants.length === 1 ? 'Default Title' : `Variant ${idx + 1}`)).trim(),
        sku: v.sku ? String(v.sku).trim() : null,
        price: vPrice,
        cost_price: 0,
        stock_quantity: vQty,
      };
    });

    const { data: insertedVariants, error: varErr } = await supabase
      .from('product_variants')
      .insert(variantsToInsert)
      .select();

    if (varErr) {
      // Rollback product insertion if variant insertion fails
      await supabase.from('products').delete().eq('id', newProd.id);
      throw varErr;
    }

    // 4. Auto-release any delayed delivery orders waiting for this product's stock
    let autoReleasedCount = 0;
    try {
      const { autoReleaseDelayedOrders } = await import('@/lib/delayedOrders');
      for (const createdVar of (insertedVariants || [])) {
        if (createdVar.stock_quantity > 0) {
          const res = await autoReleaseDelayedOrders(supabase, createdVar.id, createdVar.stock_quantity);
          autoReleasedCount += (res.releasedCount || 0);
        }
      }
    } catch (relErr) {
      console.error('[Shopify Sync] Auto release delayed orders warning:', relErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added "${newProd.title}" with ${enteredQty} units in stock.`,
      product: {
        ...newProd,
        variants: insertedVariants,
      },
      released_delayed_orders: autoReleasedCount,
    });
  } catch (err: any) {
    console.error('[Shopify Sync POST Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to add product to catalog' }, { status: 500 });
  }
}
