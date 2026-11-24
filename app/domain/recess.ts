export const isRecessOn = (date: string, exceptions: { date: string; return_on?: string }[]) =>
  exceptions.some(item => Boolean(item.return_on && item.date < date && date < item.return_on));
