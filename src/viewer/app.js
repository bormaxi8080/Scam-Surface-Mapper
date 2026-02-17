(function (global) {
  "use strict";

  var SSM = global.SSM;
  var IO = global.SSMViewerIO;
  var Bridge = global.SSMViewerBridge;
  var Graph = global.SSMViewerGraph;

  var state = {
    snapshot: null,
    activeTab: "summary",
    hostGraph: null,
    fullGraph: null,
    bridge: null,
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    byId("ssm-status").textContent = text || "";
  }

  function setCounts(snapshot) {
    byId("ssm-links-count").textContent = String(
      (snapshot && snapshot.meta && snapshot.meta.total_links) || 0
    );
    byId("ssm-hosts-count").textContent = String(
      (snapshot && snapshot.meta && snapshot.meta.total_hosts) || 0
    );
    byId("ssm-source").textContent =
      (snapshot && snapshot.meta && snapshot.meta.source) || "-";
  }

  function tagsForRecord(record) {
    var out = [];
    if (record.shortener) {
      out.push("shortener");
    }
    if (record.suspicious_tld) {
      out.push("tld");
    }
    if (record.idn) {
      out.push("idn");
    }
    if (record.host_cyrlat_mix) {
      out.push("cyrlat");
    }
    if (record.has_susp_path) {
      out.push("path");
    }
    if (record.has_susp_param) {
      out.push("param");
    }
    return out;
  }

  function renderSummary(snapshot) {
    var body = byId("ssm-summary-body");
    body.innerHTML = "";

    var summary = Array.isArray(snapshot.summary) ? snapshot.summary : [];
    var i;

    for (i = 0; i < summary.length; i += 1) {
      var row = summary[i];
      var tr = document.createElement("tr");
      var hostCell = document.createElement("td");
      var countCell = document.createElement("td");
      var externalCell = document.createElement("td");
      var riskCell = document.createElement("td");
      var flagsCell = document.createElement("td");

      hostCell.textContent = String(row.host || "");
      countCell.textContent = String(row.count || 0);
      externalCell.textContent = String(row.external || 0);
      riskCell.textContent = String(row.max_suspicion_score || 0);
      flagsCell.textContent = (row.flags || []).join(" | ");

      tr.appendChild(hostCell);
      tr.appendChild(countCell);
      tr.appendChild(externalCell);
      tr.appendChild(riskCell);
      tr.appendChild(flagsCell);

      body.appendChild(tr);
    }
  }

  function renderLinks(snapshot) {
    var body = byId("ssm-links-body");
    body.innerHTML = "";

    var links = Array.isArray(snapshot.links) ? snapshot.links : [];
    var maxRows = 1200;
    var count = Math.min(links.length, maxRows);

    var i;
    for (i = 0; i < count; i += 1) {
      var row = links[i];
      var tr = document.createElement("tr");
      var urlCell = document.createElement("td");
      var hostCell = document.createElement("td");
      var riskCell = document.createElement("td");
      var tagsCell = document.createElement("td");

      urlCell.className = "mono";
      urlCell.textContent = String(row.url || "");
      hostCell.textContent = String(row.host || "");
      riskCell.textContent = String(row.suspicion_score || 0);
      tagsCell.textContent = tagsForRecord(row).join(" | ");

      tr.appendChild(urlCell);
      tr.appendChild(hostCell);
      tr.appendChild(riskCell);
      tr.appendChild(tagsCell);

      body.appendChild(tr);
    }

    byId("ssm-links-note").textContent =
      links.length > maxRows
        ? "Showing first " + maxRows + " of " + links.length + " links"
        : "Showing " + links.length + " links";
  }

  function renderQuickFlags(snapshot) {
    var links = Array.isArray(snapshot.links) ? snapshot.links : [];
    var counts = {
      shortener: 0,
      tld: 0,
      idn: 0,
      cyrlat: 0,
      path: 0,
      param: 0,
    };

    var i;
    for (i = 0; i < links.length; i += 1) {
      if (links[i].shortener) {
        counts.shortener += 1;
      }
      if (links[i].suspicious_tld) {
        counts.tld += 1;
      }
      if (links[i].idn) {
        counts.idn += 1;
      }
      if (links[i].host_cyrlat_mix) {
        counts.cyrlat += 1;
      }
      if (links[i].has_susp_path) {
        counts.path += 1;
      }
      if (links[i].has_susp_param) {
        counts.param += 1;
      }
    }

    var holder = byId("ssm-flags");
    holder.innerHTML = "";

    Object.keys(counts).forEach(function (key) {
      var el = document.createElement("span");
      el.className = "flag-chip";
      el.textContent = key + ": " + counts[key];
      holder.appendChild(el);
    });
  }

  function ensureSummary(snapshot) {
    if (Array.isArray(snapshot.summary) && snapshot.summary.length > 0) {
      return snapshot;
    }

    var rebuiltSummary = SSM.aggregateHosts(snapshot.links || []);
    return SSM.createSnapshot({
      generatedAt:
        (snapshot.meta && snapshot.meta.generated_at) || new Date().toISOString(),
      source: (snapshot.meta && snapshot.meta.source) || "about:blank",
      userAgent: (snapshot.meta && snapshot.meta.user_agent) || "",
      links: snapshot.links || [],
      summary: rebuiltSummary,
    });
  }

  function setSnapshot(snapshot, statusHint) {
    var normalized = ensureSummary(snapshot);
    state.snapshot = normalized;

    setCounts(normalized);
    renderSummary(normalized);
    renderLinks(normalized);
    renderQuickFlags(normalized);

    state.hostGraph.setSnapshot(normalized);
    state.fullGraph.setSnapshot(normalized);

    setStatus(statusHint || "Snapshot loaded.");
  }

  function currentCanvas() {
    if (state.activeTab === "hosts") {
      return state.hostGraph.getCanvas();
    }
    if (state.activeTab === "full") {
      return state.fullGraph.getCanvas();
    }
    return state.hostGraph.getCanvas();
  }

  function activateTab(tabName) {
    state.activeTab = tabName;

    var tabs = document.querySelectorAll("[data-tab]");
    var i;
    for (i = 0; i < tabs.length; i += 1) {
      var active = tabs[i].getAttribute("data-tab") === tabName;
      tabs[i].classList.toggle("active", active);
    }

    var panels = document.querySelectorAll("[data-panel]");
    for (i = 0; i < panels.length; i += 1) {
      var visible = panels[i].getAttribute("data-panel") === tabName;
      panels[i].classList.toggle("active", visible);
    }

    if (tabName === "hosts") {
      state.hostGraph.redraw();
    }
    if (tabName === "full") {
      state.fullGraph.redraw();
    }
  }

  function handleImportFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var snapshot = IO.parseSnapshotJson(String(reader.result || ""));
        setSnapshot(snapshot, "Snapshot imported from file.");
      } catch (error) {
        setStatus("Import failed: " + error.message);
      }
    };
    reader.readAsText(file);

    event.target.value = "";
  }

  function handlePasteJson() {
    var raw = global.prompt("Paste Snapshot JSON");
    if (!raw) {
      return;
    }

    try {
      var snapshot = IO.parseSnapshotJson(raw);
      setSnapshot(snapshot, "Snapshot imported from pasted JSON.");
    } catch (error) {
      setStatus("JSON parse failed: " + error.message);
    }
  }

  function setupActions() {
    byId("btn-copy-json").addEventListener("click", function () {
      if (!state.snapshot) {
        setStatus("No snapshot loaded.");
        return;
      }

      IO.copyText(JSON.stringify(state.snapshot, null, 2))
        .then(function () {
          setStatus("Snapshot copied to clipboard.");
        })
        .catch(function () {
          setStatus("Clipboard is blocked in this browser context.");
        });
    });

    byId("btn-download-hosts").addEventListener("click", function () {
      if (!state.snapshot) {
        setStatus("No snapshot loaded.");
        return;
      }

      IO.downloadTextFile(
        "scam_hosts.csv",
        SSM.snapshotToCsvHosts(state.snapshot),
        "text/csv;charset=utf-8"
      );
      setStatus("Hosts CSV downloaded.");
    });

    byId("btn-download-links").addEventListener("click", function () {
      if (!state.snapshot) {
        setStatus("No snapshot loaded.");
        return;
      }

      IO.downloadTextFile(
        "scam_links.csv",
        SSM.snapshotToCsvLinks(state.snapshot),
        "text/csv;charset=utf-8"
      );
      setStatus("Links CSV downloaded.");
    });

    byId("btn-download-snapshot").addEventListener("click", function () {
      if (!state.snapshot) {
        setStatus("No snapshot loaded.");
        return;
      }

      IO.downloadJson("scam_snapshot.json", state.snapshot);
      setStatus("Snapshot JSON downloaded.");
    });

    byId("btn-save-graph").addEventListener("click", function () {
      IO.downloadCanvasPng(currentCanvas(), "scam_graph.png");
      setStatus("Graph PNG downloaded.");
    });

    byId("input-import-json").addEventListener("change", handleImportFile);
    byId("btn-paste-json").addEventListener("click", handlePasteJson);

    var tabButtons = document.querySelectorAll("[data-tab]");
    var i;
    for (i = 0; i < tabButtons.length; i += 1) {
      tabButtons[i].addEventListener("click", function (event) {
        activateTab(event.currentTarget.getAttribute("data-tab"));
      });
    }
  }

  function buildEmptySnapshot() {
    return SSM.createSnapshot({
      source: "about:blank",
      userAgent: global.navigator.userAgent,
      links: [],
      summary: [],
    });
  }

  function initGraphs() {
    state.hostGraph = Graph.createGraph(byId("ssm-canvas-hosts"), "hosts");
    state.fullGraph = Graph.createGraph(byId("ssm-canvas-full"), "full", {
      maxFullNodes: 700,
    });
  }

  function initBridge() {
    state.bridge = Bridge.initBridge({
      onStatus: function (text) {
        setStatus(text);
      },
      onSnapshot: function (snapshot, meta) {
        setSnapshot(snapshot, "Snapshot loaded via bridge from " + meta.origin + ".");
      },
    });
  }

  function init() {
    initGraphs();
    setupActions();
    initBridge();
    activateTab("summary");
    setSnapshot(buildEmptySnapshot(), "Viewer ready. Run collector bookmarklet or import JSON.");

    global.addEventListener("resize", function () {
      state.hostGraph.redraw();
      state.fullGraph.redraw();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
