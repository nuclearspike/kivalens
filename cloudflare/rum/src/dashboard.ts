import { labelsForDashboard } from './labels'

/**
 * rum.kivalens.org/dashboard: how many people use KivaLens and what they do with
 * it, for the owner (Paul, 2026-09-26: monthly users, separate browsers, lender
 * IDs, searches, and which criteria they use, to design a basic / medium /
 * advanced split from what people actually do).
 *
 * Three small files served by the Worker (the page, its stylesheet and its
 * script), so the page's own policy can forbid inline code. The script asks for
 * the stats key once and keeps it in that browser; the numbers come from
 * GET /v1/stats (stats.ts). Nothing here is public: without the key the page is
 * an empty form.
 */

export const DASHBOARD_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

export const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>KivaLens usage</title>
<link rel="stylesheet" href="/dashboard.css">
</head>
<body>
<header class="bar">
  <h1>KivaLens usage</h1>
  <div class="controls">
    <label class="host">Site
      <select id="host">
        <option value="www.kivalens.org">www.kivalens.org</option>
        <option value="beta.kivalens.org">beta.kivalens.org</option>
        <option value="*">All sites</option>
      </select>
    </label>
    <div class="periods" role="group" aria-label="Period">
      <button type="button" data-period="7d">7 days</button>
      <button type="button" data-period="30d">30 days</button>
      <button type="button" data-period="45d">45 days</button>
      <button type="button" data-period="month">This month</button>
      <button type="button" data-period="lastmonth">Last month</button>
    </div>
    <span id="status" class="status" role="status"></span>
    <button type="button" id="forget" class="link">Forget key</button>
  </div>
</header>
<main id="main">
  <form id="keyform" class="panel keyform" hidden>
    <h2>Stats key</h2>
    <p>Paste the key set with <code>wrangler secret put STATS_KEY</code>. It stays in this browser.</p>
    <div class="row"><input id="key" type="password" autocomplete="off" spellcheck="false" aria-label="Stats key"><button type="submit">Show usage</button></div>
    <p id="keyerror" class="error" role="alert"></p>
  </form>
  <div id="report" hidden></div>
</main>
<script src="/dashboard.js"></script>
</body>
</html>
`

export const dashboardCss = `
:root {
  --bg: #f5f7f5; --panel: #ffffff; --ink: #1c2521; --muted: #56655d; --rule: #dce3de;
  --accent: #2a8459; --accent-2: #9fd3b6; --new: #c47a1b; --track: #edf1ee; --error: #b3261e;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #111614; --panel: #18201b; --ink: #e2e9e4; --muted: #9fb0a6; --rule: #2b3630;
    --accent: #5fc28f; --accent-2: #2f6a4b; --new: #e0a458; --track: #202a24; --error: #f2b8b5; color-scheme: dark; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-variant-numeric: tabular-nums; }
.bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--rule); }
h1 { font-size: 17px; margin: 0; font-weight: 650; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.host { display: flex; align-items: center; gap: 6px; color: var(--muted); }
select, input, button { font: inherit; color: inherit; }
select, input { background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 5px 8px; }
button { background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 5px 10px; cursor: pointer; min-height: 32px; }
button:hover { border-color: var(--accent); }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.periods { display: flex; flex-wrap: wrap; gap: 4px; }
.periods button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--panel); }
.link { border: 0; background: none; color: var(--muted); text-decoration: underline; padding: 5px 4px; }
.status { color: var(--muted); min-width: 10ch; }
main { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px 40px; max-width: 1280px; margin: 0 auto; }
#report { display: flex; flex-direction: column; gap: 14px; }
.panel { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; min-width: 0; }
.panel h2 { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; font-weight: 650; }
.panel .note { color: var(--muted); margin: 0 0 8px; font-size: 13px; }
.keyform .row { display: flex; gap: 8px; flex-wrap: wrap; }
.keyform input { flex: 1 1 260px; }
.error { color: var(--error); min-height: 1.2em; margin: 6px 0 0; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.tile { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 10px 12px; }
.tile .label { color: var(--muted); font-size: 12px; }
.tile .value { font-size: 24px; font-weight: 650; line-height: 1.2; }
.tile .sub { color: var(--muted); font-size: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; align-items: start; }
.stack { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--rule); white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
th { color: var(--muted); font-weight: 600; font-size: 12px; }
.scroll { overflow-x: auto; }
.rows { display: flex; flex-direction: column; gap: 2px; }
.row-item { display: grid; grid-template-columns: minmax(0, 1fr) 5.5em 5em; gap: 8px; align-items: center; position: relative; padding: 3px 6px; border-radius: 4px; }
.row-item .fill { position: absolute; inset: 0 auto 0 0; background: var(--track); border-radius: 4px; z-index: 0; }
.row-item.primary .fill { background: color-mix(in srgb, var(--accent) 22%, transparent); }
.row-item > span { position: relative; z-index: 1; }
.row-item .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-item .num { text-align: right; }
.row-item.sub .name { padding-left: 16px; color: var(--muted); }
.row-head { display: grid; grid-template-columns: minmax(0, 1fr) 5.5em 5em; gap: 8px; padding: 0 6px 4px; color: var(--muted); font-size: 12px; }
.row-head span:not(:first-child) { text-align: right; }
.group-title { margin: 10px 0 2px; font-weight: 650; font-size: 13px; }
.chart { min-height: 190px; }
.chart svg { display: block; }
.chart .returning { fill: var(--accent); }
.chart .new { fill: var(--new); }
.chart .axis { stroke: var(--rule); }
.chart text { fill: var(--muted); font-size: 11px; }
.legend { display: flex; gap: 14px; color: var(--muted); font-size: 12px; margin-top: 6px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.legend .returning { background: var(--accent); } .legend .new { background: var(--new); }
.empty { color: var(--muted); padding: 8px 0; }
.lists3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
@media (max-width: 520px) { .tile .value { font-size: 20px; } .row-item, .row-head { grid-template-columns: minmax(0, 1fr) 4.5em 4em; } }
`

/** The script, with the names it shows built in. No template literals or ${} inside, so it can live in this string. */
export function dashboardJs(): string {
  return `(function () {
'use strict';
var L = ${JSON.stringify(labelsForDashboard())};
var KEY = 'kl_stats_key', VIEW = 'kl_stats_view';
function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function put(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
var saved = {}; try { saved = JSON.parse(get(VIEW) || '{}') || {}; } catch (e) { saved = {}; }
var state = { key: get(KEY), period: saved.period || '30d', host: saved.host || 'www.kivalens.org', seq: 0 };
var nf = new Intl.NumberFormat('en-US');
function num(n) { return nf.format(Math.round(n || 0)); }
function pct(a, b) { return b ? (Math.round((a * 1000) / b) / 10) + '%' : '\\u2013'; }
function $(id) { return document.getElementById(id); }
function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = String(text); return e; }
function svg(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) e.setAttribute(k, String(attrs[k])); return e; }
function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
function todayUtc() { return iso(Date.now()); }
function windowFor(p) {
  var today = todayUtc(), t = Date.parse(today + 'T00:00:00Z'), day = 86400000, d = new Date(t);
  if (p === '7d') return { from: iso(t - 6 * day), to: today };
  if (p === '45d') return { from: iso(t - 44 * day), to: today };
  if (p === 'month') return { from: today.slice(0, 8) + '01', to: today };
  if (p === 'lastmonth') return { from: iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)), to: iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)) };
  return { from: iso(t - 29 * day), to: today };
}
function monthName(m) { var p = m.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); }
function dayName(d) { return new Date(d + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }

function syncControls() {
  $('host').value = state.host;
  var bs = document.querySelectorAll('.periods button');
  for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-period') === state.period ? 'true' : 'false');
  $('forget').hidden = !state.key;
}
function remember() { put(VIEW, JSON.stringify({ period: state.period, host: state.host })); }
function showKeyForm(message) {
  $('keyform').hidden = false; $('report').hidden = true; $('keyerror').textContent = message || ''; $('status').textContent = '';
  syncControls(); $('key').focus();
}

function load() {
  syncControls();
  if (!state.key) { showKeyForm(''); return; }
  var w = windowFor(state.period), seq = ++state.seq;
  $('status').textContent = 'Loading\\u2026';
  var url = '/v1/stats?from=' + w.from + '&to=' + w.to + '&host=' + encodeURIComponent(state.host);
  fetch(url, { headers: { Authorization: 'Bearer ' + state.key }, cache: 'no-store' })
    .then(function (r) {
      if (seq !== state.seq) return null;
      if (r.status === 401) { state.key = null; put(KEY, null); showKeyForm('That key was not accepted. Paste the key set with wrangler secret put STATS_KEY.'); return null; }
      if (r.status === 503) { showKeyForm('The collector has no stats key yet. Set one with wrangler secret put STATS_KEY, then paste it here.'); return null; }
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) { throw new Error((j && j.error) || ('The collector answered ' + r.status + '.')); });
      }
      return r.json();
    })
    .then(function (data) {
      if (!data || seq !== state.seq) return;
      $('keyform').hidden = true; $('report').hidden = false;
      render(data);
      drawChart();
      $('status').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    })
    .catch(function (e) {
      if (seq !== state.seq) return;
      $('status').textContent = '';
      var r = $('report'); r.hidden = false; r.textContent = '';
      var p = el('section', 'panel'); p.appendChild(el('h2', null, 'Could not load the numbers'));
      p.appendChild(el('p', 'note', (e && e.message) || 'The collector could not be reached.'));
      var b = el('button', null, 'Try again'); b.type = 'button'; b.addEventListener('click', load); p.appendChild(b);
      r.appendChild(p);
    });
}

function tile(label, value, sub) {
  var t = el('div', 'tile'); t.appendChild(el('div', 'label', label)); t.appendChild(el('div', 'value', value)); if (sub) t.appendChild(el('div', 'sub', sub)); return t;
}
function panel(title, note) { var p = el('section', 'panel'); p.appendChild(el('h2', null, title)); if (note) p.appendChild(el('p', 'note', note)); return p; }
function find(list, key) { for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i]; return null; }

function rowList(items, denom, opts) {
  var box = el('div', 'rows');
  var head = el('div', 'row-head'); head.appendChild(el('span', null, opts.nameHead || '')); head.appendChild(el('span', null, opts.shareHead || 'Browsers')); head.appendChild(el('span', null, opts.countHead || 'Times'));
  box.appendChild(head);
  if (!items.length) { box.appendChild(el('div', 'empty', opts.empty || 'Nothing yet in this period.')); return box; }
  var max = 0; for (var i = 0; i < items.length; i++) max = Math.max(max, items[i].share);
  for (var j = 0; j < items.length; j++) {
    var it = items[j], row = el('div', 'row-item' + (it.sub ? ' sub' : ' primary'));
    var fill = el('span', 'fill'); fill.style.width = (denom ? Math.min(100, (it.share / denom) * 100) : 0) + '%'; row.appendChild(fill);
    var name = el('span', 'name', it.name); name.title = it.title || it.name; row.appendChild(name);
    row.appendChild(el('span', 'num', opts.shareText ? opts.shareText(it) : pct(it.share, denom)));
    row.appendChild(el('span', 'num', num(it.count)));
    box.appendChild(row);
  }
  return box;
}

function criteriaPanel(d) {
  var p = panel('Criteria used', 'Share of browsers that searched with each criterion, and how many searches used it. A criterion counts while it is in force, whether it was just set or kept from an earlier visit. Partner criteria count only in MFI Only, where they apply.');
  var denom = d.totals.browsers;
  var base = {}, subs = {}, modes = [];
  d.criteria.forEach(function (c) {
    var i = c.key.indexOf(':');
    if (c.key.indexOf('mode:') === 0) { modes.push(c); return; }
    if (i < 0) base[c.key] = c; else { var b = c.key.slice(0, i); (subs[b] = subs[b] || []).push(c); }
  });
  var groups = { Borrower: [], Partner: [], Portfolio: [], Other: [] };
  Object.keys(base).forEach(function (k) { var g = L.tab[k] || 'Other'; groups[g].push(base[k]); });
  var any = false;
  ['Borrower', 'Partner', 'Portfolio', 'Other'].forEach(function (g) {
    var list = groups[g].sort(function (a, b) { return b.browsers - a.browsers || b.n - a.n; });
    if (!list.length) return;
    any = true;
    p.appendChild(el('div', 'group-title', g + ' tab'));
    var items = [];
    list.forEach(function (c) {
      items.push({ name: L.criteria[c.key] || c.key, title: c.key, share: c.browsers, count: c.n });
      (subs[c.key] || []).sort(function (a, b) { return b.browsers - a.browsers; }).forEach(function (s) {
        var v = s.key.slice(s.key.indexOf(':') + 1), label = v === 'all' ? 'All of (mode)' : v === 'none' ? 'None of (mode)' : v.replace(/_/g, ' ');
        items.push({ name: label, title: s.key, share: s.browsers, count: s.n, sub: true });
      });
    });
    p.appendChild(rowList(items, denom, { nameHead: 'Criterion', countHead: 'Searches' }));
  });
  if (!any) p.appendChild(el('div', 'empty', 'No searches with criteria in this period yet.'));
  if (modes.length) {
    p.appendChild(el('div', 'group-title', 'MFI or Direct'));
    var totalSearches = 0; modes.forEach(function (m) { totalSearches += m.n; });
    p.appendChild(rowList(modes.sort(function (a, b) { return b.n - a.n; }).map(function (m) {
      var k = m.key.slice(5); return { name: L.modes[k] || k, title: m.key, share: m.n, count: m.browsers };
    }), totalSearches, { nameHead: 'Mode', shareHead: 'Searches', countHead: 'Browsers' }));
  }
  return p;
}

function depthPanel(d) {
  var p = panel('Filters per browser', 'How many different criteria each browser used in the period (sort order and MFI/Direct not counted). The split between few and many is the basic / advanced line.');
  var total = 0; d.depth.forEach(function (x) { total += x.browsers; });
  p.appendChild(rowList(d.depth.map(function (x) { return { name: x.key === '1' ? '1 criterion' : x.key + ' criteria', share: x.browsers, count: x.browsers }; }), total, { nameHead: 'Criteria used', shareHead: 'Browsers', countHead: 'Count', shareText: function (it) { return pct(it.share, total); } }));
  return p;
}

function namedPanel(title, note, list, labels, denom, opts) {
  var p = panel(title, note);
  p.appendChild(rowList(list.map(function (x) { return { name: labels(x.key), title: x.key, share: x.browsers, count: x.n }; }), denom, opts || {}));
  return p;
}

function chartPanel(d) {
  var p = panel('Browsers per day', null);
  var box = el('div', 'chart'); p.appendChild(box);
  var lg = el('div', 'legend'); var a = el('span'); a.appendChild(el('i', 'returning')); a.appendChild(document.createTextNode('Returning')); var b = el('span'); b.appendChild(el('i', 'new')); b.appendChild(document.createTextNode('New (first seen that day)')); lg.appendChild(a); lg.appendChild(b);
  p.appendChild(lg);
  chart = { box: box, data: d };
  return p;
}

// Drawn at the box's real width (text in a stretched drawing is stretched too), and
// again when the window is resized.
var chart = null;
function drawChart() {
  if (!chart) return;
  var d = chart.data, box = chart.box;
  box.textContent = '';
  var days = [], byDay = {};
  d.daily.forEach(function (r) { byDay[r.day] = r; });
  for (var t = Date.parse(d.window.from + 'T00:00:00Z'); t <= Date.parse(d.window.to + 'T00:00:00Z'); t += 86400000) days.push(iso(t));
  var W = Math.max(240, box.clientWidth || 760), H = 190, left = 36, bottom = 20, top = 8, max = 1;
  days.forEach(function (x) { var r = byDay[x]; if (r) max = Math.max(max, r.browsers); });
  var step = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / step) * step; if (nice < 1) nice = 1;
  var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Browsers per day, new and returning' });
  var plotH = H - top - bottom, bw = (W - left) / Math.max(days.length, 1);
  for (var g = 0; g <= 2; g++) {
    var v = (nice * g) / 2, y = top + plotH - (v / nice) * plotH;
    s.appendChild(svg('line', { x1: left, x2: W, y1: y, y2: y, class: 'axis' }));
    var lab = svg('text', { x: left - 6, y: y + 4, 'text-anchor': 'end' }); lab.textContent = Number.isInteger(v) ? num(v) : v.toFixed(1); s.appendChild(lab);
  }
  var every = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor((W - left) / 70))));
  days.forEach(function (x, i) {
    var r = byDay[x] || { browsers: 0, new_browsers: 0, pages: 0, searches: 0 };
    var ret = Math.max(0, r.browsers - r.new_browsers), X = left + i * bw + bw * 0.12, BW = Math.max(1, bw * 0.76);
    var hRet = (ret / nice) * plotH, hNew = (r.new_browsers / nice) * plotH;
    var gEl = svg('g', {});
    var title = svg('title', {}); title.textContent = dayName(x) + ': ' + num(r.browsers) + ' browsers (' + num(r.new_browsers) + ' new), ' + num(r.pages) + ' page loads, ' + num(r.searches) + ' searches'; gEl.appendChild(title);
    gEl.appendChild(svg('rect', { x: X, width: BW, y: top + plotH - hRet, height: hRet, class: 'returning' }));
    gEl.appendChild(svg('rect', { x: X, width: BW, y: top + plotH - hRet - hNew, height: hNew, class: 'new' }));
    s.appendChild(gEl);
    if (i % every === 0) { var t2 = svg('text', { x: X + BW / 2, y: H - 5, 'text-anchor': 'middle' }); t2.textContent = dayName(x); s.appendChild(t2); }
  });
  box.appendChild(s);
}
var resizeTimer = 0;
window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawChart, 150); });

function monthsPanel(d) {
  var p = panel('Months', 'Browsers are counted once a month however often they come back. Months are kept after the daily reports expire; the current month is counted live.');
  var wrap = el('div', 'scroll'), t = el('table'), head = el('tr');
  ['Month', 'Browsers', 'New', 'Lender ID', 'Page loads', 'Searches', 'Per browser'].forEach(function (h) { head.appendChild(el('th', null, h)); });
  var thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
  var body = el('tbody');
  d.months.slice().reverse().forEach(function (m) {
    var tr = el('tr');
    tr.appendChild(el('td', null, monthName(m.month) + (m.live ? ' (so far)' : '')));
    tr.appendChild(el('td', null, num(m.browsers)));
    tr.appendChild(el('td', null, num(m.new_browsers)));
    tr.appendChild(el('td', null, num(m.lender_browsers) + ' \\u00b7 ' + pct(m.lender_browsers, m.browsers)));
    tr.appendChild(el('td', null, num(m.pages)));
    tr.appendChild(el('td', null, num(m.searches)));
    tr.appendChild(el('td', null, m.browsers ? (Math.round((m.searches / m.browsers) * 10) / 10).toString() : '\\u2013'));
    body.appendChild(tr);
  });
  t.appendChild(body); wrap.appendChild(t); p.appendChild(wrap);
  return p;
}

function render(d) {
  var r = $('report'); r.textContent = '';
  var T = d.totals, ev = function (k) { var x = find(d.events, k); return x ? x.n : 0; };
  if (d.window.from > windowFor(state.period).from) {
    r.appendChild(el('p', 'note', 'Counted from ' + dayName(d.window.from) + ': daily reports are kept 45 days. Earlier months are in the Months table.'));
  }
  var tiles = el('section', 'tiles');
  tiles.appendChild(tile('Browsers', num(T.browsers), num(T.new_browsers) + ' new'));
  tiles.appendChild(tile('With a lender ID', num(T.lender_browsers), pct(T.lender_browsers, T.browsers) + ' of browsers'));
  tiles.appendChild(tile('Page loads', num(T.pages), num(T.shared) + ' from browsers that share usage'));
  tiles.appendChild(tile('Searches', num(T.searches), T.browsers ? (Math.round((T.searches / T.browsers) * 10) / 10) + ' per browser' : ''));
  var loanPages = find(d.pages, 'loan');
  tiles.appendChild(tile('Loans opened', num(loanPages ? loanPages.n : 0), loanPages ? num(loanPages.browsers) + ' browsers' : ''));
  tiles.appendChild(tile('Added to basket', num(ev('basket_add')), 'loans'));
  tiles.appendChild(tile('Sent to Kiva', num(ev('checkout_loans')), num(ev('checkout')) + ' checkouts'));
  r.appendChild(tiles);
  r.appendChild(chartPanel(d));
  r.appendChild(monthsPanel(d));
  // Three stacks side by side (one under another on a narrow screen): the long
  // criteria list, then the short panels, so no column holds a gap beside it.
  var grid = el('div', 'grid');
  var col1 = el('div', 'stack'), col2 = el('div', 'stack'), col3 = el('div', 'stack');
  col1.appendChild(criteriaPanel(d));
  col2.appendChild(depthPanel(d));
  col2.appendChild(namedPanel('Pages', 'Share of browsers that went to each page, and how many times.', d.pages, function (k) { return L.pages[k] || k; }, T.browsers, { nameHead: 'Page' }));
  col2.appendChild(namedPanel('Actions', 'Built-in saved searches are named; a lender\\u2019s own are counted together.', d.events, function (k) {
    if (k.indexOf('preset:') === 0) { var n = k.slice(7); return 'Built-in search: ' + (L.presets[n] || n); }
    return L.events[k] || k;
  }, T.browsers, { nameHead: 'Action' }));
  col3.appendChild(namedPanel('Where visits start', 'The page each page load began on, for every page load (including browsers that do not share usage).', d.landing, function (k) { return L.pages[k] || k; }, T.pages, { nameHead: 'Page', shareHead: 'Loads', countHead: 'Count', shareText: function (it) { return pct(it.count, T.pages); } }));
  var three = el('section', 'panel'); three.appendChild(el('h2', null, 'Countries, devices and languages'));
  three.appendChild(el('p', 'note', 'By page loads, including browsers that do not share usage.'));
  var lists = el('div', 'lists3');
  [['Country', d.countries], ['Device', d.devices], ['Language', d.langs]].forEach(function (pair) {
    var col = el('div');
    col.appendChild(rowList(pair[1].slice(0, 12).map(function (x) { return { name: x.key, share: x.n, count: x.browsers }; }), T.pages, { nameHead: pair[0], shareHead: 'Loads', countHead: 'Browsers', shareText: function (it) { return pct(it.share, T.pages); } }));
    lists.appendChild(col);
  });
  three.appendChild(lists);
  col3.appendChild(three);
  grid.appendChild(col1); grid.appendChild(col2); grid.appendChild(col3);
  r.appendChild(grid);
}

document.addEventListener('DOMContentLoaded', function () {
  $('host').addEventListener('change', function (e) { state.host = e.target.value; remember(); load(); });
  var bs = document.querySelectorAll('.periods button');
  for (var i = 0; i < bs.length; i++) bs[i].addEventListener('click', function (e) { state.period = e.currentTarget.getAttribute('data-period'); remember(); load(); });
  $('keyform').addEventListener('submit', function (e) {
    e.preventDefault();
    var k = $('key').value.trim();
    if (!k) { $('keyerror').textContent = 'Paste the key first.'; return; }
    state.key = k; put(KEY, k); $('key').value = ''; load();
  });
  $('forget').addEventListener('click', function () { state.key = null; put(KEY, null); showKeyForm(''); });
  load();
});
})();
`
}
