import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);
  const { data: manager } = await admin.from("people").select("id,access_role_type_id,active").eq("auth_user_id", authData.user.id).single();
  if (!manager || manager.access_role_type_id !== 1 || !manager.active) return json({ error: "forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  if (body.action !== "create") return json({ error: "invalid_action" }, 400);
  const name = String(body.name ?? "").trim();
  const minimumTeachers = Math.min(20, Math.max(1, Number(body.minimum_teachers) || 4));
  const calendarModeTypeId = Number(body.calendar_mode_type_id) === 2 ? 2 : 1;
  if (name.length < 2) return json({ error: "invalid_name" }, 400);
  const { data: unit, error } = await admin.from("units").insert({ name, minimum_teachers: minimumTeachers, calendar_mode_type_id: calendarModeTypeId, active: true }).select("id,name,minimum_teachers,calendar_mode_type_id,active").single();
  if (error || !unit) return json({ error: error?.message ?? "create_failed" }, 400);
  const { error: membershipError } = await admin.from("unit_memberships").insert({ unit_id: unit.id, person_id: manager.id });
  if (membershipError) { await admin.from("units").delete().eq("id", unit.id); return json({ error: membershipError.message }, 400); }
  await admin.from("unit_open_days").insert(Array.from({ length: 7 }, (_, weekday) => ({ unit_id: unit.id, weekday, open: weekday >= 1 && weekday <= 5 })));
  await admin.from("classes").insert([
    { unit_id: unit.id, name: "Branca", allowed_for_half_day: true, active: true },
    { unit_id: unit.id, name: "Azul BB", allowed_for_half_day: true, active: true },
    { unit_id: unit.id, name: "Azul Int", allowed_for_half_day: true, active: true },
    { unit_id: unit.id, name: "Azul Av", allowed_for_half_day: true, active: true },
    { unit_id: unit.id, name: "Preta", allowed_for_half_day: false, active: true },
    { unit_id: unit.id, name: "Preta Av", allowed_for_half_day: false, active: true },
  ]);
  return json({ unit });
});
