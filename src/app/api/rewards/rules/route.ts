import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: rules, error } = await supabase
      .from('reward_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ rules });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, rule_type, value, is_active } = body;

    const supabase = createAdminClient();

    // If making this rule active, deactivate all others so there is 1 primary active rule
    if (is_active) {
      await supabase.from('reward_rules').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { data: newRule, error } = await supabase
      .from('reward_rules')
      .insert({
        name,
        rule_type,
        value: parseFloat(value),
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, rule: newRule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_active, value, name } = body;

    const supabase = createAdminClient();

    if (is_active) {
      await supabase.from('reward_rules').update({ is_active: false }).neq('id', id);
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (is_active !== undefined) updateData.is_active = is_active;
    if (value !== undefined) updateData.value = parseFloat(value);
    if (name !== undefined) updateData.name = name;

    const { data: updatedRule, error } = await supabase
      .from('reward_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, rule: updatedRule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
