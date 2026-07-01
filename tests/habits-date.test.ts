import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysToDateKey,
  dateKeyDayNumber,
  formatWeekRange,
  localDateKey,
  mondayForDate,
  shiftWeekStart,
  weekDateKeys
} from "../src/habits/index.js";

test("habit weeks are stable Monday-through-Sunday local date ranges", () => {
  assert.equal(mondayForDate(new Date(2026, 6, 1, 12)), "2026-06-29");
  assert.equal(localDateKey(new Date(2026, 6, 1, 12)), "2026-07-01");
  assert.deepEqual(weekDateKeys("2026-06-29"), [
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05"
  ]);
  assert.equal(formatWeekRange("2026-06-29"), "Jun 29 – Jul 5, 2026");
  assert.equal(shiftWeekStart("2026-12-28", 1), "2027-01-04");
  assert.equal(addDaysToDateKey("2028-02-28", 1), "2028-02-29");
  assert.equal(dateKeyDayNumber("2026-07-05"), 5);
});
