import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, role } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Create user using Supabase Admin API with email_confirm: true
    // This bypasses email verification and SMTP rate limits completely!
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName?.trim() || '',
        role: role || 'sales',
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Ensure profile row exists or is updated
    if (data?.user) {
      await supabaseAdmin.from('profiles').upsert(
        {
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName?.trim() || '',
          role: role || 'sales',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (err: any) {
    console.error('❌ [Auth Register Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create user account' },
      { status: 500 }
    );
  }
}
