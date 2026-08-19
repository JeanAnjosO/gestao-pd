import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const genericMessage = "Se o usuário estiver cadastrado, a gestão receberá a solicitação. Entre em contato com o administrador para receber a nova senha.";

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ message: genericMessage }, 200);
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase().slice(0, 80);
  if (!/^[a-z0-9._-]{2,80}$/.test(username)) return json({ message: genericMessage });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: person } = await admin.from("people").select("id,username,active,auth_user_id").eq("username", username).maybeSingle();
  if (!person?.active || !person.auth_user_id) return json({ message: genericMessage });

  const { data: pending } = await admin.from("password_recovery_requests").select("id,requested_at").eq("person_id", person.id).eq("status", "pending").maybeSingle();
  const now = Date.now();
  if (!pending) {
    await admin.from("password_recovery_requests").insert({ person_id: person.id, username_snapshot: person.username });
  } else if (now - new Date(pending.requested_at).getTime() >= 5 * 60 * 1000) {
    await admin.from("password_recovery_requests").update({ requested_at: new Date(now).toISOString(), expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString() }).eq("id", pending.id);
  }
  return json({ message: genericMessage });
});

