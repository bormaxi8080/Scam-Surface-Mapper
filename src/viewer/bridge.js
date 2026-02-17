(function (global) {
  "use strict";

  var SSM = global.SSM;

  var READY_EVENT = "SSM_VIEWER_READY";
  var SNAPSHOT_EVENT = "SSM_SNAPSHOT_V1";
  var ERROR_EVENT = "SSM_ERROR";

  function getNonceFromUrl() {
    var params = new URLSearchParams(global.location.search || "");
    return params.get("nonce") || "";
  }

  function initBridge(handlers) {
    handlers = handlers || {};

    var nonce = getNonceFromUrl();
    var onSnapshot = handlers.onSnapshot;
    var onStatus = handlers.onStatus;

    function emitStatus(value) {
      if (typeof onStatus === "function") {
        onStatus(value);
      }
    }

    function postReady() {
      if (!global.opener || global.opener.closed) {
        emitStatus("Viewer opened directly. Waiting for manual import.");
        return;
      }

      try {
        global.opener.postMessage({ type: READY_EVENT, nonce: nonce }, "*");
        emitStatus("Waiting for collector payload...");
      } catch (error) {
        emitStatus("Failed to notify opener window.");
      }
    }

    function onMessage(event) {
      var data = event.data || {};
      if (data.type !== SNAPSHOT_EVENT) {
        return;
      }

      if (nonce && data.nonce !== nonce) {
        return;
      }

      var validation = SSM.validateSnapshot(data.snapshot);
      if (!validation.ok) {
        emitStatus("Rejected invalid snapshot payload.");

        if (global.opener && !global.opener.closed) {
          global.opener.postMessage(
            {
              type: ERROR_EVENT,
              nonce: nonce,
              error: validation.errors.join("; "),
            },
            event.origin || "*"
          );
        }
        return;
      }

      emitStatus("Snapshot received from collector.");
      if (typeof onSnapshot === "function") {
        onSnapshot(data.snapshot, { origin: event.origin || "unknown" });
      }
    }

    global.addEventListener("message", onMessage);
    postReady();

    return {
      nonce: nonce,
      destroy: function () {
        global.removeEventListener("message", onMessage);
      },
    };
  }

  global.SSMViewerBridge = {
    READY_EVENT: READY_EVENT,
    SNAPSHOT_EVENT: SNAPSHOT_EVENT,
    ERROR_EVENT: ERROR_EVENT,
    initBridge: initBridge,
  };
})(window);
