(function (global) {
  "use strict";

  var SSM = (global.SSM = global.SSM || {});

  var SHORTENER_HOSTS = {
    "t.co": true,
    "bit.ly": true,
    "tinyurl.com": true,
    "is.gd": true,
    "cutt.ly": true,
    "ow.ly": true,
    "s.id": true,
    "goo.gl": true,
    "buff.ly": true,
    "lnkd.in": true,
    "adb.ly": true,
    "rebrand.ly": true,
    "v.gd": true,
    "clck.ru": true,
    "vk.cc": true,
  };

  var SUSPICIOUS_TLD_RE =
    /\.(xyz|top|icu|cn|ru|rest|work|club|best|support|casa|loan|click|gq|cf|ml|tk|link|cfd|zip|mov|buzz|cam|monster|quest|beauty|hair|men|lol|review|country|gdn|kim|download|racing|stream|fit|mom|bar|host|party|date|faith|science|surf|site|online|shop)$/i;

  var SUS_PATH_RE =
    /(login|verify|wallet|bonus|promo|airdrop|claim|giveaway|prize|auth|signin|account|recovery|seed|mnemonic|withdraw|payout|investment|broker|crypto|binance|bybit|okx|pass|gift|lottery|casino|bet)\b/i;

  var SUS_PARAM_RE =
    /\b(sum|amount|wallet|addr|address|seed|mnemonic|key|private|bonus|promo|ref|aff|utm_|tracking|click|cid|gclid|fbclid|ysclid|yclid|msclkid)\b/i;

  var TRACKER_KEY_RE =
    /(gclid|fbclid|ysclid|yclid|msclkid|cid|clid)/i;

  var AFFILIATE_KEY_RE =
    /(?:^|_|-)(ref|aff|partner|pid|subid|affiliate)(?:$|_|-)/i;

  function uniqueStrings(items) {
    var out = [];
    var seen = {};
    var i;

    for (i = 0; i < items.length; i += 1) {
      var value = String(items[i]);
      if (seen[value]) {
        continue;
      }
      seen[value] = true;
      out.push(value);
    }

    return out;
  }

  function normalizeHost(host) {
    return String(host || "").replace(/^www\./i, "").toLowerCase();
  }

  function safeURL(url, base) {
    try {
      return new URL(url, base || global.location.href);
    } catch (error) {
      return null;
    }
  }

  function hasCyrLatMix(value) {
    return /[A-Za-z]/.test(value) && /[А-Яа-яЁё]/.test(value);
  }

  function isIDN(host) {
    return /xn--/i.test(host);
  }

  function isShortenerHost(host) {
    return !!SHORTENER_HOSTS[normalizeHost(host)];
  }

  function isSuspiciousTLD(host) {
    return SUSPICIOUS_TLD_RE.test(host);
  }

  function analyzeURL(rawUrl, meta, context) {
    var source = (context && context.source) || global.location.href;
    var currentHost = normalizeHost(
      (context && context.currentHost) || global.location.hostname
    );

    var parsed = safeURL(rawUrl, source);
    if (!parsed) {
      return null;
    }

    var host = normalizeHost(parsed.hostname);
    var pathname = parsed.pathname || "/";
    var params = [];
    try {
      params = Array.from(parsed.searchParams.entries());
    } catch (error) {
      params = [];
    }

    var utm = [];
    var aff = [];
    var trackers = [];
    var i;

    for (i = 0; i < params.length; i += 1) {
      var key = String(params[i][0] || "");
      if (/^utm_/i.test(key)) {
        utm.push(key);
      }
      if (AFFILIATE_KEY_RE.test(key)) {
        aff.push(key);
      }
      if (TRACKER_KEY_RE.test(key)) {
        trackers.push(key);
      }
    }

    var rel = String((meta && meta.rel) || "").toLowerCase();
    var attr = String((meta && meta.attr) || "");
    var text = String((meta && meta.text) || "").slice(0, 160);

    var suspiciousPath = SUS_PATH_RE.test(pathname);
    var suspiciousParam = SUS_PARAM_RE.test(parsed.search);
    var shortener = isShortenerHost(host);
    var suspiciousTld = isSuspiciousTLD(host);
    var idn = isIDN(host);
    var hostCyrlatMix = hasCyrLatMix(host);

    var suspicionScore =
      (shortener ? 2 : 0) +
      (suspiciousTld ? 2 : 0) +
      (idn ? 1 : 0) +
      (hostCyrlatMix ? 1 : 0) +
      (suspiciousPath ? 2 : 0) +
      (suspiciousParam ? 1 : 0) +
      (rel.indexOf("sponsored") >= 0 ? 1 : 0);

    return {
      source: source,
      url: parsed.href,
      host: host,
      pathname: pathname,
      is_external: host !== currentHost,
      rel: rel,
      attr: attr,
      text_anchor: text,
      utm_keys: uniqueStrings(utm),
      aff_keys: uniqueStrings(aff),
      tracker_keys: uniqueStrings(trackers),
      shortener: shortener,
      has_susp_path: suspiciousPath,
      has_susp_param: suspiciousParam,
      suspicious_tld: suspiciousTld,
      idn: idn,
      host_cyrlat_mix: hostCyrlatMix,
      suspicion_score: suspicionScore,
    };
  }

  SSM.normalizeHost = normalizeHost;
  SSM.safeURL = safeURL;
  SSM.isShortenerHost = isShortenerHost;
  SSM.isSuspiciousTLD = isSuspiciousTLD;
  SSM.hasCyrLatMix = hasCyrLatMix;
  SSM.isIDN = isIDN;
  SSM.analyzeURL = analyzeURL;
  SSM._internals = SSM._internals || {};
  SSM._internals.SHORTENER_HOSTS = SHORTENER_HOSTS;
})(typeof window !== "undefined" ? window : globalThis);
