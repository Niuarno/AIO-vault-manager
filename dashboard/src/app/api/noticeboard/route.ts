import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

const DEFAULT_HEADLINE =
  'Welcome to BOYON Order Management System. Please ensure all customer numbers and delivery addresses are verified before shipping.';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Try system_settings table first
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value, updated_at')
        .eq('key', 'noticeboard_headline')
        .maybeSingle();

      if (!error && data?.value) {
        return NextResponse.json({
          success: true,
          headline: data.value,
          updated_at: data.updated_at || new Date().toISOString(),
        });
      }
    } catch {
      // Fallback
    }

    // 2. Seamless fallback: check reward_rules
    const { data: ruleRow } = await supabase
      .from('reward_rules')
      .select('name, updated_at')
      .like('name', '%noticeboard_headline%')
      .maybeSingle();

    if (ruleRow?.name) {
      try {
        const parsed = JSON.parse(ruleRow.name);
        if (parsed.text) {
          return NextResponse.json({
            success: true,
            headline: parsed.text,
            updated_at: ruleRow.updated_at || new Date().toISOString(),
          });
        }
      } catch {
        // Not JSON
      }
    }

    return NextResponse.json({
      success: true,
      headline: DEFAULT_HEADLINE,
      updated_at: new Date().toISOString(),
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

    let saved = false;

    // 1. Try upserting into system_settings
    try {
      const { error: upsertErr } = await supabase.from('system_settings').upsert({
        key: 'noticeboard_headline',
        value: trimmedHeadline,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });

      if (!upsertErr) {
        saved = true;
      }
    } catch {
      // Fallback
    }

    // 2. Seamless fallback into reward_rules if system_settings is not present in schema
    if (!saved) {
      const jsonPayload = JSON.stringify({
        type: 'noticeboard',
        key: 'noticeboard_headline',
        text: trimmedHeadline,
      });

      const { data: existing } = await supabase
        .from('reward_rules')
        .select('id')
        .like('name', '%noticeboard_headline%')
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase
          .from('reward_rules')
          .update({
            name: jsonPayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('reward_rules').insert({
          name: jsonPayload,
          rule_type: 'fixed_per_order',
          value: 0,
          is_active: false,
        });

        if (insertErr) throw insertErr;
      }
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
