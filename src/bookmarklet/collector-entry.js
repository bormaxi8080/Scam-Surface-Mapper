(function (global) {
  "use strict";

  var SSM = global.SSM;

  var READY_EVENT = "SSM_VIEWER_READY";
  var SNAPSHOT_EVENT = "SSM_SNAPSHOT_V1";

  var VIEWER_URL = "__SSM_VIEWER_URL__";
  var TRANSFER_TIMEOUT_MS = 8000;
  var MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

  function randomNonce() {
    return String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  }

  function byteLength(value) {
    if (global.TextEncoder) {
      return new global.TextEncoder().encode(value).length;
    }

    return unescape(encodeURIComponent(value)).length;
  }

  function downloadSnapshot(snapshot) {
    var filename =
      "ssm_snapshot_" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    var blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 250);
  }

  function openViewerPage(viewerUrl) {
    return global.open(viewerUrl, "_blank", "noopener,noreferrer");
  }

  function withNonce(baseUrl, nonce) {
    var parsed = new URL(baseUrl);
    parsed.searchParams.set("nonce", nonce);
    return parsed.toString();
  }

  function buildSnapshot() {
    if (!SSM || !SSM.extractRecords || !SSM.aggregateHosts || !SSM.createSnapshot) {
      throw new Error("SSM core modules are not loaded");
    }

    var sourceUrl = global.location.href;
    var currentHost = SSM.normalizeHost(global.location.hostname);
    var links = SSM.extractRecords(document, sourceUrl, currentHost);
    var summary = SSM.aggregateHosts(links);

    return SSM.createSnapshot({
      source: sourceUrl,
      userAgent: global.navigator.userAgent,
      links: links,
      summary: summary,
    });
  }

  function fallbackToFile(snapshot, reason) {
    downloadSnapshot(snapshot);

    var message =
      "Scam Surface Mapper: auto transfer to Viewer failed" +
      (reason ? " (" + reason + ")" : "") +
      ". Snapshot file was downloaded. Import it in the Viewer page.";

    global.alert(message);
  }

  function transferSnapshot(snapshot) {
    var nonce = randomNonce();
    var targetUrl = withNonce(VIEWER_URL, nonce);
    var targetOrigin = new URL(targetUrl).origin;
    var payload = {
      type: SNAPSHOT_EVENT,
      nonce: nonce,
      snapshot: snapshot,
    };

    var payloadBytes = byteLength(JSON.stringify(payload));
    var popup = openViewerPage(targetUrl);

    if (!popup) {
      fallbackToFile(snapshot, "popup blocked");
      return;
    }

    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      fallbackToFile(snapshot, "payload too large");
      return;
    }

    var delivered = false;
    var timer = null;

    function cleanup() {
      if (timer) {
        global.clearTimeout(timer);
      }
      global.removeEventListener("message", onMessage);
    }

    function onMessage(event) {
      if (event.source !== popup) {
        return;
      }
      if (event.origin !== targetOrigin) {
        return;
      }

      var data = event.data || {};
      if (data.type !== READY_EVENT) {
        return;
      }
      if (data.nonce !== nonce) {
        return;
      }

      try {
        popup.postMessage(payload, targetOrigin);
        delivered = true;
        cleanup();
      } catch (error) {
        cleanup();
        fallbackToFile(snapshot, "postMessage failed");
      }
    }

    global.addEventListener("message", onMessage);

    timer = global.setTimeout(function () {
      if (delivered) {
        return;
      }
      cleanup();
      fallbackToFile(snapshot, "viewer timeout");
    }, TRANSFER_TIMEOUT_MS);
  }

  try {
    var snapshot = buildSnapshot();
    transferSnapshot(snapshot);
  } catch (error) {
    global.alert(
      "Scam Surface Mapper collector error: " +
        (error && error.message ? error.message : String(error))
    );
  }
})(window);
