function log(
  level,
  message,
  meta = {}
) {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),

      level,

      service: "detail-stock",

      message,

      ...(Object.keys(meta).length
        ? meta
        : {})
    })
  );
}

module.exports = {
  info(message, meta) {
    log(
      "info",
      message,
      meta
    );
  },

  warn(message, meta) {
    log(
      "warn",
      message,
      meta
    );
  },

  error(message, meta) {
    log(
      "error",
      message,
      meta
    );
  }
};