(function (global) {
  "use strict";

  var SSM = (global.SSM = global.SSM || {});

  function csvEsc(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function aggregateHosts(records) {
    var byHost = {};
    var i;

    for (i = 0; i < records.length; i += 1) {
      var record = records[i];
      var host = record.host;
      if (!byHost[host]) {
        byHost[host] = {
          count: 0,
          external: 0,
          shorteners: 0,
          paths: {},
          utm: {},
          aff: {},
          trackers: {},
          max_score: 0,
          flags: {},
          samples: [],
        };
      }

      var row = byHost[host];
      row.count += 1;
      if (record.is_external) {
        row.external += 1;
      }
      if (record.shortener) {
        row.shorteners += 1;
      }

      var j;
      for (j = 0; j < record.utm_keys.length; j += 1) {
        row.utm[record.utm_keys[j]] = true;
      }
      for (j = 0; j < record.aff_keys.length; j += 1) {
        row.aff[record.aff_keys[j]] = true;
      }
      for (j = 0; j < record.tracker_keys.length; j += 1) {
        row.trackers[record.tracker_keys[j]] = true;
      }

      row.paths[record.pathname] = true;
      row.max_score = Math.max(row.max_score, record.suspicion_score || 0);

      if (record.suspicious_tld) {
        row.flags.tld = true;
      }
      if (record.idn) {
        row.flags.idn = true;
      }
      if (record.host_cyrlat_mix) {
        row.flags.cyrlat = true;
      }
      if (record.has_susp_path) {
        row.flags.path = true;
      }
      if (record.has_susp_param) {
        row.flags.param = true;
      }
      if (record.shortener) {
        row.flags.shortener = true;
      }

      if (row.samples.length < 3) {
        row.samples.push(record.url);
      }
    }

    var hostRows = Object.keys(byHost).map(function (host) {
      var row = byHost[host];
      return {
        host: host,
        count: row.count,
        external: row.external,
        shorteners: row.shorteners,
        unique_paths: Object.keys(row.paths).slice(0, 6),
        utm_keys: Object.keys(row.utm),
        aff_keys: Object.keys(row.aff),
        tracker_keys: Object.keys(row.trackers),
        max_suspicion_score: row.max_score,
        flags: Object.keys(row.flags),
        sample: row.samples.join("|"),
      };
    });

    hostRows.sort(function (a, b) {
      return (
        b.max_suspicion_score - a.max_suspicion_score ||
        b.external - a.external ||
        b.count - a.count
      );
    });

    return hostRows;
  }

  function snapshotToCsvHosts(snapshot) {
    var rows = [
      "host,count,external,shorteners,max_suspicion_score,flags,utm_keys,aff_keys,tracker_keys,unique_paths,sample",
    ];

    var summary = Array.isArray(snapshot.summary) ? snapshot.summary : [];
    var i;

    for (i = 0; i < summary.length; i += 1) {
      var r = summary[i];
      rows.push(
        [
          r.host,
          r.count,
          r.external,
          r.shorteners,
          r.max_suspicion_score,
          (r.flags || []).join("|"),
          (r.utm_keys || []).join("|"),
          (r.aff_keys || []).join("|"),
          (r.tracker_keys || []).join("|"),
          (r.unique_paths || []).join("|"),
          r.sample,
        ]
          .map(csvEsc)
          .join(",")
      );
    }

    return rows.join("\n");
  }

  function snapshotToCsvLinks(snapshot) {
    var rows = [
      "source,url,host,pathname,is_external,rel,attr,text_anchor,utm_keys,aff_keys,tracker_keys,shortener,has_susp_path,has_susp_param,suspicious_tld,idn,host_cyrlat_mix,suspicion_score",
    ];

    var links = Array.isArray(snapshot.links) ? snapshot.links : [];
    var i;

    for (i = 0; i < links.length; i += 1) {
      var r = links[i];
      rows.push(
        [
          r.source,
          r.url,
          r.host,
          r.pathname,
          r.is_external,
          r.rel,
          r.attr,
          r.text_anchor,
          (r.utm_keys || []).join("|"),
          (r.aff_keys || []).join("|"),
          (r.tracker_keys || []).join("|"),
          r.shortener,
          r.has_susp_path,
          r.has_susp_param,
          r.suspicious_tld,
          r.idn,
          r.host_cyrlat_mix,
          r.suspicion_score,
        ]
          .map(csvEsc)
          .join(",")
      );
    }

    return rows.join("\n");
  }

  SSM.aggregateHosts = aggregateHosts;
  SSM.snapshotToCsvHosts = snapshotToCsvHosts;
  SSM.snapshotToCsvLinks = snapshotToCsvLinks;
})(typeof window !== "undefined" ? window : globalThis);
