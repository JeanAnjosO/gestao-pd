import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-bootstrap-secret, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const makePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, byte => chars[byte % chars.length]).join("");
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const action = body.action ?? "create";
  if (action === "complete_first_access") {
    const { data: person, error } = await admin.from("people")
      .update({ must_change_password: false })
      .eq("auth_user_id", authData.user.id)
      .select("id")
      .single();
    if (error || !person) return json({ error: error?.message ?? "profile_not_found" }, 400);
    return json({ completed: true });
  }
  const { data: manager } = await admin.from("people").select("id,access_role_type_id,active").eq("auth_user_id", authData.user.id).single();
  if (!manager || manager.access_role_type_id !== 1 || !manager.active) return json({ error: "forbidden" }, 403);
  const { data: person } = await admin.from("people").select("id,name,username,auth_user_id,active").eq("id", Number(body.person_id)).single();
  if (!person) return json({ error: "person_not_found" }, 404);
  const password = makePassword();
  if (action === "reset" && person.auth_user_id) {
    const { error } = await admin.auth.admin.updateUserById(person.auth_user_id, { password });
    if (error) return json({ error: error.message, person: person.username }, 400);
  } else {
    if (person.auth_user_id) return json({ error: "access_already_exists", person: person.username }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email: `${person.username}@pd-buritis.local`, password, email_confirm: true });
    if (error || !data.user) return json({ error: error?.message ?? "create_failed", person: person.username }, 400);
    const { error: linkError } = await admin.from("people").update({ auth_user_id: data.user.id, must_change_password: true }).eq("id", person.id);
    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: linkError.message, person: person.username }, 400);
    }
  }
  await admin.from("people").update({ must_change_password: true }).eq("id", person.id);
  return json({ credentials: [{ person_id: person.id, name: person.name, username: person.username, temporary_password: password }] });
});
