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
