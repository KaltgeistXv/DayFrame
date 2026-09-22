// The server serializes this date into the client component props. Both first
// renders must use that snapshot, even when their clocks/timezones differ.
export function serverCalendarDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function dateHeading(date: string) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日星期${'日一二三四五六'[weekday]}`;
}

// Display only: keep ISO values unchanged for storage, comparisons and callbacks.
export function displayDate(date: string) {
  return date.replace(/-/g, '/');
}
