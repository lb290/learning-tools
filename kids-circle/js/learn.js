/* =========================================================
   圆的乐园 · 学习模块
   ---------------------------------------------------------
   8 个知识点：圆的概念 / 圆周率 π / 1π~100π / 半径与直径
               圆周长 / 圆面积 / 扇形 / 阴影面积
   每个知识点：知识卡 + 互动小工具 + 小结 + 易错提醒
   只使用 window.CircleLab 提供的共享 API，不修改共享文件。
   ========================================================= */
(function () {
  'use strict';

  var CL = window.CircleLab;
  if (!CL) return;

  var dom = CL.dom;
  var geom = CL.geom;
  var el = dom.el;
  var fmt = CL.fmtNum;
  var PI_TABLE = CL.PI_TABLE;
  var STORE_KEY = 'learn:visited';

  /* =======================================================
     知识点清单
     ======================================================= */
  var TOPICS = [
    {
      id: 'concept', name: '圆的概念', icon: '⭕',
      desc: '圆是怎么画出来的？圆心和半径各管什么？'
    },
    {
      id: 'pi', name: '圆周率 π', icon: '🔄',
      desc: '周长和直径之间，藏着一个永远不变的数字。'
    },
    {
      id: 'pitable', name: '1π ~ 100π', icon: '🔢',
      desc: '把常用的 π 倍数装进脑袋，算得又快又准。'
    },
    {
      id: 'rd', name: '半径与直径', icon: '📏',
      desc: '直径是半径的 2 倍，一个圆里它们都有无数条。'
    },
    {
      id: 'circ', name: '圆周长', icon: '🧵',
      desc: '绕圆一圈有多长？用 C = πd 一算就知道。'
    },
    {
      id: 'area', name: '圆面积', icon: '🌕',
      desc: '圆占了多大的地方？记住 S = πr²。'
    },
    {
      id: 'sector', name: '扇形', icon: '🍕',
      desc: '像一块披萨：圆心角决定它有多大。'
    },
    {
      id: 'shadow', name: '阴影面积', icon: '🎯',
      desc: '整体减空白、圆环相减 —— 三招走遍天下。'
    }
  ];

  /* =======================================================
     通用小工具
     ======================================================= */

  /** 卡片标题栏：icon + 标题 + 副标题（可再加右侧 chip） */
  function cardHead(icon, title, sub) {
    var head = el('div', 'cl-card-head');
    head.innerHTML =
      '<div><h3><span aria-hidden="true">' + icon + '</span> ' + title + '</h3>' +
      (sub ? '<p class="cl-card-sub">' + sub + '</p>' : '') + '</div>';
    return head;
  }

  /** 建一张公共卡片 */
  function card(icon, title, sub, chip) {
    var c = el('section', 'cl-card ln-card');
    var head = cardHead(icon, title, sub);
    if (chip) head.appendChild(el('span', chip.cls || 'cl-chip cl-chip-blue', chip.text));
    c.appendChild(head);
    return c;
  }

  /** 数据展示格子：defs = [{key,label,cls}] */
  function statGrid(defs) {
    var grid = el('div', 'cl-stat-grid' + (defs.length === 3 ? ' is-three' : ''));
    var refs = {};
    defs.forEach(function (d) {
      var s = el('div', 'cl-stat' + (d.cls ? ' ' + d.cls : ''));
      s.appendChild(el('div', 'stat-label', d.label));
      var v = el('div', 'stat-value', '—');
      s.appendChild(v);
      grid.appendChild(s);
      refs[d.key] = v;
    });
    return { node: grid, refs: refs };
  }

  /** 提示框 */
  function note(type, icon, label, html) {
    return el('div', 'cl-note ' + type,
      '<span class="note-icon" aria-hidden="true">' + icon + '</span>' +
      '<div><b>' + label + '：</b>' + html + '</div>');
  }

  /** 按钮 */
  function btn(label, cls, onClick) {
    var b = el('button', 'cl-btn ' + (cls || ''), label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  /** SVG 文字 */
  function svgText(parent, x, y, str, attrs) {
    var a = {
      x: x, y: y, 'text-anchor': 'middle', 'font-size': 15,
      fill: '#334155', 'font-weight': 800, class: 'ln-fig-text'
    };
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    }
    var t = geom.svgEl('text', a, parent);
    t.textContent = str;
    return t;
  }

  /** 填充分步讲解 */
  function fillSteps(box, rows) {
    dom.clear(box);
    rows.forEach(function (html, i) {
      var row = el('div', 'ln-step');
      row.appendChild(el('span', 'ln-step-num', String(i + 1)));
      row.appendChild(el('div', 'ln-step-body', html));
      box.appendChild(row);
    });
  }

  /** 新建步骤容器（隐藏） */
  function stepsWrap() {
    var wrap = el('div', 'ln-steps-wrap');
    wrap.hidden = true;
    var box = el('div', 'ln-steps');
    var ans = el('div', 'ln-answer');
    wrap.appendChild(box);
    wrap.appendChild(ans);
    return { wrap: wrap, box: box, ans: ans };
  }

  /**
   * 滑块 + 数字输入 的联动控件
   * opts: { label, min, max, step, value, unit, dec, color, onInput }
   */
  function sliderField(opts) {
    var wrap = el('div', 'cl-field ln-slider');
    var lab = el('div', 'cl-field-label');
    var labText = el('span', null, opts.label);
    var valText = el('b', null, '');
    lab.appendChild(labText);
    lab.appendChild(valText);
    wrap.appendChild(lab);

    var row = el('div', 'cl-range-row');
    var range = el('input', 'cl-range' + (opts.color ? ' cl-range-' + opts.color : ''));
    range.type = 'range';
    range.min = opts.min;
    range.max = opts.max;
    range.step = opts.step;
    range.value = opts.value;
    range.setAttribute('aria-label', opts.label);

    var num = el('input', 'cl-input ln-num');
    num.type = 'number';
    num.min = opts.min;
    num.max = opts.max;
    num.step = opts.step;
    num.setAttribute('aria-label', opts.label + '（输入数值）');

    row.appendChild(range);
    row.appendChild(num);
    wrap.appendChild(row);

    var dec = opts.dec == null ? 1 : opts.dec;
    var unit = opts.unit || '';
    var current = Number(opts.value);
    var silent = false;

    function paint() {
      valText.textContent = fmt(current, dec) + (unit ? ' ' + unit : '');
      if (document.activeElement !== num) num.value = fmt(current, dec);
      range.value = current;
    }

    function commit(v) {
      v = Number(v);
      if (!isFinite(v)) return;
      v = CL.round(CL.clamp(v, opts.min, opts.max), 2);
      current = v;
      paint();
      if (!silent && opts.onInput) opts.onInput(v);
    }

    range.addEventListener('input', function () { commit(range.value); });
    num.addEventListener('input', function () {
      var raw = num.value;
      if (raw === '' || raw === '-' || raw === '.') return;
      var v = Number(raw);
      if (!isFinite(v) || v < opts.min || v > opts.max) return;
      commit(v);
    });
    num.addEventListener('blur', function () { num.value = fmt(current, dec); });

    num.value = fmt(current, dec);
    paint();

    return {
      node: wrap,
      get: function () { return current; },
      set: function (v) {
        silent = true;
        commit(v);
        silent = false;
      },
      setLabel: function (text) { labText.textContent = text; }
    };
  }

  /** 知识点区块开头（标题 + 堆叠容器） */
  function beginTopic(t, index) {
    var sec = el('section', 'ln-topic');
    sec.setAttribute('data-topic', t.id);

    var head = el('header', 'ln-topic-head');
    var title = el('div', 'ln-topic-title');
    title.innerHTML =
      '<span class="ln-topic-icon" aria-hidden="true">' + t.icon + '</span>' +
      '<div><h2>' + t.name + '</h2><p>' + t.desc + '</p></div>';
    head.appendChild(title);
    head.appendChild(el('span', 'cl-chip cl-chip-blue', '第 ' + (index + 1) + ' 课'));
    sec.appendChild(head);

    var stack = el('div', 'ln-stack');
    sec.appendChild(stack);
    return { sec: sec, stack: stack };
  }

  /** 阴影面积方法卡 */
  function methodCard(icon, title, text) {
    var m = el('div', 'ln-method');
    m.appendChild(el('h4', null, '<span aria-hidden="true">' + icon + '</span> ' + title));
    m.appendChild(el('p', null, text));
    return m;
  }

  /** 阴影面积例题卡 */
  function exampleCard(opts) {
    var box = el('article', 'ln-example');

    var fig = el('div', 'ln-example-fig');
    opts.draw(geom.svgRoot(fig, '0 0 400 400', 'cl-svg'));
    box.appendChild(fig);

    var body = el('div', 'ln-example-body');
    var h = el('h4');
    h.appendChild(el('span', 'ln-example-no', '例 ' + opts.no));
    h.appendChild(el('span', null, opts.title));
    body.appendChild(h);
    body.appendChild(el('p', 'ln-given', opts.given));

    var wrap = stepsWrap();
    fillSteps(wrap.box, opts.steps);
    wrap.ans.innerHTML = opts.answer;
    wrap.wrap.hidden = true;

    var open = false;
    var toggle = btn('✨ 显示步骤', 'cl-btn-amber cl-btn-sm', function () {
      open = !open;
      wrap.wrap.hidden = !open;
      toggle.innerHTML = open ? '🙈 收起步骤' : '✨ 显示步骤';
      if (CL.sound && CL.sound.click) CL.sound.click();
    });

    body.appendChild(toggle);
    body.appendChild(wrap.wrap);
    box.appendChild(body);
    return box;
  }

  /* =======================================================
     1. 圆的概念
     ======================================================= */
  function buildConcept(t, index) {
    var tp = beginTopic(t, index);

    /* ---------- 知识卡 ---------- */
    var know = el('section', 'cl-card ln-card');
    know.appendChild(cardHead('🌟', '圆是怎么画出来的？', '一根木桩 + 一根绳子，就能画出一个完美的圆。'));
    know.appendChild(el('div', 'ln-know-body',
      '<p>把绳子的两端分别拴在木桩和笔上，拉紧绳子，让笔绕木桩转一圈 —— 笔尖画出的那条<b>封闭曲线</b>就是一个<b>圆</b>。木桩扎的那个点，就是圆的中心。</p>' +
      '<ul class="ln-list">' +
      '<li><b>圆心 O</b>：固定的那个点，决定圆在哪儿。<span class="ln-tag">圆心定位置</span></li>' +
      '<li><b>半径 r</b>：从圆心到圆上任意一点的线段，决定圆有多大。<span class="ln-tag">半径定大小</span></li>' +
      '<li><b>圆上任意一点到圆心的距离都相等</b>，都等于半径 r —— 这就是圆为什么这么「圆」。</li>' +
      '<li>把圆沿任意一条直径对折，两边都能完全重合，所以圆是<b>轴对称图形</b>，有<b>无数条对称轴</b>。</li>' +
      '</ul>'));
    tp.stack.appendChild(know);

    /* ---------- 互动小工具 ---------- */
    var tool = card('🧭', '小工具：让点绕圆心走一圈', '拖动滑块改变半径，点「播放」，看看圆上的点是怎么走的。',
      { text: '点到圆心的距离始终不变' });

    var grid = el('div', 'ln-tool-grid');
    var figBox = el('div', 'ln-figure-box');
    var side = el('div', 'ln-tool-side');
    grid.appendChild(figBox);
    grid.appendChild(side);
    tool.appendChild(grid);
    tp.stack.appendChild(tool);

    var svg = geom.svgRoot(figBox, '0 0 400 400', 'cl-svg');
    var CX = 200, CY = 200;

    /* 对称轴（默认隐藏） */
    var gSym = geom.svgEl('g', { style: 'display:none' }, svg);
    var symItems = [];
    for (var a = 0; a < 180; a += 30) {
      symItems.push({
        deg: a,
        line: geom.svgEl('line', {
          stroke: '#f59e0b', 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: 0.75
        }, gSym)
      });
    }
    var symText = svgText(gSym, CX, CY + 180, '沿任意一条直径对折，两边都能重合 —— 无数条对称轴',
      { fill: '#b45309', 'font-size': 12.5, class: 'ln-fig-text' });

    /* 圆 */
    var baseCircle = geom.svgEl('circle', {
      cx: CX, cy: CY, r: 100, fill: '#faf8ff', stroke: '#ddd6fe', 'stroke-width': 6
    }, svg);

    /* 已走过的轨迹 */
    var trail = geom.svgEl('path', {
      d: '', fill: 'none', stroke: '#8b5cf6', 'stroke-width': 7, 'stroke-linecap': 'round'
    }, svg);

    /* 四条等长半径 */
    var gEq = geom.svgEl('g', {}, svg);
    var eqItems = [];
    [40, 130, 220, 310].forEach(function (deg) {
      eqItems.push({
        deg: deg,
        line: geom.svgEl('line', { stroke: '#93c5fd', 'stroke-width': 2.5, 'stroke-dasharray': '7 6' }, gEq),
        dot: geom.svgEl('circle', { r: 4.5, fill: '#93c5fd' }, gEq)
      });
    });

    /* 半径 + 圆心 + 动点 */
    var radLine = geom.svgEl('line', {
      stroke: '#2563eb', 'stroke-width': 5, 'stroke-linecap': 'round'
    }, svg);
    var centerDot = geom.svgEl('circle', { cx: CX, cy: CY, r: 6.5, fill: '#1e293b' }, svg);
    svgText(svg, CX - 17, CY + 24, 'O', { fill: '#1e293b', 'font-size': 16 });
    var movingDot = geom.svgEl('circle', {
      r: 10, fill: '#2563eb', stroke: '#fff', 'stroke-width': 4
    }, svg);
    var rLabel = svgText(svg, 0, 0, '', {
      fill: '#2563eb', 'font-size': 15, 'text-anchor': 'start',
      class: 'ln-fig-text ln-halo'
    });

    /* 控件 */
    var stats = statGrid([
      { key: 'r', label: '半径 r' },
      { key: 'd', label: '直径 d', cls: 'amber' },
      { key: 'c', label: '周长 C' },
      { key: 'eq', label: '点到圆心的距离', cls: 'green' }
    ]);
    var angleInfo = el('div', 'ln-live');

    var rField = sliderField({
      label: '半径 r', min: 1, max: 6, step: 0.5, value: 3,
      unit: '厘米', dec: 1, onInput: function (v) { st.r = v; render(); }
    });

    var playBtn = btn('⏸ 暂停', 'cl-btn-primary cl-btn-sm', function () {
      st.playing = !st.playing;
      animPlaying = st.playing;
      playBtn.innerHTML = st.playing ? '⏸ 暂停' : '▶ 播放';
      if (st.playing) startRaf(); else stopRaf();
      if (CL.sound && CL.sound.click) CL.sound.click();
    });
    var resetBtn = btn('↺ 重新走一圈', 'cl-btn-ghost cl-btn-sm', function () {
      st.angle = 0;
      st.rounds = 0;
      render();
      if (st.playing) { stopRaf(); startRaf(); }
      if (CL.sound && CL.sound.click) CL.sound.click();
    });
    var symBtn = btn('✨ 显示对称轴', 'cl-btn-amber cl-btn-sm', function () {
      st.sym = !st.sym;
      gSym.style.display = st.sym ? '' : 'none';
      symBtn.innerHTML = st.sym ? '✨ 隐藏对称轴' : '✨ 显示对称轴';
      if (CL.sound && CL.sound.click) CL.sound.click();
    });

    var btnRow = el('div', 'cl-btn-row');
    btnRow.appendChild(playBtn);
    btnRow.appendChild(resetBtn);
    btnRow.appendChild(symBtn);

    side.appendChild(rField.node);
    side.appendChild(btnRow);
    side.appendChild(stats.node);
    side.appendChild(angleInfo);

    var st = { r: 3, angle: 0, rounds: 0, playing: true, sym: false };

    function rView() { return 40 + st.r * 20; }

    function render() {
      var R = rView();
      baseCircle.setAttribute('r', geom.f(R));

      var p = geom.polar(CX, CY, R, st.angle);
      movingDot.setAttribute('cx', geom.f(p.x));
      movingDot.setAttribute('cy', geom.f(p.y));
      radLine.setAttribute('x1', CX);
      radLine.setAttribute('y1', CY);
      radLine.setAttribute('x2', geom.f(p.x));
      radLine.setAttribute('y2', geom.f(p.y));
      trail.setAttribute('d', st.angle > 0.3 ? geom.arcPath(CX, CY, R, 0, st.angle) : '');

      eqItems.forEach(function (it) {
        var q = geom.polar(CX, CY, R, it.deg);
        it.line.setAttribute('x1', CX);
        it.line.setAttribute('y1', CY);
        it.line.setAttribute('x2', geom.f(q.x));
        it.line.setAttribute('y2', geom.f(q.y));
        it.dot.setAttribute('cx', geom.f(q.x));
        it.dot.setAttribute('cy', geom.f(q.y));
      });

      symItems.forEach(function (it) {
        var p1 = geom.polar(CX, CY, R, it.deg);
        var p2 = geom.polar(CX, CY, R, it.deg + 180);
        it.line.setAttribute('x1', geom.f(p1.x));
        it.line.setAttribute('y1', geom.f(p1.y));
        it.line.setAttribute('x2', geom.f(p2.x));
        it.line.setAttribute('y2', geom.f(p2.y));
      });
      symText.setAttribute('y', geom.f(CY + R + 30));

      var lp = geom.polar(CX, CY, R * 0.58, st.angle);
      rLabel.setAttribute('x', geom.f(lp.x + 12));
      rLabel.setAttribute('y', geom.f(lp.y - 10));
      rLabel.textContent = 'r = ' + fmt(st.r, 1) + ' 厘米';

      var c = CL.circle(st.r);
      stats.refs.r.textContent = fmt(st.r, 1) + ' 厘米';
      stats.refs.d.textContent = fmt(c.d, 1) + ' 厘米';
      stats.refs.c.textContent = fmt(c.C) + ' 厘米';
      stats.refs.eq.textContent = fmt(st.r, 1) + ' 厘米';

      angleInfo.innerHTML = '点已经绕圆心转了 <b>' + fmt(st.angle, 0) + '°</b>' +
        (st.rounds > 0 ? '，这是第 ' + (st.rounds + 1) + ' 圈' : '') +
        (st.rounds > 0 ? ' —— 每转一圈都回到同一个圆上。' : '');
    }

    function tick(dt) {
      st.angle += dt * 0.075;
      if (st.angle >= 360) {
        st.angle -= 360;
        st.rounds += 1;
      }
      render();
    }

    animTick = tick;
    animPlaying = true;
    render();

    tp.show = function () { if (animPlaying) startRaf(); };
    tp.hide = stopRaf;
    return tp;
  }

  /* =======================================================
     2. 圆周率 π
     ======================================================= */
  function buildPi(t, index) {
    var tp = beginTopic(t, index);

    var know = card('🔄', '圆周率 π 是什么？', '周长和直径的比值，是所有圆共同的秘密。');
    know.appendChild(el('div', 'ln-know-body',
      '<p>拿一根绳子沿着圆边绕一圈，再拉直量一量，就得到<b>圆的周长 C</b>；量出<b>直径 d</b>，用周长除以直径，商总是同一个数 —— 这个数叫做<b>圆周率</b>，用字母 π 表示。</p>' +
      '<div class="ln-eq-list ln-mt">' +
      '<div class="ln-eq">C ÷ d = <span class="pi">π</span> ≈ 3.14</div>' +
      '<div class="ln-eq">C = <span class="pi">π</span> × d = 3.14 × d</div>' +
      '</div>' +
      '<ul class="ln-list">' +
      '<li><span class="ln-pi">π</span> ≈ <b>3.14</b>：做计算时通常取 3.14，题目里也会写「π 取 3.14」。</li>' +
      '<li>真实的圆周率是 <b>3.1415926…</b>，小数点后的数字永远写不完、也不循环，是一个<b>无限不循环小数</b>。</li>' +
      '<li>我国古代数学家<b>祖冲之</b>在 1500 多年前就算出圆周率在 3.1415926 和 3.1415927 之间，比欧洲早了近一千年！</li>' +
      '</ul>'));
    tp.stack.appendChild(know);

    var tool = card('📐', '小工具：直径变，周长也变，比值不变', '拖动滑块改变直径 d，看看 C ÷ d 是不是永远等于 3.14。',
      { text: 'π 取 3.14' });

    var grid = el('div', 'ln-tool-grid');
    var figBox = el('div', 'ln-figure-box');
    var side = el('div', 'ln-tool-side');
    grid.appendChild(figBox);
    grid.appendChild(side);
    tool.appendChild(grid);
    tp.stack.appendChild(tool);

    var svg = geom.svgRoot(figBox, '0 0 400 400', 'cl-svg');
    var CX = 200, CY = 168;

    var circleEl = geom.svgEl('circle', {
      cx: CX, cy: CY, r: 120, fill: '#faf8ff', stroke: '#8b5cf6', 'stroke-width': 7
    }, svg);
    var diamLine = geom.svgEl('line', {
      stroke: '#f59e0b', 'stroke-width': 6, 'stroke-linecap': 'round'
    }, svg);
    var radLine = geom.svgEl('line', {
      stroke: '#2563eb', 'stroke-width': 4, 'stroke-dasharray': '8 6'
    }, svg);
    geom.svgEl('circle', { cx: CX, cy: CY, r: 6, fill: '#1e293b' }, svg);

    var dLabel = svgText(svg, CX, 40, '', { fill: '#b45309', 'font-size': 16, class: 'ln-fig-text ln-halo' });
    var rLabel = svgText(svg, CX + 46, CY - 44, 'r', { fill: '#2563eb', 'font-size': 16, class: 'ln-fig-text ln-halo' });
    var cLabel = svgText(svg, CX, 360, '', { fill: '#6d28d9', 'font-size': 14.5, class: 'ln-fig-text' });

    var stats = statGrid([
      { key: 'd', label: '直径 d', cls: 'amber' },
      { key: 'c', label: '周长 C' },
      { key: 'ratio', label: 'C ÷ d', cls: 'green' }
    ]);

    var bars = el('div', 'ln-bars');
    function barRow(label, color) {
      var row = el('div', 'ln-bar-row');
      row.appendChild(el('span', 'ln-bar-label', label));
      var track = el('div', 'ln-bar-track');
      var fill = el('i', 'ln-bar-fill ' + color);
      track.appendChild(fill);
      row.appendChild(track);
      var num = el('span', 'ln-bar-num', '');
      row.appendChild(num);
      bars.appendChild(row);
      return { fill: fill, num: num };
    }
    var barD = barRow('直径', 'amber');
    var barC = barRow('周长', 'purple');

    var dField = sliderField({
      label: '直径 d', min: 1, max: 12, step: 1, value: 6,
      unit: '厘米', dec: 0, color: 'amber', onInput: function (v) { render(v); }
    });

    side.appendChild(dField.node);
    side.appendChild(stats.node);
    side.appendChild(bars);
    side.appendChild(el('p', 'ln-bar-tip', '周长那条「长条」永远是直径的 3.14 倍 —— 圆大圆小都一样！'));

    var tableWrap = el('div', 'ln-table-wrap ln-mt');
    tableWrap.appendChild(el('p', 'ln-table-cap', '多量几个圆，商都是 3.14：'));
    var table = el('table', 'ln-table');
    table.innerHTML = '<thead><tr><th>直径 d</th><th>周长 C = 3.14 × d</th><th>C ÷ d</th></tr></thead>';
    var tbody = el('tbody');
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    var rows = {};
    [1, 2, 3, 5, 8, 10, 12].forEach(function (dd) {
      var tr = el('tr');
      var c = CL.PI_APPROX * dd;
      tr.innerHTML = '<td>' + dd + ' 厘米</td><td>' + fmt(c) + ' 厘米</td><td><b>3.14</b></td>';
      tbody.appendChild(tr);
      rows[dd] = tr;
    });

    var tableNote = el('p', 'ln-table-note', '不管圆大还是小，周长除以直径的商都等于 3.14 —— 这就是圆周率的厉害之处。');
    tool.appendChild(tableWrap);
    tool.appendChild(tableNote);
    tp.stack.appendChild(tool);

    function render(d) {
      var R = 30 + d * 8.5;
      circleEl.setAttribute('r', geom.f(R));
      diamLine.setAttribute('x1', geom.f(CX - R));
      diamLine.setAttribute('y1', CY);
      diamLine.setAttribute('x2', geom.f(CX + R));
      diamLine.setAttribute('y2', CY);
      var tp45 = geom.polar(CX, CY, R, 45);
      radLine.setAttribute('x1', CX);
      radLine.setAttribute('y1', CY);
      radLine.setAttribute('x2', geom.f(tp45.x));
      radLine.setAttribute('y2', geom.f(tp45.y));
      dLabel.setAttribute('y', geom.f(CY - R - 16));
      dLabel.textContent = 'd = ' + fmt(d, 0) + ' 厘米';
      rLabel.setAttribute('x', geom.f(tp45.x + 14));
      rLabel.setAttribute('y', geom.f(tp45.y - 8));
      cLabel.setAttribute('y', geom.f(CY + R + 32));
      cLabel.textContent = '周长 C = ' + fmt(CL.PI_APPROX * d) + ' 厘米';

      var c = CL.PI_APPROX * d;
      stats.refs.d.textContent = fmt(d, 0) + ' 厘米';
      stats.refs.c.textContent = fmt(c) + ' 厘米';
      stats.refs.ratio.textContent = '3.14';

      var maxC = CL.PI_APPROX * 12;
      barD.fill.style.width = (d / maxC * 100) + '%';
      barC.fill.style.width = Math.min(100, c / maxC * 100) + '%';
      barD.num.textContent = fmt(d, 0) + ' 厘米';
      barC.num.textContent = fmt(c) + ' 厘米';

      Object.keys(rows).forEach(function (k) {
        rows[k].classList.toggle('is-hi', Number(k) === d);
      });
    }

    render(6);

    tp.show = function () {};
    tp.hide = function () {};
    return tp;
  }

  /* =======================================================
     3. 1π ~ 100π
     ======================================================= */
  function buildPiTable(t, index) {
    var tp = beginTopic(t, index);

    var know = card('🔢', '1π ~ 100π 速查表', '把常用的 π 倍数记熟，计算就能又快又准。',
      { text: 'π 取 3.14' });
    know.appendChild(el('div', 'ln-know-body',
      '<p>1π 就是 3.14 的 1 倍，2π 是 3.14 的 2 倍…… nπ 就是 <b>3.14 × n</b>。下面这张表把 1π 到 100π 全部列了出来，算圆周长、圆面积时随查随用。</p>'));
    tp.stack.appendChild(know);

    var tool = card('🔍', '查一查：nπ 是多少？', '输入 n，或者直接点一格；打开「记忆模式」，还能自己考自己。');

    var toolbar = el('div', 'ln-pi-toolbar');
    var searchWrap = el('div', 'ln-pi-search-wrap');
    var search = el('input', 'cl-input ln-pi-search');
    search.type = 'search';
    search.placeholder = '输入 1 ~ 100 的 n，比如 16';
    search.setAttribute('aria-label', '输入 n 查找 nπ');
    searchWrap.appendChild(search);
    toolbar.appendChild(searchWrap);

    var blind = false;
    var blindBtn = btn('🙈 记忆模式', 'cl-btn-amber cl-btn-sm', function () {
      blind = !blind;
      grid.classList.toggle('is-blind', blind);
      blindBtn.innerHTML = blind ? '👀 显示答案' : '🙈 记忆模式';
      blindBtn.classList.toggle('cl-btn-primary', blind);
      blindBtn.classList.toggle('cl-btn-amber', !blind);
      PI_TABLE.forEach(function (item) {
        if (cells[item.n]) cells[item.n].classList.remove('is-peek');
      });
      if (selected) selectPi(selected, {});
      CL.ui.toast(blind ? '记忆模式：先自己说出答案，再点格子验证' : '答案已经显示出来啦', 'info', 2000);
    });
    var randBtn = btn('🎲 随机抽一个', 'cl-btn-ghost cl-btn-sm', function () {
      var n = CL.randInt(1, 100);
      selectPi(n, { scroll: true, peek: !blind });
      if (CL.sound && CL.sound.click) CL.sound.click();
    });
    toolbar.appendChild(blindBtn);
    toolbar.appendChild(randBtn);
    tool.appendChild(toolbar);

    var detail = el('div', 'ln-pi-detail');
    tool.appendChild(detail);

    var grid = el('div', 'ln-pi-grid');
    tool.appendChild(grid);

    var cells = {};
    PI_TABLE.forEach(function (item) {
      var b = el('button', 'ln-pi-cell');
      b.type = 'button';
      b.setAttribute('aria-label', item.n + 'π 等于 ' + item.text);
      b.innerHTML = '<span class="ln-pi-n">' + item.n + 'π</span>' +
        '<span class="ln-pi-v">' + item.text + '</span>';
      b.addEventListener('click', function () {
        selectPi(item.n, { peek: true });
        if (CL.sound && CL.sound.tick) CL.sound.tick();
      });
      grid.appendChild(b);
      cells[item.n] = b;
    });
    tp.stack.appendChild(tool);

    var selected = 0;
    function selectPi(n, opts) {
      var o = opts || {};
      if (!cells[n]) return;
      if (selected && cells[selected]) cells[selected].classList.remove('is-selected');
      selected = n;
      cells[n].classList.add('is-selected');
      if (o.peek) cells[n].classList.add('is-peek');
      var item = PI_TABLE[n - 1];
      var reveal = !blind || o.peek;
      if (reveal) {
        detail.innerHTML =
          '<span class="ln-pi-detail-eq"><b>' + n + 'π</b> = 3.14 × ' + n +
          ' = <b class="ln-pi-big">' + item.text + '</b></span>' +
          '<span class="ln-pi-detail-tip">也就是 ' + n + ' 个 3.14 相加' +
          (n % 10 === 0 ? '，整十的 π 倍数最好记。' : '。') + '</span>';
      } else {
        detail.innerHTML =
          '<span class="ln-pi-detail-eq"><b>' + n + 'π</b> = 3.14 × ' + n +
          ' = <b class="ln-pi-big">? ?</b></span>' +
          '<span class="ln-pi-detail-tip">记忆模式：先自己算一算，再点一下这个格子验证。</span>';
      }
      if (o.scroll) {
        try { cells[n].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* 忽略 */ }
      }
    }

    function applyFilter() {
      var q = search.value.trim();
      var n = /^\d{1,3}$/.test(q) ? parseInt(q, 10) : 0;
      var byValue = q && !n;
      PI_TABLE.forEach(function (item) {
        var cell = cells[item.n];
        if (!q) {
          cell.classList.remove('is-dim');
        } else if (byValue) {
          cell.classList.toggle('is-dim', item.text.indexOf(q) !== 0);
        } else {
          cell.classList.toggle('is-dim', String(item.n).indexOf(q) !== 0);
        }
      });
      if (n >= 1 && n <= 100) selectPi(n, {});
    }
    search.addEventListener('input', applyFilter);

    var hot = [7, 16, 25, 36, 64].map(function (n) {
      return n + 'π = ' + PI_TABLE[n - 1].text;
    }).join('、');
    tp.stack.appendChild(note('good', '⭐', '要记住的常用值',
      hot + ' —— 这几个在算周长、面积时最常出现，背下来能省好多时间。'));

    tp.stack.appendChild(el('div', 'ln-note-grid',
      '<div class="cl-note warn"><span class="note-icon" aria-hidden="true">💡</span><div><b>小结：</b>' +
      'nπ = 3.14 × n。想算 20π，就是 3.14 × 20 = ' + PI_TABLE[19].text +
      '；想算 0.5π，就是 3.14 × 0.5 = ' + fmt(CL.PI_APPROX * 0.5) + '。' +
      '表格里的每一格都能用「3.14 × n」验证。</div></div>' +
      '<div class="cl-note bad"><span class="note-icon" aria-hidden="true">⚠️</span><div><b>易错提醒：</b>' +
      'nπ 是 3.14 <b>乘</b> n，不是 3.14 的 n 次方；也别把 7π 背成 ' + PI_TABLE[6].text + ' 以外的数。' +
      '算周长用「π × 直径」，算面积用「π × 半径²」，公式别混。</div></div>'));

    selectPi(7, {});
    return tp;
  }

  /* =======================================================
     4. 半径与直径
     ======================================================= */
  function buildRadiusDiameter(t, index) {
    var tp = beginTopic(t, index);

    var know = card('📏', '半径和直径是一家人', '同一个圆里，它们都有无数条，而且每条都一样长。');
    know.appendChild(el('div', 'ln-know-body',
      '<p>连接<b>圆心</b>和<b>圆上一点</b>的线段叫<b>半径</b>，用字母 r 表示；通过圆心、两端都在圆上的线段叫<b>直径</b>，用字母 d 表示。</p>' +
      '<ul class="ln-list">' +
      '<li>同一个圆里，所有半径的长度都相等，所有直径的长度也都相等。</li>' +
      '<li>直径是半径的 <b>2 倍</b>：d = 2r；反过来，半径是直径的一半：r = d ÷ 2。</li>' +
      '<li>直径是圆里<b>最长</b>的线段 —— 穿过圆心走的是「最远的路」。</li>' +
      '</ul>'));
    tp.stack.appendChild(know);

    var tool = card('🔗', '小工具：半径和直径一起变', '拖动任意一个滑块，另一个会跟着变，看看它们是不是总差 2 倍。',
      { text: 'd = 2r' });

    var grid = el('div', 'ln-tool-grid');
    var figBox = el('div', 'ln-figure-box');
    var side = el('div', 'ln-tool-side');
    grid.appendChild(figBox);
    grid.appendChild(side);
    tool.appendChild(grid);
    tp.stack.appendChild(tool);

    var svg = geom.svgRoot(figBox, '0 0 400 400', 'cl-svg');
    var CX = 200, CY = 200;

    var baseCircle = geom.svgEl('circle', {
      cx: CX, cy: CY, r: 100, fill: '#fbfdff', stroke: '#8b5cf6', 'stroke-width': 6
    }, svg);
    var diamLine = geom.svgEl('line', {
      stroke: '#f59e0b', 'stroke-width': 6, 'stroke-linecap': 'round'
    }, svg);
    var radSolid = geom.svgEl('line', {
      stroke: '#2563eb', 'stroke-width': 5, 'stroke-linecap': 'round'
    }, svg);
    var radDash = [];
    [160, 280].forEach(function () {
      radDash.push(geom.svgEl('line', {
        stroke: '#93c5fd', 'stroke-width': 2.5, 'stroke-dasharray': '7 6'
      }, svg));
    });
    geom.svgEl('circle', { cx: CX, cy: CY, r: 6.5, fill: '#1e293b' }, svg);
    svgText(svg, CX - 21, CY - 12, 'O', { fill: '#1e293b', 'font-size': 16 });
    var rLabel = svgText(svg, 0, 0, '', { fill: '#2563eb', 'font-size': 15, class: 'ln-fig-text ln-halo' });
    var dLabel = svgText(svg, 0, 0, '', { fill: '#b45309', 'font-size': 15, class: 'ln-fig-text ln-halo' });

    var stats = statGrid([
      { key: 'r', label: '半径 r' },
      { key: 'd', label: '直径 d', cls: 'amber' },
      { key: 'c', label: '周长 C' },
      { key: 's', label: '面积 S', cls: 'green' }
    ]);

    var eqList = el('div', 'ln-eq-list');

    var rField = sliderField({
      label: '半径 r', min: 0.5, max: 10, step: 0.5, value: 3,
      unit: '厘米', dec: 1, onInput: function (v) { applyR(v, true); }
    });
    var dField = sliderField({
      label: '直径 d', min: 1, max: 20, step: 1, value: 6,
      unit: '厘米', dec: 1, color: 'amber', onInput: function (v) { applyR(v / 2, false); }
    });

    side.appendChild(rField.node);
    side.appendChild(dField.node);
    side.appendChild(stats.node);
    side.appendChild(eqList);

    function applyR(r, fromR) {
      r = CL.round(CL.clamp(r, 0.5, 10), 2);
      var d = CL.round(r * 2, 2);
      if (fromR) dField.set(d); else rField.set(r);
      render(r, d);
    }

    function render(r, d) {
      var R = 50 + r * 10;
      baseCircle.setAttribute('r', geom.f(R));
      diamLine.setAttribute('x1', geom.f(CX - R));
      diamLine.setAttribute('y1', CY);
      diamLine.setAttribute('x2', geom.f(CX + R));
      diamLine.setAttribute('y2', CY);

      var p40 = geom.polar(CX, CY, R, 40);
      radSolid.setAttribute('x1', CX);
      radSolid.setAttribute('y1', CY);
      radSolid.setAttribute('x2', geom.f(p40.x));
      radSolid.setAttribute('y2', geom.f(p40.y));

      [0, 1].forEach(function (i) {
        var deg = [160, 280][i];
        var q = geom.polar(CX, CY, R, deg);
        radDash[i].setAttribute('x1', CX);
        radDash[i].setAttribute('y1', CY);
        radDash[i].setAttribute('x2', geom.f(q.x));
        radDash[i].setAttribute('y2', geom.f(q.y));
      });

      var lp = geom.polar(CX, CY, R * 0.6, 40);
      rLabel.setAttribute('x', geom.f(lp.x + 14));
      rLabel.setAttribute('y', geom.f(lp.y - 10));
      rLabel.textContent = 'r = ' + fmt(r, 1) + ' 厘米';

      dLabel.setAttribute('x', geom.f(CX + R * 0.46));
      dLabel.setAttribute('y', geom.f(CY + 22));
      dLabel.textContent = 'd = ' + fmt(d, 1) + ' 厘米';

      var c = CL.circle(r);
      stats.refs.r.textContent = fmt(r, 1) + ' 厘米';
      stats.refs.d.textContent = fmt(d, 1) + ' 厘米';
      stats.refs.c.textContent = fmt(c.C) + ' 厘米';
      stats.refs.s.textContent = fmt(c.S) + ' 平方厘米';

      eqList.innerHTML =
        '<div class="ln-eq">d = 2 × r = 2 × ' + fmt(r, 1) + ' = <b>' + fmt(d, 1) + '</b>（厘米）</div>' +
        '<div class="ln-eq">r = d ÷ 2 = ' + fmt(d, 1) + ' ÷ 2 = <b>' + fmt(r, 1) + '</b>（厘米）</div>';
    }

    applyR(3, true);
    tp.show = function () {};
    tp.hide = function () {};
    return tp;
  }

  /* =======================================================
     5. 圆周长
     ======================================================= */
  function buildCircumference(t, index) {
    var tp = beginTopic(t, index);

    var know = card('🧵', '绕圆一圈有多长？', '围成圆的曲线的长度，叫做圆的周长。');
    know.appendChild(el('div', 'ln-know-body',
      '<p><b>圆的周长 C</b> 就是绕圆走一圈的长度。因为 C ÷ d = π，所以只要知道直径就能算周长：</p>' +
      '<div class="ln-eq-list ln-mt">' +
      '<div class="ln-eq">C = <span class="pi">π</span>d = 3.14 × d</div>' +
      '<div class="ln-eq">C = 2<span class="pi">π</span>r = 2 × 3.14 × r</div>' +
      '</div>' +
      '<p class="ln-mt-sm">两个公式其实是一回事：因为 d = 2r，把 2r 代进去就得到 C = 2πr。</p>'));
    tp.stack.appendChild(know);

    var tool = card('🧮', '计算器：一步一步算周长', '选择已知半径还是直径，拖动滑块或直接输入数字。',
      { text: 'C = πd = 2πr' });

    var grid = el('div', 'ln-tool-grid');
    var figBox = el('div', 'ln-figure-box');
    var side = el('div', 'ln-tool-side');
    grid.appendChild(figBox);
    grid.appendChild(side);
    tool.appendChild(grid);

    /* 步骤区（工具内，全宽） */
    var stepsBox = el('div', 'ln-steps ln-mt');
    var stepTitle = el('div', 'cl-section-title ln-sub-title', '一步一步算');

    var svg = geom.svgRoot(figBox, '0 0 400 400', 'cl-svg');
    var CX = 200, CY = 180;

    var circleEl = geom.svgEl('circle', {
      cx: CX, cy: CY, r: 100, fill: '#fbf8ff', stroke: '#8b5cf6', 'stroke-width': 7
    }, svg);
    var diamLine = geom.svgEl('line', {
      stroke: '#f59e0b', 'stroke-width': 5, 'stroke-dasharray': '10 7'
    }, svg);
    var radLine = geom.svgEl('line', {
      stroke: '#2563eb', 'stroke-width': 5, 'stroke-linecap': 'round'
    }, svg);
    geom.svgEl('circle', { cx: CX, cy: CY, r: 6, fill: '#1e293b' }, svg);
    var rLabel = svgText(svg, 0, 0, '', { fill: '#2563eb', 'font-size': 15, class: 'ln-fig-text ln-halo' });
    var dLabel = svgText(svg, 0, 0, '', { fill: '#b45309', 'font-size': 14, class: 'ln-fig-text ln-halo' });
    var cLabel = svgText(svg, CX, 368, '', { fill: '#6d28d9', 'font-size': 14.5, class: 'ln-fig-text' });

    var stats = statGrid([
      { key: 'r', label: '半径 r' },
      { key: 'd', label: '直径 d', cls: 'amber' },
      { key: 'c', label: '圆的周长 C' },
      { key: 'half', label: '圆周长的一半', cls: 'green' }
    ]);

    var mode = 'r';
    var seg = el('div', 'cl-seg');
    var segR = el('button', 'active', '已知半径 r');
    segR.type = 'button';
    var segD = el('button', null, '已知直径 d');
    segD.type = 'button';
    seg.appendChild(segR);
    seg.appendChild(segD);

    var rField = sliderField({
      label: '半径 r', min: 0.5, max: 10, step: 0.5, value: 3,
      unit: '厘米', dec: 1, onInput: function (v) { applyR(v, true); }
    });
    var dField = sliderField({
      label: '直径 d', min: 1, max: 20, step: 1, value: 6,
      unit: '厘米', dec: 1, color: 'amber', onInput: function (v) { applyR(v / 2, false); }
    });
    dField.node.hidden = true;

    side.appendChild(seg);
    side.appendChild(rField.node);
    side.appendChild(dField.node);
    side.appendChild(stats.node);

    tool.appendChild(stepTitle);
    tool.appendChild(stepsBox);
    tp.stack.appendChild(tool);

    /* 半圆易错卡 */
    var half = card('🌗', '易错：半圆的周长怎么算？', '半圆的周长 = 圆周长的一半 + 一条直径，那条直边千万别忘了！',
      { text: 'πr + 2r' });
    var halfGrid = el('div', 'ln-example');
    var halfFig = el('div', 'ln-example-fig ln-fig-wide');
    var halfBody = el('div', 'ln-example-body');
    halfGrid.appendChild(halfFig);
    halfGrid.appendChild(halfBody);
    half.appendChild(halfGrid);

    var hsvg = geom.svgRoot(halfFig, '0 0 240 170', 'cl-svg');
    geom.svgEl('path', {
      d: 'M 40 120 A 80 80 0 0 1 200 120 Z',
      fill: '#f5f3ff', stroke: '#8b5cf6', 'stroke-width': 6
    }, hsvg);
    geom.svgEl('line', {
      x1: 40, y1: 120, x2: 200, y2: 120,
      stroke: '#f59e0b', 'stroke-width': 5, 'stroke-dasharray': '9 6'
    }, hsvg);
    svgText(hsvg, 120, 66, '弧长 = πr', { fill: '#6d28d9', 'font-size': 13, class: 'ln-fig-text' });
    svgText(hsvg, 120, 144, '直径 = 2r', { fill: '#b45309', 'font-size': 13, class: 'ln-fig-text' });

    var halfSteps = el('div', 'ln-steps');
    var halfAns = el('div', 'ln-answer');
    halfBody.appendChild(el('p', 'ln-given', '半径 r = 3 厘米的半圆，它的周长是多少？'));
    halfBody.appendChild(halfSteps);
    halfBody.appendChild(halfAns);
    tp.stack.appendChild(half);

    function applyR(r, fromR) {
      r = CL.round(CL.clamp(r, 0.5, 10), 2);
      var d = CL.round(r * 2, 2);
      if (fromR) dField.set(d); else rField.set(r);
      render(r, d);
    }

    segR.addEventListener('click', function () {
      mode = 'r';
      segR.classList.add('active');
      segD.classList.remove('active');
      rField.node.hidden = false;
      dField.node.hidden = true;
      render(rField.get(), rField.get() * 2);
      if (CL.sound && CL.sound.click) CL.sound.click();
    });
    segD.addEventListener('click', function () {
      mode = 'd';
      segD.classList.add('active');
      segR.classList.remove('active');
      rField.node.hidden = true;
      dField.node.hidden = false;
      render(rField.get(), rField.get() * 2);
      if (CL.sound && CL.sound.click) CL.sound.click();
    });

    function render(r, d) {
      r = CL.round(r, 2);
      d = CL.round(r * 2, 2);
      var C = CL.round(CL.PI_APPROX * d, 4);
      var halfArc = CL.round(CL.PI_APPROX * r, 4);

      var R = 50 + r * 10;
      circleEl.setAttribute('r', geom.f(R));
      diamLine.setAttribute('x1', geom.f(CX - R));
      diamLine.setAttribute('y1', CY);
      diamLine.setAttribute('x2', geom.f(CX + R));
      diamLine.setAttribute('y2', CY);
      var p45 = geom.polar(CX, CY, R, 45);
      radLine.setAttribute('x1', CX);
      radLine.setAttribute('y1', CY);
      radLine.setAttribute('x2', geom.f(p45.x));
      radLine.setAttribute('y2', geom.f(p45.y));
      rLabel.setAttribute('x', geom.f(p45.x + 14));
      rLabel.setAttribute('y', geom.f(p45.y - 8));
      rLabel.textContent = 'r';
      dLabel.setAttribute('x', geom.f(CX + R * 0.45));
      dLabel.setAttribute('y', geom.f(CY + 22));
      dLabel.textContent = 'd = ' + fmt(d, 1);
      cLabel.setAttribute('y', geom.f(CY + R + 40));
      cLabel.textContent = 'C = ' + fmt(C) + ' 厘米';

      stats.refs.r.textContent = fmt(r, 1) + ' 厘米';
      stats.refs.d.textContent = fmt(d, 1) + ' 厘米';
      stats.refs.c.textContent = fmt(C) + ' 厘米';
      stats.refs.half.textContent = fmt(halfArc) + ' 厘米';

      var rows = [];
      if (mode === 'r') {
        rows.push('先求直径：d = 2 × r = 2 × ' + fmt(r, 1) + ' = ' + fmt(d, 1) + '（厘米）');
        rows.push('再求周长：C = <span class="pi">π</span>d = 3.14 × ' + fmt(d, 1) + ' = <b>' + fmt(C) + '</b>（厘米）');
        rows.push('也可以直接代公式：C = 2<span class="pi">π</span>r = 2 × 3.14 × ' + fmt(r, 1) + ' = ' + fmt(C) + '（厘米）');
      } else {
        rows.push('已知直径，直接算：C = <span class="pi">π</span>d = 3.14 × ' + fmt(d, 1) + ' = <b>' + fmt(C) + '</b>（厘米）');
        rows.push('也可以先求半径：r = d ÷ 2 = ' + fmt(d, 1) + ' ÷ 2 = ' + fmt(r, 1) + '（厘米）');
        rows.push('再用公式：C = 2<span class="pi">π</span>r = 2 × 3.14 × ' + fmt(r, 1) + ' = ' + fmt(C) + '（厘米）');
      }
      rows.push('答：这个圆的周长是 <b>' + fmt(C) + ' 厘米</b>。');
      fillSteps(stepsBox, rows);

      /* 半圆 */
      var dd = CL.round(2 * r, 4);
      var sc = CL.round(halfArc + dd, 4);
      fillSteps(halfSteps, [
        '半圆的弧长 = <span class="pi">π</span>r = 3.14 × ' + fmt(r, 1) + ' = ' + fmt(halfArc) + '（厘米）',
        '还要加上一条直径：2r = 2 × ' + fmt(r, 1) + ' = ' + fmt(dd, 1) + '（厘米）',
        '半圆周长 = ' + fmt(halfArc) + ' + ' + fmt(dd, 1) + ' = <b>' + fmt(sc) + '</b>（厘米）'
      ]);
      halfBody.querySelector('.ln-given').innerHTML =
        '半径 r = ' + fmt(r, 1) + ' 厘米的半圆，它的周长是多少？';
      halfAns.innerHTML = '答：半圆的周长是 <b>' + fmt(sc) + ' 厘米</b>。注意不是 ' +
        fmt(halfArc) + ' 厘米（那只是弧长），还要加上直径 ' + fmt(dd, 1) + ' 厘米。';
    }

    applyR(3, true);
    tp.show = function () {};
    tp.hide = function () {};
    return tp;
  }

  /* =======================================================
     6. 圆面积
     ======================================================= */
  function buildArea(t, index) {
    var tp = beginTopic(t, index);

    var know = card('🌕', '圆占了多大的地方？', '把圆剪成很多小扇形，拼成长方形，就能看懂面积公式。');
    know.appendChild(el('div', 'ln-know-body',
      '<p>把圆平均分成很多个小扇形，再一上一下拼起来，会得到一个近似的长方形：它的<b>长</b>大约是圆周长的一半（πr），<b>宽</b>就是半径 r。所以：</p>' +
      '<div class="ln-eq-list ln-mt">' +
      '<div class="ln-eq">S = <span class="pi">π</span>r² = 3.14 × r × r</div>' +
      '</div>' +
      '<p class="ln-mt-sm">计算时先算 <b>r²</b>（半径乘半径），再乘 3.14。面积的单位是<b>平方厘米</b>。</p>'));
    tp.stack.appendChild(know);

    var tool = card('🧮', '计算器：一步一步算面积', '拖动滑块或直接输入半径，看看每一步是怎么来的。',
      { text: 'S = πr²' });

    var grid = el('div', 'ln-tool-grid');
    var figBox = el('div', 'ln-figure-box');
    var side = el('div', 'ln-tool-side');
    grid.appendChild(figBox);
    grid.appendChild(side);
    tool.appendChild(grid);

    var stepsBox = el('div', 'ln-steps ln-mt');

    var svg = geom.svgRoot(figBox, '0 0 400 400', 'cl-svg');
    var CX = 200, CY = 200;

    var circleEl = geom.svgEl('circle', {
      cx: CX, cy: CY, r: 100, fill: '#e9fbf4', stroke: '#10b981', 'stroke-width': 6
    }, svg);
    var radLine = geom.svgEl('line', {
      stroke: '#2563eb', 'stroke-width': 5, 'stroke-linecap': 'round'
    }, svg);
    geom.svgEl('circle', { cx: CX, cy: CY, r: 6, fill: '#1e293b' }, svg);
    var rLabel = svgText(svg, 0, 0, '', { fill: '#2563eb', 'font-size': 15, class: 'ln-fig-text ln-halo' });
    var sLabel = svgText(svg, CX, CY + 44, '', { fill: '#047857', 'font-size': 15, class: 'ln-fig-text ln-halo' });

    var stats = statGrid([
      { key: 'r', label: '半径 r' },
      { key: 'r2', label: 'r² = r × r' },
      { key: 'c', label: '周长 C' },
      { key: 's', label: '面积 S', cls: 'green' }
    ]);

    var rField = sliderField({
      label: '半径 r', min: 1, max: 10, step: 0.5, value: 3,
      unit: '厘米', dec: 1, color: 'green', onInput: function (v) { render(v); }
    });

    side.appendChild(rField.node);
    side.appendChild(stats.node);

    var cmp = el('div', 'ln-compare');
    side.appendChild(cmp);

    tool.appendChild(el('div', 'cl-section-title ln-sub-title', '一步一步算'));
    tool.appendChild(stepsBox);
    tp.stack.appendChild(tool);

    tp.stack.appendChild(el('div', 'ln-note-grid',
      '<div class="cl-note warn"><span class="note-icon" aria-hidden="true">💡</span><div><b>小结：</b>' +
      '求圆面积就三步：① 找到半径 r；② 算 r² = r × r；③ 乘 3.14。S = πr²。' +
      '半径变成原来的 2 倍，周长只变 2 倍，面积却会变成原来的 4 倍！</div></div>' +
      '<div class="cl-note bad"><span class="note-icon" aria-hidden="true">⚠️</span><div><b>易错提醒：</b>' +
      'r² 表示 <b>r × r</b>，<b>不是</b> 2r！比如 r = 3，r² = 9，不是 6。' +
      '还有：周长和面积的单位不一样，不能直接比较大小。</div></div>'));

    function render(r) {
      r = CL.round(CL.clamp(r, 1, 10), 2);
      var R = 50 + r * 10;
      circleEl.setAttribute('r', geom.f(R));
      var p = geom.polar(CX, CY, R, 42);
      radLine.setAttribute('x1', CX);
      radLine.setAttribute('y1', CY);
      radLine.setAttribute('x2', geom.f(p.x));
      radLine.setAttribute('y2', geom.f(p.y));
      var lp = geom.polar(CX, CY, R * 0.6, 42);
      rLabel.setAttribute('x', geom.f(lp.x + 14));
      rLabel.setAttribute('y', geom.f(lp.y - 10));
      rLabel.textContent = 'r = ' + fmt(r, 1) + ' 厘米';

      var c = CL.circle(r);
      var r2 = CL.round(r * r, 4);
      sLabel.setAttribute('y', geom.f(CY + R * 0.45));
      sLabel.textContent = 'S = ' + fmt(c.S) + ' 平方厘米';

      stats.refs.r.textContent = fmt(r, 1) + ' 厘米';
      stats.refs.r2.textContent = fmt(r, 1) + ' × ' + fmt(r, 1) + ' = ' + fmt(r2);
      stats.refs.c.textContent = fmt(c.C) + ' 厘米';
      stats.refs.s.textContent = fmt(c.S) + ' 平方厘米';

      fillSteps(stepsBox, [
        '先算半径的平方：r² = r × r = ' + fmt(r, 1) + ' × ' + fmt(r, 1) + ' = <b>' + fmt(r2) + '</b>',
        '再乘圆周率：S = <span class="pi">π</span>r² = 3.14 × ' + fmt(r2) + ' = <b>' + fmt(c.S) + '</b>（平方厘米）',
        '答：这个圆的面积是 <b>' + fmt(c.S) + ' 平方厘米</b>。'
      ]);

      var c2 = CL.circle(CL.round(r * 2, 2));
      cmp.innerHTML =
        '<div class="ln-compare-head">半径翻倍会怎样？</div>' +
        '<div class="ln-compare-row"><span>半径 ' + fmt(r, 1) + ' 厘米</span><span>周长 ' + fmt(c.C) + ' 厘米</span><span>面积 ' + fmt(c.S) + ' 平方厘米</span></div>' +
        '<div class="ln-compare-row"><span>半径 ' + fmt(CL.round(r * 2, 2), 1) + ' 厘米</span><span>周长 ' + fmt(c2.C) + ' 厘米</span><span>面积 ' + fmt(c2.S) + ' 平方厘米</span></div>' +
        '<div class="ln-compare-tip">半径 ×2 → 周长 ×2，面积 ×<b>4</b></div>';
    }

    render(3);
    tp.show = function () {};
    tp.hide = function () {};
    return tp;
  }

  /* =======================================================
     7. 扇形
     ======================================================= */
  function buildSector(t, index) {
    var tp = beginTopic(t, index);

    var know = card('🍕', '扇形：圆的一块「披萨」', '一条弧 + 两条半径围成的图形，就是扇形。');
    know.appendChild(el('div', 'ln-know-body',
      '<p>一条弧和经过这条弧两端的两条半径围成的图形，叫做<b>扇形</b>。两条半径夹的角（顶点在圆心）叫做<b>圆心角 n</b>。</p>' +
      '<ul class="ln-list">' +
      '<li>圆心角占 360° 的几分之几，这个扇形就是整圆的几分之几。</li>' +
      '<li>弧长 = 2<span class="ln-pi">π</span>r × n / 360；扇形面积 = <span class="ln-pi">π</span>r² × n / 360。</li>' +
      '<li>先算整圆的周长和面积，再乘比例 n / 360，就不容易错。</li>' +
      '</ul>'));
    tp.stack.appendChild(know);

    var tool = card('📐', '小工具：调角度、调半径，扇形立刻变', '两个滑块一起拖一拖，看看弧长和面积怎么跟着变。',
      { text: '弧长 / 面积 = 整圆 × n/360' });

    var grid = el('div', 'ln-tool-grid');
    var figBox = el('div', 'ln-figure-box');
    var side = el('div', 'ln-tool-side');
    grid.appendChild(figBox);
    grid.appendChild(side);
    tool.appendChild(grid);

    var stepsBox = el('div', 'ln-steps ln-mt');

    var svg = geom.svgRoot(figBox, '0 0 400 400', 'cl-svg');
    var CX = 200, CY = 200;

    var fullCircle = geom.svgEl('circle', {
      cx: CX, cy: CY, r: 120, fill: '#fbfdff', stroke: '#e2e8f0',
      'stroke-width': 3, 'stroke-dasharray': '7 7'
    }, svg);
    var sectorEl = geom.svgEl('path', {
      fill: '#ede9fe', stroke: '#8b5cf6', 'stroke-width': 4, 'stroke-linejoin': 'round'
    }, svg);
    var arcEl = geom.svgEl('path', {
      fill: 'none', stroke: '#f59e0b', 'stroke-width': 8, 'stroke-linecap': 'round'
    }, svg);
    var fullArc = geom.svgEl('circle', {
      cx: CX, cy: CY, r: 120, fill: 'none', stroke: '#f59e0b', 'stroke-width': 8,
      style: 'display:none'
    }, svg);
    var radA = geom.svgEl('line', { stroke: '#2563eb', 'stroke-width': 4.5, 'stroke-linecap': 'round' }, svg);
    var radB = geom.svgEl('line', { stroke: '#2563eb', 'stroke-width': 4.5, 'stroke-linecap': 'round' }, svg);
    geom.svgEl('circle', { cx: CX, cy: CY, r: 6, fill: '#1e293b' }, svg);
    var angleArc = geom.svgEl('path', {
      fill: 'none', stroke: '#1e293b', 'stroke-width': 2,
      'stroke-dasharray': '4 4'
    }, svg);
    var angleLabel = svgText(svg, CX, CY - 44, '', { fill: '#1e293b', 'font-size': 14, class: 'ln-fig-text ln-halo' });
    var rLabel = svgText(svg, 0, 0, '', { fill: '#2563eb', 'font-size': 15, class: 'ln-fig-text ln-halo' });

    var stats = statGrid([
      { key: 'angle', label: '圆心角 n' },
      { key: 'frac', label: '占整圆', cls: 'amber' },
      { key: 'arc', label: '弧长' },
      { key: 'area', label: '扇形面积', cls: 'green' }
    ]);

    var rField = sliderField({
      label: '半径 r', min: 1, max: 8, step: 0.5, value: 5,
      unit: '厘米', dec: 1, onInput: function (v) { st.r = v; render(); }
    });
    var aField = sliderField({
      label: '圆心角 n', min: 0, max: 360, step: 5, value: 90,
      unit: '°', dec: 0, color: 'amber', onInput: function (v) { st.angle = v; render(); }
    });

    var quickRow = el('div', 'cl-btn-row ln-quick');
    [90, 180, 270, 360].forEach(function (deg) {
      var qb = btn(deg + '°', 'cl-btn-ghost cl-btn-sm', function () {
        aField.set(deg);
        st.angle = deg;
        render();
        if (CL.sound && CL.sound.click) CL.sound.click();
      });
      quickRow.appendChild(qb);
    });

    side.appendChild(rField.node);
    side.appendChild(aField.node);
    side.appendChild(quickRow);
    side.appendChild(stats.node);

    tool.appendChild(el('div', 'cl-section-title ln-sub-title', '怎么算出来的'));
    tool.appendChild(stepsBox);
    tp.stack.appendChild(tool);

    tp.stack.appendChild(el('div', 'ln-note-grid',
      '<div class="cl-note warn"><span class="note-icon" aria-hidden="true">💡</span><div><b>小结：</b>' +
      '扇形是「整圆的一部分」。先算整圆的周长 2πr、面积 πr²，再乘 n/360，就是弧长和扇形面积。' +
      'n = 180° 时，扇形是半圆；n = 90° 时，是四分之一圆。</div></div>' +
      '<div class="cl-note bad"><span class="note-icon" aria-hidden="true">⚠️</span><div><b>易错提醒：</b>' +
      'n/360 是「比例」，别忘了乘；弧长用 <b>2πr</b>（周长）乘比例，面积用 <b>πr²</b> 乘比例，别把两个公式用反了。' +
      '弧长的单位是厘米，面积是平方厘米。</div></div>'));

    var st = { r: 5, angle: 90 };

    function render() {
      var r = st.r;
      var angle = st.angle;
      var R = 40 + r * 12;

      fullCircle.setAttribute('r', geom.f(R));
      fullArc.setAttribute('r', geom.f(R));

      if (angle <= 0.01) {
        sectorEl.setAttribute('d', '');
        arcEl.setAttribute('d', '');
        angleArc.setAttribute('d', '');
        fullArc.style.display = 'none';
      } else if (angle >= 359.9) {
        sectorEl.setAttribute('d', geom.sectorPath(CX, CY, R, 0, 360));
        arcEl.setAttribute('d', '');
        fullArc.style.display = '';
        angleArc.setAttribute('d', '');
      } else {
        sectorEl.setAttribute('d', geom.sectorPath(CX, CY, R, 0, angle));
        arcEl.setAttribute('d', geom.arcPath(CX, CY, R, 0, angle));
        fullArc.style.display = 'none';
        angleArc.setAttribute('d', geom.arcPath(CX, CY, 34, 0, angle));
      }

      var pA = geom.polar(CX, CY, R, 0);
      var pB = geom.polar(CX, CY, R, angle);
      radA.setAttribute('x1', CX); radA.setAttribute('y1', CY);
      radA.setAttribute('x2', geom.f(pA.x)); radA.setAttribute('y2', geom.f(pA.y));
      radB.setAttribute('x1', CX); radB.setAttribute('y1', CY);
      radB.setAttribute('x2', geom.f(pB.x)); radB.setAttribute('y2', geom.f(pB.y));

      var midDir = angle / 2;
      var al = geom.polar(CX, CY, 52, midDir);
      angleLabel.setAttribute('x', geom.f(al.x));
      angleLabel.setAttribute('y', geom.f(al.y + 5));
      angleLabel.textContent = fmt(angle, 0) + '°';

      var rl = geom.polar(CX, CY, R * 0.55, 0);
      rLabel.setAttribute('x', geom.f(rl.x + 12));
      rLabel.setAttribute('y', geom.f(rl.y - 8));
      rLabel.textContent = 'r = ' + fmt(r, 1) + ' 厘米';

      var sec = CL.sector(r, angle);
      var fullC = CL.round(2 * CL.PI_APPROX * r, 4);
      var fullS = CL.round(CL.PI_APPROX * r * r, 4);

      stats.refs.angle.textContent = fmt(angle, 0) + '°';
      stats.refs.frac.textContent = fmt(sec.frac * 100, 1) + '%';
      stats.refs.arc.textContent = fmt(sec.arc) + ' 厘米';
      stats.refs.area.textContent = fmt(sec.area) + ' 平方厘米';

      fillSteps(stepsBox, [
        '整圆的周长 = 2<span class="pi">π</span>r = 2 × 3.14 × ' + fmt(r, 1) + ' = ' + fmt(fullC) + '（厘米）',
        '弧长 = 整圆周长 × n/360 = ' + fmt(fullC) + ' × ' + fmt(angle, 0) + '/360 = <b>' + fmt(sec.arc) + '</b>（厘米）',
        '整圆的面积 = <span class="pi">π</span>r² = 3.14 × ' + fmt(r, 1) + ' × ' + fmt(r, 1) + ' = ' + fmt(fullS) + '（平方厘米）',
        '扇形面积 = 整圆面积 × n/360 = ' + fmt(fullS) + ' × ' + fmt(angle, 0) + '/360 = <b>' + fmt(sec.area) + '</b>（平方厘米）'
      ]);
    }

    render();
    tp.show = function () {};
    tp.hide = function () {};
    return tp;
  }

  /* =======================================================
     8. 阴影面积
     ======================================================= */
  function buildShadow(t, index) {
    var tp = beginTopic(t, index);

    var know = card('🎯', '阴影面积的三板斧', '看到阴影别慌，先想「它等于哪两个图形相减」。');
    know.appendChild(el('div', 'ln-know-body',
      '<p>求阴影部分的面积，最常用的办法是<b>把阴影看成一个规则图形，再减去空白部分</b>；' +
      '如果阴影比较散，可以用<b>割补、平移、旋转</b>把它拼成规则图形。圆里的阴影题，多半离不开圆环、外方内圆、内方外圆这三种。</p>'));
    var methods = el('div', 'ln-method-grid');
    methods.appendChild(methodCard('🧩', '整体减空白', '阴影 = 大图形 − 空白图形，最常用。'));
    methods.appendChild(methodCard('⭕', '圆环相减', 'S = πR² − πr²，先算两个整圆再相减。'));
    methods.appendChild(methodCard('✂️', '割补', '把阴影切开，补到空白处，拼成规则图形。'));
    methods.appendChild(methodCard('🔄', '平移旋转', '把零散的阴影移到一起，凑成好算的形状。'));
    know.appendChild(methods);
    tp.stack.appendChild(know);

    var examples = el('div', 'ln-examples');
    examples.appendChild(el('div', 'cl-section-title ln-sub-title', '三个经典例题（先自己想，再点「显示步骤」）'));

    /* ---------------- 例 1：圆环 ---------------- */
    var R1 = 5, r1 = 3;
    var cOut = CL.circle(R1);
    var cIn = CL.circle(r1);
    var ringS = CL.round(cOut.S - cIn.S, 2);

    examples.appendChild(exampleCard({
      no: 1,
      title: '圆环的面积',
      given: '外圆半径 R = ' + R1 + ' 厘米，内圆半径 r = ' + r1 + ' 厘米。求粉色圆环的面积。',
      draw: function (svg) {
        geom.svgEl('path', {
          d: geom.donutPath(200, 200, 132, 79),
          fill: '#fbcfe8', 'fill-rule': 'evenodd'
        }, svg);
        geom.svgEl('circle', { cx: 200, cy: 200, r: 132, fill: 'none', stroke: '#ec4899', 'stroke-width': 5 }, svg);
        geom.svgEl('circle', { cx: 200, cy: 200, r: 79, fill: 'none', stroke: '#ec4899', 'stroke-width': 5 }, svg);
        geom.svgEl('line', { x1: 200, y1: 200, x2: 332, y2: 200, stroke: '#2563eb', 'stroke-width': 4 }, svg);
        var q = geom.polar(200, 200, 79, 225);
        geom.svgEl('line', { x1: 200, y1: 200, x2: geom.f(q.x), y2: geom.f(q.y), stroke: '#2563eb', 'stroke-width': 4 }, svg);
        geom.svgEl('circle', { cx: 200, cy: 200, r: 5, fill: '#1e293b' }, svg);
        svgText(svg, 268, 188, 'R = 5', { fill: '#1d4ed8', 'font-size': 14, class: 'ln-fig-text ln-halo' });
        svgText(svg, 168, 158, 'r = 3', { fill: '#1d4ed8', 'font-size': 14, class: 'ln-fig-text ln-halo' });
        svgText(svg, 200, 372, '粉色部分是圆环', { fill: '#be185d', 'font-size': 13, class: 'ln-fig-text' });
      },
      steps: [
        '外圆面积 = <span class="pi">π</span>R² = 3.14 × ' + R1 + ' × ' + R1 + ' = <b>' + fmt(cOut.S) + '</b>（平方厘米）',
        '内圆面积 = <span class="pi">π</span>r² = 3.14 × ' + r1 + ' × ' + r1 + ' = <b>' + fmt(cIn.S) + '</b>（平方厘米）',
        '阴影 = 外圆 − 内圆 = ' + fmt(cOut.S) + ' − ' + fmt(cIn.S) + ' = <b>' + fmt(ringS) + '</b>（平方厘米）'
      ],
      answer: '答：圆环的面积是 <b>' + fmt(ringS) + ' 平方厘米</b>。'
    }));

    /* ---------------- 例 2：外方内圆 ---------------- */
    var side2 = 8;
    var r2 = side2 / 2;
    var square2 = side2 * side2;
    var circle2 = CL.circle(r2).S;
    var shadow2 = CL.round(square2 - circle2, 2);

    examples.appendChild(exampleCard({
      no: 2,
      title: '外方内圆（正方形里最大的圆）',
      given: '正方形边长 ' + side2 + ' 厘米，里面画一个最大的圆。求四个角上粉色部分的面积。',
      draw: function (svg) {
        geom.svgEl('rect', {
          x: 66, y: 66, width: 268, height: 268,
          fill: '#fbcfe8', stroke: '#94a3b8', 'stroke-width': 4
        }, svg);
        geom.svgEl('circle', {
          cx: 200, cy: 200, r: 134, fill: '#ffffff', stroke: '#8b5cf6', 'stroke-width': 5
        }, svg);
        svgText(svg, 200, 366, '边长 = 圆的直径 = ' + side2 + ' 厘米', { fill: '#475569', 'font-size': 13, class: 'ln-fig-text' });
        svgText(svg, 200, 208, 'r = ' + r2, { fill: '#1d4ed8', 'font-size': 14, class: 'ln-fig-text ln-halo' });
        var p = geom.polar(200, 200, 134, 0);
        geom.svgEl('line', { x1: 200, y1: 200, x2: geom.f(p.x), y2: 200, stroke: '#2563eb', 'stroke-width': 4 }, svg);
        geom.svgEl('circle', { cx: 200, cy: 200, r: 5, fill: '#1e293b' }, svg);
      },
      steps: [
        '圆的直径 = 正方形的边长 = ' + side2 + ' 厘米，所以 r = ' + side2 + ' ÷ 2 = ' + r2 + '（厘米）',
        '正方形面积 = ' + side2 + ' × ' + side2 + ' = <b>' + square2 + '</b>（平方厘米）',
        '圆的面积 = <span class="pi">π</span>r² = 3.14 × ' + r2 + ' × ' + r2 + ' = <b>' + fmt(circle2) + '</b>（平方厘米）',
        '阴影 = 正方形 − 圆 = ' + square2 + ' − ' + fmt(circle2) + ' = <b>' + fmt(shadow2) + '</b>（平方厘米）'
      ],
      answer: '答：四个角上的阴影面积是 <b>' + fmt(shadow2) + ' 平方厘米</b>。'
    }));

    /* ---------------- 例 3：内方外圆 ---------------- */
    var r3 = 4;
    var diag3 = r3 * 2;
    var circle3 = CL.circle(r3).S;
    var square3 = CL.round(diag3 * diag3 / 2, 4);
    var shadow3 = CL.round(circle3 - square3, 2);

    examples.appendChild(exampleCard({
      no: 3,
      title: '内方外圆（圆里最大的正方形）',
      given: '圆的半径 r = ' + r3 + ' 厘米，圆里画一个最大的正方形。求粉色部分（4 个弓形）的面积。',
      draw: function (svg) {
        geom.svgEl('circle', {
          cx: 200, cy: 200, r: 134, fill: '#fbcfe8', stroke: '#8b5cf6', 'stroke-width': 5
        }, svg);
        geom.svgEl('path', {
          d: 'M 200 66 L 334 200 L 200 334 L 66 200 Z',
          fill: '#ffffff', stroke: '#94a3b8', 'stroke-width': 4, 'stroke-linejoin': 'round'
        }, svg);
        geom.svgEl('line', {
          x1: 66, y1: 200, x2: 334, y2: 200,
          stroke: '#f59e0b', 'stroke-width': 4, 'stroke-dasharray': '9 7'
        }, svg);
        geom.svgEl('circle', { cx: 200, cy: 200, r: 5, fill: '#1e293b' }, svg);
        svgText(svg, 200, 228, '对角线 = 2r = ' + diag3, { fill: '#b45309', 'font-size': 13, class: 'ln-fig-text ln-halo' });
        svgText(svg, 200, 372, '粉色部分是 4 个弓形', { fill: '#be185d', 'font-size': 13, class: 'ln-fig-text' });
      },
      steps: [
        '圆的面积 = <span class="pi">π</span>r² = 3.14 × ' + r3 + ' × ' + r3 + ' = <b>' + fmt(circle3) + '</b>（平方厘米）',
        '正方形的对角线 = 圆的直径 = ' + r3 + ' × 2 = <b>' + diag3 + '</b>（厘米）',
        '正方形面积 = 对角线 × 对角线 ÷ 2 = ' + diag3 + ' × ' + diag3 + ' ÷ 2 = <b>' + square3 + '</b>（平方厘米）',
        '阴影 = 圆 − 正方形 = ' + fmt(circle3) + ' − ' + square3 + ' = <b>' + fmt(shadow3) + '</b>（平方厘米）'
      ],
      answer: '答：4 个弓形的总面积是 <b>' + fmt(shadow3) + ' 平方厘米</b>。'
    }));

    tp.stack.appendChild(examples);

    tp.stack.appendChild(el('div', 'ln-note-grid',
      '<div class="cl-note warn"><span class="note-icon" aria-hidden="true">💡</span><div><b>小结：</b>' +
      '先看清楚「阴影 = 哪个图形 − 哪个图形」：圆环用 πR² − πr²；外方内圆用「正方形 − 圆」；' +
      '内方外圆用「圆 − 正方形」，其中正方形面积 = 对角线 × 对角线 ÷ 2。</div></div>' +
      '<div class="cl-note bad"><span class="note-icon" aria-hidden="true">⚠️</span><div><b>易错提醒：</b>' +
      '圆环面积是 <b>πR² − πr²</b>，不是 π(R − r)²！' +
      '用对角线求正方形面积时别忘了 <b>÷ 2</b>；阴影面积的单位是<b>平方厘米</b>，别写成厘米。</div></div>'));

    tp.show = function () {};
    tp.hide = function () {};
    return tp;
  }

  /* =======================================================
     模块状态与导航
     ======================================================= */
  var els = {};
  var navItems = {};
  var hooks = {};
  var current = null;
  var active = false;
  var visited = [];

  var chipEl = null;
  var navProgressFill = null;
  var navProgressText = null;
  var pagerPos = null;
  var pagerPrev = null;
  var pagerNext = null;

  var rafId = 0;
  var animTick = null;
  var animPlaying = false;

  function loadVisited() {
    var list = CL.store.get(STORE_KEY, []);
    if (!Array.isArray(list)) list = [];
    visited = list.filter(function (id) {
      return TOPICS.some(function (t) { return t.id === id; });
    });
  }

  function markVisited(id) {
    if (visited.indexOf(id) >= 0) return;
    visited.push(id);
    CL.store.set(STORE_KEY, visited);
    paintVisited();
  }

  function paintVisited() {
    TOPICS.forEach(function (t) {
      var item = navItems[t.id];
      if (!item) return;
      var done = visited.indexOf(t.id) >= 0;
      item.classList.toggle('is-visited', done);
    });
    var text = '已学 ' + visited.length + ' / ' + TOPICS.length;
    if (chipEl) chipEl.textContent = text;
    if (navProgressText) navProgressText.textContent = text;
    if (navProgressFill) navProgressFill.style.width = (visited.length / TOPICS.length * 100) + '%';
  }

  function indexOfTopic(id) {
    for (var i = 0; i < TOPICS.length; i++) {
      if (TOPICS[i].id === id) return i;
    }
    return 0;
  }

  function updatePager() {
    var i = indexOfTopic(current);
    if (pagerPos) pagerPos.textContent = '第 ' + (i + 1) + ' / ' + TOPICS.length + ' 课';
    if (pagerPrev) pagerPrev.disabled = i <= 0;
    if (pagerNext) pagerNext.disabled = i >= TOPICS.length - 1;
  }

  function showTopic(id, options) {
    var opts = options || {};
    if (!els[id]) id = TOPICS[0].id;
    if (current === id) {
      if (opts.scroll) scrollToTopic(els[id]);
      return;
    }
    if (current && hooks[current] && hooks[current].hide) {
      try { hooks[current].hide(); } catch (e) { /* 忽略 */ }
    }
    if (current && els[current]) els[current].classList.remove('is-active');

    current = id;
    var sec = els[id];
    sec.classList.add('is-active');
    /* 重播进入动画 */
    sec.style.animation = 'none';
    void sec.offsetWidth;
    sec.style.animation = '';

    Object.keys(navItems).forEach(function (key) {
      var item = navItems[key];
      var on = key === id;
      item.classList.toggle('is-active', on);
      if (on) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });

    markVisited(id);
    updatePager();

    if (hooks[id] && hooks[id].show) {
      try { hooks[id].show(); } catch (e) { /* 忽略 */ }
    }

    try {
      if ((location.hash || '').indexOf('#learn') === 0) {
        history.replaceState(null, '', '#learn/' + id);
      }
    } catch (e) { /* 忽略 */ }

    if (opts.scroll) scrollToTopic(sec);
  }

  function scrollToTopic(sec) {
    var top = sec.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function startRaf() {
    if (rafId || !animTick || !animPlaying || !active || current !== 'concept') return;
    var last = 0;
    function frame(ts) {
      rafId = 0;
      if (!animPlaying || !active || current !== 'concept') return;
      var dt = last ? Math.min(60, ts - last) : 16;
      last = ts;
      animTick(dt);
      rafId = window.requestAnimationFrame(frame);
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function stopRaf() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function startModule() {
    active = true;
    if (current && hooks[current] && hooks[current].show) {
      try { hooks[current].show(); } catch (e) { /* 忽略 */ }
    }
  }

  function stopModule() {
    active = false;
    stopRaf();
  }

  function hashTopic() {
    var m = /^#learn\/([\w-]+)/.exec(location.hash || '');
    if (!m) return null;
    return els[m[1]] ? m[1] : null;
  }

  /* =======================================================
     构建界面
     ======================================================= */
  function build(root) {
    dom.clear(root);
    loadVisited();

    /* 版块头 */
    var head = el('div', 'cl-mode-head ln-head');
    var headLeft = el('div');
    headLeft.innerHTML =
      '<h2><span class="head-emoji" aria-hidden="true">📖</span> 学习 · 8 个知识点</h2>' +
      '<p>从「圆是什么」开始，一课一课把圆的知识学扎实。每课都有能动手的小工具，先玩一玩，再看小结和易错提醒。</p>';
    head.appendChild(headLeft);
    var headRight = el('div', 'ln-head-right');
    chipEl = el('span', 'cl-head-chip', '已学 0 / 8');
    headRight.appendChild(chipEl);
    head.appendChild(headRight);
    root.appendChild(head);

    var wrap = el('div', 'ln-wrap');

    /* 左侧导航 */
    var nav = el('nav', 'ln-nav');
    nav.setAttribute('aria-label', '知识点导航');
    var navHead = el('div', 'ln-nav-head');
    navHead.innerHTML = '<span>知识点</span><span>' + TOPICS.length + ' 课</span>';
    nav.appendChild(navHead);

    var list = el('div', 'ln-nav-list');
    TOPICS.forEach(function (t, i) {
      var b = el('button', 'ln-nav-item');
      b.type = 'button';
      b.innerHTML = '<span class="ln-nav-num">' + (i + 1) + '</span>' +
        '<span class="ln-nav-label">' + t.name + '</span>' +
        '<span class="ln-nav-check" aria-hidden="true">✓</span>';
      b.addEventListener('click', function () {
        if (CL.sound && CL.sound.click) CL.sound.click();
        showTopic(t.id, { scroll: true });
      });
      list.appendChild(b);
      navItems[t.id] = b;
    });
    nav.appendChild(list);

    var prog = el('div', 'ln-nav-progress');
    var bar = el('div', 'cl-progress');
    navProgressFill = el('i');
    bar.appendChild(navProgressFill);
    navProgressText = el('span', null, '已学 0 / 8');
    prog.appendChild(bar);
    prog.appendChild(navProgressText);
    nav.appendChild(prog);
    wrap.appendChild(nav);

    /* 右侧内容 */
    var main = el('div', 'ln-main');
    var builders = {
      concept: buildConcept,
      pi: buildPi,
      pitable: buildPiTable,
      rd: buildRadiusDiameter,
      circ: buildCircumference,
      area: buildArea,
      sector: buildSector,
      shadow: buildShadow
    };
    TOPICS.forEach(function (t, i) {
      var res = builders[t.id](t, i);
      els[t.id] = res.sec;
      hooks[t.id] = res;
      main.appendChild(res.sec);
    });

    /* 上一课 / 下一课 */
    var pager = el('div', 'ln-pager');
    pagerPrev = btn('← 上一课', 'cl-btn-ghost', function () {
      var i = indexOfTopic(current) - 1;
      if (i >= 0) showTopic(TOPICS[i].id, { scroll: true });
    });
    pagerNext = btn('下一课 →', 'cl-btn-primary', function () {
      var i = indexOfTopic(current) + 1;
      if (i < TOPICS.length) showTopic(TOPICS[i].id, { scroll: true });
    });
    pagerPos = el('span', 'ln-pager-pos', '第 1 / 8 课');
    pager.appendChild(pagerPrev);
    pager.appendChild(pagerPos);
    pager.appendChild(pagerNext);
    main.appendChild(pager);

    wrap.appendChild(main);
    root.appendChild(wrap);

    paintVisited();

    var initial = hashTopic() || TOPICS[0].id;
    showTopic(initial, {});

    window.addEventListener('hashchange', function () {
      if (!active) return;
      var id = hashTopic();
      if (id && id !== current) showTopic(id, {});
    });
  }

  CL.registerMode('learn', function (root) {
    build(root);
    return { start: startModule, stop: stopModule };
  });
})();
