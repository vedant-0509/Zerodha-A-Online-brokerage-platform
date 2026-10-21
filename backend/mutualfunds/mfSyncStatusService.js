const {
  getSyncStatus: findSyncStatus,
  getAllSyncStatuses: findAllSyncStatuses,
  updateSyncStatus,
} = require("./mfMongoRepository");

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateString(value) {
  const date = toDate(value);

  if (!date) return null;

  return date.toISOString().slice(0, 10);
}

function normalizeStatus(document) {
  if (!document) return null;

  return {
    id: document.mysqlId ?? document._id?.toString() ?? null,
    sync_name: document.syncName ?? null,
    last_success_date: toDateString(document.lastSuccessDate),
    last_attempt_date: toDateString(document.lastAttemptDate),
    last_processed_nav_date: toDateString(document.lastProcessedNavDate),
    last_success_at: toDate(document.lastSuccessAt),
    status: document.status ?? null,
    records_processed: Number(document.recordsProcessed || 0),
    records_updated: Number(document.recordsUpdated || 0),
    records_failed: Number(document.recordsFailed || 0),
    error_message: document.errorMessage ?? null,
    created_at: toDate(document.createdAt),
    updated_at: toDate(document.updatedAt),
  };
}

async function getSyncStatus(syncName) {
  const document = await findSyncStatus(syncName);
  return normalizeStatus(document);
}

async function getAllSyncStatuses() {
  const documents = await findAllSyncStatuses();

  return documents
    .map(normalizeStatus)
    .sort((a, b) =>
      String(a.sync_name || "").localeCompare(
        String(b.sync_name || "")
      )
    );
}

function toIndiaDateString(value) {
  const date = toDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function hasTodaysSyncSucceeded(syncName) {
  const document = await findSyncStatus(syncName);

  if (!document || document.status !== "SUCCESS") {
    return false;
  }

  const today = toIndiaDateString(new Date());
  const successDate = toIndiaDateString(
    document.lastSuccessAt || document.lastSuccessDate
  );

  return Boolean(successDate) && successDate === today;
}

async function hasAttemptedToday(syncName) {
  const document = await findSyncStatus(syncName);

  if (!document) {
    return false;
  }

  const today = toIndiaDateString(new Date());
  const attemptDate = toIndiaDateString(document.lastAttemptDate);

  return (
    attemptDate === today &&
    ["SUCCESS", "PENDING"].includes(document.status)
  );
}

async function markRunning(syncName) {
  await updateSyncStatus(syncName, {
    lastAttemptDate: new Date(),
    status: "RUNNING",
    errorMessage: null,
  });
}

async function markPending(
  syncName,
  message,
  processedNavDate = null,
  counts = {}
) {
  await updateSyncStatus(syncName, {
    lastAttemptDate: new Date(),
    lastProcessedNavDate: processedNavDate
      ? toDate(processedNavDate)
      : null,
    status: "PENDING",
    recordsProcessed: Number(counts.processed || 0),
    recordsUpdated: Number(counts.updated || 0),
    recordsFailed: Number(counts.failed || 0),
    errorMessage: String(
      message || "No new NAV data"
    ).slice(0, 4000),
  });
}

async function markSuccess(
  syncName,
  counts = {},
  processedNavDate = null
) {
  const now = new Date();

  await updateSyncStatus(syncName, {
    lastSuccessDate: now,
    lastAttemptDate: now,
    lastProcessedNavDate: processedNavDate
      ? toDate(processedNavDate)
      : null,
    lastSuccessAt: now,
    status: "SUCCESS",
    recordsProcessed: Number(counts.processed || 0),
    recordsUpdated: Number(counts.updated || 0),
    recordsFailed: Number(counts.failed || 0),
    errorMessage: null,
  });
}

async function markFailed(
  syncName,
  errorMessage,
  counts = {}
) {
  await updateSyncStatus(syncName, {
    lastAttemptDate: new Date(),
    status: "FAILED",
    recordsProcessed: Number(counts.processed || 0),
    recordsUpdated: Number(counts.updated || 0),
    recordsFailed: Number(counts.failed || 0),
    errorMessage: String(
      errorMessage || "Unknown error"
    ).slice(0, 4000),
  });
}

module.exports = {
  getSyncStatus,
  getAllSyncStatuses,
  hasTodaysSyncSucceeded,
  hasAttemptedToday,
  markRunning,
  markPending,
  markSuccess,
  markFailed,
};