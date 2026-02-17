(function (global) {
  "use strict";

  var SSM = (global.SSM = global.SSM || {});
  var SCHEMA_VERSION = "1.0.0";

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function createSnapshot(input) {
    var generatedAt =
      (input && input.generatedAt) || new Date().toISOString();
    var source = (input && input.source) || global.location.href;
    var userAgent =
      (input && input.userAgent) ||
      (global.navigator && global.navigator.userAgent) ||
      "";
    var links = toSafeArray(input && input.links);
    var summary = toSafeArray(input && input.summary);

    return {
      meta: {
        schema_version: SCHEMA_VERSION,
        generated_at: generatedAt,
        source: source,
        user_agent: userAgent,
        total_links: links.length,
        total_hosts: summary.length,
      },
      summary: summary,
      links: links,
    };
  }

  function validateSnapshot(snapshot) {
    var errors = [];
    if (!isObject(snapshot)) {
      errors.push("Snapshot is not an object");
      return { ok: false, errors: errors };
    }

    if (!isObject(snapshot.meta)) {
      errors.push("meta is required");
    } else {
      if (typeof snapshot.meta.schema_version !== "string") {
        errors.push("meta.schema_version must be a string");
      }
      if (typeof snapshot.meta.generated_at !== "string") {
        errors.push("meta.generated_at must be a string");
      }
      if (typeof snapshot.meta.source !== "string") {
        errors.push("meta.source must be a string");
      }
    }

    if (!Array.isArray(snapshot.summary)) {
      errors.push("summary must be an array");
    }
    if (!Array.isArray(snapshot.links)) {
      errors.push("links must be an array");
    }

    return { ok: errors.length === 0, errors: errors };
  }

  SSM.SCHEMA_VERSION = SCHEMA_VERSION;
  SSM.createSnapshot = createSnapshot;
  SSM.validateSnapshot = validateSnapshot;
})(typeof window !== "undefined" ? window : globalThis);
