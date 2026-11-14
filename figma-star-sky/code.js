// Star Sky — звёздное небо из Drop shadow.
// Каждая звезда = тень одной почти невидимой точки. Figma даёт максимум 8 Drop shadow на слой,
// поэтому N звёзд = ceil(N / 8) точек по 8 теней.

var KEY = 'starsky';
var MAX_SHADOWS = 8;

// base — под какой размер подобраны количества; UI пересчитывает их по площади выделенного фрейма
var PRESETS = {
  section: {
    base: [1440, 760],
    inset: 0, clip: true,
    layers: [
      { on: true, count: 160, size: 1,   aMin: 35, aMax: 80,  blur: 0, color: '#FFFFFF' },
      { on: true, count: 64,  size: 2,   aMin: 60, aMax: 100, blur: 0, color: '#FFFFFF' },
      { on: true, count: 24,  size: 3,   aMin: 85, aMax: 100, blur: 1, color: '#FFFFFF' }
    ]
  },
  button: {
    base: [180, 44],
    inset: 6, clip: true,
    layers: [
      { on: true,  count: 16, size: 1,   aMin: 50, aMax: 100, blur: 0, color: '#FFFFFF' },
      { on: true,  count: 8,  size: 1.5, aMin: 70, aMax: 100, blur: 1, color: '#FFFFFF' },
      { on: false, count: 8,  size: 2,   aMin: 80, aMax: 100, blur: 1, color: '#FFFFFF' }
    ]
  }
};
var LAYER_NAMES = ['far', 'mid', 'near'];

figma.showUI(__html__, { width: 320, height: 800, themeColors: true });

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

function readSaved(node) {
  try {
    var raw = node.getPluginData(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Находит контейнер и уже сгенерированный слой звёзд (если есть)
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

function generate(settings, seed) {
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
    container.insertChild(0, stars); // под контентом, над заливкой фона
    if ('layoutMode' in container && container.layoutMode !== 'NONE') stars.layoutPositioning = 'ABSOLUTE';
  }
  stars.resize(w, h);
  stars.x = 0; stars.y = 0;

  var old = stars.children.slice();
  for (var o = 0; o < old.length; o++) old[o].remove();

  var inset = Math.max(0, Number(settings.inset) || 0);
  var total = 0;

  for (var li = 0; li < settings.layers.length; li++) {
    var L = settings.layers[li];
    if (!L.on || L.count <= 0) continue;
    var r = rng(seed + li * 7919);
    var color = hexToRgb(L.color);
    var aMin = Math.min(L.aMin, L.aMax) / 100;
    var aMax = Math.max(L.aMin, L.aMax) / 100;
    var size = Math.max(0.5, Number(L.size) || 1);
    var dots = Math.ceil(L.count / MAX_SHADOWS);

    for (var d = 0; d < dots; d++) {
      var n = Math.min(MAX_SHADOWS, L.count - d * MAX_SHADOWS);
      var dot = figma.createEllipse();
      dot.name = LAYER_NAMES[li] + ' ' + size + 'px / ' + (d + 1);
      dot.resize(size, size);
      // почти невидимая заливка: источник в (0,0) не видно, а тени рисуются в полную силу
      dot.fills = [{ type: 'SOLID', color: color, opacity: 0.002 }];
      var fx = [];
      for (var s = 0; s < n; s++) {
        var a = aMin + r() * (aMax - aMin);
        fx.push({
          type: 'DROP_SHADOW', visible: true, blendMode: 'NORMAL',
          color: { r: color.r, g: color.g, b: color.b, a: a },
          offset: {
            x: Math.round(inset + r() * Math.max(0, w - 2 * inset - size)),
            y: Math.round(inset + r() * Math.max(0, h - 2 * inset - size))
          },
          radius: 0, spread: 0, showShadowBehindNode: false
        });
      }
      if (L.blur > 0) fx.push({ type: 'LAYER_BLUR', radius: Number(L.blur), visible: true });
      dot.effects = fx;
      stars.appendChild(dot);
      dot.x = 0; dot.y = 0;
      total += n;
    }
  }

  if (settings.clip) container.clipsContent = true;
  stars.setPluginData(KEY, JSON.stringify({ settings: settings, seed: seed }));
  return { total: total, name: container.name };
}

function sendSelection() {
  var t = resolveTarget();
  if (t.error) { figma.ui.postMessage({ type: 'selection', ok: false, text: t.error }); return; }
  var saved = t.stars ? readSaved(t.stars) : null;
  figma.ui.postMessage({
    type: 'selection', ok: true,
    text: t.container.name + ' · ' + Math.round(t.container.width) + '×' + Math.round(t.container.height),
    w: t.container.width, h: t.container.height,
    saved: saved
  });
}

figma.on('selectionchange', sendSelection);

figma.ui.onmessage = function (msg) {
  if (msg.type === 'init') {
    figma.ui.postMessage({ type: 'presets', presets: PRESETS });
    sendSelection();
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
