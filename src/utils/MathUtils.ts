/**
 * Returns a deterministic integer seed for today's UTC date.
 * Changes at midnight UTC — same value for all players on the same day.
 * e.g. 2026-03-04 → 20260304
 */
export function getDailySeed(): number {
  const now = new Date();
  return now.getUTCFullYear() * 10000
       + (now.getUTCMonth() + 1) * 100
       + now.getUTCDate();
}

/**
 * Returns a human-readable string for time remaining until the next UTC midnight.
 * Zero-valued parts are omitted. e.g. "5 hr, 3 min" or "45 min" or "30 sec"
 */
export function formatTimeUntilMidnightUTC(): string {
  const now     = new Date();
  const nextMid = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const totalSec = Math.max(0, Math.floor((nextMid.getTime() - now.getTime()) / 1000));

  const hr  = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);

  const parts: string[] = [];
  if (hr  > 0) parts.push(`${hr} hr`);
  if (min > 0) parts.push(`${min} min`);
  return parts.join(', ') || '< 1 min';
}

/**
 * Formats a duration in milliseconds as a race time string.
 * e.g. 83_400 ms → "1:23.4"
 */
export function formatRaceTime(ms: number): string {
  const totalTenths = Math.floor(ms / 100);
  const tenths      = totalTenths % 10;
  const secs        = Math.floor(totalTenths / 10) % 60;
  const mins        = Math.floor(totalTenths / 600);
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
}
