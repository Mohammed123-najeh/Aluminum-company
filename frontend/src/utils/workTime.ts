export function formatWorkDuration(totalMinutes: number, extraSeconds = 0): string {
  const seconds = Math.max(0, (totalMinutes * 60) + extraSeconds);
  const roundedMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}

export function formatAmPm(value: string | number | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
