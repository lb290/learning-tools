/* =========================================================
   圆的乐园 · 核心工具库
   ---------------------------------------------------------
   1. 数学：圆周率、1π~100π、圆 / 扇形 / 圆环的计算
   2. 图形：SVG 创建、极坐标、弧线 / 扇形 / 圆环路径
   3. 交互：提示条、彩带、音效、本地存储
   4. 模式注册：各模块通过 CircleLab.registerMode 挂载
   ========================================================= */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PI = Math.PI;          // 数学上的圆周率 3.1415926...
  var PI_APPROX = 3.14;      // 小学课本计算时取 3.14

  /* =======================================================
     一、数学工具
     ======================================================= */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /** 四舍五入到 d 位小数（先加一个很小的数，避免 1.005 这类浮点误差） */
  function round(n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    var p = Math.pow(10, d == null ? 2 : d);
    return Math.round((n + 1e-9) * p) / p;
  }

  /** 数字转文本：最多 d 位小数，四舍五入并去掉末尾多余的 0，如 15.70 → 15.7 */
  function fmtNum(n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    var digits = d == null ? 2 : d;
    return String(parseFloat(round(n, digits).toFixed(digits)));
  }

  /** 数字 + 单位，如 “12.56 厘米” */
  function fmtUnit(n, unit, d) {
    return fmtNum(n, d) + (unit ? ' ' + unit : '');
  }

  /** 1π ~ 100π 乘法表，全部按 π 取 3.14 计算，保留两位小数 */
  var PI_TABLE = (function () {
    var list = [];
    for (var n = 1; n <= 100; n++) {
      var value = round(PI_APPROX * n, 2);
      list.push({ n: n, value: value, text: fmtNum(value, 2) });
    }
    return list;
  })();

  /** 圆的半径 → 直径、周长、面积 */
  function circle(r) {
    r = Number(r) || 0;
    return {
      r: round(r, 4),
      d: round(r * 2, 4),
      C: round(2 * PI_APPROX * r, 4),
      S: round(PI_APPROX * r * r, 4)
    };
  }

  /** 扇形：半径 r、圆心角 angle（0~360 度） → 弧长、面积、占整圆比例 */
  function sector(r, angle) {
    r = Number(r) || 0;
    angle = clamp(Number(angle) || 0, 0, 360);
    var frac = angle / 360;
    return {
      r: r,
      angle: angle,
      frac: frac,
      arc: round(2 * PI_APPROX * r * frac, 4),
      area: round(PI_APPROX * r * r * frac, 4),
      fullArea: round(PI_APPROX * r * r, 4)
    };
  }

  /** 圆环（环形）面积 = πR² − πr² */
  function ring(R, r) {
    R = Number(R) || 0;
    r = Number(r) || 0;
    return {
      R: R,
      r: r,
      area: round(PI_APPROX * (R * R - r * r), 4)
    };
  }

  /* =======================================================
     二、SVG 与几何
     ======================================================= */

  /** 数字坐标保留两位小数，让路径字符串短一些 */
  function f(n) {
    return (Math.round(n * 100) / 100).toString();
  }

  /** 创建 SVG 元素并设置属性 */
  function svgEl(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (attrs[key] != null) node.setAttribute(key, attrs[key]);
      });
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  /**
   * 极坐标：以 12 点方向为 0°，顺时针转 deg 度
   * @returns {{x:number, y:number}}
   */
  function polar(cx, cy, r, deg) {
    var rad = ((deg - 90) * PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  /** 一段圆弧的 path（不回到圆心） */
  function arcPath(cx, cy, r, startDeg, endDeg) {
    var delta = ((endDeg - startDeg) % 360 + 360) % 360;
    var s = polar(cx, cy, r, startDeg);
    var e = polar(cx, cy, r, endDeg);
    if (Math.abs(delta) < 0.01) {
      return 'M ' + f(s.x) + ' ' + f(s.y);
    }
    var large = delta > 180 ? 1 : 0;
    return 'M ' + f(s.x) + ' ' + f(s.y) +
      ' A ' + f(r) + ' ' + f(r) + ' 0 ' + large + ' 1 ' + f(e.x) + ' ' + f(e.y);
  }

  /** 扇形 path：圆心 → 起点 → 弧 → 回到圆心 */
  function sectorPath(cx, cy, r, startDeg, endDeg) {
    var delta = ((endDeg - startDeg) % 360 + 360) % 360;
    if (delta >= 359.99) {
      return 'M ' + f(cx - r) + ' ' + f(cy) +
        ' a ' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0' +
        ' a ' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0 Z';
    }
    var s = polar(cx, cy, r, startDeg);
    var e = polar(cx, cy, r, endDeg);
    var large = delta > 180 ? 1 : 0;
    return 'M ' + f(cx) + ' ' + f(cy) +
      ' L ' + f(s.x) + ' ' + f(s.y) +
      ' A ' + f(r) + ' ' + f(r) + ' 0 ' + large + ' 1 ' + f(e.x) + ' ' + f(e.y) +
      ' Z';
  }

  /** 圆环 path（配合 fill-rule="evenodd" 使用，中间是空的） */
  function donutPath(cx, cy, R, r) {
    return 'M ' + f(cx - R) + ' ' + f(cy) +
      ' a ' + f(R) + ' ' + f(R) + ' 0 1 0 ' + f(2 * R) + ' 0' +
      ' a ' + f(R) + ' ' + f(R) + ' 0 1 0 ' + f(-2 * R) + ' 0 Z ' +
      'M ' + f(cx - r) + ' ' + f(cy) +
      ' a ' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0' +
      ' a ' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0 Z';
  }

  /** 在容器里建一个 SVG 画布，返回 <svg> 元素 */
  function svgRoot(container, viewBox, className) {
    var svg = svgEl('svg', {
      viewBox: viewBox || '0 0 400 400',
      class: className || 'cl-svg',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    container.appendChild(svg);
    return svg;
  }

  /* =======================================================
     三、DOM / 交互小工具
     ======================================================= */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /** 创建元素：el('div', 'my-class', '内容') */
  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------------- 提示条 ---------------- */

  function toast(message, type, ms) {
    var stack = document.getElementById('cl-toast-stack');
    if (!stack) {
      stack = el('div');
      stack.id = 'cl-toast-stack';
      stack.className = 'cl-toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    var item = el('div', 'cl-toast ' + (type || 'info'));
    item.innerHTML = message;
    stack.appendChild(item);
    global.requestAnimationFrame(function () {
      item.classList.add('show');
    });
    global.setTimeout(function () {
      item.classList.remove('show');
      global.setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 300);
    }, ms || 2400);
  }

  /* ---------------- 彩带 ---------------- */

  var confettiCanvas = null;
  var confettiDpr = 1;
  var confettiParticles = [];
  var confettiRaf = 0;

  function ensureConfettiCanvas() {
    if (confettiCanvas && confettiCanvas.parentNode) return confettiCanvas;
    confettiCanvas = el('canvas');
    confettiCanvas.id = 'cl-confetti';
    confettiCanvas.className = 'cl-confetti';
    document.body.appendChild(confettiCanvas);
    return confettiCanvas;
  }

  function sizeConfettiCanvas() {
    if (!confettiCanvas) return;
    confettiDpr = Math.min(global.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.floor(global.innerWidth * confettiDpr);
    confettiCanvas.height = Math.floor(global.innerHeight * confettiDpr);
    confettiCanvas.style.width = global.innerWidth + 'px';
    confettiCanvas.style.height = global.innerHeight + 'px';
  }

  function drawConfetti() {
    if (!confettiCanvas) return;
    var ctx = confettiCanvas.getContext('2d');
    ctx.setTransform(confettiDpr, 0, 0, confettiDpr, 0, 0);
    ctx.clearRect(0, 0, global.innerWidth, global.innerHeight);
    confettiParticles = confettiParticles.filter(function (p) {
      p.vy += 0.16;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.995;
      p.rot += p.vr;
      p.life -= 1;
      if (p.life <= 0 || p.y > global.innerHeight + 40) return false;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
      return true;
    });
    if (confettiParticles.length) {
      confettiRaf = global.requestAnimationFrame(drawConfetti);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiRaf = 0;
    }
  }

  function confetti(options) {
    if (prefersReducedMotion()) return;
    var opts = options || {};
    var colors = opts.colors || ['#2563eb', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];
    var count = opts.count || 70;
    var canvas = ensureConfettiCanvas();
    sizeConfettiCanvas();
    var originX = opts.x == null ? global.innerWidth / 2 : opts.x;
    var originY = opts.y == null ? global.innerHeight * 0.32 : opts.y;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 7;
      confettiParticles.push({
        x: originX + (Math.random() - 0.5) * 60,
        y: originY + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.2,
        size: 6 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 70 + Math.random() * 40,
        round: Math.random() > 0.6
      });
    }
    if (!confettiRaf) confettiRaf = global.requestAnimationFrame(drawConfetti);
  }

  global.addEventListener('resize', function () {
    if (confettiParticles.length) sizeConfettiCanvas();
  });

  /* ---------------- 音效（WebAudio，无外部文件） ---------------- */

  var sound = {
    enabled: true,
    ctx: null,
    init: function () {
      if (this.ctx) return this.ctx;
      try {
        var Ctor = global.AudioContext || global.webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      } catch (e) {
        this.ctx = null;
      }
      return this.ctx;
    },
    setEnabled: function (on) {
      this.enabled = !!on;
      store.set('sound', this.enabled);
    },
    toggle: function () {
      this.setEnabled(!this.enabled);
      return this.enabled;
    },
    beep: function (freq, dur, type, gain, delay) {
      if (!this.enabled) return;
      var ctx = this.init();
      if (!ctx) return;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var vol = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      vol.gain.setValueAtTime(0.0001, t0);
      vol.gain.exponentialRampToValueAtTime(gain == null ? 0.05 : gain, t0 + 0.012);
      vol.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.1));
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + (dur || 0.1) + 0.02);
    },
    click: function () { this.beep(520, 0.05, 'sine', 0.03); },
    tick: function () { this.beep(760, 0.035, 'square', 0.015); },
    correct: function () {
      this.beep(660, 0.09, 'sine', 0.05);
      this.beep(880, 0.14, 'sine', 0.05, 0.09);
    },
    wrong: function () {
      this.beep(240, 0.14, 'sawtooth', 0.03);
      this.beep(180, 0.2, 'sawtooth', 0.03, 0.1);
    },
    win: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        this.beep(notes[i], 0.16, 'sine', 0.05, i * 0.11);
      }
    }
  };

  /* ---------------- 本地存储 ---------------- */

  var store = {
    get: function (key, fallback) {
      try {
        var raw = global.localStorage.getItem('circle-lab:' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        global.localStorage.setItem('circle-lab:' + key, JSON.stringify(value));
      } catch (e) { /* 隐私模式等情况下静默失败 */ }
    },
    remove: function (key) {
      try {
        global.localStorage.removeItem('circle-lab:' + key);
      } catch (e) { /* 忽略 */ }
    }
  };

  sound.enabled = store.get('sound', true) !== false;

  /* =======================================================
     四、模式注册（供 app.js 调用）
     ======================================================= */

  var modes = {};

  /**
   * 注册一个模式模块。
   * 工厂函数接收根容器，返回可选的生命周期对象：
   *   { start: fn, stop: fn }
   */
  function registerMode(name, factory) {
    modes[name] = factory;
  }

  /** 便捷：庆祝（彩带 + 音效） */
  function celebrate(opts) {
    confetti(opts);
    sound.win();
  }

  /* =======================================================
     五、导出
     ======================================================= */

  global.CircleLab = {
    PI: PI,
    PI_APPROX: PI_APPROX,
    PI_TABLE: PI_TABLE,

    clamp: clamp,
    round: round,
    fmtNum: fmtNum,
    fmtUnit: fmtUnit,
    circle: circle,
    sector: sector,
    ring: ring,

    geom: {
      NS: NS,
      f: f,
      svgEl: svgEl,
      svgRoot: svgRoot,
      polar: polar,
      arcPath: arcPath,
      sectorPath: sectorPath,
      donutPath: donutPath
    },

    dom: { $: $, $$: $$, el: el, clear: clear },

    ui: { toast: toast, confetti: confetti, celebrate: celebrate },

    sound: sound,
    store: store,
    prefersReducedMotion: prefersReducedMotion,

    randInt: randInt,
    pick: pick,
    shuffle: shuffle,

    modes: modes,
    registerMode: registerMode,

    // 预留：由 pi-table.js 等公共组件挂载
    parts: {}
  };
})(window);
