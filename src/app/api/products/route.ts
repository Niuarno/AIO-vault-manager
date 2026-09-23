import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('include_archived') === 'true';

    // Verify if requester is an admin
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

    let query = supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .order('title', { ascending: true });

    // Only filter active products if explicitly requested via active_only=true
    if (searchParams.get('active_only') === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Strict privacy: if not admin, sanitize and completely remove cost_price
    const sanitizedProducts = (data || []).map((product: any) => ({
      ...product,
      variants: (product.variants || []).map((variant: any) => {
        if (!isAdmin) {
          const { cost_price, ...publicVariant } = variant;
          return publicVariant;
        }
        return variant;
      }),
    }));

    return NextResponse.json({ success: true, products: sanitizedProducts, is_admin: isAdmin });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const cleanNum = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Mode A: Bulk CSV import: { items: [...] }
    if (Array.isArray(body.items)) {
      const items = body.items;
      if (items.length === 0) {
        return NextResponse.json({ error: 'No items provided in CSV' }, { status: 400 });
      }

      let insertedCount = 0;

      for (const row of items) {
        const title = (row.title || row.Title || row.name || row.product_name || 'Untitled Product').trim();
        const sku = (row.sku || row.SKU || '').trim() || null;
        const price = cleanNum(row.price || row.Price || row.variant_price);
        const costPrice = cleanNum(row.cost_price || row.cost || row.Cost);
        const stock = parseInt(String(row.stock_quantity || row.stock || row.quantity || '0').replace(/,/g, '').trim(), 10) || 0;
        const imageUrl = (row.image_url || row.image || row.image_src || '').trim() || null;
        const description = (row.description || row.Description || row.body_html || '').trim() || null;

        // Check if product with same title exists
        let { data: existingProd } = await supabase
          .from('products')
          .select('id, is_active')
          .eq('title', title)
          .maybeSingle();

        let prodId = existingProd?.id;

        if (!prodId) {
          const { data: newProd, error: pErr } = await supabase
            .from('products')
            .insert({
              title,
              description,
              image_url: imageUrl,
              is_active: stock > 0,
            })
            .select('id')
            .single();

          if (!pErr && newProd) {
            prodId = newProd.id;
          }
        } else {
          // If existing product, update image/description if provided
          const prodUpdates: Record<string, any> = {};
          if (imageUrl) prodUpdates.image_url = imageUrl;
          if (description) prodUpdates.description = description;
          if (stock > 0 && !existingProd?.is_active) {
            prodUpdates.is_active = true;
          }
          if (Object.keys(prodUpdates).length > 0) {
            await supabase.from('products').update(prodUpdates).eq('id', prodId);
          }
        }

        if (prodId) {
          const variantTitle = (row.variant_title || 'Default Title').trim();

          // Check if variant exists for this product
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, title, price, cost_price, sku')
            .eq('product_id', prodId);

          let targetVariant = null;
          if (variants && variants.length > 0) {
            targetVariant = variants.find((v: any) => v.title === variantTitle) || variants[0];
          }

          if (targetVariant) {
            const variantUpdate: Record<string, any> = {
              stock_quantity: stock,
            };
            if (sku) variantUpdate.sku = sku;
            if (price > 0) variantUpdate.price = price;
            if (costPrice > 0) variantUpdate.cost_price = costPrice;

            await supabase
              .from('product_variants')
              .update(variantUpdate)
              .eq('id', targetVariant.id);
          } else {
            await supabase.from('product_variants').insert({
              product_id: prodId,
              title: variantTitle,
              sku,
              price,
              cost_price: costPrice,
              stock_quantity: stock,
            });
          }

          // If stock <= 0, verify if all variants have 0 stock to update is_active
          if (stock <= 0) {
            const { data: allVariants } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('product_id', prodId);
            const totalStock = (allVariants || []).reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0);
            if (totalStock <= 0) {
              await supabase.from('products').update({ is_active: false }).eq('id', prodId);
            }
          }

          insertedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${insertedCount} product items.`,
        count: insertedCount,
      });
    }

    // Mode B: Manual single product creation: { title, sku, price, stock_quantity, image_url, description }
    const { title, sku, price, cost_price, stock_quantity, image_url, description, variant_title } = body;
    if (!title) {
      return NextResponse.json({ error: 'Product title is required' }, { status: 400 });
    }

    const stockQtyNum = parseInt(String(stock_quantity || '0').replace(/,/g, '').trim(), 10) || 0;
    const priceNum = cleanNum(price);
    const costPriceNum = cleanNum(cost_price);

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({
        title: title.trim(),
        description: description ? description.trim() : null,
        image_url: image_url ? image_url.trim() : null,
        is_active: stockQtyNum > 0,
      })
      .select()
      .single();

    if (prodErr) throw prodErr;

    const { data: variant, error: varErr } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        title: (variant_title || 'Default Title').trim(),
        sku: sku ? sku.trim() : null,
        price: priceNum,
        cost_price: costPriceNum,
        stock_quantity: stockQtyNum,
      })
      .select()
      .single();

    if (varErr) throw varErr;

    return NextResponse.json({
      success: true,
      product: { ...product, variants: [variant] },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    // Mode 1: Update Variant Selling Price or Buying Price (cost_price)
    if (body.variant_id) {
      const { variant_id, cost_price, price } = body;
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (cost_price !== undefined) {
        updates.cost_price = parseFloat(cost_price) || 0;
      }
      if (price !== undefined) {
        updates.price = Math.max(0, parseFloat(price) || 0);
      }

      const { data, error } = await supabase
        .from('product_variants')
        .update(updates)
        .eq('id', variant_id)
        .select('*, product:products(*)')
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        variant: data,
        message: 'Product pricing updated successfully.',
      });
    }

    // Mode 2: Toggle Product Status (Enable / Disable)
    const { product_id, is_active } = body;

    if (!product_id || typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid payload: variant_id or (product_id and is_active) required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('products')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', product_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      product: data,
      message: `Product ${is_active ? 'enabled' : 'disabled'} successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    let productId = searchParams.get('id') || searchParams.get('product_id');

    if (!productId) {
      try {
        const body = await req.json();
        productId = body?.product_id || body?.id;
      } catch {
        // No json body
      }
    }

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required for deletion.' },
        { status: 400 }
      );
    }

    // Verify Admin Authorization
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

    // Check Authorization header fallback
    if (!isAdmin) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          isAdmin = profile?.role === 'admin';
        }
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only administrators can permanently delete products.' },
        { status: 403 }
      );
    }

    // Verify product exists
    const { data: existingProd, error: fetchErr } = await supabase
      .from('products')
      .select('id, title')
      .eq('id', productId)
      .single();

    if (fetchErr || !existingProd) {
      return NextResponse.json(
        { error: 'Product not found.' },
        { status: 404 }
      );
    }

    // Permanently delete product from database
    // Cascades automatically to product_variants and inventory_logs.
    // Order items have ON DELETE SET NULL, preserving line item historical snapshot.
    const { error: deleteErr } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({
      success: true,
      message: `Product "${existingProd.title}" permanently deleted successfully.`,
      product_id: productId,
    });
  } catch (err: any) {
    console.error('❌ [Product DELETE Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to permanently delete product.' },
      { status: 500 }
    );
  }
}