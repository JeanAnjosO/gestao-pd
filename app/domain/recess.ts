export const isRecessOn = (date: string, exceptions: { date: string; return_on?: string }[]) =>
  exceptions.some(item => Boolean(item.return_on && item.date < date && date < item.return_on));

// Keep the full interval blocked, but only mark teaching weekdays in calendars.
export const isCalendarRecessOn = (date: string, exceptions: { date: string; return_on?: string }[]) => {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return weekday > 0 && weekday < 6 && isRecessOn(date, exceptions);
};
export const calendarClosureLabel = (date: string, exceptions: { date: string; return_on?: string }[]) =>
  isCalendarRecessOn(date, exceptions) ? "Recesso" : "Feriado";
