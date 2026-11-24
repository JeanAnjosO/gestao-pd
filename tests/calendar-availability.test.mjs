import assert from "node:assert/strict";
import test from "node:test";
import { calendarPeopleForDate } from "../app/domain/calendar-availability.ts";

const person = (id, active = true) => ({ id, active, person_type_id: 2 });
const schedule = (person_id, weekday, starts_on = "2026-01-01", ends_on = null) => ({ person_id, weekday, starts_on, ends_on });
const setup = (changes = {}) => ({ people: [person(1), person(2)], schedules: [], absences: [], managerDays: [], substitutions: [], ...changes });
const ids = (date, data) => calendarPeopleForDate({ date, ...data }).map(person => person.id);

test("substitution adds only the exact date, not the same weekday next week", () => {
  const data = setup({ substitutions: [{ date: "2026-11-24", substitute_person_id: 1 }] });
  assert.deepEqual(ids("2026-11-23", data), []);
  assert.deepEqual(ids("2026-11-24", data), [1]);
  assert.deepEqual(ids("2026-11-25", data), []);
  assert.deepEqual(ids("2026-12-01", data), []);
});

test("substitute retains regular workdays and schedule validity boundaries", () => {
  const data = setup({ schedules: [schedule(1, 1, "2026-11-23", "2026-11-30")], substitutions: [{ date: "2026-11-24", substitute_person_id: 1 }] });
  assert.deepEqual(ids("2026-11-16", data), []);
  assert.deepEqual(ids("2026-11-23", data), [1]);
  assert.deepEqual(ids("2026-11-24", data), [1]);
  assert.deepEqual(ids("2026-11-30", data), [1]);
  assert.deepEqual(ids("2026-12-07", data), []);
});

test("duplicate substitutions and overlapping regular days produce one option", () => {
  const data = setup({ schedules: [schedule(1, 2)], substitutions: [
    { date: "2026-11-24", substitute_person_id: 1 }, { date: "2026-11-24", substitute_person_id: 1 },
  ] });
  const before = structuredClone(data);
  assert.deepEqual(ids("2026-11-24", data), [1]);
  assert.deepEqual(data, before);
  assert.deepEqual(ids("2026-11-24", { ...data, substitutions: [] }), [1]);
  assert.deepEqual(ids("2026-11-24", { ...data, substitutions: [], schedules: [] }), []);
});

test("absences and inactive profiles still exclude a substitute", () => {
  const data = setup({ people: [person(1), person(2, false)], absences: [{ date: "2026-11-24", person_id: 1 }], substitutions: [
    { date: "2026-11-24", substitute_person_id: 1 }, { date: "2026-11-24", substitute_person_id: 2 },
  ] });
  assert.deepEqual(ids("2026-11-24", data), []);
});

test("external names and people without registration are not candidates", () => {
  const data = setup({ substitutions: [
    { date: "2026-11-24", substitute_person_id: null, external_name: "Externo" },
    { date: "2026-11-24", substitute_person_id: 99 },
  ], managerDays: [{ date: "2026-11-24", manager_id: 2 }] });
  assert.deepEqual(ids("2026-11-24", data), [2]);
  assert.deepEqual(ids("2026-11-25", data), []);
});
