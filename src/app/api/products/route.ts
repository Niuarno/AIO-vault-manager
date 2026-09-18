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

    if (!includeArchived) {
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

    // Mode A: Bulk CSV import: { items: [...] }
    if (Array.isArray(body.items)) {
      const items = body.items;
      if (items.length === 0) {
        return NextResponse.json({ error: 'No items provided in CSV' }, { status: 400 });
      }

      let insertedCount = 0;

      for (const row of items) {
        const title = row.title || row.Title || row.name || 'Untitled Product';
        const sku = row.sku || row.SKU || null;
        const price = parseFloat(row.price || row.Price || '0') || 0;
        const costPrice = parseFloat(row.cost_price || row.cost || '0') || 0;
        const stock = parseInt(row.stock_quantity || row.stock || row.quantity || '0', 10) || 0;
        const imageUrl = row.image_url || row.image || null;
        const description = row.description || null;

        // Check if product with same title exists
        let { data: existingProd } = await supabase
          .from('products')
          .select('id')
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
              is_active: true,
            })
            .select('id')
            .single();

          if (!pErr && newProd) {
            prodId = newProd.id;
          }
        }

        if (prodId) {
          // Insert or update variant
          await supabase.from('product_variants').insert({
            product_id: prodId,
            title: row.variant_title || 'Default Title',
            sku,
            price,
            cost_price: costPrice,
            stock_quantity: stock,
          });
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

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({
        title,
        description: description || null,
        image_url: image_url || null,
        is_active: true,
      })
      .select()
      .single();

    if (prodErr) throw prodErr;

    const { data: variant, error: varErr } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        title: variant_title || 'Default Title',
        sku: sku || null,
        price: parseFloat(price || '0') || 0,
        cost_price: parseFloat(cost_price || '0') || 0,
        stock_quantity: parseInt(stock_quantity || '0', 10) || 0,
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

    // Mode 1: Update Variant Buying Price (cost_price) or Selling Price
    if (body.variant_id) {
      const { variant_id, cost_price, price } = body;
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (cost_price !== undefined) {
        updates.cost_price = parseFloat(cost_price) || 0;
      }
      if (price !== undefined) {
        updates.price = parseFloat(price) || 0;
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

    // Mode 2: Archive / Unarchive Product
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
      message: `Product ${is_active ? 'unarchived' : 'archived'} successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}