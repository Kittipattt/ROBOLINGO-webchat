/**
 * Utility formatters for UI timestamps and display strings
 */

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
}
