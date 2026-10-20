import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  addDays,
  calendarDay,
  completeMemorization,
  isCalendarDay,
} from "../src/memorization.ts";

function inZone(zone, body) {
  const memory = new URL("../src/memorization.ts", import.meta.url).href;
  const clock = new URL("../src/study-clock.ts", import.meta.url).href;
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
    import { addDays, calendarDay, memorizationDue, validateMemorization } from ${JSON.stringify(memory)};
    import { nextLocalMidnight } from ${JSON.stringify(clock)};
    ${body}
  `,
      ],
      { env: { ...process.env, TZ: zone }, encoding: "utf8" },
    ),
  );
}

test("stored calendar dates and offsets survive changing zones, including a skipped local day", () => {
  for (const zone of [
    "Europe/Istanbul",
    "America/New_York",
    "Australia/Sydney",
    "Pacific/Apia",
  ]) {
    const result = inZone(
      zone,
      `
      const plan = { addedOn: '2011-12-29', learnedOn: '2011-12-29', reviews: ['2011-12-30'] };
      console.log(JSON.stringify({ date: addDays('2011-12-29', 1), plan: validateMemorization(plan), due: memorizationDue(plan, '2012-01-01') }));
    `,
    );
    assert.equal(result.date, "2011-12-30", zone);
    assert.deepEqual(result.plan.reviews, ["2011-12-30"], zone);
    assert.equal(result.due, true, zone);
  }
});

test("learning uses the device local day around UTC midnight, not the UTC date", () => {
  for (const [zone, expected] of [
    ["Europe/Istanbul", "2026-10-19"],
    ["America/New_York", "2026-10-18"],
    ["Australia/Sydney", "2026-10-19"],
  ]) {
    assert.equal(
      inZone(
        zone,
        `console.log(JSON.stringify(calendarDay(new Date('2026-10-18T21:30:00Z'))));`,
      ),
      expected,
    );
  }
});

test("day rollover timer follows local midnight across 23 and 25 hour days", () => {
  for (const [zone, day, hours] of [
    ["America/New_York", "2026-03-08", 23],
    ["America/New_York", "2026-11-01", 25],
    ["Australia/Sydney", "2026-10-04", 23],
    ["Australia/Sydney", "2026-04-05", 25],
    ["Europe/Istanbul", "2026-03-08", 24],
  ]) {
    const result = inZone(
      zone,
      `const now = new Date('${day}T00:00:00').getTime(); console.log(JSON.stringify({ hours: (nextLocalMidnight(now) - now) / 3600000, tomorrow: calendarDay(new Date(nextLocalMidnight(now))) }));`,
    );
    assert.equal(result.hours, hours, `${zone} ${day}`);
    assert.equal(result.tomorrow, addDays(day, 1));
  }
});

test("invalid days and clock rollback never append impossible history", () => {
  const plan = {
    addedOn: "2026-01-01",
    learnedOn: "2026-01-01",
    reviews: ["2026-02-01"],
  };
  for (const day of ["2026-02-30", "bad", "2026-01-31", "2026-02-01"]) {
    assert.equal(completeMemorization(plan, day), plan);
  }
  assert.equal(isCalendarDay("2028-02-29"), true);
  assert.equal(isCalendarDay("2026-02-29"), false);
  assert.throws(() => addDays("2026-02-30", 1));
  assert.throws(() => addDays("2026-01-01", 0.5));
  assert.throws(() => calendarDay(new Date(NaN)));
});
