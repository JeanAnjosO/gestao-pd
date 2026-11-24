import test from "node:test";
import assert from "node:assert/strict";
import { studentMonthDays, studentDayContent } from "../app/domain/student-calendar.ts";

test("includes every day, weekends and leap days", () => {
  assert.equal(studentMonthDays(2026, 9).length, 31);
  assert.equal(studentMonthDays(2026, 9)[2], "2026-10-03");
  assert.equal(studentMonthDays(2026, 9).at(-1), "2026-10-31");
  assert.equal(studentMonthDays(2028, 1).at(-1), "2028-02-29");
  assert.equal(studentMonthDays(2026, 1).length, 28);
});

test("student edits and hidden notes preserve the original planning", () => {
  const planning = [{ date: "2026-10-03", note: "Segunda chamada" }];
  const before = structuredClone(planning);
  assert.equal(studentDayContent("2026-10-03", planning, [], []).note, "Segunda chamada");
  assert.deepEqual(studentDayContent("2026-10-03", planning, [{ date: "2026-10-03", note: "Workshop às 15h", category: "workshop" }], []), { note: "Workshop às 15h", category: "workshop", custom: true });
  assert.equal(studentDayContent("2026-10-03", planning, [{ date: "2026-10-03", note: "", category: "event" }], []).note, "");
  assert.deepEqual(planning, before);
  assert.equal(studentDayContent("2026-10-03", planning, [], []).custom, false);
});

test("holidays include planning notes and allow separate student announcements", () => {
  const holidays = [{ date: "2026-10-12", open: false, label: "Feriado" }];
  const planning = [{ date: "2026-10-12", note: "Sem aula" }];
  assert.deepEqual(studentDayContent("2026-10-12", planning, [], holidays), { note: "Feriado · Sem aula", category: "holiday", custom: false });
  assert.equal(studentDayContent("2026-10-12", planning, [{ date: "2026-10-12", note: "Baile especial", category: "event" }], holidays).note, "Baile especial");
  assert.equal(studentDayContent("2026-10-13", planning, [], holidays).note, "");
});

test("recess spans the new year without blocking either boundary", () => {
  const recess = [{ date: "2026-12-19", return_on: "2027-01-05", open: false, label: "RECESSO" }];
  assert.equal(studentDayContent("2026-12-19", [], [], recess).note, "");
  assert.equal(studentDayContent("2027-01-05", [], [], recess).note, "");
  assert.equal(studentDayContent("2026-12-20", [], [], recess).note, "");
  assert.deepEqual(studentDayContent("2027-01-04", [], [{ date: "2027-01-04", note: "Old note", category: "notice" }], recess), {
    note: "RECESSO", category: "holiday", custom: false,
  });
});

test("recess marks weekdays only in student calendars, preserving weekend notes", () => {
 const recess = [{date:"2026-12-22",return_on:"2027-01-04",open:false,label:"RECESSO"}];
 for (const date of ["2026-12-26","2026-12-27","2027-01-02","2027-01-03"]) assert.equal(studentDayContent(date, [], [], recess).note, "");
 for (const date of ["2026-12-23","2026-12-25","2026-12-31","2027-01-01"]) assert.equal(studentDayContent(date, [], [], recess).note, "RECESSO");
 assert.equal(studentDayContent("2026-12-27", [], [{date:"2026-12-27",note:"Aviso aos alunos",category:"notice"}], recess).note, "Aviso aos alunos");
});
