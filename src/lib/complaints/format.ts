// Durations are integers (hours), never floats. Format at render time only.
export function formatHours(hours: number): string {
  const wholeHours = Math.max(0, Math.floor(hours));
  const days = Math.floor(wholeHours / 24);
  const remainder = wholeHours % 24;
  return days === 0 ? `${remainder}h` : `${days}d ${remainder}h`;
}
