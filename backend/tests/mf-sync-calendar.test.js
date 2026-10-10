const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLatestExpectedScheduleDate,
  shouldRecoverStartupSync,
} = require("../mutualfunds/mfSyncCalendar");

const TZ = "Asia/Kolkata";
const SCHEDULE_MINUTE = 23 * 60 + 15;

const options = {
  scheduleMinuteOfDay: SCHEDULE_MINUTE,
  timeZone: TZ,
};

test("after Friday's scheduled time, Friday is the expected sync date", () => {
  assert.equal(
    getLatestExpectedScheduleDate(new Date("2026-10-09T17:46:00.000Z"), options),
    "2026-10-09",
  );
});

test("Saturday startup expects Friday, not a Saturday cron run", () => {
  assert.equal(
    getLatestExpectedScheduleDate(new Date("2026-10-10T06:00:00.000Z"), options),
    "2026-10-09",
  );
});

test("Sunday startup expects the previous Friday", () => {
  assert.equal(
    getLatestExpectedScheduleDate(new Date("2026-10-11T06:00:00.000Z"), options),
    "2026-10-09",
  );
});

test("Monday before 23:15 IST expects the previous Friday", () => {
  assert.equal(
    getLatestExpectedScheduleDate(new Date("2026-10-12T02:00:00.000Z"), options),
    "2026-10-09",
  );
});

test("Monday after 23:15 IST expects Monday's run", () => {
  assert.equal(
    getLatestExpectedScheduleDate(new Date("2026-10-12T17:46:00.000Z"), options),
    "2026-10-12",
  );
});

test("missed Friday sync is recovered on Saturday", () => {
  const recovery = shouldRecoverStartupSync(
    {
      status: "SUCCESS",
      last_success_at: new Date("2026-10-08T18:00:00.000Z"),
    },
    new Date("2026-10-10T06:00:00.000Z"),
    options,
  );

  assert.equal(recovery.expectedDate, "2026-10-09");
  assert.equal(recovery.lastSuccessDate, "2026-10-08");
  assert.equal(recovery.shouldRun, true);
});

test("successful Friday sync prevents unnecessary weekend catch-up", () => {
  const recovery = shouldRecoverStartupSync(
    {
      status: "SUCCESS",
      last_success_at: new Date("2026-10-09T18:00:00.000Z"),
    },
    new Date("2026-10-10T06:00:00.000Z"),
    options,
  );

  assert.equal(recovery.expectedDate, "2026-10-09");
  assert.equal(recovery.lastSuccessDate, "2026-10-09");
  assert.equal(recovery.shouldRun, false);
});

test("a FAILED status is recovered even if an older success exists", () => {
  const recovery = shouldRecoverStartupSync(
    {
      status: "FAILED",
      last_success_at: new Date("2026-10-09T18:00:00.000Z"),
    },
    new Date("2026-10-10T06:00:00.000Z"),
    options,
  );

  assert.equal(recovery.shouldRun, true);
});

test("startup before Monday's scheduled time does not rerun a successful Friday sync", () => {
  const recovery = shouldRecoverStartupSync(
    {
      status: "SUCCESS",
      last_success_at: new Date("2026-10-09T18:00:00.000Z"),
    },
    new Date("2026-10-12T02:00:00.000Z"),
    options,
  );

  assert.equal(recovery.expectedDate, "2026-10-09");
  assert.equal(recovery.shouldRun, false);
});
