// Sky Stars — звёздное небо из Drop shadow.
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
  section: { density: 50, brightness: 100, size: 1, sizeSpread: 3,   blur: 1, midShare: 25, bigShare: 10, shape: 'dot', sparkleCurve: 10, cluster: 0,  inset: 0, color: '#FFFFFF', accent: '#B9A4FF', accentPct: 0,  clip: true },
  button:  { density: 54, brightness: 100, size: 1, sizeSpread: 1.5, blur: 1, midShare: 0,  bigShare: 33, shape: 'dot', sparkleCurve: 10, cluster: 0,  inset: 0, color: '#FFFFFF', accent: '#B9A4FF', accentPct: 0,  clip: true,
             alpha: [[0.5, 1], [0.6, 1], [0.7, 1]] },
  galaxy:  { density: 70, brightness: 90,  size: 1, sizeSpread: 2.5, blur: 1, midShare: 25, bigShare: 10, shape: 'dot', sparkleCurve: 10, cluster: 65, inset: 0, color: '#FFFFFF', accent: '#B9A4FF', accentPct: 30, clip: true }
};

figma.showUI(__html__, { width: 320, height: 930, themeColors: true });

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

// Четырёхлучевая искра: 4 квадратичные кривые между кончиками лучей.
// curve — выпуклость в % от размера: контрольная точка уходит от центра к углу.
// 2% — тонкие иглы, 10% — как у Telegram, 25% — ровный ромб (контрольная точка на прямой), выше — выпуклые грани.
function sparklePath(S, curve) {
  var t = Math.min(50, Math.max(0, curve == null ? 10 : curve)) / 100;
  var c = S / 2, k = S * t;
  function p(x, y) { return (Math.round(x * 1000) / 1000) + ' ' + (Math.round(y * 1000) / 1000); }
  return 'M ' + p(c, 0) +
    ' Q ' + p(c + k, c - k) + ' ' + p(S, c) +
    ' Q ' + p(c + k, c + k) + ' ' + p(c, S) +
    ' Q ' + p(c - k, c + k) + ' ' + p(0, c) +
    ' Q ' + p(c - k, c - k) + ' ' + p(c, 0) + ' Z';
}

function makeSource(shape, size, curve) {
  var n;
  if (shape === 'sparkle') {
    n = figma.createVector();
    n.vectorPaths = [{ windingRule: 'NONZERO', data: sparklePath(size, curve) }];
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

  // Скругление фрейма: звёзды не ставим в углы, которые срежет corner radius
  var R = typeof container.cornerRadius === 'number' ? container.cornerRadius
        : Math.max(container.topLeftRadius || 0, container.topRightRadius || 0, container.bottomLeftRadius || 0, container.bottomRightRadius || 0);
  function inside(cx, cy, m) {
    var x0 = inset + m, y0 = inset + m, x1 = w - inset - m, y1 = h - inset - m;
    if (cx < x0 || cx > x1 || cy < y0 || cy > y1) return false;
    var rr = Math.max(0, R - inset - m);
    if (rr <= 0) return true;
    var qx = cx < x0 + rr ? x0 + rr : (cx > x1 - rr ? x1 - rr : cx);
    var qy = cy < y0 + rr ? y0 + rr : (cy > y1 - rr ? y1 - rr : cy);
    var dx = cx - qx, dy = cy - qy;
    return dx * dx + dy * dy <= rr * rr;
  }

  // Раскладка «лучший из кандидатов» (Mitchell): для каждой звезды пробуем K случайных мест и берём то,
  // что дальше всего от уже поставленных. Чистый random на маленьком числе звёзд почти всегда даёт кучки и дыры.
  // Сначала ставим крупные — они расходятся друг от друга, потом мелкие заполняют промежутки.
  // Расстояние делим на сумму радиусов, поэтому вокруг крупной звезды остаётся больше воздуха.
  var layers = plan(s, w, h);
  var placed = [];
  var shadows = [[], [], []];
  var order = [2, 1, 0];
  var total = 0;
  for (var oi = 0; oi < order.length; oi++) {
    var li = order[oi];
    var L = layers[li];
    if (L.count <= 0) continue;
    var r = rng(seed + li * 7919);
    var K = li === 0 ? 8 : 16;
    var half = L.size / 2;
    var rad = Math.max(L.size, 2);

    for (var i = 0; i < L.count; i++) {
      // фиксированное число вызовов r() на звезду: при изменении количества уже стоящие звёзды не прыгают
      var u1 = r(), u2 = r(), u3 = Math.max(r(), 1e-6), u4 = r(), u5 = r(), u8 = r();
      var cand = [];
      for (var k = 0; k < K; k++) cand.push([r(), r()]);
      var cx, cy, ok = false;

      if (u1 < cluster) {
        var ce = centers[Math.floor(u2 * centers.length)];
        var gr = Math.sqrt(-2 * Math.log(u3)) * sigma;
        cx = ce.x + gr * Math.cos(2 * Math.PI * u4);
        cy = ce.y + gr * Math.sin(2 * Math.PI * u4);
        ok = inside(cx, cy, half);
      }
      if (!ok) {
        var best = -1, bx = 0, by = 0;
        for (var k2 = 0; k2 < K; k2++) {
          var px = inset + half + cand[k2][0] * Math.max(0, aw - L.size);
          var py = inset + half + cand[k2][1] * Math.max(0, ah - L.size);
          if (!inside(px, py, half)) continue;
          var score = 1e9;
          for (var j = 0; j < placed.length; j++) {
            var P = placed[j], ddx = px - P.x, ddy = py - P.y;
            var d = Math.sqrt(ddx * ddx + ddy * ddy) / (rad + P.r);
            if (d < score) score = d;
          }
          if (score > best) { best = score; bx = px; by = py; }
        }
        if (best < 0) { bx = w / 2; by = h / 2; } // все кандидаты вне формы — крайний случай для крошечных фреймов
        cx = bx; cy = by;
      }
      placed.push({ x: cx, y: cy, r: rad });

      var a = Math.min(1, (L.alpha[0] + u5 * (L.alpha[1] - L.alpha[0])) * bright);
      var col = u8 < s.accentPct / 100 ? accent : color;
      shadows[li].push({ x: Math.round(cx - half), y: Math.round(cy - half), a: a, col: col });
    }
    total += L.count;
  }

  // Источники стоят за левым верхним краем: десятки слоёв по 0.2% в одной точке иначе дают видимое пятно.
  // Clip content фрейма их срезает, а смещения теней компенсируют сдвиг.
  for (var li2 = 0; li2 < layers.length; li2++) {
    var L2 = layers[li2], list = shadows[li2];
    var ox = -(Math.ceil(L2.size) + 1);
    for (var g = 0, idx = 1; g < list.length; g += MAX_SHADOWS, idx++) {
      var fx = list.slice(g, g + MAX_SHADOWS).map(function (st) {
        return {
          type: 'DROP_SHADOW', visible: true, blendMode: 'NORMAL',
          color: { r: st.col.r, g: st.col.g, b: st.col.b, a: st.a },
          offset: { x: st.x - ox, y: st.y - ox }, radius: 0, spread: 0, showShadowBehindNode: false
        };
      });
      if (L2.blur > 0) fx.push({ type: 'LAYER_BLUR', radius: L2.blur, visible: true });
      var dot = makeSource(L2.shape, L2.size, s.sparkleCurve);
      dot.name = LAYER_NAMES[li2] + ' ' + (L2.shape === 'sparkle' ? 'sparkle ' : '') + L2.size + 'px / ' + idx;
      dot.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.002 }];
      dot.effects = fx;
      stars.appendChild(dot);
      dot.x = ox; dot.y = ox;
    }
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
