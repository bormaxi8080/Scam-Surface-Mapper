(function (global) {
  "use strict";

  var SSM = (global.SSM = global.SSM || {});

  function parseOnclickURLs(value) {
    var text = String(value || "");
    var regex = /(?:https?:\/\/|\/)[^'"\s)]+/g;
    var matches = text.match(regex);
    return matches || [];
  }

  function readMetaRefreshURL(doc) {
    var metas = doc.querySelectorAll("meta[http-equiv]");
    var i;

    for (i = 0; i < metas.length; i += 1) {
      var httpEquiv = String(metas[i].getAttribute("http-equiv") || "").toLowerCase();
      if (httpEquiv !== "refresh") {
        continue;
      }

      var content = String(metas[i].getAttribute("content") || "");
      var match = content.match(/url\s*=\s*([^;]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return "";
  }

  function extractRecords(doc, sourceUrl, currentHost) {
    var seen = {};
    var records = [];

    function pushURL(url, meta) {
      var analyzed = SSM.analyzeURL(url, meta, {
        source: sourceUrl,
        currentHost: currentHost,
      });
      if (!analyzed) {
        return;
      }

      var key =
        analyzed.url +
        "|" +
        String((meta && meta.text) || "") +
        "|" +
        String((meta && meta.attr) || "");

      if (seen[key]) {
        return;
      }
      seen[key] = true;
      records.push(analyzed);
    }

    var links = doc.querySelectorAll("a[href]");
    var i;

    for (i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href");
      if (!href) {
        continue;
      }
      if (/^javascript:|^mailto:|^tel:|^#/i.test(href)) {
        continue;
      }

      pushURL(href, {
        text: links[i].textContent || "",
        rel: links[i].getAttribute("rel") || "",
        attr: "href",
      });
    }

    var onclickNodes = doc.querySelectorAll("[onclick]");
    for (i = 0; i < onclickNodes.length; i += 1) {
      var onclickAttr = onclickNodes[i].getAttribute("onclick") || "";
      var onclickUrls = parseOnclickURLs(onclickAttr);
      var j;
      for (j = 0; j < onclickUrls.length && j < 3; j += 1) {
        pushURL(onclickUrls[j], {
          text: onclickNodes[i].textContent || "",
          attr: "onclick",
        });
      }
    }

    var dataLinkNodes = doc.querySelectorAll("[data-href],[data-url],[data-link]");
    for (i = 0; i < dataLinkNodes.length; i += 1) {
      var node = dataLinkNodes[i];
      var dataUrl =
        node.getAttribute("data-href") ||
        node.getAttribute("data-url") ||
        node.getAttribute("data-link");
      if (!dataUrl) {
        continue;
      }

      pushURL(dataUrl, {
        text: node.textContent || "",
        attr: "data-*",
      });
    }

    var refreshUrl = readMetaRefreshURL(doc);
    if (refreshUrl) {
      pushURL(refreshUrl, { attr: "meta-refresh" });
    }

    var canonical = doc.querySelector("link[rel='canonical']");
    if (canonical && canonical.href) {
      pushURL(canonical.href, { attr: "canonical" });
    }

    var ogUrl = doc.querySelector("meta[property='og:url']");
    if (ogUrl && ogUrl.content) {
      pushURL(ogUrl.content, { attr: "og:url" });
    }

    return records;
  }

  SSM.extractRecords = extractRecords;
})(typeof window !== "undefined" ? window : globalThis);
