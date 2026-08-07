import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the Supabase
// Edge Functions runtime — never set these manually, never put them in the
// frontend .env. This is the ONLY place in this project the service_role key
// should ever be used.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
    // verifying who is calling, and performing the privileged invite + profile insert.
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
      return json({ error: 'Only admins can invite staff' }, 403);
    }

    const { email, fullName, role } = await req.json();

    if (!email || !role || !['admin', 'staff'].includes(role)) {
      return json({ error: 'A valid email and role (admin/staff) are required' }, 400);
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      return json({ error: inviteError.message }, 400);
    }

    // upsert, not insert: the on_auth_user_created trigger already created a
    // default 'staff' row for this user the moment inviteUserByEmail() ran.
    // This call overwrites it with the name/role the admin actually chose.
    const { error: upsertError } = await adminClient.from('profiles').upsert({
      id: invited.user.id,
      full_name: fullName ?? null,
      email,
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
