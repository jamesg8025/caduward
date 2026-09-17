import type { DetectionRule } from "./types.js";

function parseHour(time: string): number {
  return Number.parseInt(time.split(":")[0], 10);
}

function isWithinShift(hour: number, shiftStart: string, shiftEnd: string): boolean {
  const start = parseHour(shiftStart);
  const end = parseHour(shiftEnd);

  if (start < end) {
    return hour >= start && hour < end;
  }
  // Night shift wraps past midnight (e.g., 22:00-06:00)
  return hour >= start || hour < end;
}

export const offShiftRule: DetectionRule = {
  name: "off_shift",
  check(ctx) {
    const hour = ctx.event.timestamp.getUTCHours();
    const withinShift = isWithinShift(hour, ctx.staff.shiftStart, ctx.staff.shiftEnd);
    const fired = !withinShift;
    return {
      rule: "off_shift",
      fired,
      details: fired
        ? `Access at ${hour}:00 UTC, shift is ${ctx.staff.shiftStart}-${ctx.staff.shiftEnd}`
        : undefined,
    };
  },
};
