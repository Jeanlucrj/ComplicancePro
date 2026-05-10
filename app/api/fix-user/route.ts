import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const email = 'jean.cruz@redsun.com.br';
    const password = 'Beauty123!Password';

    // Check if user exists
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) return NextResponse.json({ error: 'List Error', details: listError });

    const user = users.users.find((u) => u.email === email);

    if (user) {
      // Update password
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: password,
        email_confirm: true
      });
      if (error) return NextResponse.json({ error: 'Update Error', details: error });
      return NextResponse.json({ success: true, message: 'User updated successfully', data });
    } else {
      // Create user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });
      if (error) return NextResponse.json({ error: 'Create Error', details: error });
      return NextResponse.json({ success: true, message: 'User created successfully', data });
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Exception', message: err.message });
  }
}
