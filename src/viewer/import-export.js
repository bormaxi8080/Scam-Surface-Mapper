(function (global) {
  "use strict";

  var SSM = global.SSM;
  var ViewerIO = {};

  function safeAlert(message) {
    if (global.alert) {
      global.alert(message);
    }
  }

  function copyText(value) {
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(value);
    }

    return Promise.reject(new Error("Clipboard API unavailable"));
  }

  function downloadTextFile(filename, content, mimeType) {
    var blob = new Blob([content], {
      type: mimeType || "text/plain;charset=utf-8",
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

  function downloadJson(filename, objectValue) {
    downloadTextFile(
      filename,
      JSON.stringify(objectValue, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function downloadCanvasPng(canvas, filename) {
    if (!canvas) {
      safeAlert("No active graph canvas");
      return;
    }

    var outputName = filename || "ssm_graph.png";
    canvas.toBlob(function (blob) {
      if (!blob) {
        safeAlert("Failed to export PNG");
        return;
      }

      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = outputName;
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        anchor.remove();
      }, 250);
    });
  }

  function parseSnapshotJson(rawText) {
    var parsed = JSON.parse(rawText);
    var validation = SSM.validateSnapshot(parsed);
    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }

    return parsed;
  }

  ViewerIO.copyText = copyText;
  ViewerIO.downloadTextFile = downloadTextFile;
  ViewerIO.downloadJson = downloadJson;
  ViewerIO.downloadCanvasPng = downloadCanvasPng;
  ViewerIO.parseSnapshotJson = parseSnapshotJson;

  global.SSMViewerIO = ViewerIO;
})(window);
