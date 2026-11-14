// Starry Sky 2 — звёздное небо из Drop shadow.
// Звезда = тень почти невидимой точки (fill 0.2%). Figma даёт максимум 8 Drop shadow на слой,
// поэтому звёзды раскладываются по точкам по 8 штук.
//
// Главное правило баланса: количество звёзд растёт как sqrt(площади), а не как площадь.
// Иначе маленькая кнопка с тем же числом звёзд, что и секция, выходит перенасыщенной,
// а большая секция — пустой. Образцы: секция 1440×760 ≈ 248 звёзд, кнопка 180×44 ≈ 24.

var KEY = 'starsky';
var VERSION = 2;
var MAX_SHADOWS = 8;
var DENSITY_K = 0.5;           // насыщенность 50% → 0.25 * sqrt(w*h)
var ALPHA = [[0.35, 0.8], [0.6, 1], [0.85, 1]]; // дальние / средние / ближние
var LAYER_NAMES = ['far', 'mid', 'near'];

var PRESETS = {
  // midShare/bigShare — доля средних и крупных (размытых) звёзд, остальное — мелкие резкие.
  // Кнопка: средних нет вовсе — на 44px высоты три размера читаются как «горох».
  section: { density: 50, brightness: 100, size: 1, sizeSpread: 3,   blur: 1, midShare: 25, bigShare: 10, shape: 'dot', cluster: 0,  inset: 0, color: '#FFFFFF', accent: '#B9A4FF', accentPct: 0,  clip: true },
  button:  { density: 54, brightness: 100, size: 1, sizeSpread: 1.5, blur: 1, midShare: 0,  bigShare: 33, shape: 'dot', cluster: 0,  inset: 0, color: '#FFFFFF', accent: '#B9A4FF', accentPct: 0,  clip: true,
             alpha: [[0.5, 1], [0.6, 1], [0.7, 1]] },
  galaxy:  { density: 70, brightness: 90,  size: 1, sizeSpread: 2.5, blur: 1, midShare: 25, bigShare: 10, shape: 'dot', cluster: 65, inset: 0, color: '#FFFFFF', accent: '#B9A4FF', accentPct: 30, clip: true }
};

figma.showUI(__html__, { width: 320, height: 885, themeColors: true });

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  var h = String(hex || '#FFFFFF').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  if (isNaN(n)) n = 0xFFFFFF;
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function q(x, step) { return Math.round(x / step) * step; }

// Сколько звёзд и каких получится — общая функция для генерации и подсказки в UI
function plan(s, w, h) {
  var total = Math.round((s.density / 100) * DENSITY_K * Math.sqrt(w * h));
  var midShare = s.midShare == null ? 25 : s.midShare;
  var bigShare = s.bigShare == null ? 10 : s.bigShare;
  var near = Math.round(total * bigShare / 100);
  var mid = Math.min(total - near, Math.round(total * midShare / 100));
  var far = Math.max(0, total - near - mid);
  var A = s.alpha || ALPHA;
  var sFar = s.size;
  var sNear = Math.max(sFar, q(s.size * s.sizeSpread, 0.25));
  var sMid = Math.max(sFar, q((sFar + sNear) / 2, 0.25));
  var b = s.blur;
  var layers = [
    { count: far,  size: sFar,  blur: 0,                         alpha: A[0] },
    { count: mid,  size: sMid,  blur: b >= 2 ? q(b - 1, 0.5) : 0, alpha: A[1] },
    { count: near, size: sNear, blur: b,                         alpha: A[2] }
  ];
  // Форма: dot — круги, sparkle — четырёхлучевые искры, mix — мелкие круги + искры на средних и крупных
  var shape = s.shape || 'dot';
  for (var i = 0; i < layers.length; i++) {
    var sp = shape === 'sparkle' || (shape === 'mix' && i > 0);
    layers[i].shape = sp ? 'sparkle' : 'dot';
    if (sp) layers[i].size = sparkleSize(layers[i].size);
  }
  return layers;
}

// Искра той же «величины», что и круг, должна быть крупнее: у неё тонкие лучи и мало площади.
// Меньше 3px форма не читается — превращается в точку.
function sparkleSize(size) { return Math.max(3, q(size * 3, 0.5)); }

// Четырёхлучевая искра с вогнутыми гранями: 4 квадратичные кривые с контрольными точками у центра
function sparklePath(S) {
  var c = S / 2, k = S * 0.1;
  function p(x, y) { return (Math.round(x * 1000) / 1000) + ' ' + (Math.round(y * 1000) / 1000); }
  return 'M ' + p(c, 0) +
    ' Q ' + p(c + k, c - k) + ' ' + p(S, c) +
    ' Q ' + p(c + k, c + k) + ' ' + p(c, S) +
    ' Q ' + p(c - k, c + k) + ' ' + p(0, c) +
    ' Q ' + p(c - k, c - k) + ' ' + p(c, 0) + ' Z';
}

function makeSource(shape, size) {
  var n;
  if (shape === 'sparkle') {
    n = figma.createVector();
    n.vectorPaths = [{ windingRule: 'NONZERO', data: sparklePath(size) }];
  } else {
    n = figma.createEllipse();
    n.resize(size, size);
  }
  n.strokes = []; // у нового вектора бывает обводка по умолчанию — она выдаёт источник в углу
  return n;
}

function readSaved(node) {
  try {
    var raw = node.getPluginData(KEY);
    var d = raw ? JSON.parse(raw) : null;
    return d && d.v === VERSION ? d : null;
  } catch (e) { return null; }
}

function resolveTarget() {
  var sel = figma.currentPage.selection;
  if (sel.length !== 1) return { error: 'Выдели один фрейм' };
  var node = sel[0];

  var p = node;
  while (p && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
    if (p.getPluginData(KEY)) return { container: p.parent, stars: p };
    p = p.parent;
  }
  if (node.type === 'INSTANCE') return { error: 'Это Instance. Открой главный компонент и выдели его' };
  if (node.type !== 'FRAME' && node.type !== 'COMPONENT') return { error: 'Нужен Frame или Component (сейчас: ' + node.type + ')' };

  var stars = null;
  for (var i = 0; i < node.children.length; i++) {
    if (node.children[i].getPluginData(KEY)) { stars = node.children[i]; break; }
  }
  return { container: node, stars: stars };
}

function generate(s, seed) {
  var t = resolveTarget();
  if (t.error) return { error: t.error };
  var container = t.container;
  var stars = t.stars;
  var w = Math.max(1, Math.round(container.width));
  var h = Math.max(1, Math.round(container.height));

  if (!stars) {
    stars = figma.createFrame();
    stars.name = '★ Stars';
    stars.fills = [];
    stars.clipsContent = false;
    container.insertChild(0, stars); // над заливкой фона, под контентом
    if ('layoutMode' in container && container.layoutMode !== 'NONE') stars.layoutPositioning = 'ABSOLUTE';
  }
  stars.resize(w, h);
  stars.x = 0; stars.y = 0;
  var old = stars.children.slice();
  for (var o = 0; o < old.length; o++) old[o].remove();

  var inset = Math.max(0, Math.min(s.inset, Math.min(w, h) / 2 - 1));
  var aw = Math.max(1, w - 2 * inset), ah = Math.max(1, h - 2 * inset);
  var color = hexToRgb(s.color), accent = hexToRgb(s.accent);
  var bright = s.brightness / 100;
  var cluster = s.cluster / 100;

  // центры скоплений лежат на одной диагональной полосе — похоже на Млечный путь
  var cr = rng(seed ^ 0x5bd1e995);
  var ang = cr() * Math.PI;
  var centers = [];
  for (var c = 0; c < 4; c++) {
    var tt = (c / 3 - 0.5) * 0.8;
    centers.push({
      x: w / 2 + Math.cos(ang) * tt * w + (cr() - 0.5) * aw * 0.15,
      y: h / 2 + Math.sin(ang) * tt * h + (cr() - 0.5) * ah * 0.15
    });
  }
  var sigma = 0.1 * Math.min(aw, ah) + 0.04 * Math.max(aw, ah);

  var layers = plan(s, w, h);
  var total = 0;
  for (var li = 0; li < layers.length; li++) {
    var L = layers[li];
    if (L.count <= 0) continue;
    var r = rng(seed + li * 7919);
    var fx = [], idx = 0;

    for (var i = 0; i < L.count; i++) {
      // ровно 7 вызовов r() на звезду: при изменении количества уже стоящие звёзды не прыгают
      var u1 = r(), u2 = r(), u3 = Math.max(r(), 1e-6), u4 = r(), u5 = r(), u6 = r(), u7 = r();
      var x, y;
      if (u1 < cluster) {
        var ce = centers[Math.floor(u2 * centers.length)];
        var rad = Math.sqrt(-2 * Math.log(u3)) * sigma;
        x = ce.x + rad * Math.cos(2 * Math.PI * u4);
        y = ce.y + rad * Math.sin(2 * Math.PI * u4);
        if (x < inset || x > w - inset - L.size || y < inset || y > h - inset - L.size) { x = inset + u6 * aw; y = inset + u7 * ah; }
      } else {
        x = inset + u6 * aw; y = inset + u7 * ah;
      }
      x = Math.round(Math.min(Math.max(x, inset), w - inset - L.size));
      y = Math.round(Math.min(Math.max(y, inset), h - inset - L.size));
      var a = Math.min(1, (L.alpha[0] + u5 * (L.alpha[1] - L.alpha[0])) * bright);
      var col = (u2 * 997 % 1) < s.accentPct / 100 ? accent : color;
      fx.push({
        type: 'DROP_SHADOW', visible: true, blendMode: 'NORMAL',
        color: { r: col.r, g: col.g, b: col.b, a: a },
        offset: { x: x, y: y }, radius: 0, spread: 0, showShadowBehindNode: false
      });
      if (fx.length === MAX_SHADOWS || i === L.count - 1) {
        idx++;
        var dot = makeSource(L.shape, L.size);
        dot.name = LAYER_NAMES[li] + ' ' + (L.shape === 'sparkle' ? 'sparkle ' : '') + L.size + 'px / ' + idx;
        dot.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.002 }];
        if (L.blur > 0) fx.push({ type: 'LAYER_BLUR', radius: L.blur, visible: true });
        dot.effects = fx;
        stars.appendChild(dot);
        dot.x = 0; dot.y = 0;
        fx = [];
      }
    }
    total += L.count;
  }

  if (s.clip) container.clipsContent = true;
  stars.setPluginData(KEY, JSON.stringify({ v: VERSION, settings: s, seed: seed }));
  return { total: total, name: container.name };
}

function sendSelection() {
  var t = resolveTarget();
  if (t.error) { figma.ui.postMessage({ type: 'selection', ok: false, text: t.error }); return; }
  figma.ui.postMessage({
    type: 'selection', ok: true,
    text: t.container.name + ' · ' + Math.round(t.container.width) + '×' + Math.round(t.container.height),
    w: t.container.width, h: t.container.height,
    saved: t.stars ? readSaved(t.stars) : null
  });
}

figma.on('selectionchange', sendSelection);

figma.ui.onmessage = function (msg) {
  if (msg.type === 'init') {
    figma.ui.postMessage({ type: 'presets', presets: PRESETS });
    sendSelection();
  } else if (msg.type === 'plan') {
    figma.ui.postMessage({ type: 'plan', layers: plan(msg.settings, msg.w, msg.h) });
  } else if (msg.type === 'apply') {
    try {
      var res = generate(msg.settings, msg.seed);
      if (res.error) figma.ui.postMessage({ type: 'status', text: res.error, error: true });
      else figma.ui.postMessage({ type: 'status', text: res.total + ' звёзд → ' + res.name });
    } catch (e) {
      figma.ui.postMessage({ type: 'status', text: 'Ошибка: ' + e.message, error: true });
    }
  } else if (msg.type === 'clear') {
    var t = resolveTarget();
    if (t.stars) { t.stars.remove(); figma.ui.postMessage({ type: 'status', text: 'Звёзды удалены' }); }
    else figma.ui.postMessage({ type: 'status', text: 'Тут нечего удалять' });
    sendSelection();
  }
};
