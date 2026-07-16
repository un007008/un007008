/**
 * Timezone helpers. The server runs in UTC but all business times are
 * Asia/Bangkok — naive Date parsing/formatting shifts everything by 7 hours.
 */

const BKK = "Asia/Bangkok";

/**
 * Parse a zone-less string from <input type="datetime-local"> or
 * <input type="date"> as Bangkok wall-clock time. Strings that already
 * carry zone info are parsed as-is.
 */
export function parseAsBangkok(input: string): Date {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(input)) return new Date(input);
  const withTime = input.includes("T") ? input : `${input}T00:00`;
  return new Date(`${withTime}+07:00`);
}

/** "YYYY-MM-DD" of the given instant in Bangkok. */
export function bangkokDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BKK }).format(d);
}

/** Start of the current month, Bangkok time, as a UTC instant. */
export function bangkokMonthStart(now = new Date()): Date {
  const [y, m] = bangkokDayKey(now).split("-");
  return new Date(`${y}-${m}-01T00:00:00+07:00`);
}

/** Format an instant for display in Bangkok time (Thai locale). */
export function fmtBangkokDateTime(d: Date): string {
  return d.toLocaleString("th-TH", {
    timeZone: BKK,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function fmtBangkokDate(d: Date): string {
  return d.toLocaleDateString("th-TH", { timeZone: BKK });
}
