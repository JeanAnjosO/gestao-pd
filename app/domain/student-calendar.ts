import { isRecessOn } from "./recess.ts";

export type StudentCalendarCategory = "event" | "workshop" | "holiday" | "simulation" | "notice";
export type StudentCalendarNote = { date: string; note: string; category: StudentCalendarCategory };

export function studentMonthDays(year: number, month: number) {
  return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
}

export function studentDayContent(date: string, planning: { date: string; note: string }[], overrides: StudentCalendarNote[], holidays: { date: string; open: boolean; label?: string | null; return_on?: string }[]) {
  if (isRecessOn(date, holidays)) return { note: "RECESSO", category: "holiday" as const, custom: false };
  const custom = overrides.find(item => item.date === date);
  if (custom) return { note: custom.note, category: custom.category, custom: true };

  const holiday = holidays.find(item => !item.return_on && item.date === date && !item.open);
  const note = planning.find(item => item.date === date)?.note ?? "";
  return { note: holiday ? [holiday.label || "FERIADO", note].filter(Boolean).join(" · ") : note, category: holiday ? "holiday" as const : "event" as const, custom: false };
}
