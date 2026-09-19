import { SupabaseClient } from '@supabase/supabase-js';
import { RewardRule } from '@/types/database';

export interface QuotaTier {
  id: string;
  name: string;
  min_quota: number; // Extra Sales Added required (e.g. 3000)
  bonus: number;     // Bonus reward earned (e.g. 100)
  effective_pct: number; // Effective Bonus percentage (e.g. 3.3%)
  source: string;    // 'website'
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Default 7 Tiers from Image 2
export const DEFAULT_WEBSITE_QUOTA_TIERS = [
  { name: 'Tier 1', min_quota: 3000, bonus: 100 },
  { name: 'Tier 2', min_quota: 4000, bonus: 250 },
  { name: 'Tier 3', min_quota: 6000, bonus: 500 },
  { name: 'Tier 4', min_quota: 8000, bonus: 800 },
  { name: 'Tier 5', min_quota: 12000, bonus: 1200 },
  { name: 'Tier 6', min_quota: 16000, bonus: 1800 },
  { name: 'Tier 7', min_quota: 24000, bonus: 3000 },
];

/**
 * Parses a raw database RewardRule row into a typed QuotaTier.
 */
export function parseQuotaTier(rule: RewardRule | any): QuotaTier {
  let min_quota = 0;
  let title = rule.name || 'Quota Tier';
  let source = 'website';

  try {
    if (typeof rule.name === 'string' && rule.name.startsWith('{')) {
      const parsed = JSON.parse(rule.name);
      min_quota = Number(parsed.min_quota || parsed.min || 0);
      title = parsed.name || parsed.title || 'Quota Tier';
      source = parsed.source || 'website';
    } else if (typeof rule.name === 'string') {
      // Check if name contains a number
      const match = rule.name.match(/\d[\d,]*/);
      if (match) {
        min_quota = Number(match[0].replace(/,/g, ''));
      }
    }
  } catch {
    title = rule.name;
  }

  // If min_quota is 0 but we have a matching default by value or title
  if (min_quota === 0) {
    const matchedDefault = DEFAULT_WEBSITE_QUOTA_TIERS.find(
      (d) => d.bonus === Number(rule.value) || d.name === rule.name
    );
    if (matchedDefault) {
      min_quota = matchedDefault.min_quota;
      title = matchedDefault.name;
    }
  }

  const bonus = Number(rule.value || 0);
  const effective_pct =
    min_quota > 0 ? parseFloat(((bonus / min_quota) * 100).toFixed(2)) : 0;

  return {
    id: rule.id,
    name: title,
    min_quota,
    bonus,
    effective_pct,
    source,
    is_active: Boolean(rule.is_active),
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  };
}

/**
 * Encodes a QuotaTier payload into the database RewardRule fields.
 */
export function encodeQuotaTierPayload(tier: {
  name: string;
  min_quota: number;
  bonus: number;
  source?: string;
  is_active?: boolean;
}) {
  const jsonName = JSON.stringify({
    name: tier.name || `৳${tier.min_quota.toLocaleString()}+ Quota`,
    min_quota: Number(tier.min_quota) || 0,
    source: tier.source || 'website',
  });

  return {
    name: jsonName,
    rule_type: 'fixed_per_order' as const, // standard enum value
    value: Number(tier.bonus) || 0,
    is_active: tier.is_active ?? true,
  };
}

/**
 * Synchronizes and recalculates daily website upsell quota rewards for a staff member.
 * Only applies to Website Orders (`source === 'website'`).
 * Resets each day (12:00 AM).
 */
export async function syncWebsiteUpsellQuotaRewards(
  supabase: SupabaseClient,
  staffId: string,
  triggerOrderId?: string
) {
  if (!staffId) return null;

  try {
    // 1. Fetch active quota tiers sorted descending
    const { data: rawRules } = await supabase
      .from('reward_rules')
      .select('*')
      .eq('is_active', true);

    const tiers = (rawRules || [])
      .map(parseQuotaTier)
      .filter((t) => t.is_active && t.min_quota > 0 && t.bonus > 0)
      .sort((a, b) => b.min_quota - a.min_quota);

    if (tiers.length === 0) {
      return null;
    }

    // 2. Fetch all qualifying website orders for this staff member created today
    const today = new Date().toISOString().split('T')[0];
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, source, sales_rep_id, status, created_at, order_items(price, quantity, is_upsell)')
      .eq('source', 'website')
      .eq('sales_rep_id', staffId)
      .neq('status', 'canceled')
      .gte('created_at', today + 'T00:00:00.000Z');

    if (ordersErr) {
      console.error('Failed to fetch website orders for quota calculation:', ordersErr);
      return null;
    }

    // 3. Compute cumulative website upsell sales added today
    let totalWebsiteUpsellsToday = 0;
    let mostRecentWebsiteOrderId = triggerOrderId;

    (orders || []).forEach((order: any) => {
      if (!mostRecentWebsiteOrderId) {
        mostRecentWebsiteOrderId = order.id;
      }
      (order.order_items || []).forEach((item: any) => {
        if (item.is_upsell) {
          totalWebsiteUpsellsToday +=
            (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }
      });
    });

    // 4. Determine highest reached milestone tier
    const reachedTier = tiers.find((t) => totalWebsiteUpsellsToday >= t.min_quota);
    const targetBonus = reachedTier ? reachedTier.bonus : 0;

    // 5. Fetch existing quota rewards for this staff member today (pending status)
    const { data: existingRewards } = await supabase
      .from('upsell_rewards')
      .select('*')
      .eq('sales_rep_id', staffId)
      .gte('created_at', today + 'T00:00:00.000Z')
      .like('note', 'Website Upsell Quota%')
      .neq('status', 'paid');

    const currentAwardedBonus = (existingRewards || []).reduce(
      (sum, r) => sum + Number(r.bonus_amount || 0),
      0
    );

    // 6. Update ledger if milestone tier changed
    if (targetBonus > currentAwardedBonus && mostRecentWebsiteOrderId) {
      const deltaBonus = targetBonus - currentAwardedBonus;
      await supabase.from('upsell_rewards').insert({
        sales_rep_id: staffId,
        order_id: mostRecentWebsiteOrderId,
        bonus_amount: deltaBonus,
        status: 'pending',
        note: `Website Upsell Quota: Reached ৳${reachedTier?.min_quota.toLocaleString()}+ tier (Total: ৳${targetBonus} BDT bonus)`,
      });
    }

    return {
      totalWebsiteUpsellsToday,
      reachedTier,
      targetBonus,
      nextTier: [...tiers].reverse().find((t) => t.min_quota > totalWebsiteUpsellsToday) || null,
    };
  } catch (err) {
    console.error('Error in syncWebsiteUpsellQuotaRewards:', err);
    return null;
  }
}
