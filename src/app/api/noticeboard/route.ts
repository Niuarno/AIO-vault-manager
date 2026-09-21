import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

const DEFAULT_HEADLINE =
  'Welcome to BOYON Order Management System. Please ensure all customer numbers and delivery addresses are verified before shipping.';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('system_settings')
      .select('value, updated_at')
      .eq('key', 'noticeboard_headline')
      .maybeSingle();

    if (error) {
      // Graceful fallback if table doesn't exist yet
      return NextResponse.json({
        success: true,
        headline: DEFAULT_HEADLINE,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      headline: data?.value || DEFAULT_HEADLINE,
      updated_at: data?.updated_at || new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      headline: DEFAULT_HEADLINE,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { headline } = body;

    if (typeof headline !== 'string' || !headline.trim()) {
      return NextResponse.json({ error: 'Headline text is required' }, { status: 400 });
    }

    const trimmedHeadline = headline.trim();
    const supabase = createAdminClient();

    // Verify requesting user is admin
    let isAdmin = false;
    let userId: string | null = null;
    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile?.role === 'admin') {
          isAdmin = true;
        }
      }
    } catch {
      // ignore
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can update the noticeboard headline.' },
        { status: 403 }
      );
    }

    // Upsert into system_settings
    const { error: upsertErr } = await supabase.from('system_settings').upsert({
      key: 'noticeboard_headline',
      value: trimmedHeadline,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

    if (upsertErr) {
      // If table doesn't exist, try to create it on the fly
      if (upsertErr.message?.includes('relation "public.system_settings" does not exist') || upsertErr.code === '42P01') {
        return NextResponse.json(
          {
            error:
              'Database table system_settings is missing. Please execute the latest migration in Supabase SQL editor.',
          },
          { status: 500 }
        );
      }
      throw upsertErr;
    }

    return NextResponse.json({
      success: true,
      headline: trimmedHeadline,
      message: 'Noticeboard headline updated successfully.',
    });
  } catch (err: any) {
    console.error('Noticeboard update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update noticeboard' }, { status: 500 });
  }
}
