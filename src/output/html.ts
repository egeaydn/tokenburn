import type { ReportData } from "../core/report.js";

/** JSON that is safe to embed inside a <script> element. */
function embed(data: ReportData): string {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}

// The report is one self-contained file: no network requests, no external fonts or scripts.
// Client code below deliberately avoids backticks and ${} so it can live in this template.
const STYLE = /* css */ `
:root {
  color-scheme: light;
  --bg: #f6f5f1; --surface: #ffffff; --text: #1d1c1a; --muted: #6a665e; --faint: #9a958b;
  --border: #e5e2da; --grid: #ece9e2; --shadow: 0 1px 2px rgba(30,25,15,.06), 0 4px 16px rgba(30,25,15,.04);
  --c0: #c4502f; --c1: #1f7a99; --c2: #7457b8; --c3: #3f8f3d; --c4: #b07d12; --c5: #6f747d;
  --focus: #1f7a99;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #14130f; --surface: #1d1b17; --text: #f1eee6; --muted: #aaa598; --faint: #78736a;
    --border: #2f2c26; --grid: #28251f; --shadow: 0 1px 2px rgba(0,0,0,.4);
    --c0: #ee8264; --c1: #5bb7d6; --c2: #a58fe6; --c3: #7fc77c; --c4: #e3b44c; --c5: #a2a7b0;
    --focus: #5bb7d6;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #14130f; --surface: #1d1b17; --text: #f1eee6; --muted: #aaa598; --faint: #78736a;
  --border: #2f2c26; --grid: #28251f; --shadow: 0 1px 2px rgba(0,0,0,.4);
  --c0: #ee8264; --c1: #5bb7d6; --c2: #a58fe6; --c3: #7fc77c; --c4: #e3b44c; --c5: #a2a7b0;
  --focus: #5bb7d6;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-variant-numeric: tabular-nums;
}
.wrap { max-width: 1080px; margin: 0 auto; padding: 32px 16px 56px; }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
h1 { font-size: 26px; line-height: 1.2; margin: 0; letter-spacing: -0.02em; }
h1 span { color: var(--c0); }
.sub { color: var(--muted); margin-top: 4px; }
.theme { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 3px; }
.theme button {
  font: inherit; font-size: 13px; color: var(--muted); background: none; border: 0; border-radius: 7px;
  padding: 5px 12px; cursor: pointer;
}
.theme button[aria-pressed="true"] { background: var(--text); color: var(--bg); }
button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
.card, .panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow);
}
.card { padding: 16px 18px; }
.card .label { color: var(--muted); font-size: 13px; }
.card .value { font-size: 28px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.25; margin-top: 2px; }
.card .note { color: var(--faint); font-size: 12.5px; margin-top: 2px; }
.panel { padding: 18px 18px 14px; margin-bottom: 12px; }
.panel h2 { font-size: 15px; margin: 0 0 2px; }
.panel .hint { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; margin: 0 0 8px; font-size: 13px; color: var(--muted); }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 6px; vertical-align: baseline; }
#chart { position: relative; }
#chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.tip {
  position: absolute; pointer-events: none; z-index: 2; min-width: 190px; max-width: 260px;
  background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.18); padding: 10px 12px; font-size: 13px; opacity: 0; transition: opacity .08s;
}
.tip.on { opacity: 1; }
.tip b { display: block; font-size: 13px; margin-bottom: 4px; }
.tip .row { display: flex; justify-content: space-between; gap: 12px; }
.tip .tok { color: var(--muted); font-size: 12px; margin-top: 6px; border-top: 1px solid var(--border); padding-top: 6px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.grid3 .panel { margin-bottom: 0; min-width: 0; }
ul.bars { list-style: none; margin: 0; padding: 0; }
ul.bars li { margin: 0 0 11px; }
ul.bars .top { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; }
ul.bars .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
ul.bars .amt { color: var(--muted); white-space: nowrap; }
ul.bars .track { height: 6px; border-radius: 3px; background: var(--grid); margin-top: 4px; overflow: hidden; }
ul.bars .fill { height: 100%; border-radius: 3px; min-width: 2px; }
.empty { color: var(--muted); padding: 40px 0; text-align: center; }
footer { color: var(--muted); font-size: 12.5px; margin-top: 20px; }
footer p { margin: 0 0 6px; }
.priv { color: var(--text); }
@media (max-width: 860px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
  .grid3 { grid-template-columns: 1fr; }
}
@media (max-width: 420px) {
  .card .value { font-size: 24px; }
}
`;

const SCRIPT = /* js */ `
(function () {
  var data = JSON.parse(document.getElementById("data").textContent);
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  // ---- formatting ----
  var money = function (n) {
    if (n > 0 && n < 0.01) return "<$0.01";
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  var tok = function (n) { return compact.format(n); };
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var label = function (key, long) {
    var p = key.split("-");
    if (p.length === 2) return MONTHS[+p[1] - 1] + " " + p[0];
    return MONTHS[+p[1] - 1] + " " + (+p[2]) + (long ? ", " + p[0] : "");
  };
  var colorVar = function (i) { return "var(--c" + (i % 6) + ")"; };
  var providerColor = function (name) {
    var i = data.providers.indexOf(name);
    return colorVar(i < 0 ? 5 : i);
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };

  // ---- theme: system (default) / light / dark ----
  var KEY = "tokenburn-theme";
  var readTheme = function () { try { return localStorage.getItem(KEY) || "system"; } catch (e) { return "system"; } };
  var applyTheme = function (t) {
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
    var btns = document.querySelectorAll(".theme button");
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute("aria-pressed", String(btns[i].dataset.theme === t));
  };
  applyTheme(readTheme());
  document.querySelector(".theme").addEventListener("click", function (e) {
    var t = e.target && e.target.dataset && e.target.dataset.theme;
    if (!t) return;
    try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch (err) {}
    applyTheme(t);
    drawChart();
  });
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { drawChart(); });
  }

  // ---- header + cards ----
  var t = data.totals;
  var activeDays = t.activeDays || 1;
  var allInput = t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens;
  var hit = allInput ? Math.round((t.cacheReadTokens / allInput) * 100) : 0;
  $("range").textContent = data.range
    ? label(data.range.from, true) + " \\u2013 " + label(data.range.to, true) + " \\u00b7 " + data.providers.length + (data.providers.length === 1 ? " tool" : " tools")
    : "No usage found";
  var cards = [
    ["Total spend", money(t.costUSD), t.unpricedModels.length ? "excludes unpriced models" : "API-equivalent"],
    ["Per active day", money(t.costUSD / activeDays), t.activeDays + " active " + (t.activeDays === 1 ? "day" : "days")],
    ["Output tokens", tok(t.outputTokens), tok(t.inputTokens) + " fresh input"],
    ["Cache hit rate", hit + "%", tok(t.cacheReadTokens) + " tokens read from cache"]
  ];
  $("cards").innerHTML = cards.map(function (c) {
    return '<div class="card"><div class="label">' + c[0] + '</div><div class="value">' + c[1] + '</div><div class="note">' + esc(c[2]) + "</div></div>";
  }).join("");

  // ---- breakdown lists ----
  var list = function (id, entries, colorOf) {
    var max = 0;
    entries.forEach(function (e) { if (e.costUSD > max) max = e.costUSD; });
    if (!entries.length) { $(id).innerHTML = '<li class="empty">Nothing here yet</li>'; return; }
    $(id).innerHTML = entries.map(function (e) {
      var pct = max ? Math.max(2, (e.costUSD / max) * 100) : 2;
      var amt = e.partial && !e.costUSD ? "price unknown" : money(e.costUSD) + (e.partial ? "*" : "");
      return '<li><div class="top"><span class="name" title="' + esc(e.name) + '">' + esc(e.name) +
        '</span><span class="amt">' + amt + '</span></div><div class="track"><div class="fill" style="width:' +
        pct.toFixed(1) + "%;background:" + colorOf(e) + '"></div></div></li>';
    }).join("");
  };
  var byFirstProvider = function (e) { return providerColor(e.provider.split(", ")[0]); };
  var projectColor = function (e) { return e.provider.indexOf(",") >= 0 ? "var(--c5)" : providerColor(e.provider); };
  list("l-tools", data.byProvider, byFirstProvider);
  list("l-models", data.byModel, byFirstProvider);
  list("l-projects", data.byProject, projectColor);

  // ---- legend ----
  $("legend").innerHTML = data.providers.map(function (p) {
    return '<span><i class="dot" style="background:' + providerColor(p) + '"></i>' + esc(p) + "</span>";
  }).join("");

  // ---- stacked bar chart ----
  var tip = $("tip");
  var niceMax = function (v) {
    if (v <= 0) return 1;
    var pow = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var n = v / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  };
  var svgEl = function (name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  function drawChart() {
    var host = $("chart");
    var old = host.querySelector("svg");
    if (old) host.removeChild(old);
    var series = data.series;
    if (!series.length) return;
    var W = Math.max(host.clientWidth, 280), H = W < 520 ? 220 : 270;
    var m = { l: 46, r: 4, t: 8, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = 0;
    series.forEach(function (p) { if (p.costUSD > max) max = p.costUSD; });
    var top = niceMax(max);
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Daily spend, stacked by tool" });
    var css = getComputedStyle(root);
    var faint = css.getPropertyValue("--faint").trim();
    var grid = css.getPropertyValue("--grid").trim();

    for (var g = 0; g <= 4; g++) {
      var y = m.t + ih - (g / 4) * ih;
      svg.appendChild(svgEl("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: grid, "stroke-width": 1 }));
      var tx = svgEl("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", fill: faint, "font-size": 11 });
      tx.textContent = "$" + compact.format((g / 4) * top);
      svg.appendChild(tx);
    }

    var n = series.length, slot = iw / n, bw = Math.max(1, Math.min(28, slot * 0.74));
    series.forEach(function (p, i) {
      var x = m.l + i * slot + (slot - bw) / 2;
      var yBase = m.t + ih;
      data.providers.forEach(function (name) {
        var v = p.byProvider[name] || 0;
        if (v <= 0) return;
        var h = Math.max(1, (v / top) * ih);
        yBase -= h;
        svg.appendChild(svgEl("rect", { x: x, y: yBase, width: bw, height: h, rx: bw > 6 ? 2 : 0, fill: providerColor(name) }));
      });
    });

    var ticks = Math.min(6, n), seen = {};
    for (var k = 0; k < ticks; k++) {
      var idx = ticks === 1 ? 0 : Math.round((k / (ticks - 1)) * (n - 1));
      if (seen[idx]) continue;
      seen[idx] = 1;
      var lx = m.l + idx * slot + slot / 2;
      var anchor = idx === 0 ? "start" : idx === n - 1 ? "end" : "middle";
      var lt = svgEl("text", { x: idx === 0 ? m.l : idx === n - 1 ? W - m.r : lx, y: H - 6, "text-anchor": anchor, fill: faint, "font-size": 11 });
      lt.textContent = label(series[idx].key, false);
      svg.appendChild(lt);
    }

    var hover = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    var show = function (ev) {
      var r = svg.getBoundingClientRect();
      var px = ((ev.clientX - r.left) / r.width) * W;
      var i = Math.min(n - 1, Math.max(0, Math.floor((px - m.l) / slot)));
      var p = series[i];
      var rows = data.providers.filter(function (name) { return p.byProvider[name] > 0; }).map(function (name) {
        return '<div class="row"><span><i class="dot" style="background:' + providerColor(name) + '"></i>' + esc(name) +
          "</span><span>" + money(p.byProvider[name]) + "</span></div>";
      }).join("");
      tip.innerHTML = "<b>" + label(p.key, true) + " \\u00b7 " + money(p.costUSD) + "</b>" + rows +
        '<div class="tok">' + tok(p.inputTokens) + " in \\u00b7 " + tok(p.outputTokens) + " out \\u00b7 " + tok(p.cacheTokens) + " cache</div>";
      var cx = ((m.l + i * slot + slot / 2) / W) * r.width;
      var left = cx + 14;
      if (left + tip.offsetWidth > r.width) left = cx - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = "8px";
      tip.classList.add("on");
    };
    hover.addEventListener("pointermove", show);
    hover.addEventListener("pointerdown", show);
    hover.addEventListener("pointerleave", function () { tip.classList.remove("on"); });
    svg.appendChild(hover);
    host.insertBefore(svg, tip);
  }
  drawChart();
  var timer;
  window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(drawChart, 80); });

  // ---- footer ----
  var notes = [];
  if (t.unpricedModels.length) {
    notes.push("No known price for " + t.unpricedModels.map(esc).join(", ") + ": their usage is counted in tokens but not in dollars (marked with *).");
  }
  $("notes").innerHTML = notes.map(function (n) { return "<p>" + n + "</p>"; }).join("");
  $("generated").textContent = new Date(data.generatedAt).toLocaleString();
})();
`;

export function renderHtml(data: ReportData): string {
  const empty = data.series.length === 0;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tokenburn report</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1><span>&#9679;</span> tokenburn</h1>
      <div class="sub" id="range"></div>
    </div>
    <div class="theme" role="group" aria-label="Theme">
      <button type="button" data-theme="system" aria-pressed="true">System</button>
      <button type="button" data-theme="light" aria-pressed="false">Light</button>
      <button type="button" data-theme="dark" aria-pressed="false">Dark</button>
    </div>
  </header>
  <div class="cards" id="cards"></div>
  <section class="panel">
    <h2>Spend over time</h2>
    <p class="hint">${data.granularity === "month" ? "Per month" : "Per day"}, stacked by tool. Hover or tap a bar for details.</p>
    <div class="legend" id="legend"></div>
    ${empty ? '<div class="empty">No usage found for this period.</div>' : ""}
    <div id="chart"><div class="tip" id="tip"></div></div>
  </section>
  <div class="grid3">
    <section class="panel"><h2>By tool</h2><p class="hint">Where the money goes</p><ul class="bars" id="l-tools"></ul></section>
    <section class="panel"><h2>By model</h2><p class="hint">Top models by cost</p><ul class="bars" id="l-models"></ul></section>
    <section class="panel"><h2>By project</h2><p class="hint">Top working directories</p><ul class="bars" id="l-projects"></ul></section>
  </div>
  <footer>
    <div id="notes"></div>
    <p>Costs are API-equivalent list prices computed from your local logs. Subscriptions and free plans are not billed per token, so treat them as a measure of usage rather than an invoice.</p>
    <p class="priv">Generated <span id="generated"></span> on your machine. This file makes no network requests and nothing was uploaded.</p>
  </footer>
</div>
<script id="data" type="application/json">${embed(data)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
