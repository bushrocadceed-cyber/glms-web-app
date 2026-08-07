import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the Supabase
// Edge Functions runtime — never set these manually, never put them in the
// frontend .env. This is one of only two places in this project the
// service_role key should ever be used (the other is invite-staff).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const VALID_ROLES = ['admin', 'librarian', 'staff'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const callerToken = authHeader.replace('Bearer ', '');

    // Service-role client — bypasses RLS. Used for two things only:
    // verifying who is calling, and performing the privileged account creation.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);

    if (callerError || !callerUser) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Only admins can create staff accounts' }, 403);
    }

    const { fullName, email, password, role, phone } = await req.json();

    if (!fullName || !email || !password || !role) {
      return json({ error: 'Full name, email, password, and role are required' }, 400);
    }

    if (!VALID_ROLES.includes(role)) {
      return json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` }, 400);
    }

    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    // Creates the account with the password set directly — unlike
    // inviteUserByEmail, no invite email is sent, and the new user can log
    // in immediately with the password the admin chose.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return json({ error: createError.message }, 400);
    }

    // upsert, not insert: the on_auth_user_created trigger already created a
    // default 'staff' row for this user the moment createUser() ran.
    const { error: upsertError } = await adminClient.from('profiles').upsert({
      id: created.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      role,
    });

    if (upsertError) {
      return json({ error: upsertError.message }, 400);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
