/* =========================================================
   圆的乐园 · 操作模块（4 个实验台）
   ---------------------------------------------------------
   ① 圆规画圆工坊      设半径 → 点/拖画布定圆心 → 动画画圆
   ② 圆的变身计算器    已知 r 或 d，实时算 d / C / S 并给代入步骤
   ③ 扇形实验室        半径 + 圆心角滑块，弧长 / 面积 / 占比
   ④ 阴影面积工坊      圆环 / 外方内圆 / 内方外圆 / 半圆环

   依赖：window.CircleLab（js/core.js）；计算一律 π = 3.14。
   ========================================================= */
(function () {
  'use strict';

  var CL = window.CircleLab;
  var PI = CL.PI_APPROX;     // 3.14，小学计算用的 π
  var VB = 400;              // SVG 画布 viewBox 边长
  var SCALE = 26;            // 画布比例：1 厘米 = 26 像素

  var dom = CL.dom;
  var geom = CL.geom;
  var el = dom.el;
  var svgEl = geom.svgEl;
  var polar = geom.polar;
  var arcPath = geom.arcPath;
  var sectorPath = geom.sectorPath;
  var donutPath = geom.donutPath;

  var modeVisible = false;   // 整个操作板块是否处于可见状态

  /* =======================================================
     一、通用小工具
     ======================================================= */

  /**
   * 数字转文本：保留 d 位小数、去掉多余的 0。
   * 计算时加一个极小量再四舍五入，避免 7.065 被浮点误差显示成 7.06。
   */
  function num(n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    var digits = d == null ? 2 : d;
    var p = Math.pow(10, digits);
    var rounded = Math.round(n * p + (n < 0 ? -1e-6 : 1e-6)) / p;
    return String(rounded);
  }

  /** 保留两位小数的数值（用于判断结果是否需要写 ≈） */
  function round2(n) {
    return Math.round(n * 100 + (n < 0 ? -1e-6 : 1e-6)) / 100;
  }

  /** π 的 HTML 片段（统一用黄色） */
  function piHtml() {
    return '<span class="pi">π</span>';
  }

  /**
   * 计算结果的「= / ≈」写法：
   *   res(18.84, '厘米')  → "= <b>18.84 厘米</b>"
   *   res(7.065, '平方厘米') → "≈ <b>7.07 平方厘米</b>"
   */
  function res(raw, unit) {
    var rounded = round2(raw);
    var approx = Math.abs(raw - rounded) > 1e-9;
    return (approx ? '≈ ' : '= ') + '<b>' + num(raw) + ' ' + unit + '</b>';
  }

  /** 分步计算列表 */
  function stepsHtml(items) {
    var html = '<ol class="lb-steps">';
    items.forEach(function (text, i) {
      html += '<li class="lb-step">' +
        '<span class="lb-step-no">' + (i + 1) + '</span>' +
        '<span class="lb-step-text">' + text + '</span>' +
        '</li>';
    });
    return html + '</ol>';
  }

  /** 最大公约数（约分占比用） */
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  /** 角度占整圆的最简分数：90 → "1/4"，180 → "1/2"，360 → "1" */
  function fracText(angle) {
    var a = Math.round(angle);
    var g = gcd(a, 360);
    var n = a / g;
    var d = 360 / g;
    return d === 1 ? String(n) : n + '/' + d;
  }

  /** 图片区域里的一行小字（SVG） */
  function svgText(parent, x, y, text, cls, anchor) {
    var node = svgEl('text', {
      x: num(x),
      y: num(y),
      class: 'lb-svg-label ' + (cls || ''),
      'text-anchor': anchor || 'middle'
    }, parent);
    node.textContent = text;
    return node;
  }

  /** 画布纸格（每格 1 厘米），中心对齐 */
  function drawGrid(g) {
    var i;
    for (i = -7; i <= 7; i++) {
      var x = VB / 2 + i * SCALE;
      var y = VB / 2 + i * SCALE;
      svgEl('line', { x1: x, y1: 0, x2: x, y2: VB }, g);
      svgEl('line', { x1: 0, y1: y, x2: VB, y2: y }, g);
    }
    svgEl('rect', { x: 0.5, y: 0.5, width: VB - 1, height: VB - 1, class: 'lb-grid-frame' }, g);
  }

  /** 圆心小圆点 */
  function drawCenter(parent, cx, cy) {
    svgEl('circle', { cx: cx, cy: cy, r: 7, class: 'lb-center-halo' }, parent);
    svgEl('circle', { cx: cx, cy: cy, r: 3.6, class: 'lb-center-dot' }, parent);
  }

  /** 卡片标题 */
  function cardHead(icon, title, sub, chipCls, chipText) {
    var head = el('div', 'cl-card-head lb-head');
    var left = el('div', 'lb-head-main');
    var h3 = el('h3');
    var badge = el('span', 'lb-head-icon', icon);
    badge.setAttribute('aria-hidden', 'true');
    h3.appendChild(badge);
    h3.appendChild(document.createTextNode(title));
    left.appendChild(h3);
    left.appendChild(el('p', 'cl-card-sub', sub));
    head.appendChild(left);
    if (chipText) head.appendChild(el('span', 'cl-chip ' + (chipCls || 'cl-chip-blue'), chipText));
    return head;
  }

  /** 数据小卡网格 */
  function statGrid(items) {
    var grid = el('div', 'cl-stat-grid lb-stats');
    var vals = {};
    items.forEach(function (it) {
      var stat = el('div', 'cl-stat' + (it.tone ? ' ' + it.tone : ''));
      stat.appendChild(el('div', 'stat-label', it.label));
      var value = el('div', 'stat-value', '—');
      stat.appendChild(value);
      grid.appendChild(stat);
      vals[it.key] = value;
    });
    return {
      el: grid,
      val: vals,
      set: function (key, text) {
        if (vals[key]) vals[key].textContent = text;
      }
    };
  }

  /**
   * 滑块 + 数值输入框联动控件
   * opts: { label, min, max, step, value, unit, tone, decimals, onInput, onCommit }
   */
  function makeRange(opts) {
    var min = opts.min;
    var max = opts.max;
    var step = opts.step;
    var value = CL.clamp(opts.value, min, max);
    var decimals = opts.decimals == null ? 1 : opts.decimals;
    var syncing = false;

    var wrap = el('div', 'lb-field');
    var label = el('div', 'cl-field-label');
    var labelText = el('span', 'lb-field-name', opts.label || '');
    var valueText = el('b', 'lb-field-value', '');
    label.appendChild(labelText);
    label.appendChild(valueText);
    wrap.appendChild(label);

    var line = el('div', 'lb-range-line');
    var range = document.createElement('input');
    range.type = 'range';
    range.className = 'cl-range ' + (opts.tone || '');
    range.min = min;
    range.max = max;
    range.step = step;
    range.value = value;
    range.setAttribute('aria-label', opts.label || '滑块');
    var numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.className = 'cl-input lb-num-input';
    numInput.min = min;
    numInput.max = max;
    numInput.step = step;
    numInput.value = value;
    numInput.setAttribute('inputmode', 'decimal');
    numInput.setAttribute('aria-label', (opts.label || '') + '（可输入数字）');
    line.appendChild(range);
    line.appendChild(numInput);
    wrap.appendChild(line);

    function paint() {
      valueText.textContent = num(value, decimals) + (opts.unit ? ' ' + opts.unit : '');
      if (document.activeElement !== numInput) {
        numInput.value = num(value, decimals);
      }
      range.value = String(value);
    }

    function apply(v, silent) {
      if (typeof v !== 'number' || !isFinite(v)) return;
      v = CL.clamp(v, min, max);
      var changed = v !== value;
      value = v;
      paint();
      if (changed && !silent && opts.onInput) {
        syncing = true;
        opts.onInput(value);
        syncing = false;
      }
    }

    range.addEventListener('input', function () {
      if (syncing) return;
      apply(parseFloat(range.value), false);
    });
    range.addEventListener('change', function () {
      if (opts.onCommit) opts.onCommit(value);
      else CL.sound.tick();
    });
    numInput.addEventListener('input', function () {
      var v = parseFloat(numInput.value);
      if (!isFinite(v) || v < min || v > max) return;
      apply(v, false);
    });
    numInput.addEventListener('change', function () {
      var v = parseFloat(numInput.value);
      if (!isFinite(v)) v = value;
      apply(v, false);
      if (opts.onCommit) opts.onCommit(value);
      else CL.sound.tick();
    });

    paint();

    return {
      el: wrap,
      get: function () { return value; },
      set: function (v) { apply(v, false); },
      setSilent: function (v) { apply(v, true); },
      refresh: paint,
      setLabel: function (text) { labelText.textContent = text; },
      setBounds: function (lo, hi, st) {
        min = lo;
        max = hi;
        step = st || step;
        range.min = lo;
        range.max = hi;
        range.step = step;
        numInput.min = lo;
        numInput.max = hi;
        numInput.step = step;
        apply(CL.clamp(value, lo, hi), true);
      },
      /** 失焦时把输入框里的不规范内容刷回合法值 */
      normalize: function () { paint(); }
    };
  }

  /* =======================================================
     二、① 圆规画圆工坊
     ======================================================= */

  function buildCompass() {
    var panel = el('section', 'cl-card lb-panel');
    panel.appendChild(cardHead('🖍️', '圆规画圆工坊',
      '先定好圆规张开多大，再在画布上点一下（或拖动）确定圆心，看圆规转一圈把圆画出来。',
      'cl-chip-blue', '动手画一画'));

    var body = el('div', 'lb-body');
    var controls = el('div', 'lb-controls');
    var stage = el('div', 'lb-stage');
    body.appendChild(controls);
    body.appendChild(stage);
    panel.appendChild(body);

    var below = el('div', 'lb-below');
    panel.appendChild(below);

    /* ---------- 画布 ---------- */
    var canvas = el('div', 'lb-canvas lb-canvas-draw');
    var svg = geom.svgRoot(canvas, '0 0 ' + VB + ' ' + VB, 'cl-svg lb-svg');
    var gGrid = svgEl('g', { class: 'lb-grid' }, svg);
    drawGrid(gGrid);
    var gShapes = svgEl('g', { class: 'lb-shapes' }, svg);

    var previewEl = svgEl('circle', {
      cx: VB / 2, cy: VB / 2, r: 0, class: 'lb-preview-circle'
    }, gShapes);
    var circleEl = svgEl('circle', {
      cx: VB / 2, cy: VB / 2, r: 0, class: 'lb-draw-circle'
    }, gShapes);
    var armEl = svgEl('line', {
      x1: VB / 2, y1: VB / 2, x2: VB / 2, y2: VB / 2, class: 'lb-arm'
    }, gShapes);
    var pencilEl = svgEl('circle', {
      cx: VB / 2, cy: VB / 2, r: 5, class: 'lb-pencil'
    }, gShapes);
    var radiusLine = svgEl('line', {
      x1: 0, y1: 0, x2: 0, y2: 0, class: 'lb-dim-line lb-dim-blue'
    }, gShapes);
    var diameterLine = svgEl('line', {
      x1: 0, y1: 0, x2: 0, y2: 0, class: 'lb-dim-line lb-dim-amber lb-dim-dash'
    }, gShapes);
    var rLabel = svgText(gShapes, 0, 0, '', 'lb-label-r');
    var dLabel = svgText(gShapes, 0, 0, '', 'lb-label-d');
    var centerLayer = svgEl('g', { class: 'lb-center-layer' }, gShapes);
    drawCenter(centerLayer, VB / 2, VB / 2);

    var hint = el('div', 'lb-hint');
    hint.innerHTML = '<span>👆 在画布上点一下，确定圆心</span>';
    canvas.appendChild(hint);
    stage.appendChild(canvas);

    var legend = el('div', 'cl-legend');
    legend.innerHTML =
      '<span class="cl-legend-item"><i class="cl-legend-dot"></i>半径 r</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot amber"></i>直径 d</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot purple"></i>圆（周长 C）</span>';
    stage.appendChild(legend);

    /* ---------- 控件 ---------- */
    var radiusCtl = makeRange({
      label: '圆规两脚张开的距离（半径 r）',
      min: 0.5, max: 6, step: 0.5, value: 2, unit: '厘米', decimals: 1,
      onInput: function () { syncRadius(); },
      onCommit: function () { CL.sound.tick(); }
    });
    controls.appendChild(radiusCtl.el);

    var btnRow = el('div', 'cl-btn-row lb-actions');
    var centerBtn = el('button', 'cl-btn cl-btn-primary cl-btn-sm', '🎯 在正中画圆');
    centerBtn.type = 'button';
    var clearBtn = el('button', 'cl-btn cl-btn-ghost cl-btn-sm', '🧹 清空画布');
    clearBtn.type = 'button';
    btnRow.appendChild(centerBtn);
    btnRow.appendChild(clearBtn);
    controls.appendChild(btnRow);

    var taskBox = el('div', 'lb-taskbox');
    var taskTop = el('div', 'lb-mini-title');
    taskTop.innerHTML = '<span>🎯 小任务</span><span class="lb-task-progress">0 / 3</span>';
    var taskList = el('ul', 'lb-tasks');
    taskBox.appendChild(taskTop);
    taskBox.appendChild(taskList);
    taskBox.appendChild(el('p', 'lb-task-tip', '在画布上把圆画出来，符合任务的圆会自动打勾 ✔'));
    controls.appendChild(taskBox);
    var taskProgress = taskTop.querySelector('.lb-task-progress');

    /* ---------- 下方数据 ---------- */
    var stats = statGrid([
      { key: 'r', label: '半径 r', tone: '' },
      { key: 'd', label: '直径 d = 2r', tone: 'amber' },
      { key: 'c', label: '周长 C = πd', tone: 'lb-purple' },
      { key: 's', label: '面积 S = πr²', tone: 'green' }
    ]);
    below.appendChild(stats.el);

    var formulaRow = el('div', 'lb-formula-row');
    below.appendChild(formulaRow);

    var note = el('div', 'cl-note lb-note');
    note.innerHTML = '<span class="note-icon">💡</span><span><b>圆心</b>决定圆的位置，<b>半径</b>决定圆的大小。同一个圆里，所有半径都相等，直径是半径的 2 倍。</span>';
    below.appendChild(note);

    /* ---------- 状态 ---------- */
    var tasks = [
      { text: '画一个半径 2 厘米的圆', r: 2, done: false },
      { text: '画一个半径 3 厘米的圆', r: 3, done: false },
      { text: '画一个直径 5 厘米的圆（先想想半径是多少）', r: 2.5, done: false }
    ];
    var cx = VB / 2;
    var cy = VB / 2;
    var lastRpx = 0;
    var placed = false;
    var shown = false;
    var autoDrawn = false;
    var autoTimer = 0;
    var animId = 0;
    var guardTimer = 0;      // 动画保险：rAF 被系统节流时也能把圆画完
    var dragging = false;
    var dragged = false;

    /* ---------- 任务清单 ---------- */
    function renderTasks() {
      taskList.innerHTML = '';
      var doneCount = 0;
      tasks.forEach(function (task) {
        if (task.done) doneCount++;
        var li = el('li', 'lb-task' + (task.done ? ' done' : ''));
        var dot = el('span', 'lb-dot', task.done ? '✓' : '');
        li.appendChild(dot);
        li.appendChild(el('span', 'lb-task-text', task.text));
        taskList.appendChild(li);
      });
      taskProgress.textContent = doneCount + ' / ' + tasks.length;
      taskBox.classList.toggle('all-done', doneCount === tasks.length);
    }
    renderTasks();

    function checkTasks() {
      var rcm = radiusCtl.get();
      var newly = [];
      tasks.forEach(function (task) {
        if (!task.done && Math.abs(rcm - task.r) < 1e-6) {
          task.done = true;
          newly.push(task);
        }
      });
      if (!newly.length) return;
      renderTasks();
      if (tasks.every(function (t) { return t.done; })) {
        CL.sound.correct();
        CL.ui.toast('三个任务全部完成，你就是画圆小能手！🎉', 'good', 2800);
        CL.ui.celebrate({ count: 90 });
      } else {
        CL.sound.correct();
        CL.ui.toast('太棒了！这个圆正好符合任务要求 ✔', 'good', 2200);
      }
    }

    /* ---------- 统计与公式 ---------- */
    function updateStats(rcm) {
      var c = CL.circle(rcm);
      stats.set('r', num(rcm) + ' 厘米');
      stats.set('d', num(c.d) + ' 厘米');
      stats.set('c', num(c.C) + ' 厘米');
      stats.set('s', num(c.S) + ' 平方厘米');
    }

    function updateFormula(rcm) {
      var d = rcm * 2;
      var cRaw = 2 * PI * rcm;
      var sRaw = PI * rcm * rcm;
      formulaRow.innerHTML =
        '<span class="cl-formula">d = 2r = 2 × ' + num(rcm) + ' = ' + num(d) + '</span>' +
        '<span class="cl-formula">C = ' + piHtml() + 'd = 3.14 × ' + num(d) + ' = ' + num(cRaw) + '</span>' +
        '<span class="cl-formula">S = ' + piHtml() + 'r² = 3.14 × ' + num(rcm * rcm) + ' = ' + num(sRaw) + '</span>';
    }

    /* ---------- 动画与绘制 ---------- */
    function cancelAnim() {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
      if (guardTimer) {
        clearTimeout(guardTimer);
        guardTimer = 0;
      }
      armEl.style.opacity = 0;
      pencilEl.style.opacity = 0;
    }

    function hideGuides() {
      radiusLine.style.opacity = 0;
      diameterLine.style.opacity = 0;
      rLabel.style.opacity = 0;
      dLabel.style.opacity = 0;
      centerLayer.style.opacity = 0.35;
    }

    function showGuides() {
      radiusLine.style.opacity = 1;
      diameterLine.style.opacity = 1;
      rLabel.style.opacity = 1;
      dLabel.style.opacity = 1;
      centerLayer.style.opacity = 1;
    }

    function finish(opts) {
      var options = opts || {};
      var rcm = radiusCtl.get();
      var rpx = lastRpx;
      if (guardTimer) {
        clearTimeout(guardTimer);
        guardTimer = 0;
      }
      armEl.style.opacity = 0;
      pencilEl.style.opacity = 0;
      circleEl.style.strokeDasharray = '';
      circleEl.style.strokeDashoffset = '';

      var top = polar(cx, cy, rpx, 0);
      radiusLine.setAttribute('x1', num(cx));
      radiusLine.setAttribute('y1', num(cy));
      radiusLine.setAttribute('x2', num(top.x));
      radiusLine.setAttribute('y2', num(top.y));
      diameterLine.setAttribute('x1', num(cx - rpx));
      diameterLine.setAttribute('y1', num(cy));
      diameterLine.setAttribute('x2', num(cx + rpx));
      diameterLine.setAttribute('y2', num(cy));

      rLabel.textContent = '半径 r = ' + num(rcm) + ' 厘米';
      rLabel.setAttribute('x', num(cx));
      rLabel.setAttribute('text-anchor', 'middle');

      dLabel.textContent = '直径 d = ' + num(rcm * 2) + ' 厘米';
      dLabel.setAttribute('x', num(cx));
      dLabel.setAttribute('text-anchor', 'middle');

      /* 标注放在圆的外面：上方放得下就放上方，否则放下方；直径标注放另一侧 */
      var rAbove = (cy - rpx - 10) >= 16;
      var rY = rAbove ? cy - rpx - 10 : Math.min(cy + rpx + 22, VB - 12);
      var dY = rAbove ? Math.min(cy + rpx + 22, VB - 12) : Math.max(cy - rpx - 10, 12);
      rLabel.setAttribute('y', num(rY));
      dLabel.setAttribute('y', num(dY));

      centerLayer.style.opacity = 1;
      showGuides();
      placed = true;
      hint.classList.add('is-hidden');
      previewEl.style.opacity = 0;
      previewEl.setAttribute('r', 0);
      updateStats(rcm);

      if (options.sound) CL.sound.click();
      if (options.check) checkTasks();
    }

    function place(x, y, animate, opts) {
      var options = opts || {};
      cancelAnim();
      var rcm = radiusCtl.get();
      var rpx = Math.min(rcm * SCALE, VB / 2 - 12);
      lastRpx = rpx;
      cx = CL.clamp(x, rpx + 8, VB - rpx - 8);
      cy = CL.clamp(y, rpx + 8, VB - rpx - 8);

      circleEl.setAttribute('cx', num(cx));
      circleEl.setAttribute('cy', num(cy));
      circleEl.setAttribute('r', num(rpx));
      centerLayer.setAttribute('transform', 'translate(' + num(cx - VB / 2) + ' ' + num(cy - VB / 2) + ')');
      hideGuides();
      hint.classList.add('is-hidden');
      previewEl.style.opacity = 0;

      if (!animate || CL.prefersReducedMotion()) {
        circleEl.style.strokeDasharray = '';
        circleEl.style.strokeDashoffset = '';
        finish(options);
        return;
      }

      var len = 2 * Math.PI * rpx;
      circleEl.style.strokeDasharray = num(len) + ' ' + num(len);
      circleEl.style.strokeDashoffset = num(len);
      armEl.style.opacity = 1;
      pencilEl.style.opacity = 1;

      var startTs = 0;
      function frame(ts) {
        if (!shown || !modeVisible) {
          animId = 0;
          armEl.style.opacity = 0;
          pencilEl.style.opacity = 0;
          finish(options);
          return;
        }
        if (!startTs) startTs = ts;
        var p = CL.clamp((ts - startTs) / 820, 0, 1);
        var eased = 1 - Math.pow(1 - p, 2.6);
        circleEl.style.strokeDashoffset = num(len * (1 - eased));
        var pt = polar(cx, cy, rpx, 90 + 360 * eased);
        armEl.setAttribute('x1', num(cx));
        armEl.setAttribute('y1', num(cy));
        armEl.setAttribute('x2', num(pt.x));
        armEl.setAttribute('y2', num(pt.y));
        pencilEl.setAttribute('cx', num(pt.x));
        pencilEl.setAttribute('cy', num(pt.y));
        if (p < 1) {
          animId = requestAnimationFrame(frame);
        } else {
          animId = 0;
          armEl.style.opacity = 0;
          pencilEl.style.opacity = 0;
          finish(options);
        }
      }
      animId = requestAnimationFrame(frame);
      guardTimer = window.setTimeout(function () {
        guardTimer = 0;
        if (!animId) return;
        cancelAnimationFrame(animId);
        animId = 0;
        finish(options);
      }, 1000);
    }

    function syncRadius() {
      var rcm = radiusCtl.get();
      updateStats(rcm);
      updateFormula(rcm);
      if (placed) {
        place(cx, cy, false, { sound: false, check: true });
      } else {
        previewEl.setAttribute('cx', num(VB / 2));
        previewEl.setAttribute('cy', num(VB / 2));
        previewEl.setAttribute('r', num(rcm * SCALE));
        previewEl.style.opacity = 0.85;
      }
    }

    /* ---------- 交互 ---------- */
    function toSvg(clientX, clientY) {
      var rect = svg.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width * VB,
        y: (clientY - rect.top) / rect.height * VB
      };
    }

    canvas.addEventListener('pointerdown', function (event) {
      if (event.button != null && event.button !== 0) return;
      if (!shown) return;
      dragging = true;
      dragged = false;
      var pt = toSvg(event.clientX, event.clientY);
      place(pt.x, pt.y, true, { sound: true, check: true });
      try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* 忽略 */ }
    });

    canvas.addEventListener('pointermove', function (event) {
      if (!dragging || !shown) return;
      if (event.pointerType === 'touch') return;   // 手机只用手点，避免干扰滚动
      dragged = true;
      var pt = toSvg(event.clientX, event.clientY);
      place(pt.x, pt.y, false, { sound: false, check: false });
    });

    function endPress(event, commit) {
      if (!dragging) return;
      dragging = false;
      try { canvas.releasePointerCapture(event.pointerId); } catch (e) { /* 忽略 */ }
      if (dragged && commit) {
        place(cx, cy, true, { sound: false, check: true });
      }
    }
    canvas.addEventListener('pointerup', function (event) { endPress(event, true); });
    canvas.addEventListener('pointercancel', function (event) { endPress(event, false); });

    centerBtn.addEventListener('click', function () {
      if (!shown) return;
      placed = false;
      place(VB / 2, VB / 2, true, { sound: true, check: true });
    });

    clearBtn.addEventListener('click', function () {
      CL.sound.click();
      cancelAnim();
      placed = false;
      circleEl.setAttribute('r', 0);
      circleEl.style.strokeDasharray = '';
      circleEl.style.strokeDashoffset = '';
      hideGuides();
      var rcm = radiusCtl.get();
      previewEl.setAttribute('cx', num(VB / 2));
      previewEl.setAttribute('cy', num(VB / 2));
      previewEl.setAttribute('r', num(rcm * SCALE));
      previewEl.style.opacity = 0.85;
      hint.classList.remove('is-hidden');
      CL.ui.toast('画布清空啦，再点一下画布试试～', 'info', 1800);
    });

    /* ---------- 初始化 ---------- */
    updateStats(radiusCtl.get());
    updateFormula(radiusCtl.get());
    previewEl.setAttribute('r', num(radiusCtl.get() * SCALE));
    previewEl.style.opacity = 0.85;

    return {
      el: panel,
      onShow: function () {
        shown = true;
        if (!autoDrawn) {
          autoDrawn = true;
          autoTimer = window.setTimeout(function () {
            autoTimer = 0;
            if (!shown || !modeVisible) return;
            place(VB / 2, VB / 2, true, { sound: false, check: false });
          }, 320);
        }
      },
      onHide: function () {
        shown = false;
        if (autoTimer) {
          clearTimeout(autoTimer);
          autoTimer = 0;
        }
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
          armEl.style.opacity = 0;
          pencilEl.style.opacity = 0;
          finish({ sound: false, check: false });
        }
        dragging = false;
      }
    };
  }

  /* =======================================================
     三、② 圆的变身计算器
     ======================================================= */

  function buildCalc() {
    var panel = el('section', 'cl-card lb-panel');
    panel.appendChild(cardHead('🧮', '圆的变身计算器',
      '告诉我半径或者直径，圆的直径、周长、面积马上变身出来，还附上一行行代入过程。',
      'cl-chip-purple', '算一算'));

    var body = el('div', 'lb-body');
    var controls = el('div', 'lb-controls');
    var stage = el('div', 'lb-stage');
    body.appendChild(controls);
    body.appendChild(stage);
    panel.appendChild(body);

    var below = el('div', 'lb-below');
    panel.appendChild(below);

    /* ---------- 已知条件切换 ---------- */
    var seg = el('div', 'cl-seg lb-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', '选择已知条件');
    var btnR = el('button', 'active', '已知半径 r');
    var btnD = el('button', null, '已知直径 d');
    btnR.type = 'button';
    btnD.type = 'button';
    btnR.setAttribute('aria-pressed', 'true');
    btnD.setAttribute('aria-pressed', 'false');
    seg.appendChild(btnR);
    seg.appendChild(btnD);
    controls.appendChild(seg);

    /* ---------- 输入控件 ---------- */
    var inputCtl = makeRange({
      label: '半径 r',
      min: 0.5, max: 10, step: 0.5, value: 3, unit: '厘米', decimals: 1,
      onInput: function () { update(); },
      onCommit: function () { CL.sound.tick(); }
    });
    controls.appendChild(inputCtl.el);

    var quick = el('div', 'cl-btn-row lb-quick');
    var quickLabel = el('span', 'lb-quick-label', '常用数：');
    quick.appendChild(quickLabel);
    [1, 2, 3, 5, 10].forEach(function (v) {
      var b = el('button', 'cl-btn cl-btn-sm cl-btn-ghost', num(v));
      b.type = 'button';
      b.addEventListener('click', function () {
        CL.sound.click();
        inputCtl.set(v);
      });
      quick.appendChild(b);
    });
    controls.appendChild(quick);

    var note = el('div', 'cl-note warn lb-note');
    note.innerHTML = '<span class="note-icon">⚠️</span><span><b>易错提醒：</b>r² 表示 r × r，不是 2 × r。例如 r = 3 时，r² = 3 × 3 = 9，不是 6。</span>';
    controls.appendChild(note);

    /* ---------- 图形 ---------- */
    var canvas = el('div', 'lb-canvas lb-canvas-calc');
    var svg = geom.svgRoot(canvas, '0 0 ' + VB + ' ' + VB, 'cl-svg lb-svg');
    var gShapes = svgEl('g', { class: 'lb-shapes' }, svg);
    var figCircle = svgEl('circle', { cx: VB / 2, cy: VB / 2, r: 0, class: 'lb-draw-circle' }, gShapes);
    var figRadius = svgEl('line', { x1: VB / 2, y1: VB / 2, x2: VB / 2, y2: VB / 2, class: 'lb-dim-line lb-dim-blue' }, gShapes);
    var figDiameter = svgEl('line', { x1: VB / 2, y1: VB / 2, x2: VB / 2, y2: VB / 2, class: 'lb-dim-line lb-dim-amber lb-dim-dash' }, gShapes);
    var figRLabel = svgText(gShapes, VB / 2, 0, '', 'lb-label-r');
    var figDLabel = svgText(gShapes, VB / 2, 0, '', 'lb-label-d');
    var figCenter = svgEl('g', { class: 'lb-center-layer' }, gShapes);
    drawCenter(figCenter, VB / 2, VB / 2);
    stage.appendChild(canvas);

    var legend = el('div', 'cl-legend');
    legend.innerHTML =
      '<span class="cl-legend-item"><i class="cl-legend-dot"></i>半径 r</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot amber"></i>直径 d</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot purple"></i>圆</span>';
    stage.appendChild(legend);

    /* ---------- 结果 ---------- */
    var stats = statGrid([
      { key: 'r', label: '半径 r', tone: '' },
      { key: 'd', label: '直径 d', tone: 'amber' },
      { key: 'c', label: '周长 C', tone: 'lb-purple' },
      { key: 's', label: '面积 S', tone: 'green' }
    ]);
    below.appendChild(stats.el);

    var formulaRow = el('div', 'lb-formula-row');
    below.appendChild(formulaRow);

    var stepsTitle = el('div', 'cl-section-title lb-sub-title', '一步一步算');
    below.appendChild(stepsTitle);
    var stepsBox = el('div', 'lb-steps-box');
    below.appendChild(stepsBox);

    var tip = el('div', 'cl-note lb-note lb-tip');
    tip.innerHTML = '<span class="note-icon">🔎</span><span><b>小发现：</b>半径变成原来的 2 倍，直径、周长也变成 2 倍，但面积会变成 4 倍。把滑块拉到 3 和 6 比一比吧！</span>';
    below.appendChild(tip);

    /* ---------- 状态 ---------- */
    var mode = 'r';   // 'r' 已知半径；'d' 已知直径

    function renderFigure(r, d) {
      var rpx = CL.clamp(r * 16, 12, 168);
      var top = polar(VB / 2, VB / 2, rpx, 0);
      figCircle.setAttribute('cx', VB / 2);
      figCircle.setAttribute('cy', VB / 2);
      figCircle.setAttribute('r', num(rpx));
      figRadius.setAttribute('x1', VB / 2);
      figRadius.setAttribute('y1', VB / 2);
      figRadius.setAttribute('x2', num(top.x));
      figRadius.setAttribute('y2', num(top.y));
      figDiameter.setAttribute('x1', num(VB / 2 - rpx));
      figDiameter.setAttribute('y1', VB / 2);
      figDiameter.setAttribute('x2', num(VB / 2 + rpx));
      figDiameter.setAttribute('y2', VB / 2);
      figRLabel.setAttribute('x', VB / 2);
      figRLabel.setAttribute('y', num(VB / 2 - rpx - 12));
      figRLabel.textContent = 'r = ' + num(r) + ' 厘米';
      figDLabel.setAttribute('x', VB / 2);
      figDLabel.setAttribute('y', num(VB / 2 + rpx + 24));
      figDLabel.textContent = 'd = ' + num(d) + ' 厘米';
    }

    function update() {
      var v = inputCtl.get();
      var r = mode === 'r' ? v : v / 2;
      var d = mode === 'r' ? v * 2 : v;
      var C = 2 * PI * r;
      var S = PI * r * r;

      stats.set('r', num(r) + ' 厘米');
      stats.set('d', num(d) + ' 厘米');
      stats.set('c', num(C) + ' 厘米');
      stats.set('s', num(S) + ' 平方厘米');

      renderFigure(r, d);

      formulaRow.innerHTML =
        '<span class="cl-formula">C = ' + piHtml() + 'd</span>' +
        '<span class="cl-formula">S = ' + piHtml() + 'r²</span>' +
        '<span class="cl-formula">d = 2r</span>';

      var items = [];
      if (mode === 'r') {
        items.push('直径 d = 2 × r = 2 × ' + num(r) + ' ' + res(d, '厘米'));
        items.push('周长 C = ' + piHtml() + ' × d = 3.14 × ' + num(d) + ' ' + res(C, '厘米') +
          '<br><span class="lb-step-note">也可以写成：C = 2 × 3.14 × ' + num(r) + ' ' + res(C, '厘米') + '</span>');
        items.push('面积 S = ' + piHtml() + ' × r² = 3.14 × ' + num(r) + '² = 3.14 × ' + num(r * r) + ' ' + res(S, '平方厘米') +
          '<br><span class="lb-step-note">先算 r² = ' + num(r) + ' × ' + num(r) + ' = ' + num(r * r) + '，再乘 3.14。</span>');
      } else {
        items.push('半径 r = d ÷ 2 = ' + num(d) + ' ÷ 2 ' + res(r, '厘米'));
        items.push('周长 C = ' + piHtml() + ' × d = 3.14 × ' + num(d) + ' ' + res(C, '厘米') +
          '<br><span class="lb-step-note">也可以写成：C = 2 × 3.14 × ' + num(r) + ' ' + res(C, '厘米') + '</span>');
        items.push('面积 S = ' + piHtml() + ' × r² = 3.14 × ' + num(r) + '² = 3.14 × ' + num(r * r) + ' ' + res(S, '平方厘米') +
          '<br><span class="lb-step-note">先求半径 r = ' + num(r) + '，再算 r² = ' + num(r * r) + '。</span>');
      }
      stepsBox.innerHTML = stepsHtml(items);
    }

    function setMode(next) {
      if (next === mode) return;
      var v = inputCtl.get();
      mode = next;
      btnR.classList.toggle('active', mode === 'r');
      btnD.classList.toggle('active', mode === 'd');
      btnR.setAttribute('aria-pressed', mode === 'r' ? 'true' : 'false');
      btnD.setAttribute('aria-pressed', mode === 'd' ? 'true' : 'false');
      if (mode === 'd') {
        inputCtl.setBounds(1, 20, 1);
        inputCtl.setLabel('直径 d');
        inputCtl.setSilent(v * 2);
      } else {
        inputCtl.setBounds(0.5, 10, 0.5);
        inputCtl.setLabel('半径 r');
        inputCtl.setSilent(v / 2);
      }
      update();
      CL.sound.click();
    }

    btnR.addEventListener('click', function () { setMode('r'); });
    btnD.addEventListener('click', function () { setMode('d'); });

    update();

    return {
      el: panel,
      onShow: function () { update(); },
      onHide: function () {}
    };
  }

  /* =======================================================
     四、③ 扇形实验室
     ======================================================= */

  function buildSector() {
    var panel = el('section', 'cl-card lb-panel');
    panel.appendChild(cardHead('🍕', '扇形实验室',
      '拖动半径和圆心角滑块，看看扇形怎么变。圆心角越大，扇形占整圆就越多。',
      'cl-chip-amber', '切一切'));

    var body = el('div', 'lb-body');
    var controls = el('div', 'lb-controls');
    var stage = el('div', 'lb-stage');
    body.appendChild(controls);
    body.appendChild(stage);
    panel.appendChild(body);

    var below = el('div', 'lb-below');
    panel.appendChild(below);

    /* ---------- 控件 ---------- */
    var radiusCtl = makeRange({
      label: '半径 r',
      min: 1, max: 6, step: 0.5, value: 3, unit: '厘米', decimals: 1,
      onInput: function () { render(); },
      onCommit: function () { CL.sound.tick(); }
    });
    controls.appendChild(radiusCtl.el);

    var angleCtl = makeRange({
      label: '圆心角 n（扇形张开的度数）',
      min: 10, max: 360, step: 5, value: 90, unit: '°', decimals: 0, tone: 'cl-range-amber',
      onInput: function () { render(); },
      onCommit: function () { CL.sound.tick(); }
    });
    controls.appendChild(angleCtl.el);

    var quickBox = el('div', 'lb-quickbox');
    quickBox.appendChild(el('div', 'lb-mini-title', '<span>快捷角度</span>'));
    var quickRow = el('div', 'cl-btn-row lb-quick');
    [90, 180, 270, 360].forEach(function (deg) {
      var b = el('button', 'cl-btn cl-btn-sm cl-btn-ghost', deg + '°');
      b.type = 'button';
      b.addEventListener('click', function () {
        CL.sound.click();
        angleCtl.set(deg);
        render();
      });
      quickRow.appendChild(b);
    });
    quickBox.appendChild(quickRow);
    controls.appendChild(quickBox);

    var compareBtn = el('button', 'lb-toggle');
    compareBtn.type = 'button';
    compareBtn.setAttribute('aria-pressed', 'false');
    compareBtn.innerHTML = '<span class="lb-switch" aria-hidden="true"></span><span>整圆对比</span>';
    controls.appendChild(compareBtn);

    var note = el('div', 'cl-note lb-note');
    note.innerHTML = '<span class="note-icon">💡</span><span>整个圆的圆心角是 <b>360°</b>。圆心角是 90° 时，扇形正好占整圆的 <b>1/4</b>；180° 就是 <b>半个圆</b>。</span>';
    controls.appendChild(note);

    /* ---------- 图形 ---------- */
    var canvas = el('div', 'lb-canvas lb-canvas-sector');
    var svg = geom.svgRoot(canvas, '0 0 ' + VB + ' ' + VB, 'cl-svg lb-svg');
    var defs = svgEl('defs', null, svg);
    var grad = svgEl('linearGradient', {
      id: 'lb-sector-grad', x1: '0%', y1: '0%', x2: '100%', y2: '100%'
    }, defs);
    svgEl('stop', { offset: '0%', 'stop-color': '#a78bfa', 'stop-opacity': '0.85' }, grad);
    svgEl('stop', { offset: '100%', 'stop-color': '#22d3ee', 'stop-opacity': '0.55' }, grad);

    var gGrid = svgEl('g', { class: 'lb-grid' }, svg);
    drawGrid(gGrid);
    var gShapes = svgEl('g', { class: 'lb-shapes' }, svg);
    stage.appendChild(canvas);

    var legend = el('div', 'cl-legend');
    legend.innerHTML =
      '<span class="cl-legend-item"><i class="cl-legend-dot purple"></i>扇形</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot" style="background:#22d3ee"></i>弧（弧长）</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot dashed"></i>整圆</span>';
    stage.appendChild(legend);

    /* ---------- 结果 ---------- */
    var stats = statGrid([
      { key: 'arc', label: '弧长', tone: 'lb-purple' },
      { key: 'area', label: '扇形面积', tone: 'green' },
      { key: 'frac', label: '占整圆', tone: 'amber' },
      { key: 'full', label: '整圆面积', tone: '' }
    ]);
    below.appendChild(stats.el);

    var formulaRow = el('div', 'lb-formula-row');
    below.appendChild(formulaRow);

    var stepsTitle = el('div', 'cl-section-title lb-sub-title', '一步一步算');
    below.appendChild(stepsTitle);
    var stepsBox = el('div', 'lb-steps-box');
    below.appendChild(stepsBox);

    var tip = el('div', 'cl-note lb-note lb-tip');
    tip.innerHTML = '<span class="note-icon">🍕</span><span><b>想一想：</b>把 n 调到 360°，扇形就变回整个圆，弧长正好等于周长 πd，面积正好等于 πr²。这就是扇形的秘密！</span>';
    below.appendChild(tip);

    /* ---------- 状态 ---------- */
    var compare = false;
    var cx = VB / 2;
    var cy = VB / 2;

    function render() {
      var r = radiusCtl.get();
      var angle = angleCtl.get();
      var rpx = r * SCALE;
      var info = CL.sector(r, angle);
      var arcRaw = 2 * PI * r * angle / 360;
      var areaRaw = PI * r * r * angle / 360;
      var fullRaw = PI * r * r;
      var frac = angle / 360;

      /* 重画图形 */
      dom.clear(gShapes);

      if (compare) {
        svgEl('circle', {
          cx: cx, cy: cy, r: rpx, class: 'lb-whole-circle'
        }, gShapes);
        svgText(gShapes, cx, cy + rpx + 22, '整圆：周长 ' + num(2 * PI * r) + ' 厘米，面积 ' + num(fullRaw) + ' 平方厘米',
          'lb-label-muted');
      } else {
        svgEl('circle', {
          cx: cx, cy: cy, r: rpx, class: 'lb-ghost-circle'
        }, gShapes);
      }

      if (angle >= 359.5) {
        svgEl('circle', {
          cx: cx, cy: cy, r: rpx, class: 'lb-sector-fill'
        }, gShapes);
        svgEl('circle', {
          cx: cx, cy: cy, r: rpx, class: 'lb-sector-arc'
        }, gShapes);
      } else {
        svgEl('path', {
          d: sectorPath(cx, cy, rpx, 0, angle),
          class: 'lb-sector-fill'
        }, gShapes);
        svgEl('path', {
          d: arcPath(cx, cy, rpx, 0, angle),
          class: 'lb-sector-arc'
        }, gShapes);
        /* 两条半径边 */
        var pEnd = polar(cx, cy, rpx, angle);
        svgEl('line', {
          x1: cx, y1: cy, x2: num(pEnd.x), y2: num(pEnd.y), class: 'lb-sector-edge'
        }, gShapes);
      }

      /* 圆心角小弧 + 标注 */
      var smallR = Math.max(rpx * 0.26, 26);
      if (angle < 359.5) {
        svgEl('path', {
          d: arcPath(cx, cy, smallR, 0, angle),
          class: 'lb-angle-arc'
        }, gShapes);
      }
      var angleLabelAt = polar(cx, cy, smallR + 20, angle / 2);
      svgText(gShapes, angleLabelAt.x, angleLabelAt.y + 4, num(angle, 0) + '°', 'lb-label-d');

      /* 半径标注 */
      var midR = polar(cx, cy, rpx * 0.55, 0);
      svgText(gShapes, midR.x - 10, midR.y + 4, 'r = ' + num(r), 'lb-label-r', 'end');

      /* 弧长标注 */
      var arcLabelAt = polar(cx, cy, Math.min(rpx + 20, VB / 2 - 8), angle / 2);
      svgText(gShapes, arcLabelAt.x, arcLabelAt.y + 4, '弧长 ' + num(arcRaw), 'lb-label-arc');

      drawCenter(gShapes, cx, cy);

      /* 数据 */
      stats.set('arc', num(arcRaw) + ' 厘米');
      stats.set('area', num(areaRaw) + ' 平方厘米');
      stats.set('frac', fracText(angle) + '（' + num(frac * 100, 1) + '%）');
      stats.set('full', num(fullRaw) + ' 平方厘米');

      formulaRow.innerHTML =
        '<span class="cl-formula">弧长 = 2' + piHtml() + 'r × n/360</span>' +
        '<span class="cl-formula">面积 = ' + piHtml() + 'r² × n/360</span>';

      /* 步骤 */
      var items = [
        '占整圆的几分之几：n ÷ 360 = ' + num(angle, 0) + ' ÷ 360 = <b>' + fracText(angle) + '</b>' +
          '（也就是 ' + num(frac * 100, 1) + '%）',
        '弧长 = 2 × ' + piHtml() + ' × r × n/360 = 2 × 3.14 × ' + num(r) + ' × ' + num(angle, 0) + '/360 ' + res(arcRaw, '厘米'),
        '面积 = ' + piHtml() + ' × r² × n/360 = 3.14 × ' + num(r * r) + ' × ' + num(angle, 0) + '/360 ' + res(areaRaw, '平方厘米'),
        '整个圆的面积 = ' + piHtml() + 'r² = 3.14 × ' + num(r * r) + ' ' + res(fullRaw, '平方厘米') +
          '，扇形只占它的 ' + fracText(angle) + '。'
      ];
      stepsBox.innerHTML = stepsHtml(items);
    }

    compareBtn.addEventListener('click', function () {
      compare = !compare;
      compareBtn.setAttribute('aria-pressed', compare ? 'true' : 'false');
      CL.sound.click();
      render();
    });

    render();

    return {
      el: panel,
      onShow: function () { render(); },
      onHide: function () {}
    };
  }

  /* =======================================================
     五、④ 阴影面积工坊
     ======================================================= */

  function buildShadow() {
    var panel = el('section', 'cl-card lb-panel');
    panel.appendChild(cardHead('🌑', '阴影面积工坊',
      '选一个图形，拖滑块改尺寸，阴影面积会实时算出来。想不通就点「显示解题步骤」，一步一步看。',
      'cl-chip-pink', '挖一挖'));

    var body = el('div', 'lb-body');
    var controls = el('div', 'lb-controls');
    var stage = el('div', 'lb-stage');
    body.appendChild(controls);
    body.appendChild(stage);
    panel.appendChild(body);

    var below = el('div', 'lb-below');
    panel.appendChild(below);

    /* ---------- 图形选择 ---------- */
    controls.appendChild(el('div', 'lb-mini-title', '<span>选择图形</span>'));
    var shapeBox = el('div', 'lb-shapes');
    shapeBox.setAttribute('role', 'group');
    shapeBox.setAttribute('aria-label', '选择阴影图形');
    var SHAPES = [
      { id: 'ring', icon: '💿', name: '圆环' },
      { id: 'sqin', icon: '🟦', name: '外方内圆' },
      { id: 'circin', icon: '🔵', name: '内方外圆' },
      { id: 'semi', icon: '🌈', name: '半圆组合' }
    ];
    var shapeBtns = {};
    SHAPES.forEach(function (shape) {
      var b = el('button', 'lb-shape-btn');
      b.type = 'button';
      b.innerHTML = '<span class="lb-shape-icon" aria-hidden="true">' + shape.icon + '</span><span>' + shape.name + '</span>';
      b.addEventListener('click', function () {
        if (state.shape === shape.id) return;
        CL.sound.click();
        setShape(shape.id);
      });
      shapeBox.appendChild(b);
      shapeBtns[shape.id] = b;
    });
    controls.appendChild(shapeBox);

    var ctlBox = el('div', 'lb-ctl-box');
    controls.appendChild(ctlBox);

    var note = el('div', 'cl-note lb-note');
    note.innerHTML = '<span class="note-icon">💡</span><span>求阴影面积常用思路：<b>整体 − 空白</b>。先算外面的大图形，再减掉挖去的部分，剩下的就是阴影。</span>';
    controls.appendChild(note);

    /* ---------- 图形 ---------- */
    var canvas = el('div', 'lb-canvas lb-canvas-shadow');
    var svg = geom.svgRoot(canvas, '0 0 ' + VB + ' ' + VB, 'cl-svg lb-svg');
    var gGrid = svgEl('g', { class: 'lb-grid' }, svg);
    drawGrid(gGrid);
    var gShapes = svgEl('g', { class: 'lb-shapes' }, svg);
    stage.appendChild(canvas);

    var legend = el('div', 'cl-legend');
    legend.innerHTML =
      '<span class="cl-legend-item"><i class="cl-legend-dot pink"></i>阴影部分</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot" style="background:#fff;border:1.5px solid #cbd5e1"></i>挖去的部分</span>' +
      '<span class="cl-legend-item"><i class="cl-legend-dot" style="background:#f59e0b"></i>尺寸标注</span>';
    stage.appendChild(legend);

    /* ---------- 结果 ---------- */
    var stats = statGrid([
      { key: 'a', label: '外面的图形', tone: '' },
      { key: 'b', label: '挖去的部分', tone: 'amber' },
      { key: 's', label: '阴影面积', tone: 'green' }
    ]);
    below.appendChild(stats.el);

    var formulaRow = el('div', 'lb-formula-row');
    below.appendChild(formulaRow);

    var stepsHead = el('div', 'lb-steps-head');
    var stepsBtn = el('button', 'cl-btn cl-btn-sm cl-btn-ghost', '🔍 收起解题步骤');
    stepsBtn.type = 'button';
    stepsBtn.setAttribute('aria-expanded', 'true');
    stepsHead.appendChild(el('div', 'cl-section-title lb-sub-title', '解题步骤'));
    stepsHead.appendChild(stepsBtn);
    below.appendChild(stepsHead);

    var stepsBox = el('div', 'lb-steps-box');
    below.appendChild(stepsBox);

    /* ---------- 状态 ---------- */
    var state = {
      shape: 'ring',
      ring: { R: 6, r: 3 },
      sqin: { a: 6 },
      circin: { r: 3 },
      semi: { R: 6, r: 3 }
    };
    var stepsOpen = true;
    var ctlMap = {};

    function setShape(id) {
      state.shape = id;
      SHAPES.forEach(function (shape) {
        shapeBtns[shape.id].classList.toggle('active', shape.id === id);
      });
      buildControls();
      update();
    }

    /* ---------- 控件构建 ---------- */
    function buildControls() {
      dom.clear(ctlBox);
      ctlMap = {};
      if (state.shape === 'ring' || state.shape === 'semi') {
        var data = state.shape === 'ring' ? state.ring : state.semi;
        var rCtl = makeRange({
          label: '外半径 R',
          min: 2, max: 6, step: 0.5, value: data.R, unit: '厘米', decimals: 1,
          tone: 'cl-range-amber',
          onInput: function (v) {
            data.R = v;
            if (data.r > v - 0.5) {
              data.r = v - 0.5;
              innerCtl.setSilent(data.r);
            }
            innerCtl.setBounds(0.5, v - 0.5, 0.5);
            update();
          },
          onCommit: function () { CL.sound.tick(); }
        });
        var innerCtl = makeRange({
          label: '内半径 r',
          min: 0.5, max: data.R - 0.5, step: 0.5, value: data.r, unit: '厘米', decimals: 1,
          onInput: function (v) { data.r = v; update(); },
          onCommit: function () { CL.sound.tick(); }
        });
        ctlBox.appendChild(rCtl.el);
        ctlBox.appendChild(innerCtl.el);
        ctlMap.R = rCtl;
        ctlMap.r = innerCtl;
      } else if (state.shape === 'sqin') {
        var aCtl = makeRange({
          label: '正方形边长 a',
          min: 2, max: 10, step: 1, value: state.sqin.a, unit: '厘米', decimals: 0,
          tone: 'cl-range-amber',
          onInput: function (v) { state.sqin.a = v; update(); },
          onCommit: function () { CL.sound.tick(); }
        });
        ctlBox.appendChild(aCtl.el);
        ctlMap.a = aCtl;
      } else {
        var cCtl = makeRange({
          label: '圆的半径 r',
          min: 1, max: 6, step: 0.5, value: state.circin.r, unit: '厘米', decimals: 1,
          onInput: function (v) { state.circin.r = v; update(); },
          onCommit: function () { CL.sound.tick(); }
        });
        ctlBox.appendChild(cCtl.el);
        ctlMap.cr = cCtl;
      }
    }

    /* ---------- 绘图 ---------- */
    function renderRing(R, r) {
      var Rpx = R * SCALE;
      var rpx = r * SCALE;
      svgEl('path', {
        d: donutPath(VB / 2, VB / 2, Rpx, rpx),
        'fill-rule': 'evenodd',
        class: 'lb-shadow-fill'
      }, gShapes);
      svgEl('circle', { cx: VB / 2, cy: VB / 2, r: Rpx, class: 'lb-outline-strong' }, gShapes);
      svgEl('circle', { cx: VB / 2, cy: VB / 2, r: rpx, class: 'lb-outline-strong' }, gShapes);
      /* R 标注：向上（写在圆弧外面） */
      svgEl('line', {
        x1: VB / 2, y1: VB / 2, x2: VB / 2, y2: num(VB / 2 - Rpx), class: 'lb-dim-line lb-dim-amber'
      }, gShapes);
      svgText(gShapes, VB / 2, VB / 2 - Rpx - 10, 'R = ' + num(R) + ' 厘米', 'lb-label-d');
      /* r 标注：向右 */
      svgEl('line', {
        x1: VB / 2, y1: VB / 2, x2: num(VB / 2 + rpx), y2: VB / 2, class: 'lb-dim-line lb-dim-blue'
      }, gShapes);
      svgText(gShapes, VB / 2 + rpx / 2, VB / 2 + 22, 'r = ' + num(r) + ' 厘米', 'lb-label-r');
      drawCenter(gShapes, VB / 2, VB / 2);
    }

    function renderSqIn(a) {
      var half = a * SCALE / 2;
      var rpx = half;
      svgEl('rect', {
        x: num(VB / 2 - half), y: num(VB / 2 - half),
        width: num(half * 2), height: num(half * 2), rx: 2,
        class: 'lb-shadow-fill'
      }, gShapes);
      svgEl('circle', { cx: VB / 2, cy: VB / 2, r: rpx, class: 'lb-cut-fill' }, gShapes);
      svgEl('rect', {
        x: num(VB / 2 - half), y: num(VB / 2 - half),
        width: num(half * 2), height: num(half * 2), fill: 'none',
        class: 'lb-outline-strong'
      }, gShapes);
      svgEl('circle', { cx: VB / 2, cy: VB / 2, r: rpx, class: 'lb-outline-strong' }, gShapes);
      /* 边长标注 */
      svgEl('line', {
        x1: num(VB / 2 - half), y1: num(VB / 2 + half + 16),
        x2: num(VB / 2 + half), y2: num(VB / 2 + half + 16),
        class: 'lb-dim-line lb-dim-amber'
      }, gShapes);
      svgText(gShapes, VB / 2, VB / 2 + half + 32, '边长 a = ' + num(a) + ' 厘米', 'lb-label-d');
      /* 圆半径标注 */
      svgEl('line', {
        x1: VB / 2, y1: VB / 2, x2: VB / 2, y2: num(VB / 2 - rpx), class: 'lb-dim-line lb-dim-blue'
      }, gShapes);
      svgText(gShapes, VB / 2 + 10, VB / 2 - rpx / 2, 'r = ' + num(a / 2) + ' 厘米', 'lb-label-r', 'start');
      drawCenter(gShapes, VB / 2, VB / 2);
    }

    function renderCircIn(r) {
      var Rpx = r * SCALE;
      var side = Rpx * Math.SQRT2;
      var half = side / 2;
      svgEl('circle', { cx: VB / 2, cy: VB / 2, r: Rpx, class: 'lb-shadow-fill' }, gShapes);
      svgEl('rect', {
        x: num(VB / 2 - half), y: num(VB / 2 - half),
        width: num(side), height: num(side), class: 'lb-cut-fill'
      }, gShapes);
      svgEl('circle', { cx: VB / 2, cy: VB / 2, r: Rpx, fill: 'none', class: 'lb-outline-strong' }, gShapes);
      svgEl('rect', {
        x: num(VB / 2 - half), y: num(VB / 2 - half),
        width: num(side), height: num(side), fill: 'none', class: 'lb-outline-strong'
      }, gShapes);
      /* 对角线 = 圆的直径 = 2r */
      svgEl('line', {
        x1: num(VB / 2 - half), y1: num(VB / 2 - half),
        x2: num(VB / 2 + half), y2: num(VB / 2 + half),
        class: 'lb-dim-line lb-dim-amber lb-dim-dash'
      }, gShapes);
      var rLabelY = (VB / 2 - Rpx - 10) >= 44 ? (VB / 2 - Rpx - 10) : (VB / 2 + Rpx + 22);
      svgText(gShapes, VB / 2, rLabelY, 'r = ' + num(r) + ' 厘米', 'lb-label-r');
      svgText(gShapes, 16, 24, '正方形的对角线 = 圆的直径 = 2r = ' + num(2 * r) + ' 厘米', 'lb-label-muted', 'start');
      drawCenter(gShapes, VB / 2, VB / 2);
    }

    function renderSemi(R, r) {
      var Rpx = R * SCALE;
      var rpx = r * SCALE;
      svgEl('path', { d: sectorPath(VB / 2, VB / 2, Rpx, 270, 90), class: 'lb-shadow-fill' }, gShapes);
      svgEl('path', { d: sectorPath(VB / 2, VB / 2, rpx, 270, 90), class: 'lb-cut-fill' }, gShapes);
      svgEl('path', {
        d: sectorPath(VB / 2, VB / 2, Rpx, 270, 90), fill: 'none', class: 'lb-outline-strong'
      }, gShapes);
      svgEl('path', {
        d: sectorPath(VB / 2, VB / 2, rpx, 270, 90), fill: 'none', class: 'lb-outline-strong'
      }, gShapes);
      svgEl('line', {
        x1: num(VB / 2 - Rpx), y1: VB / 2, x2: num(VB / 2 + Rpx), y2: VB / 2,
        class: 'lb-dim-line lb-dim-amber'
      }, gShapes);
      /* R、r 标注：沿竖直方向 */
      svgEl('line', {
        x1: VB / 2, y1: VB / 2, x2: VB / 2, y2: num(VB / 2 - Rpx), class: 'lb-dim-line lb-dim-amber'
      }, gShapes);
      svgText(gShapes, VB / 2 + 12, VB / 2 - Rpx / 2, 'R = ' + num(R) + ' 厘米', 'lb-label-d', 'start');
      svgText(gShapes, VB / 2 - 12, VB / 2 - rpx / 2, 'r = ' + num(r) + ' 厘米', 'lb-label-r', 'end');
      drawCenter(gShapes, VB / 2, VB / 2);
    }

    /* ---------- 更新 ---------- */
    function update() {
      dom.clear(gShapes);
      var shape = state.shape;
      var outer = 0;
      var cut = 0;
      var shadow = 0;
      var outerLabel = '';
      var cutLabel = '';
      var formula = '';
      var items = [];

      if (shape === 'ring') {
        var R = state.ring.R;
        var r = state.ring.r;
        outer = PI * R * R;
        cut = PI * r * r;
        shadow = PI * (R * R - r * r);
        renderRing(R, r);
        outerLabel = '外圆 ' + num(outer);
        cutLabel = '内圆 ' + num(cut);
        formula = 'S阴影 = ' + piHtml() + 'R² − ' + piHtml() + 'r²';
        items = [
          '外圆面积 = ' + piHtml() + ' × R² = 3.14 × ' + num(R) + '² = 3.14 × ' + num(R * R) + ' ' + res(outer, '平方厘米'),
          '内圆面积 = ' + piHtml() + ' × r² = 3.14 × ' + num(r) + '² = 3.14 × ' + num(r * r) + ' ' + res(cut, '平方厘米'),
          '阴影面积 = 外圆 − 内圆 = ' + piHtml() + ' × (R² − r²) = 3.14 × (' + num(R * R) + ' − ' + num(r * r) + ') = 3.14 × ' + num(R * R - r * r) + ' ' + res(shadow, '平方厘米')
        ];
      } else if (shape === 'sqin') {
        var a = state.sqin.a;
        var rr = a / 2;
        outer = a * a;
        cut = PI * rr * rr;
        shadow = outer - cut;
        renderSqIn(a);
        outerLabel = '正方形 ' + num(outer);
        cutLabel = '圆 ' + num(cut);
        formula = 'S阴影 = a² − ' + piHtml() + '(a/2)²';
        items = [
          '圆的半径 = a ÷ 2 = ' + num(a) + ' ÷ 2 = ' + num(rr) + ' 厘米（正方形里最大的圆，直径就是边长）',
          '正方形面积 = a × a = ' + num(a) + ' × ' + num(a) + ' ' + res(outer, '平方厘米'),
          '圆的面积 = ' + piHtml() + ' × r² = 3.14 × ' + num(rr) + '² = 3.14 × ' + num(rr * rr) + ' ' + res(cut, '平方厘米'),
          '阴影面积 = 正方形 − 圆 = ' + num(a * a) + ' − ' + num(cut) + ' ' + res(shadow, '平方厘米')
        ];
      } else if (shape === 'circin') {
        var cr = state.circin.r;
        var sideR = cr * Math.SQRT2;
        outer = PI * cr * cr;
        cut = 2 * cr * cr;
        shadow = outer - cut;
        renderCircIn(cr);
        outerLabel = '圆 ' + num(outer);
        cutLabel = '正方形 ' + num(cut);
        formula = 'S阴影 = ' + piHtml() + 'r² − 2r²';
        items = [
          '圆内最大的正方形，它的对角线就是圆的直径：对角线 = 2r = ' + num(2 * cr) + ' 厘米',
          '正方形面积 = 对角线 × 对角线 ÷ 2 = ' + num(2 * cr) + ' × ' + num(2 * cr) + ' ÷ 2 = ' + num(cut) + ' 平方厘米（就是 2r²）',
          '圆的面积 = ' + piHtml() + ' × r² = 3.14 × ' + num(cr) + '² = 3.14 × ' + num(cr * cr) + ' ' + res(outer, '平方厘米'),
          '阴影面积 = 圆 − 正方形 = ' + num(outer) + ' − ' + num(cut) + ' ' + res(shadow, '平方厘米') +
            '<br><span class="lb-step-note">这一步用到「对角线 × 对角线 ÷ 2」，属于拓展知识，看不懂可以跳过。</span>'
        ];
      } else {
        var sR = state.semi.R;
        var sr = state.semi.r;
        outer = PI * sR * sR / 2;
        cut = PI * sr * sr / 2;
        shadow = outer - cut;
        renderSemi(sR, sr);
        outerLabel = '大半圆 ' + num(outer);
        cutLabel = '小半圆 ' + num(cut);
        formula = 'S阴影 = ' + piHtml() + 'R² ÷ 2 − ' + piHtml() + 'r² ÷ 2';
        items = [
          '大半圆面积 = ' + piHtml() + ' × R² ÷ 2 = 3.14 × ' + num(sR * sR) + ' ÷ 2 ' + res(outer, '平方厘米'),
          '小半圆面积 = ' + piHtml() + ' × r² ÷ 2 = 3.14 × ' + num(sr * sr) + ' ÷ 2 ' + res(cut, '平方厘米'),
          '阴影面积 = 大半圆 − 小半圆 = ' + num(outer) + ' − ' + num(cut) + ' ' + res(shadow, '平方厘米') +
            '<br><span class="lb-step-note">也可以先算半圆环：S = ' + piHtml() + '(R² − r²) ÷ 2。</span>'
        ];
      }

      stats.set('a', outerLabel + ' 平方厘米');
      stats.set('b', cutLabel + ' 平方厘米');
      stats.set('s', num(shadow) + ' 平方厘米');
      formulaRow.innerHTML = '<span class="cl-formula">' + formula + '</span>';
      stepsBox.innerHTML = stepsHtml(items);
      stepsBox.hidden = !stepsOpen;
      stepsBtn.textContent = stepsOpen ? '🔍 收起解题步骤' : '🔍 显示解题步骤';
      stepsBtn.setAttribute('aria-expanded', stepsOpen ? 'true' : 'false');
    }

    stepsBtn.addEventListener('click', function () {
      stepsOpen = !stepsOpen;
      stepsBox.hidden = !stepsOpen;
      stepsBtn.textContent = stepsOpen ? '🔍 收起解题步骤' : '🔍 显示解题步骤';
      stepsBtn.setAttribute('aria-expanded', stepsOpen ? 'true' : 'false');
      CL.sound.click();
    });

    setShape('ring');

    return {
      el: panel,
      onShow: function () { update(); },
      onHide: function () {}
    };
  }

  /* =======================================================
     六、模式注册
     ======================================================= */

  var STATIONS = [
    { id: 'compass', icon: '🖍️', name: '画圆工坊' },
    { id: 'calc', icon: '🧮', name: '变身计算器' },
    { id: 'sector', icon: '🍕', name: '扇形实验室' },
    { id: 'shadow', icon: '🌑', name: '阴影工坊' }
  ];

  var BUILDERS = {
    compass: buildCompass,
    calc: buildCalc,
    sector: buildSector,
    shadow: buildShadow
  };

  function build(root) {
    dom.clear(root);

    var head = el('div', 'cl-mode-head');
    head.innerHTML = '<div>' +
      '<h2><span class="head-emoji">🧪</span>操作实验室</h2>' +
      '<p>四个小实验台，边动手边算一算：画一个圆、给圆变身、切一块扇形、挖一块阴影。数字会跟着你的操作实时变化，π 全部取 3.14。</p>' +
      '</div>' +
      '<span class="cl-head-chip">🎯 4 个实验台</span>';
    root.appendChild(head);

    var tabs = el('div', 'lb-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '选择实验台');
    root.appendChild(tabs);

    var panelBox = el('div', 'lb-panels');
    root.appendChild(panelBox);

    var foot = el('div', 'cl-note lb-footnote');
    foot.innerHTML = '<span class="note-icon">📐</span><span>四个实验台的数字都由代码按 <b>π = 3.14</b> 即时计算，结果保留两位小数、去掉末尾的 0（例如 15.7 而不是 15.70）。画布上每小格代表 1 厘米。</span>';
    root.appendChild(foot);

    var panels = {};
    var activeId = null;

    STATIONS.forEach(function (station) {
      var btn = el('button', 'lb-tab');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.innerHTML = '<span class="lb-tab-icon" aria-hidden="true">' + station.icon + '</span><span class="lb-tab-name">' + station.name + '</span>';
      btn.addEventListener('click', function () { select(station.id); });
      tabs.appendChild(btn);
      station.btn = btn;

      var panel = BUILDERS[station.id]();
      panel.el.hidden = true;
      panelBox.appendChild(panel.el);
      panels[station.id] = panel;
    });

    function select(id, silent) {
      if (activeId === id) {
        if (!silent) CL.sound.click();
        return;
      }
      if (activeId && panels[activeId].onHide) panels[activeId].onHide();
      activeId = id;
      STATIONS.forEach(function (station) {
        var on = station.id === id;
        station.btn.classList.toggle('active', on);
        station.btn.setAttribute('aria-selected', on ? 'true' : 'false');
        panels[station.id].el.hidden = !on;
      });
      var panel = panels[id];
      panel.el.classList.remove('lb-in');
      void panel.el.offsetWidth;
      panel.el.classList.add('lb-in');
      if (panel.onShow) panel.onShow();
      if (!silent) CL.sound.click();
      CL.store.set('lab-station', id);
    }

    var stored = CL.store.get('lab-station', 'compass');
    var validStored = STATIONS.some(function (s) { return s.id === stored; });

    return {
      start: function () {
        modeVisible = true;
        if (!activeId) {
          select(validStored ? stored : 'compass', true);
        } else {
          var panel = panels[activeId];
          if (panel && panel.onShow) panel.onShow();
        }
      },
      stop: function () {
        modeVisible = false;
        if (activeId && panels[activeId].onHide) panels[activeId].onHide();
      }
    };
  }

  CL.registerMode('lab', function (root) {
    return build(root);
  });
})();
