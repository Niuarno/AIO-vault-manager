import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseQuotaTier,
  encodeQuotaTierPayload,
  DEFAULT_WEBSITE_QUOTA_TIERS,
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

    // Check if any quota tier exists
    const hasQuotaTiers = rules.some(
      (r) =>
        (typeof r.name === 'string' && r.name.startsWith('{')) ||
        DEFAULT_WEBSITE_QUOTA_TIERS.some((d) => d.bonus === Number(r.value))
    );

    // If only old legacy rules exist or table is empty, auto-seed the 7 tiers from Image 2
    if (!hasQuotaTiers || rules.length === 0) {
      // Remove old legacy sample rules
      await supabase.from('reward_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const toInsert = DEFAULT_WEBSITE_QUOTA_TIERS.map((tier) =>
        encodeQuotaTierPayload({
          name: tier.name,
          min_quota: tier.min_quota,
          bonus: tier.bonus,
          source: 'website',
          is_active: true,
        })
      );

      const { data: seeded, error: seedErr } = await supabase
        .from('reward_rules')
        .insert(toInsert)
        .select('*');

      if (!seedErr && seeded) {
        rules = seeded;
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
    const { name, min_quota, bonus, is_active } = body;

    const quotaNum = parseFloat(min_quota);
    const bonusNum = parseFloat(bonus);

    if (isNaN(quotaNum) || quotaNum <= 0) {
      return NextResponse.json(
        { error: 'Please provide a valid positive Minimum Extra Sales (Quota) value.' },
        { status: 400 }
      );
    }
    if (isNaN(bonusNum) || bonusNum <= 0) {
      return NextResponse.json(
        { error: 'Please provide a valid positive Commission Bonus amount.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const payload = encodeQuotaTierPayload({
      name: name || `Tier (৳${quotaNum.toLocaleString()}+)`,
      min_quota: quotaNum,
      bonus: bonusNum,
      source: 'website',
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
      message: 'Website Commission Quota Tier created successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, min_quota, bonus, is_active } = body;

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

    const payload = encodeQuotaTierPayload({
      name: updatedName,
      min_quota: updatedQuota,
      bonus: updatedBonus,
      source: 'website',
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
      message: 'Website Commission Quota Tier updated successfully.',
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
