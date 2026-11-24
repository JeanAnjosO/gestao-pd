import assert from "node:assert/strict";
import test from "node:test";
import { isRecessOn, isCalendarRecessOn, calendarClosureLabel } from "../app/domain/recess.ts";

test("recess keeps the full interval blocked while calendar labels skip both weekend days", () => {
 const recess=[{date:"2026-12-22",return_on:"2027-01-04"}];
 for (const date of ["2026-12-26","2026-12-27","2027-01-02","2027-01-03"]) { assert.equal(isRecessOn(date,recess),true); assert.equal(isCalendarRecessOn(date,recess),false); }
 for (const date of ["2026-12-23","2026-12-24","2026-12-25","2026-12-28","2026-12-31","2027-01-01"]) { assert.equal(isCalendarRecessOn(date,recess),true); assert.equal(calendarClosureLabel(date,recess),"Recesso"); }
 assert.equal(isCalendarRecessOn("2026-12-22",recess),false);
 assert.equal(isCalendarRecessOn("2027-01-04",recess),false);
 assert.equal(calendarClosureLabel("2026-12-21",recess),"Feriado");
});
