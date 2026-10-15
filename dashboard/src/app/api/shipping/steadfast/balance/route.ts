import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSteadfastBalance, isSteadfastConfigured } from '@/lib/steadfast';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // 1. Authenticate user (packing or admin)
    let isAuthorized = false;
    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin' || profile?.role === 'packing') {
          isAuthorized = true;
        }
      }
    } catch {}

    if (!isAuthorized) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile?.role === 'admin' || profile?.role === 'packing') {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSteadfastConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          current_balance: null,
          message: 'Steadfast Courier API credentials not configured in environment.',
        },
        { status: 200 }
      );
    }

    const result = await getSteadfastBalance();

    if (result.status === 200) {
      return NextResponse.json({
        success: true,
        configured: true,
        current_balance: result.current_balance ?? 0,
      });
    }

    return NextResponse.json({
      success: false,
      configured: true,
      current_balance: null,
      message: result.message || 'Could not retrieve Steadfast balance.',
    });
  } catch (err: any) {
    console.error('[Steadfast Balance Route Error]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch Steadfast balance' },
      { status: 500 }
    );
  }
}
