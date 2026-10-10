const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

function getPartsInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function dateKeyFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayForDateKey(dateKey, timeZone) {
  // Noon UTC remains on the same calendar date in Asia/Kolkata.
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
}

function toDateKeyInTimezone(value, timeZone) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateKeyFromParts(getPartsInTimezone(date, timeZone));
}

/**
 * Returns the most recent weekday whose scheduled run should have completed.
 * Before today's scheduled time, the expected run is the prior weekday.
 * On weekends, Friday is the most recent expected run.
 */
function getLatestExpectedScheduleDate(
  now = new Date(),
  {
    scheduleMinuteOfDay = 23 * 60 + 15,
    timeZone = "Asia/Kolkata",
  } = {},
) {
  const parts = getPartsInTimezone(now, timeZone);
  const todayKey = dateKeyFromParts(parts);
  const localMinute = Number(parts.hour) * 60 + Number(parts.minute);

  if (WEEKDAYS.has(parts.weekday) && localMinute >= scheduleMinuteOfDay) {
    return todayKey;
  }

  let candidate = shiftDateKey(todayKey, -1);

  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (WEEKDAYS.has(weekdayForDateKey(candidate, timeZone))) {
      return candidate;
    }

    candidate = shiftDateKey(candidate, -1);
  }

  throw new Error("Could not determine the latest expected weekday sync date");
}

/**
 * Recovery is unnecessary only if the persisted daily pipeline succeeded
 * on or after the most recent expected weekday. Use lastSuccessAt first
 * because it records the actual completion instant.
 */
function shouldRecoverStartupSync(
  status,
  now = new Date(),
  options = {},
) {
  const timeZone = options.timeZone || "Asia/Kolkata";
  const expectedDate = getLatestExpectedScheduleDate(now, options);
  const lastSuccessInstant =
    status?.last_success_at ??
    status?.lastSuccessAt ??
    status?.last_success_date ??
    status?.lastSuccessDate ??
    null;
  const lastSuccessDate = toDateKeyInTimezone(lastSuccessInstant, timeZone);
  const lastSuccessParts = lastSuccessInstant
    ? getPartsInTimezone(
        lastSuccessInstant instanceof Date
          ? lastSuccessInstant
          : new Date(lastSuccessInstant),
        timeZone,
      )
    : null;
  const lastSuccessMinute = lastSuccessParts
    ? Number(lastSuccessParts.hour) * 60 + Number(lastSuccessParts.minute)
    : null;
  const scheduleMinuteOfDay =
    options.scheduleMinuteOfDay ?? 23 * 60 + 15;

  const alreadyCurrent =
    status?.status === "SUCCESS" &&
    Boolean(lastSuccessDate) &&
    (
      lastSuccessDate > expectedDate ||
      (
        lastSuccessDate === expectedDate &&
        Number.isFinite(lastSuccessMinute) &&
        lastSuccessMinute >= scheduleMinuteOfDay
      )
    );

  return {
    shouldRun: !alreadyCurrent,
    expectedDate,
    lastSuccessDate,
  };
}

function didSucceedAfterScheduledTime(
  status,
  now = new Date(),
  options = {},
) {
  if (status?.status !== "SUCCESS") return false;

  const timeZone = options.timeZone || "Asia/Kolkata";
  const scheduleMinuteOfDay =
    options.scheduleMinuteOfDay ?? 23 * 60 + 15;
  const lastSuccessInstant =
    status?.last_success_at ??
    status?.lastSuccessAt ??
    null;

  if (!lastSuccessInstant) return false;

  const lastSuccessDate = toDateKeyInTimezone(lastSuccessInstant, timeZone);
  const todayParts = getPartsInTimezone(now, timeZone);
  const todayDate = dateKeyFromParts(todayParts);

  if (lastSuccessDate !== todayDate) return false;

  const lastParts = getPartsInTimezone(
    lastSuccessInstant instanceof Date
      ? lastSuccessInstant
      : new Date(lastSuccessInstant),
    timeZone,
  );
  const lastMinute = Number(lastParts.hour) * 60 + Number(lastParts.minute);

  return lastMinute >= scheduleMinuteOfDay;
}

module.exports = {
  getLatestExpectedScheduleDate,
  shouldRecoverStartupSync,
  didSucceedAfterScheduledTime,
};
