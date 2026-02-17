(function (global) {
  "use strict";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function parseHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, "");
    } catch (error) {
      return "source";
    }
  }

  function createGraph(canvas, mode, options) {
    options = options || {};

    var ctx = canvas.getContext("2d");
    var dpr = global.devicePixelRatio || 1;

    var nodes = [];
    var edges = [];
    var positions = new Map();
    var velocities = new Map();
    var boxes = [];
    var snapshot = null;

    var width = 320;
    var height = 240;

    var draggingNode = null;
    var dragOffset = { x: 0, y: 0 };

    var destroyed = false;
    var currentSourceUrl = "";
    var currentSourceHost = "source";
    var maxFullNodes = options.maxFullNodes || 700;

    var menu = document.createElement("div");
    menu.className = "ssm-context-menu";
    menu.style.display = "none";
    document.body.appendChild(menu);

    function openUrl(url) {
      if (typeof options.openUrl === "function") {
        options.openUrl(url);
        return;
      }

      global.open(url, "_blank", "noopener,noreferrer");
    }

    function clearMenu() {
      menu.style.display = "none";
      menu.innerHTML = "";
    }

    function showMenu(clientX, clientY, items) {
      menu.innerHTML = "";
      var i;

      for (i = 0; i < items.length; i += 1) {
        var item = items[i];
        var row = document.createElement("button");
        row.type = "button";
        row.className = "ssm-context-item";
        row.textContent = item.label;
        row.addEventListener("click", item.onClick);
        menu.appendChild(row);
      }

      menu.style.left = clientX + "px";
      menu.style.top = clientY + "px";
      menu.style.display = "block";
    }

    function addNode(node) {
      node.id = nodes.length;
      nodes.push(node);
      return node.id;
    }

    function nodeColor(node) {
      if (node.type === "root") {
        return "#9cdcfe";
      }
      if (node.type === "host") {
        if ((node.score || 0) >= 4) {
          return "#ff6b6b";
        }
        if ((node.score || 0) >= 2) {
          return "#ffb86c";
        }
        return "#8be9fd";
      }
      if ((node.score || 0) >= 4) {
        return "#ef4444";
      }
      if ((node.score || 0) >= 2) {
        return "#facc15";
      }
      return "#a3e635";
    }

    function roundedRect(context, x, y, w, h, r) {
      context.beginPath();
      context.moveTo(x + r, y);
      context.arcTo(x + w, y, x + w, y + h, r);
      context.arcTo(x + w, y + h, x, y + h, r);
      context.arcTo(x, y + h, x, y, r);
      context.arcTo(x, y, x + w, y, r);
      context.closePath();
    }

    function labelFor(node) {
      var maxLen = node.type === "url" ? 42 : 28;
      var text = String(node.label || "");
      if (text.length <= maxLen) {
        return text;
      }
      return text.slice(0, maxLen - 1) + "…";
    }

    function resetGraphData() {
      nodes = [];
      edges = [];
      positions = new Map();
      velocities = new Map();
      boxes = [];
    }

    function buildDataFromSnapshot(inputSnapshot) {
      resetGraphData();
      snapshot = inputSnapshot;
      currentSourceUrl =
        (snapshot && snapshot.meta && snapshot.meta.source) || "about:blank";
      currentSourceHost = parseHost(currentSourceUrl);

      var rootId = addNode({
        type: "root",
        label: currentSourceHost,
        score: 0,
      });

      var hostMap = {};
      var summary = Array.isArray(snapshot.summary) ? snapshot.summary : [];
      var i;

      for (i = 0; i < summary.length; i += 1) {
        var host = summary[i];
        var hostId = addNode({
          type: "host",
          label: host.host,
          score: host.max_suspicion_score || 0,
          flags: host.flags || [],
        });
        hostMap[host.host] = hostId;
        edges.push({ from: rootId, to: hostId, type: "src-host" });
      }

      if (mode !== "full") {
        return;
      }

      var links = Array.isArray(snapshot.links) ? snapshot.links : [];
      var urlSeen = {};
      var urlNodes = 0;

      for (i = 0; i < links.length; i += 1) {
        var link = links[i];
        if (urlSeen[link.url]) {
          continue;
        }
        if (urlNodes >= maxFullNodes) {
          break;
        }

        var hostIdForLink = hostMap[link.host];
        if (hostIdForLink == null) {
          hostIdForLink = addNode({
            type: "host",
            label: link.host,
            score: link.suspicion_score || 0,
            flags: [],
          });
          hostMap[link.host] = hostIdForLink;
          edges.push({ from: rootId, to: hostIdForLink, type: "src-host" });
        }

        var urlId = addNode({
          type: "url",
          label: link.url,
          url: link.url,
          host: link.host,
          score: link.suspicion_score || 0,
        });

        urlSeen[link.url] = true;
        urlNodes += 1;
        edges.push({ from: hostIdForLink, to: urlId, type: "host-url" });
      }
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 320));
      height = Math.max(260, Math.floor(rect.height || canvas.clientHeight || 260));

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initPositions() {
      var i;
      for (i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        var point;

        if (node.type === "root") {
          point = { x: width * 0.12, y: height * 0.5 };
        } else if (node.type === "host") {
          point = {
            x: randomRange(width * 0.24, width * 0.56),
            y: randomRange(40, height - 40),
          };

          if (mode !== "full") {
            point.x = randomRange(width * 0.30, width * 0.90);
          }
        } else {
          point = {
            x: randomRange(width * 0.58, width * 0.94),
            y: randomRange(40, height - 40),
          };
        }

        positions.set(node.id, point);
        velocities.set(node.id, { x: 0, y: 0 });
      }
    }

    function runLayout(iterations) {
      var repulsion = mode === "full" ? 1200 : 1800;
      var spring = 0.02;

      var i;
      var j;
      var k;

      for (k = 0; k < iterations; k += 1) {
        for (i = 0; i < nodes.length; i += 1) {
          for (j = i + 1; j < nodes.length; j += 1) {
            var nodeA = nodes[i];
            var nodeB = nodes[j];
            var posA = positions.get(nodeA.id);
            var posB = positions.get(nodeB.id);

            var dx = posA.x - posB.x;
            var dy = posA.y - posB.y;
            var d2 = dx * dx + dy * dy + 0.01;
            var dist = Math.sqrt(d2);
            var force = repulsion / d2;

            dx = dx / dist;
            dy = dy / dist;

            var velA = velocities.get(nodeA.id);
            var velB = velocities.get(nodeB.id);

            velA.x += dx * force;
            velA.y += dy * force;
            velB.x -= dx * force;
            velB.y -= dy * force;
          }
        }

        for (i = 0; i < edges.length; i += 1) {
          var edge = edges[i];
          var from = positions.get(edge.from);
          var to = positions.get(edge.to);

          var ex = to.x - from.x;
          var ey = to.y - from.y;
          var edgeDist = Math.sqrt(ex * ex + ey * ey) || 1;
          var desired = edge.type === "src-host" ? 160 : 110;
          var pull = (edgeDist - desired) * spring;

          ex = ex / edgeDist;
          ey = ey / edgeDist;

          var velFrom = velocities.get(edge.from);
          var velTo = velocities.get(edge.to);

          velFrom.x += ex * pull;
          velFrom.y += ey * pull;
          velTo.x -= ex * pull;
          velTo.y -= ey * pull;
        }

        for (i = 0; i < nodes.length; i += 1) {
          var updateNode = nodes[i];
          var point = positions.get(updateNode.id);
          var velocity = velocities.get(updateNode.id);

          point.x += velocity.x;
          point.y += velocity.y;

          velocity.x *= 0.84;
          velocity.y *= 0.84;

          point.x = clamp(point.x, 40, width - 40);
          point.y = clamp(point.y, 30, height - 30);
        }
      }
    }

    function draw() {
      if (destroyed) {
        return;
      }

      ctx.clearRect(0, 0, width, height);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(148,163,184,0.45)";
      var i;

      for (i = 0; i < edges.length; i += 1) {
        var edge = edges[i];
        var from = positions.get(edge.from);
        var to = positions.get(edge.to);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      boxes = [];
      ctx.font = "12px ui-monospace";

      for (i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        var point = positions.get(node.id);
        var text = labelFor(node);
        var textWidth = ctx.measureText(text).width;
        var nodeWidth = clamp(textWidth + 18, 70, node.type === "url" ? 360 : 280);
        var nodeHeight = 24;
        var x = point.x - nodeWidth / 2;
        var y = point.y - nodeHeight / 2;

        roundedRect(ctx, x, y, nodeWidth, nodeHeight, 6);
        ctx.fillStyle = nodeColor(node);
        ctx.fill();
        ctx.strokeStyle = "rgba(35,48,65,0.95)";
        ctx.stroke();

        ctx.fillStyle = "#0b0f14";
        ctx.fillText(text, x + 9, y + 16);

        boxes.push({
          x: x,
          y: y,
          w: nodeWidth,
          h: nodeHeight,
          node: node,
        });
      }
    }

    function nodeAt(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var x = clientX - rect.left;
      var y = clientY - rect.top;

      var i;
      for (i = boxes.length - 1; i >= 0; i -= 1) {
        var box = boxes[i];
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          return { node: box.node, x: x, y: y };
        }
      }

      return null;
    }

    function buildNodeMenu(node) {
      if (node.type === "root") {
        return [
          {
            label: "Open source URL",
            onClick: function () {
              clearMenu();
              openUrl(currentSourceUrl);
            },
          },
          {
            label: "urlscan: source domain",
            onClick: function () {
              clearMenu();
              openUrl(
                "https://urlscan.io/search/#domain:" +
                  encodeURIComponent(currentSourceHost)
              );
            },
          },
          {
            label: "SecurityTrails: source domain",
            onClick: function () {
              clearMenu();
              openUrl(
                "https://securitytrails.com/domain/" +
                  encodeURIComponent(currentSourceHost)
              );
            },
          },
        ];
      }

      if (node.type === "host") {
        return [
          {
            label: "SecurityTrails: domain overview",
            onClick: function () {
              clearMenu();
              openUrl(
                "https://securitytrails.com/domain/" +
                  encodeURIComponent(node.label)
              );
            },
          },
          {
            label: "urlscan: search domain",
            onClick: function () {
              clearMenu();
              openUrl(
                "https://urlscan.io/search/#domain:" +
                  encodeURIComponent(node.label)
              );
            },
          },
          {
            label: "Whois: Whoxy",
            onClick: function () {
              clearMenu();
              openUrl("https://www.whoxy.com/" + encodeURIComponent(node.label));
            },
          },
        ];
      }

      return [
        {
          label: "Open URL",
          onClick: function () {
            clearMenu();
            openUrl(node.url || node.label);
          },
        },
        {
          label: "urlscan: submit URL",
          onClick: function () {
            clearMenu();
            openUrl(
              "https://urlscan.io/scan/?url=" +
                encodeURIComponent(node.url || node.label)
            );
          },
        },
        {
          label: "urlscan: search URL",
          onClick: function () {
            clearMenu();
            openUrl(
              "https://urlscan.io/search/#url:" +
                encodeURIComponent(node.url || node.label)
            );
          },
        },
      ];
    }

    function onMouseDown(event) {
      var hit = nodeAt(event.clientX, event.clientY);
      if (!hit) {
        return;
      }

      draggingNode = hit.node;
      var point = positions.get(draggingNode.id);
      dragOffset.x = hit.x - point.x;
      dragOffset.y = hit.y - point.y;
    }

    function onMouseMove(event) {
      if (!draggingNode) {
        return;
      }

      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;

      var point = positions.get(draggingNode.id);
      point.x = clamp(x - dragOffset.x, 40, width - 40);
      point.y = clamp(y - dragOffset.y, 30, height - 30);
      draw();
    }

    function onMouseUp() {
      draggingNode = null;
    }

    function onContextMenu(event) {
      event.preventDefault();
      var hit = nodeAt(event.clientX, event.clientY);
      if (!hit) {
        clearMenu();
        return;
      }

      showMenu(event.clientX, event.clientY, buildNodeMenu(hit.node));
    }

    function onWindowClick() {
      clearMenu();
    }

    function setSnapshot(inputSnapshot) {
      buildDataFromSnapshot(inputSnapshot);
      resize();
      initPositions();

      var n = Math.max(nodes.length, 1);
      var iterations = clamp(Math.floor(16000 / n), 40, 220);
      runLayout(iterations);
      draw();
    }

    function redraw() {
      if (!snapshot) {
        return;
      }
      resize();
      draw();
    }

    function destroy() {
      destroyed = true;
      clearMenu();
      menu.remove();

      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("contextmenu", onContextMenu);
      global.removeEventListener("mousemove", onMouseMove);
      global.removeEventListener("mouseup", onMouseUp);
      global.removeEventListener("click", onWindowClick);
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("contextmenu", onContextMenu);
    global.addEventListener("mousemove", onMouseMove);
    global.addEventListener("mouseup", onMouseUp);
    global.addEventListener("click", onWindowClick);

    return {
      setSnapshot: setSnapshot,
      redraw: redraw,
      destroy: destroy,
      getCanvas: function () {
        return canvas;
      },
      getNodeCount: function () {
        return nodes.length;
      },
    };
  }

  global.SSMViewerGraph = {
    createGraph: createGraph,
  };
})(window);
