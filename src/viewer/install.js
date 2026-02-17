(function (global) {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function setInstallStatus(text) {
    var status = byId("ssm-install-status");
    if (status) {
      status.textContent = text || "";
    }
  }

  function viewerBaseUrl() {
    var path = global.location.pathname;
    if (!/\/$/.test(path)) {
      path = path.replace(/\/index\.html$/i, "/");
      if (!/\/$/.test(path)) {
        path += "/";
      }
    }
    return global.location.origin + path;
  }

  function setupInstall() {
    var link = byId("bookmarklet-link");
    var copyButton = byId("bookmarklet-copy");
    var codeBox = byId("bookmarklet-code");

    if (!link || !copyButton || !codeBox) {
      return;
    }

    fetch("assets/bookmarklet-template.txt", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load bookmarklet template");
        }
        return response.text();
      })
      .then(function (template) {
        var bookmarklet = template
          .replace(/__SSM_VIEWER_URL__/g, viewerBaseUrl())
          .trim();

        link.href = bookmarklet;
        codeBox.value = bookmarklet;

        copyButton.addEventListener("click", function () {
          if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
            global.navigator.clipboard
              .writeText(bookmarklet)
              .then(function () {
                setInstallStatus("Bookmarklet code copied.");
              })
              .catch(function () {
                setInstallStatus(
                  "Clipboard blocked. Copy code manually from the text box."
                );
              });
            return;
          }

          setInstallStatus("Clipboard API unavailable. Copy code manually.");
        });

        setInstallStatus("Bookmarklet is ready. Drag it to bookmarks bar.");
      })
      .catch(function (error) {
        setInstallStatus(error.message);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupInstall);
  } else {
    setupInstall();
  }
})(window);
