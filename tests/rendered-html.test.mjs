import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: path === "/release" ? "application/json" : "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Gestão PD application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Gestão PD<\/title>/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("keeps shared domain concerns outside the page component", async () => {
  const [page, types, constants, utils, calendar, installPrompt, ui] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/domain/types.ts", root), "utf8"),
    readFile(new URL("app/domain/constants.ts", root), "utf8"),
    readFile(new URL("app/domain/utils.ts", root), "utf8"),
    readFile(new URL("app/domain/calendar.ts", root), "utf8"),
    readFile(new URL("app/components/InstallAppPrompt.tsx", root), "utf8"),
    readFile(new URL("app/components/ui.tsx", root), "utf8"),
  ]);
  assert.match(page, /from "\.\/domain\/types"/);
  assert.match(page, /from "\.\/domain\/constants"/);
  assert.match(page, /from "\.\/domain\/utils"/);
  assert.match(page, /from "\.\/components\/InstallAppPrompt"/);
  assert.doesNotMatch(page, /^type Profile\s*=/m);
  assert.doesNotMatch(page, /^const PERSON_TYPES\s*=/m);
  assert.doesNotMatch(page, /^function InstallAppPrompt\s*\(/m);
  assert.match(types, /export type Profile/);
  assert.match(constants, /export const PERSON_TYPES/);
  assert.match(constants, /WEB_INACTIVITY_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(utils, /export const scheduleAppliesOn/);
  assert.match(utils, /export const isHolidayOn/);
  assert.match(utils, /schedule\.starts_on <= date/);
  assert.doesNotMatch(utils, /starts_on\.slice/);
  assert.match(page, /replace_schedule_from_date/);
  assert.match(page, /p_effective_on: localIsoDate\(\)/);
  assert.match(calendar, /export function chooseCalendarPerson/);
  assert.match(page, /chooseCalendarPerson\(/);
  assert.match(page, /Mês atual/);
  assert.match(page, /Próximo mês/);
  assert.match(page, /managerMonthOffset === 0 && <TodayOperations/);
  assert.match(page, /Recepção: \$\{receptionName\}/);
  assert.match(page, /receptionAbsent \? " \(falta\)"/);
  assert.match(page, /fixedReceptionAbsentNames/);
  assert.match(page, /new Set\(\[\.\.\.teamAbsentNames, \.\.\.fixedReceptionAbsentNames\]\)/);
  assert.match(page, /\.eq\("assignment_type_id", ASSIGNMENT_TYPES\.reception\)/);
  assert.match(page, /const present = presentNames\.length/);
  assert.match(page, /className="overview-day holiday-day"/);
  assert.match(page, /if \(isHolidayOn\(date, operationExceptions\)\) return \{ date, scheduled: 0, present: 0 \}/);
  assert.match(page, /const operationalDays = days\.filter\(date => !isHolidayOn/);
  assert.match(page, /holiday \? "FERIADO"/);
  assert.match(page, /if \(isHolidayOn\(date, operationExceptions\)\) return false/);
  assert.match(page, /holiday && role !== "gestor"/);
  assert.match(page, /isHolidayOn\(date, operationExceptions\)\) return Boolean\(override\)/);
  assert.match(installPrompt, /if \(!isMobileSession\(\)\) return/);
  assert.match(ui, /export function Table/);
});

test("exposes a non-cacheable release identifier", async () => {
  const response = await render("/release");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
  const body = await response.json();
  assert.equal(typeof body.release, "string");
  assert.ok(body.release.length > 0);
});
