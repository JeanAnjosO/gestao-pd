import type { PersonRow, ScheduleRow, AbsenceRow, ManagerDayRow, SubstitutionRow } from "./types";

type AvailabilityInput = {
  date: string;
  people: PersonRow[];
  schedules: ScheduleRow[];
  absences: AbsenceRow[];
  managerDays: ManagerDayRow[];
  substitutions: SubstitutionRow[];
};

// Substitutions add availability only for their exact date, preserving regular schedules.
export function calendarPeopleForDate({ date, people, schedules, absences, managerDays, substitutions }: AvailabilityInput) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const absent = new Set(absences.filter(item => item.date === date).map(item => item.person_id));
  const present = new Set([
    ...schedules.filter(item => item.weekday === weekday && item.starts_on <= date && (!item.ends_on || item.ends_on >= date)).map(item => item.person_id),
    ...managerDays.filter(item => item.date === date).map(item => item.manager_id),
    ...substitutions.filter(item => item.date === date && item.substitute_person_id !== null).map(item => item.substitute_person_id!),
  ]);
  return people.filter(person => person.active && !absent.has(person.id) && present.has(person.id));
}
