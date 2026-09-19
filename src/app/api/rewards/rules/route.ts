import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseQuotaTier,
  encodeQuotaTierPayload,
  DEFAULT_WEBSITE_QUOTA_TIERS,
  DEFAULT_NON_WEBSITE_SALES_TIERS,
} from '@/lib/commission';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: rawRules, error } = await supabase
      .from('reward_rules')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    let rules = rawRules || [];

    // Check if website quota tiers exist
    const hasWebsiteTiers = rules.some((r) => {
      const parsed = parseQuotaTier(r);
      return parsed.source === 'website';
    });

    // Check if non-website daily sales tiers exist
    const hasOtherTiers = rules.some((r) => {
      const parsed = parseQuotaTier(r);
      return parsed.source !== 'website';
    });

    const newInserts: any[] = [];

    if (!hasWebsiteTiers) {
      DEFAULT_WEBSITE_QUOTA_TIERS.forEach((tier) => {
        newInserts.push(
          encodeQuotaTierPayload({
            name: tier.name,
            min_quota: tier.min_quota,
            bonus: tier.bonus,
            source: 'website',
            is_active: true,
          })
        );
      });
    }

    if (!hasOtherTiers) {
      DEFAULT_NON_WEBSITE_SALES_TIERS.forEach((tier) => {
        newInserts.push(
          encodeQuotaTierPayload({
            name: tier.name,
            min_quota: tier.min_quota,
            bonus: tier.bonus,
            source: 'other',
            is_active: true,
          })
        );
      });
    }

    if (newInserts.length > 0) {
      const { data: seeded } = await supabase
        .from('reward_rules')
        .insert(newInserts)
        .select('*');
      if (seeded) {
        rules = [...rules, ...seeded];
      }
    }

    // Parse and sort by min_quota ascending for clean progression display
    const parsedTiers = rules
      .map(parseQuotaTier)
      .sort((a, b) => a.min_quota - b.min_quota);

    return NextResponse.json({ success: true, rules: parsedTiers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, min_quota, bonus, source, is_active } = body;

    const quotaNum = parseFloat(min_quota);
    const bonusNum = parseFloat(bonus);

    if (isNaN(quotaNum) || quotaNum <= 0) {
      return NextResponse.json(
        { error: 'Please provide a valid positive Minimum Sales Target value.' },
        { status: 400 }
      );
    }
    if (isNaN(bonusNum) || bonusNum <= 0) {
      return NextResponse.json(
        { error: 'Please provide a valid positive Commission Bonus amount.' },
        { status: 400 }
      );
    }

    const tierSource = source === 'website' ? 'website' : 'other';
    const supabase = createAdminClient();
    const payload = encodeQuotaTierPayload({
      name: name || `Tier (৳${quotaNum.toLocaleString()}+)`,
      min_quota: quotaNum,
      bonus: bonusNum,
      source: tierSource,
      is_active: is_active ?? true,
    });

    const { data: newRule, error } = await supabase
      .from('reward_rules')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      rule: parseQuotaTier(newRule),
      message: 'Commission Tier created successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, min_quota, bonus, source, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch existing rule
    const { data: existing, error: fetchErr } = await supabase
      .from('reward_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const currentTier = parseQuotaTier(existing);
    const updatedQuota = min_quota !== undefined ? parseFloat(min_quota) : currentTier.min_quota;
    const updatedBonus = bonus !== undefined ? parseFloat(bonus) : currentTier.bonus;
    const updatedName = name !== undefined ? name : currentTier.name;
    const updatedActive = is_active !== undefined ? Boolean(is_active) : currentTier.is_active;
    const updatedSource = source !== undefined ? (source === 'website' ? 'website' : 'other') : currentTier.source;

    const payload = encodeQuotaTierPayload({
      name: updatedName,
      min_quota: updatedQuota,
      bonus: updatedBonus,
      source: updatedSource,
      is_active: updatedActive,
    });

    const { data: updatedRule, error } = await supabase
      .from('reward_rules')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      rule: parseQuotaTier(updatedRule),
      message: 'Commission Tier updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('reward_rules').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Commission Quota Tier deleted successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
