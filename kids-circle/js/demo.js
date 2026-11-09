/* =========================================================
   圆的乐园 · 演示模块（js/demo.js）
   ---------------------------------------------------------
   5 个动画演示：
   1. 圆的形成        —— 点绕圆心旋转一周留下轨迹
   2. 圆周率 π        —— 圆沿直尺滚动一圈，C ÷ d = 3.14
   3. 面积剪拼法      —— 8/16/32 等份扇形拼成近似长方形
   4. 扇形与圆心角    —— 拖动 0° ~ 360°，实时看弧长 / 面积
   5. 阴影面积        —— 圆环 / 外方内圆，整体减空白

   所有动画均用 requestAnimationFrame；stop() 会暂停所有 rAF。
   ========================================================= */
(function () {
  'use strict';

  var CL = window.CircleLab;
  if (!CL) return;

  var PIA = CL.PI_APPROX;      // 计算统一取 3.14
  var f = CL.geom.f;
  var polar = CL.geom.polar;
  var svgEl = CL.geom.svgEl;

  var DEMOS = [
    { id: 'forming', icon: '⭕', tab: '圆的形成' },
    { id: 'pi', icon: '📏', tab: '圆周率 π' },
    { id: 'area', icon: '🧩', tab: '面积公式' },
    { id: 'sector', icon: '📐', tab: '扇形与圆心角' },
    { id: 'shadow', icon: '🌗', tab: '阴影面积' }
  ];

  /* =======================================================
     一、通用小工具
     ======================================================= */

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function q(root, sel) {
    return root.querySelector(sel);
  }

  function svgText(parent, attrs, content) {
    var node = svgEl('text', attrs, parent);
    if (content != null) node.textContent = content;
    return node;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /** 角度规范到 (-180, 180]，让扇形旋转走最近的方向 */
  function normDeg(deg) {
    deg = ((deg % 360) + 360) % 360;
    return deg > 180 ? deg - 360 : deg;
  }

  /** rAF 小循环：onTick(dt) 返回 false 时自动停止 */
  function makeLoop(onTick) {
    var raf = 0;
    var playing = false;
    var last = 0;

    function frame(ts) {
      if (!playing) return;
      if (!last) last = ts;
      var dt = Math.min(80, ts - last) / 1000;
      last = ts;
      if (onTick(dt) === false) {
        playing = false;
        raf = 0;
        return;
      }
      raf = window.requestAnimationFrame(frame);
    }

    return {
      play: function () {
        if (playing) return;
        playing = true;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      },
      pause: function () {
        playing = false;
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      },
      isPlaying: function () {
        return playing;
      }
    };
  }

  /* ---------------- 版块骨架 ---------------- */

  function statsHtml(list) {
    return '<div class="cl-stat-grid">' + list.map(function (item) {
      return '<div class="cl-stat ' + (item.tone || '') + '">' +
        '<div class="stat-label">' + item.label + '</div>' +
        '<div class="stat-value" data-stat="' + item.key + '">—</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function shell(panel, cfg) {
    panel.innerHTML =
      '<div class="dm-main cl-card">' +
        '<div class="cl-card-head">' +
          '<div>' +
            '<h3>' + cfg.title + '</h3>' +
            '<div class="cl-card-sub">' + cfg.sub + '</div>' +
          '</div>' +
          '<span class="cl-chip ' + (cfg.chipTone || 'cl-chip-blue') + '">' + cfg.chip + '</span>' +
        '</div>' +
        (cfg.subbar || '') +
        '<div class="dm-stage" data-role="stage"></div>' +
        '<div class="dm-controls" data-role="controls"></div>' +
      '</div>' +
      '<aside class="dm-side">' +
        '<div class="cl-card dm-narr">' +
          '<div class="dm-narr-head">' +
            '<span class="dm-narr-avatar" aria-hidden="true">🧑‍🏫</span>' +
            '<div>' +
              '<h3>小讲师</h3>' +
              '<div class="cl-card-sub">边看动画，边想为什么</div>' +
            '</div>' +
          '</div>' +
          '<p class="dm-narr-text" data-role="narr"></p>' +
          '<div class="dm-formula-slot" data-role="formula"></div>' +
        '</div>' +
        '<div class="cl-card dm-data">' +
          '<div class="cl-section-title">数据看板</div>' +
          statsHtml(cfg.stats) +
          '<div class="dm-progress-top"><span>' + cfg.progressLabel + '</span>' +
            '<b data-role="progText">0%</b></div>' +
          '<div class="cl-progress"><i data-role="progBar" style="width:0%"></i></div>' +
        '</div>' +
      '</aside>';
  }

  function setNarr(panel, html) {
    var node = q(panel, '[data-role="narr"]');
    if (node && node.innerHTML !== html) node.innerHTML = html;
  }

  function setFormula(panel, html) {
    var node = q(panel, '[data-role="formula"]');
    if (node && node.innerHTML !== html) node.innerHTML = html;
  }

  function setProgress(panel, pct) {
    pct = Math.max(0, Math.min(100, pct));
    var bar = q(panel, '[data-role="progBar"]');
    var text = q(panel, '[data-role="progText"]');
    if (bar) bar.style.width = pct.toFixed(1) + '%';
    if (text) text.textContent = Math.round(pct) + '%';
  }

  function statSetter(panel) {
    var map = {};
    Array.prototype.forEach.call(panel.querySelectorAll('[data-stat]'), function (node) {
      map[node.getAttribute('data-stat')] = node;
    });
    return function (key, text) {
      if (map[key]) map[key].textContent = text;
    };
  }

  /* ---------------- 播放 / 重置按钮 ---------------- */

  function addButtons(panel, onToggle, onReset) {
    var box = q(panel, '[data-role="controls"]');
    var row = el('div', 'dm-btn-row cl-btn-row');
    var play = el('button', 'cl-btn cl-btn-primary dm-play',
      '<span class="dm-play-ico" data-role="playIco" aria-hidden="true">▶</span>' +
      '<span data-role="playText">播放</span>');
    var reset = el('button', 'cl-btn cl-btn-ghost dm-reset', '↺ 重置');
    play.type = 'button';
    reset.type = 'button';
    play.addEventListener('click', function () { CL.sound.click(); onToggle(); });
    reset.addEventListener('click', function () { CL.sound.click(); onReset(); });
    row.appendChild(play);
    row.appendChild(reset);
    box.appendChild(row);
    return {
      play: play,
      reset: reset,
      ico: q(play, '[data-role="playIco"]'),
      text: q(play, '[data-role="playText"]')
    };
  }

  function syncPlay(ui, playing, done) {
    ui.ico.textContent = playing ? '⏸' : '▶';
    ui.text.textContent = playing ? '暂停' : (done ? '再播一次' : '播放');
    ui.play.classList.toggle('is-playing', !!playing);
  }

  /* =======================================================
     二、演示 1：圆是怎样形成的
     ======================================================= */

  function buildForming(panel) {
    shell(panel, {
      title: '① 圆是怎样形成的',
      sub: '一个点绕定点旋转一周，它留下的轨迹就是圆',
      chip: '到圆心的距离始终相等',
      chipTone: 'cl-chip-purple',
      stats: [
        { key: 'r', label: '半径 r' },
        { key: 'd', label: '直径 d', tone: 'amber' },
        { key: 'c', label: '周长 C' },
        { key: 'ang', label: '已转角度', tone: 'green' }
      ],
      progressLabel: '旋转进度'
    });

    var stage = q(panel, '[data-role="stage"]');
    var svg = CL.geom.svgRoot(stage, '0 0 800 460', 'cl-svg dm-svg');
    var CX = 400;
    var CY = 238;

    var ghost = svgEl('circle', { cx: CX, cy: CY, r: 100, class: 'dm-ghost' }, svg);
    var angleArc = svgEl('path', { d: '', class: 'dm-angle-arc' }, svg);
    var trail = svgEl('path', { d: '', class: 'dm-trail' }, svg);
    var radiusLine = svgEl('line', {
      x1: CX, y1: CY, x2: CX, y2: CY - 110, class: 'dm-radius-line'
    }, svg);
    svgEl('circle', { cx: CX, cy: CY, r: 7, class: 'dm-center-dot' }, svg);
    svgText(svg, { x: CX + 14, y: CY + 7, class: 'dm-o-label dm-halo' }, 'O');

    var pointGroup = svgEl('g', null, svg);
    svgEl('circle', { r: 22, class: 'dm-point-pulse' }, pointGroup);
    svgEl('circle', { r: 10, class: 'dm-point' }, pointGroup);

    var distanceText = svgText(svg, {
      x: 30, y: 50, class: 'dm-top-label dm-halo'
    }, '');
    svgText(svg, {
      x: 770, y: 50, 'text-anchor': 'end', class: 'dm-top-label dm-halo'
    }, '绕一周 = 360°');
    var angleText = svgText(svg, {
      class: 'dm-angle-label dm-halo', 'text-anchor': 'middle'
    }, '0°');
    svgText(svg, {
      x: 30, y: 428, class: 'dm-bottom-label dm-halo'
    }, '圆上每一点到圆心 O 的距离都相等');

    var state = { r: 5, angle: 0, done: false, userStarted: false };
    var setStat = statSetter(panel);
    var narrKey = '';
    var ui;
    var entered = false;

    var box = q(panel, '[data-role="controls"]');
    box.innerHTML =
      '<div class="cl-field dm-field">' +
        '<div class="cl-field-label"><span>圆的半径 r</span>' +
          '<b data-role="rVal">5 厘米</b></div>' +
        '<input class="cl-range" type="range" min="2" max="7" step="1" value="5" ' +
          'aria-label="圆的半径（厘米）">' +
      '</div>';

    function updateStats() {
      var circle = CL.circle(state.r);
      setStat('r', CL.fmtUnit(state.r, '厘米'));
      setStat('d', CL.fmtUnit(circle.d, '厘米'));
      setStat('c', CL.fmtUnit(circle.C, '厘米'));
      setStat('ang', Math.round(state.angle) + '°');
    }

    function updateNarr() {
      var key = state.r + '|' + (state.done ? 'done' : Math.floor(state.angle / 5));
      if (key === narrKey) return;
      narrKey = key;
      var html;
      if (state.done) {
        html = '转满 360°！点 P 的轨迹围成了一个<b>圆</b>。因为点 P 到圆心 O 的距离' +
          '<b>始终等于半径 r</b>，所以圆上每一个点到圆心都一样远。';
      } else if (state.angle < 1) {
        html = '点 P 从圆的最上方出发，它到圆心 O 的距离一直是 <b>' + state.r +
          ' 厘米</b>。按下播放，看它走完一圈会留下什么？';
      } else {
        html = '点 P 已经转了大约 <b>' + Math.round(state.angle) + '°</b>，它到圆心 O 的距离还是 <b>' +
          state.r + ' 厘米</b>，一点都没变。继续转，轨迹越来越像一个圆……';
      }
      setNarr(panel, html);
      setFormula(panel,
        '<div class="cl-formula">C = 2<span class="pi">π</span>r = 2 × 3.14 × ' +
        state.r + ' = ' + CL.fmtNum(2 * PIA * state.r, 2) + ' 厘米</div>');
    }

    function render() {
      var R = state.r * 22;
      var ang = state.angle;
      var wrapped = Math.min(ang, 359.99);
      ghost.setAttribute('r', R);

      var p = polar(CX, CY, R, ang);
      radiusLine.setAttribute('x2', f(p.x));
      radiusLine.setAttribute('y2', f(p.y));
      pointGroup.setAttribute('transform', 'translate(' + f(p.x) + ' ' + f(p.y) + ')');

      trail.setAttribute('d', ang > 0.2 ? CL.geom.arcPath(CX, CY, R, 0, wrapped) : '');
      angleArc.setAttribute('d', ang > 0.2 ? CL.geom.arcPath(CX, CY, 62, 0, wrapped) : '');

      var mid = polar(CX, CY, 100, ang / 2);
      angleText.setAttribute('x', f(mid.x));
      angleText.setAttribute('y', f(mid.y + 7));
      angleText.textContent = Math.round(ang) + '°';
      angleText.style.opacity = ang > 8 ? '1' : '0';

      distanceText.textContent = '● 点到圆心的距离 = ' + state.r + ' 厘米';
      updateStats();
      setProgress(panel, ang / 3.6);
    }

    var loop = makeLoop(function (dt) {
      state.angle += dt * 45;   // 8 秒转一圈
      if (state.angle >= 360) {
        state.angle = 360;
        state.done = true;
        loop.pause();
        render();
        updateNarr();
        syncPlay(ui, false, true);
        if (state.userStarted) {
          CL.ui.confetti({ count: 46 });
          CL.sound.correct();
        }
        return false;
      }
      render();
      updateNarr();
      return true;
    });

    ui = addButtons(panel, function () {
      if (loop.isPlaying()) {
        loop.pause();
        syncPlay(ui, false, state.done);
        return;
      }
      if (state.angle >= 360) {
        state.angle = 0;
        state.done = false;
        narrKey = '';
        render();
      }
      state.userStarted = true;
      loop.play();
      syncPlay(ui, true, false);
    }, function () {
      loop.pause();
      state.angle = 0;
      state.done = false;
      state.userStarted = false;
      narrKey = '';
      render();
      updateNarr();
      syncPlay(ui, false, false);
    });

    var slider = q(panel, 'input[type="range"]');
    slider.value = String(state.r);
    slider.addEventListener('input', function () {
      state.r = Number(slider.value);
      q(panel, '[data-role="rVal"]').textContent = state.r + ' 厘米';
      narrKey = '';
      render();
      updateNarr();
    });

    var resumeOnReturn = false;

    function activate() {
      render();
      updateNarr();
      if (!entered) {
        entered = true;
        if (!CL.prefersReducedMotion()) {
          loop.play();
          syncPlay(ui, true, false);
        }
        return;
      }
      resumeIfNeeded();
    }

    function resumeIfNeeded() {
      if (!resumeOnReturn) return;
      resumeOnReturn = false;
      loop.play();
      syncPlay(ui, true, false);
    }

    function deactivate() {
      resumeOnReturn = loop.isPlaying();
      loop.pause();
      syncPlay(ui, false, state.done);
    }

    return {
      panel: panel,
      activate: activate,
      deactivate: deactivate,
      refresh: function () {
        render();
        updateNarr();
        resumeIfNeeded();
      }
    };
  }

  /* =======================================================
     三、演示 2：圆周率 π 的发现（滚动法）
     ======================================================= */

  function buildPi(panel) {
    shell(panel, {
      title: '② 圆周率 π 的发现',
      sub: '让圆贴着直尺滚一圈，量一量周长 C 和直径 d',
      chip: 'C ÷ d 永远等于 π',
      chipTone: 'cl-chip-purple',
      stats: [
        { key: 'd', label: '直径 d', tone: 'amber' },
        { key: 'c', label: '周长 C' },
        { key: 'run', label: '已滚路程' },
        { key: 'ratio', label: 'C ÷ d', tone: 'green' }
      ],
      progressLabel: '滚动进度'
    });

    var stage = q(panel, '[data-role="stage"]');
    var svg = CL.geom.svgRoot(stage, '0 0 800 460', 'cl-svg dm-svg');

    var RULER_Y = 345;
    var START_X = 140;
    var PXX = 28;            // 1 厘米 = 28 像素
    var X0 = 90;

    /* 直尺 */
    var ruler = svgEl('g', null, svg);
    svgEl('rect', {
      x: 70, y: RULER_Y, width: 700, height: 46, rx: 12, class: 'dm-ruler-bg'
    }, ruler);
    svgEl('rect', {
      x: 70, y: RULER_Y, width: 700, height: 9, rx: 4, class: 'dm-ruler-top'
    }, ruler);
    for (var cm = 0; cm <= 23; cm++) {
      var major = cm % 2 === 0;
      var tickX = X0 + cm * PXX;
      svgEl('line', {
        x1: tickX, y1: RULER_Y, x2: tickX,
        y2: RULER_Y + (major ? 14 : 8),
        class: major ? 'dm-tick dm-tick-major' : 'dm-tick'
      }, ruler);
      if (major && cm > 0) {
        svgText(ruler, {
          x: tickX, y: RULER_Y + 37, class: 'dm-ruler-num', 'text-anchor': 'middle'
        }, String(cm));
      }
    }
    svgText(ruler, {
      x: 762, y: RULER_Y + 37, class: 'dm-ruler-unit', 'text-anchor': 'end'
    }, '厘米');

    /* 起点虚线 / 滚动轨迹 */
    svgEl('line', {
      x1: START_X, y1: RULER_Y, x2: START_X, y2: 150, class: 'dm-start-line'
    }, svg);
    var track = svgEl('line', {
      x1: START_X, y1: RULER_Y, x2: START_X, y2: RULER_Y, class: 'dm-roll-track'
    }, svg);

    /* 顶部测量括号 */
    var bracket = svgEl('g', null, svg);
    var bracketLine = svgEl('line', { y1: 150, y2: 150, class: 'dm-bracket-line' }, bracket);
    svgEl('line', {
      x1: START_X, y1: 142, x2: START_X, y2: 158, class: 'dm-bracket-tick'
    }, bracket);
    var bracketTickRight = svgEl('line', {
      y1: 142, y2: 158, class: 'dm-bracket-tick'
    }, bracket);
    var bracketText = svgText(svg, {
      y: 185, class: 'dm-bracket-label dm-halo', 'text-anchor': 'middle'
    }, '');

    /* 滚动的圆 */
    var rollGroup = svgEl('g', null, svg);
    var rollCircle = svgEl('circle', { r: 56, class: 'dm-roll-circle' }, rollGroup);
    var rollDia = svgEl('line', {
      x1: -56, y1: 0, x2: 56, y2: 0, class: 'dm-roll-dia'
    }, rollGroup);
    var diaDotA = svgEl('circle', { cx: 56, cy: 0, r: 5, class: 'dm-roll-dot' }, rollGroup);
    var diaDotB = svgEl('circle', { cx: -56, cy: 0, r: 5, class: 'dm-roll-dot' }, rollGroup);
    var rollSpot = svgEl('circle', { cx: 0, cy: 56, r: 8, class: 'dm-roll-spot' }, rollGroup);
    svgEl('circle', { r: 5, class: 'dm-roll-hub' }, rollGroup);

    svgText(svg, { x: 30, y: 438, class: 'dm-top-label dm-halo' }, '圆贴着直尺滚动');
    var dLabel = svgText(svg, {
      x: 770, y: 438, 'text-anchor': 'end', class: 'dm-top-label dm-halo dm-amber-text'
    }, '');

    var flash = el('div', 'dm-flash');
    stage.appendChild(flash);

    var state = { d: 4, p: 0, done: false, userStarted: false };
    var setStat = statSetter(panel);
    var narrKey = '';
    var ui;
    var entered = false;

    var box = q(panel, '[data-role="controls"]');
    box.innerHTML =
      '<div class="dm-opt-row"><span class="dm-opt-label">圆的直径</span>' +
        '<div class="cl-seg dm-seg" data-role="dseg"></div>' +
      '</div>';
    var seg = q(panel, '[data-role="dseg"]');
    [2, 4, 6].forEach(function (d) {
      var btn = el('button', 'dm-seg-btn', d + ' 厘米');
      btn.type = 'button';
      if (d === state.d) btn.classList.add('active');
      btn.addEventListener('click', function () {
        CL.sound.click();
        Array.prototype.forEach.call(seg.children, function (child) {
          child.classList.remove('active');
        });
        btn.classList.add('active');
        state.d = d;
        state.p = 0;
        state.done = false;
        state.userStarted = true;
        narrKey = '';
        loop.pause();
        render();
        updateNarr();
        loop.play();
        syncPlay(ui, true, false);
      });
      seg.appendChild(btn);
    });

    function updateStats() {
      setStat('d', CL.fmtUnit(state.d, '厘米'));
      setStat('c', CL.fmtUnit(PIA * state.d, '厘米'));
      setStat('run', CL.fmtUnit(state.p * PIA * state.d, '厘米'));
      setStat('ratio', state.done ? '3.14' : '?');
    }

    function updateNarr() {
      var key = state.d + '|' + (state.done ? 'done' : Math.floor(state.p * 10));
      if (key === narrKey) return;
      narrKey = key;
      var c = CL.fmtNum(PIA * state.d, 2);
      var html;
      if (state.done) {
        html = '滚完一整圈！圆走过的路程正好等于圆的<b>周长 C = ' + c +
          ' 厘米</b>。C ÷ d = ' + c + ' ÷ ' + state.d +
          ' = <b>3.14</b>，任何圆都是这个固定的倍数，它就是圆周率 π！';
      } else if (state.p < 0.02) {
        html = '圆从起点出发，贴着直尺向前滚动。圆上的小粉点跟着一起转，' +
          '滚完一圈时，它走过的路程就是圆的<b>周长</b>。';
      } else {
        html = '已经滚了 <b>' + CL.fmtNum(state.p * PIA * state.d, 2) +
          ' 厘米</b>，圆的直径是 ' + state.d + ' 厘米。继续滚，看看一圈有多长？';
      }
      setNarr(panel, html);
      setFormula(panel,
        '<div class="cl-formula">C = <span class="pi">π</span>d = 3.14 × ' +
        state.d + ' = ' + c + ' 厘米</div>');
    }

    function render() {
      var R = state.d * 14;                 // 直径（厘米）× 14 = 半径（像素）
      var cpx = Math.PI * state.d * PXX;    // 实际滚动距离（像素）
      var cx = START_X + state.p * cpx;

      rollCircle.setAttribute('r', R);
      rollDia.setAttribute('x1', -R);
      rollDia.setAttribute('x2', R);
      diaDotA.setAttribute('cx', R);
      diaDotB.setAttribute('cx', -R);
      rollSpot.setAttribute('cy', R);
      rollGroup.setAttribute('transform',
        'translate(' + f(cx) + ' ' + f(RULER_Y - R) + ') rotate(' + f(state.p * 360) + ')');

      track.setAttribute('x2', f(cx));
      bracketLine.setAttribute('x1', START_X);
      bracketLine.setAttribute('x2', f(cx));
      bracketTickRight.setAttribute('x1', f(cx));
      bracketTickRight.setAttribute('x2', f(cx));
      bracketText.setAttribute('x', f((START_X + cx) / 2));
      var showBracket = state.p > 0.012;
      bracket.style.opacity = showBracket ? '1' : '0';
      bracketText.style.opacity = showBracket ? '1' : '0';
      bracketText.textContent = state.done
        ? 'C = ' + CL.fmtNum(PIA * state.d, 2) + ' 厘米'
        : '已滚 ' + CL.fmtNum(state.p * PIA * state.d, 2) + ' 厘米';

      dLabel.textContent = '直径 d = ' + state.d + ' 厘米';
      if (state.done) {
        flash.innerHTML = '滚完一圈：C ÷ d = ' + CL.fmtNum(PIA * state.d, 2) +
          ' ÷ ' + state.d + ' = <b>3.14</b>';
      }
      flash.classList.toggle('show', state.done);

      updateStats();
      setProgress(panel, state.p * 100);
    }

    var DURATION = 2.6;
    var loop = makeLoop(function (dt) {
      state.p += dt / DURATION;
      if (state.p >= 1) {
        state.p = 1;
        state.done = true;
        loop.pause();
        render();
        updateNarr();
        syncPlay(ui, false, true);
        if (state.userStarted) {
          CL.ui.confetti({ count: 46 });
          CL.sound.correct();
        }
        return false;
      }
      render();
      updateNarr();
      return true;
    });

    ui = addButtons(panel, function () {
      if (loop.isPlaying()) {
        loop.pause();
        syncPlay(ui, false, state.done);
        return;
      }
      if (state.p >= 1) {
        state.p = 0;
        state.done = false;
        narrKey = '';
        render();
      }
      state.userStarted = true;
      loop.play();
      syncPlay(ui, true, false);
    }, function () {
      loop.pause();
      state.p = 0;
      state.done = false;
      state.userStarted = false;
      narrKey = '';
      render();
      updateNarr();
      syncPlay(ui, false, false);
    });

    var resumeOnReturn = false;

    function activate() {
      render();
      updateNarr();
      if (!entered) {
        entered = true;
        if (!CL.prefersReducedMotion()) {
          loop.play();
          syncPlay(ui, true, false);
        }
        return;
      }
      resumeIfNeeded();
    }

    function resumeIfNeeded() {
      if (!resumeOnReturn) return;
      resumeOnReturn = false;
      loop.play();
      syncPlay(ui, true, false);
    }

    function deactivate() {
      resumeOnReturn = loop.isPlaying();
      loop.pause();
      syncPlay(ui, false, state.done);
    }

    return {
      panel: panel,
      activate: activate,
      deactivate: deactivate,
      refresh: function () {
        render();
        updateNarr();
        resumeIfNeeded();
      }
    };
  }

  /* =======================================================
     四、演示 3：圆的面积公式（剪拼法）
     ======================================================= */

  function buildArea(panel) {
    shell(panel, {
      title: '③ 圆的面积公式（剪拼法）',
      sub: '把圆平均分成小扇形，再拼成一个近似长方形',
      chip: '份数越多，越接近长方形',
      chipTone: 'cl-chip-green',
      stats: [
        { key: 'n', label: '平均分成' },
        { key: 'deg', label: '每份圆心角', tone: 'amber' },
        { key: 'len', label: '长方形的长' },
        { key: 'wid', label: '长方形的宽', tone: 'green' }
      ],
      progressLabel: '拼合进度'
    });

    var stage = q(panel, '[data-role="stage"]');
    var svg = CL.geom.svgRoot(stage, '0 0 800 460', 'cl-svg dm-svg');

    var CX = 400;
    var CY = 230;
    var R = 130;
    var XPI = Math.PI * R;
    var yTop = CY - R / 2;
    var yBottom = CY + R / 2;

    var sectorsGroup = svgEl('g', null, svg);

    /* 圆状态下的辅助标记 */
    var guide = svgEl('g', null, svg);
    svgEl('line', {
      x1: CX, y1: CY, x2: CX, y2: CY - R, class: 'dm-radius-line'
    }, guide);
    svgEl('circle', { cx: CX, cy: CY, r: 6, class: 'dm-center-dot' }, guide);
    svgText(guide, { x: CX + 12, y: CY + 6, class: 'dm-o-label dm-halo' }, 'O');
    svgText(guide, {
      x: CX + 12, y: CY - R / 2, class: 'dm-radius-label dm-halo'
    }, 'r = 2 厘米');

    /* 尺寸标注 */
    var dims = svgEl('g', null, svg);
    var bottomDim = svgEl('line', { y1: 330, y2: 330, class: 'dm-dim-line' }, dims);
    var bottomArrowL = svgEl('path', { class: 'dm-dim-arrow' }, dims);
    var bottomArrowR = svgEl('path', { class: 'dm-dim-arrow' }, dims);
    var bottomLabel = svgText(dims, {
      y: 364, class: 'dm-dim-label dm-dim-len dm-halo', 'text-anchor': 'middle'
    }, '');
    var sideDim = svgEl('line', { class: 'dm-dim-line' }, dims);
    var sideArrowUp = svgEl('path', { class: 'dm-dim-arrow' }, dims);
    var sideArrowDown = svgEl('path', { class: 'dm-dim-arrow' }, dims);
    var sideLabel = svgText(dims, {
      class: 'dm-dim-label dm-dim-wid dm-halo'
    }, '');

    /* 文字标注 */
    var hint = svgText(svg, { x: 30, y: 50, class: 'dm-top-label dm-halo' }, '');
    var topFormula = svgText(svg, {
      x: 770, y: 50, 'text-anchor': 'end', class: 'dm-green-label dm-halo'
    }, 'S = πr² = 12.56 平方厘米');

    var state = { n: 8, t: 0, targetN: 8 };
    var mode = null;         // 'forward' | 'back' | null
    var sectorEls = [];
    var narrKey = '';
    var ui;
    var entered = false;

    var box = q(panel, '[data-role="controls"]');
    box.innerHTML =
      '<div class="dm-opt-row"><span class="dm-opt-label">平均分成</span>' +
        '<div class="cl-seg dm-seg" data-role="nseg"></div>' +
      '</div>';
    var seg = q(panel, '[data-role="nseg"]');
    [8, 16, 32].forEach(function (n) {
      var btn = el('button', 'dm-seg-btn', n + ' 份');
      btn.type = 'button';
      if (n === state.n) btn.classList.add('active');
      btn.addEventListener('click', function () {
        CL.sound.click();
        Array.prototype.forEach.call(seg.children, function (child) {
          child.classList.remove('active');
        });
        btn.classList.add('active');
        changeCount(n);
      });
      seg.appendChild(btn);
    });

    var setStat = statSetter(panel);

    function rebuildSectors() {
      CL.dom.clear(sectorsGroup);
      sectorEls = [];
      var step = 360 / state.n;
      for (var i = 0; i < state.n; i++) {
        var path = svgEl('path', {
          d: CL.geom.sectorPath(0, 0, R, i * step, (i + 1) * step),
          class: 'dm-sector ' + (i % 2 ? 'odd' : 'even')
        }, sectorsGroup);
        sectorEls.push({ node: path, i: i, mid: (i + 0.5) * step });
      }
      layoutDims();
      hint.textContent = '平均分成 ' + state.n + ' 份 · 每份 ' +
        CL.fmtNum(step, 2) + '°';
    }

    function layoutDims() {
      var s = 2 * Math.PI * R / state.n;
      var x0 = CX - (XPI - s / 2) / 2;
      var left = x0 - s / 2;
      var right = x0 + XPI;
      var y = 330;

      bottomDim.setAttribute('x1', f(left));
      bottomDim.setAttribute('x2', f(right));
      bottomArrowL.setAttribute('d', 'M ' + f(left) + ' ' + y + ' l 12 -6 l 0 12 Z');
      bottomArrowR.setAttribute('d', 'M ' + f(right) + ' ' + y + ' l -12 -6 l 0 12 Z');
      bottomLabel.setAttribute('x', f((left + right) / 2));
      bottomLabel.textContent = '长 ≈ πr = 6.28 厘米';

      var sx = right + 22;
      sideDim.setAttribute('x1', f(sx));
      sideDim.setAttribute('x2', f(sx));
      sideDim.setAttribute('y1', f(yTop));
      sideDim.setAttribute('y2', f(yBottom));
      sideArrowUp.setAttribute('d', 'M ' + f(sx) + ' ' + f(yTop) + ' l -6 12 l 12 0 Z');
      sideArrowDown.setAttribute('d', 'M ' + f(sx) + ' ' + f(yBottom) + ' l -6 -12 l 12 0 Z');
      sideLabel.setAttribute('x', f(sx + 12));
      sideLabel.setAttribute('y', f(CY + 6));
      sideLabel.textContent = '宽 = r = 2 厘米';
    }

    function updateStats() {
      setStat('n', state.n + ' 份');
      setStat('deg', CL.fmtNum(360 / state.n, 2) + '°');
      setStat('len', '≈ ' + CL.fmtUnit(PIA * 2, '厘米'));
      setStat('wid', CL.fmtUnit(2, '厘米'));
    }

    function updateNarr() {
      var key = state.n + '|' + (state.t >= 0.9 ? 'done' : state.t < 0.1 ? 'start' : 'mid');
      if (key === narrKey) return;
      narrKey = key;
      var step = CL.fmtNum(360 / state.n, 2);
      var html;
      if (state.t >= 0.9) {
        html = '拼成了一个近似的长方形！它的<b>长 ≈ πr = 6.28 厘米</b>，' +
          '<b>宽 = r = 2 厘米</b>。因为长方形面积 = 长 × 宽，' +
          '所以圆的面积 S = πr × r = <b>πr² = 12.56 平方厘米</b>。';
      } else if (state.t < 0.1) {
        html = '把圆平均分成 <b>' + state.n + ' 个</b>一样的小扇形，' +
          '每份的圆心角是 ' + step + '°。想象用剪刀把它们剪开……';
      } else {
        html = '把剪下的小扇形一上一下交错拼起来，看看能不能拼成我们学过的图形？';
      }
      setNarr(panel, html);
      setFormula(panel,
        '<div class="cl-formula">S = <span class="pi">π</span>r² = 3.14 × 2² = ' +
        CL.fmtNum(PIA * 4, 2) + ' 平方厘米</div>');
    }

    function render() {
      var e = easeInOut(state.t);
      var step = 360 / state.n;
      var s = 2 * Math.PI * R / state.n;
      var x0 = CX - (XPI - s / 2) / 2;

      sectorEls.forEach(function (sec) {
        var targetX;
        var targetY;
        var targetRot;
        if (sec.i % 2 === 0) {
          targetX = x0 + (sec.i / 2) * s;
          targetY = yBottom;
          targetRot = -sec.mid;
        } else {
          targetX = x0 + ((sec.i - 1) / 2 + 0.5) * s;
          targetY = yTop;
          targetRot = 180 - sec.mid;
        }
        targetRot = normDeg(targetRot);
        var x = CX + (targetX - CX) * e;
        var y = CY + (targetY - CY) * e;
        sec.node.setAttribute('transform',
          'translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(targetRot * e) + ')');
      });

      guide.style.opacity = clamp01(1 - state.t / 0.3);
      dims.style.opacity = clamp01((state.t - 0.45) / 0.3);
      topFormula.style.opacity = clamp01((state.t - 0.65) / 0.25);

      updateStats();
      setProgress(panel, state.t * 100);
    }

    function changeCount(n) {
      state.targetN = n;
      narrKey = '';
      if (state.t > 0.02) {
        mode = 'back';
        loop.play();
        syncPlay(ui, true, false);
      } else {
        state.n = n;
        state.t = 0;
        rebuildSectors();
        render();
        mode = 'forward';
        loop.play();
        syncPlay(ui, true, false);
      }
    }

    var loop = makeLoop(function (dt) {
      if (mode === 'back') {
        state.t -= dt / 0.55;
        if (state.t <= 0) {
          state.t = 0;
          state.n = state.targetN;
          rebuildSectors();
          mode = 'forward';
          narrKey = '';
        }
      } else if (mode === 'forward') {
        state.t += dt / 2.3;
        if (state.t >= 1) {
          state.t = 1;
          mode = null;
          loop.pause();
          render();
          updateNarr();
          syncPlay(ui, false, true);
          if (state.userStarted) {
            CL.ui.confetti({ count: 46 });
            CL.sound.correct();
          }
          return false;
        }
      }
      render();
      updateNarr();
      return true;
    });

    ui = addButtons(panel, function () {
      if (loop.isPlaying()) {
        loop.pause();
        mode = null;
        syncPlay(ui, false, state.t >= 1);
        return;
      }
      state.userStarted = true;
      if (state.targetN !== state.n) {
        mode = 'back';
        loop.play();
        syncPlay(ui, true, false);
        return;
      }
      if (state.t >= 1) {
        state.t = 0;
        narrKey = '';
        render();
      }
      mode = 'forward';
      loop.play();
      syncPlay(ui, true, false);
    }, function () {
      loop.pause();
      mode = null;
      state.t = 0;
      state.n = state.targetN;
      state.userStarted = false;
      narrKey = '';
      rebuildSectors();
      render();
      updateNarr();
      syncPlay(ui, false, false);
    });

    var resumeOnReturn = false;

    function activate() {
      render();
      updateNarr();
      if (!entered) {
        entered = true;
        if (!CL.prefersReducedMotion()) {
          mode = 'forward';
          loop.play();
          syncPlay(ui, true, false);
        }
        return;
      }
      resumeIfNeeded();
    }

    function resumeIfNeeded() {
      if (!resumeOnReturn) return;
      resumeOnReturn = false;
      loop.play();
      syncPlay(ui, true, false);
    }

    function deactivate() {
      resumeOnReturn = loop.isPlaying();
      loop.pause();
      syncPlay(ui, false, state.t >= 1);
    }

    rebuildSectors();
    render();

    return {
      panel: panel,
      activate: activate,
      deactivate: deactivate,
      refresh: function () {
        render();
        updateNarr();
        resumeIfNeeded();
      }
    };
  }

  /* =======================================================
     五、演示 4：扇形与圆心角
     ======================================================= */

  function buildSector(panel) {
    shell(panel, {
      title: '④ 扇形与圆心角',
      sub: '拖动圆心角，看扇形、弧长和面积一起变化',
      chip: '圆心角决定扇形大小',
      chipTone: 'cl-chip-blue',
      stats: [
        { key: 'ang', label: '圆心角', tone: 'amber' },
        { key: 'frac', label: '占整圆' },
        { key: 'arc', label: '弧长' },
        { key: 'area', label: '面积', tone: 'green' }
      ],
      progressLabel: '占整圆比例'
    });

    var stage = q(panel, '[data-role="stage"]');
    var svg = CL.geom.svgRoot(stage, '0 0 800 460', 'cl-svg dm-svg');

    var CX = 400;
    var CY = 235;
    var R = 140;

    svgEl('circle', {
      cx: CX, cy: CY, r: R, class: 'dm-sec-circle'
    }, svg);
    var sectorFill = svgEl('path', { d: '', class: 'dm-sec-fill' }, svg);
    var arc = svgEl('path', { d: '', class: 'dm-sec-arc' }, svg);
    var radiusStart = svgEl('line', {
      x1: CX, y1: CY, x2: CX, y2: CY - R, class: 'dm-radius-line'
    }, svg);
    var radiusEnd = svgEl('line', {
      x1: CX, y1: CY, x2: CX, y2: CY - R, class: 'dm-radius-line'
    }, svg);
    svgEl('circle', { cx: CX, cy: CY, r: 6, class: 'dm-center-dot' }, svg);
    svgText(svg, { x: CX + 12, y: CY + 6, class: 'dm-o-label dm-halo' }, 'O');

    var angleArc = svgEl('path', { d: '', class: 'dm-angle-arc' }, svg);
    var angleText = svgText(svg, {
      class: 'dm-angle-label dm-halo', 'text-anchor': 'middle'
    }, '90°');
    var arcText = svgText(svg, {
      class: 'dm-arc-label dm-halo', 'text-anchor': 'middle'
    }, '');

    svgText(svg, {
      x: 30, y: 50, class: 'dm-top-label dm-halo'
    }, '拖动滑块，看看扇形怎样变化');
    svgText(svg, {
      x: 30, y: 428, class: 'dm-bottom-label dm-halo'
    }, '圆心角越大，扇形就越大');

    var state = { angle: 90 };
    var target = 90;
    var setStat = statSetter(panel);
    var narrKey = '';
    var quickButtons = [];

    var box = q(panel, '[data-role="controls"]');
    box.innerHTML =
      '<div class="cl-field dm-field">' +
        '<div class="cl-field-label"><span>圆心角 n</span>' +
          '<b data-role="angleVal">90°</b></div>' +
        '<input class="cl-range cl-range-amber" type="range" min="0" max="360" ' +
          'step="1" value="90" aria-label="圆心角（度）">' +
      '</div>' +
      '<div class="dm-quick"><span class="dm-opt-label">快捷角度</span></div>';
    var quickRow = q(panel, '.dm-quick');
    [90, 180, 270, 360].forEach(function (deg) {
      var btn = el('button', 'cl-btn cl-btn-ghost cl-btn-sm', deg + '°');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        CL.sound.click();
        tweenTo(deg);
      });
      btn.setAttribute('data-deg', String(deg));
      quickButtons.push(btn);
      quickRow.appendChild(btn);
    });

    var slider = q(panel, 'input[type="range"]');
    slider.addEventListener('input', function () {
      loop.pause();
      target = Number(slider.value);
      state.angle = target;
      narrKey = '';
      render();
      updateNarr();
    });

    function updateStats(n) {
      var sec = CL.sector(3, n);
      setStat('ang', n + '°');
      setStat('frac', CL.fmtNum(n / 3.6, 2) + '%');
      setStat('arc', CL.fmtUnit(sec.arc, '厘米'));
      setStat('area', CL.fmtUnit(sec.area, '平方厘米'));
    }

    function narrFor(n) {
      if (n === 0) return '圆心角是 0° 时，扇形缩成了一条半径，还没有面积。';
      if (n === 90) return '圆心角 90°，扇形正好是整圆的 <b>1/4</b>，占 25%。';
      if (n === 180) return '圆心角 180°，扇形正好是<b>半圆</b>，面积是整圆的一半。';
      if (n === 270) return '圆心角 270°，占整圆的 <b>3/4</b>，再补 90° 就是一个整圆。';
      if (n === 360) return '圆心角 360°，扇形就是<b>整个圆</b>，占 100%。';
      return '圆心角 <b>' + n + '°</b>，占整圆的 ' + n + '/360。' +
        '圆心角越大，扇形就越大。';
    }

    function updateNarr() {
      var n = Math.round(state.angle);
      if (n === narrKey) return;
      narrKey = n;
      setNarr(panel, narrFor(n));

      var sec = CL.sector(3, n);
      setFormula(panel,
        '<div class="cl-formula">弧长 = 2<span class="pi">π</span>r × <b>' + n + '</b>/360<br>' +
          '= ' + CL.fmtNum(2 * PIA * 3, 2) + ' × ' + n + '/360 = ' +
          CL.fmtNum(sec.arc, 2) + ' 厘米</div>' +
        '<div class="cl-formula">面积 = <span class="pi">π</span>r² × <b>' + n + '</b>/360<br>' +
          '= ' + CL.fmtNum(PIA * 9, 2) + ' × ' + n + '/360 = ' +
          CL.fmtNum(sec.area, 2) + ' 平方厘米</div>');
    }

    function render() {
      var a = state.angle;
      var wrapped = Math.min(a, 359.999);
      var n = Math.round(a);

      sectorFill.setAttribute('d', a < 0.3 ? '' : CL.geom.sectorPath(CX, CY, R, 0, wrapped));
      arc.setAttribute('d', a < 0.3 ? '' : CL.geom.arcPath(CX, CY, R, 0, wrapped));

      var pEnd = polar(CX, CY, R, a);
      radiusEnd.setAttribute('x2', f(pEnd.x));
      radiusEnd.setAttribute('y2', f(pEnd.y));

      angleArc.setAttribute('d', a > 0.3 ? CL.geom.arcPath(CX, CY, 62, 0, wrapped) : '');
      var am = polar(CX, CY, 70, a / 2);
      angleText.setAttribute('x', f(am.x));
      angleText.setAttribute('y', f(am.y + 7));
      angleText.textContent = n + '°';
      angleText.style.opacity = a > 6 && a < 354 ? '1' : '0';

      var rm = polar(CX, CY, R + 40, a / 2);
      arcText.setAttribute('x', f(rm.x));
      arcText.setAttribute('y', f(rm.y + 7));
      arcText.textContent = '弧长 ' + CL.fmtNum(CL.sector(3, n).arc, 2) + ' 厘米';
      arcText.style.opacity = a > 12 && a < 348 ? '1' : '0';

      q(panel, '[data-role="angleVal"]').textContent = n + '°';
      slider.value = String(n);

      quickButtons.forEach(function (btn) {
        btn.classList.toggle('active', Math.abs(n - Number(btn.getAttribute('data-deg'))) < 0.5);
      });

      updateStats(n);
      setProgress(panel, a / 3.6);
    }

    var loop = makeLoop(function (dt) {
      var diff = target - state.angle;
      var step = 420 * dt;
      if (Math.abs(diff) <= step) {
        state.angle = target;
        render();
        updateNarr();
        loop.pause();
        return false;
      }
      state.angle += diff > 0 ? step : -step;
      render();
      updateNarr();
      return true;
    });

    function tweenTo(deg) {
      target = deg;
      if (Math.abs(target - state.angle) < 0.5) {
        state.angle = target;
        narrKey = '';
        render();
        updateNarr();
        return;
      }
      loop.play();
    }

    var resumeOnReturn = false;

    function activate() {
      render();
      updateNarr();
      if (resumeOnReturn) {
        resumeOnReturn = false;
        loop.play();
      }
    }

    function deactivate() {
      resumeOnReturn = loop.isPlaying();
      loop.pause();
    }

    return {
      panel: panel,
      activate: activate,
      deactivate: deactivate,
      refresh: function () {
        render();
        updateNarr();
        if (resumeOnReturn) {
          resumeOnReturn = false;
          loop.play();
        }
      }
    };
  }

  /* =======================================================
     六、演示 5：阴影面积的两种思路
     ======================================================= */

  function buildShadow(panel) {
    shell(panel, {
      title: '⑤ 阴影面积的两种思路',
      sub: '圆环和外方内圆，都藏着「整体 − 空白」的方法',
      chip: '整体 − 空白 = 阴影',
      chipTone: 'cl-chip-pink',
      stats: [
        { key: 's1', label: '—' },
        { key: 's2', label: '—' },
        { key: 's3', label: '—' }
      ],
      progressLabel: '动画进度',
      subbar:
        '<div class="dm-subbar">' +
          '<div class="cl-seg dm-subseg" data-role="subseg" role="tablist" aria-label="选择阴影图形">' +
            '<button type="button" data-sub="ring" class="active">圆环</button>' +
            '<button type="button" data-sub="square">外方内圆</button>' +
          '</div>' +
          '<span class="dm-subhint">看动画，理解「整体 − 空白」</span>' +
        '</div>'
    });

    var stage = q(panel, '[data-role="stage"]');
    var svg = CL.geom.svgRoot(stage, '0 0 800 460', 'cl-svg dm-svg');
    var defs = svgEl('defs', null, svg);

    /* 圆环：用遮罩把内圆挖掉 */
    var ringMask = svgEl('mask', {
      id: 'dm-ring-mask',
      maskUnits: 'userSpaceOnUse',
      maskContentUnits: 'userSpaceOnUse',
      x: 0, y: 0, width: 800, height: 460
    }, defs);
    svgEl('rect', { x: 0, y: 0, width: 800, height: 460, fill: '#fff' }, ringMask);
    var ringHole = svgEl('circle', {
      cx: 400, cy: 230, r: 0, fill: '#000'
    }, ringMask);

    /* 外方内圆：用遮罩把圆挖掉 */
    var squareMask = svgEl('mask', {
      id: 'dm-square-mask',
      maskUnits: 'userSpaceOnUse',
      maskContentUnits: 'userSpaceOnUse',
      x: 0, y: 0, width: 800, height: 460
    }, defs);
    svgEl('rect', { x: 0, y: 0, width: 800, height: 460, fill: '#fff' }, squareMask);
    var squareHole = svgEl('circle', {
      cx: 400, cy: 222, r: 0, fill: '#000'
    }, squareMask);

    /* ---- 圆环视图 ---- */
    var ringView = svgEl('g', null, svg);
    svgEl('circle', {
      cx: 400, cy: 230, r: 160, class: 'dm-ring-disk',
      mask: 'url(#dm-ring-mask)'
    }, ringView);
    svgEl('circle', {
      cx: 400, cy: 230, r: 160, class: 'dm-ring-outline'
    }, ringView);
    var ringInnerCircle = svgEl('circle', {
      cx: 400, cy: 230, r: 80, class: 'dm-ring-inner'
    }, ringView);
    svgEl('line', {
      x1: 400, y1: 230, x2: 560, y2: 230, class: 'dm-radius-line'
    }, ringView);
    svgText(ringView, {
      x: 470, y: 214, class: 'dm-radius-label dm-halo', 'text-anchor': 'middle'
    }, 'R = 4 厘米');
    svgEl('line', {
      x1: 400, y1: 230, x2: 400, y2: 310, class: 'dm-radius-line'
    }, ringView);
    svgText(ringView, {
      x: 414, y: 292, class: 'dm-radius-label dm-halo'
    }, 'r = 2 厘米');
    svgEl('circle', { cx: 400, cy: 230, r: 5, class: 'dm-center-dot' }, ringView);
    svgText(ringView, {
      x: 30, y: 52, class: 'dm-pink-label dm-halo'
    }, '圆环面积 = 大圆面积 − 小圆面积');

    /* ---- 外方内圆视图 ---- */
    var squareView = svgEl('g', { style: 'display:none' }, svg);
    svgEl('rect', {
      x: 240, y: 62, width: 320, height: 320, class: 'dm-sq-fill',
      mask: 'url(#dm-square-mask)'
    }, squareView);
    svgEl('rect', {
      x: 240, y: 62, width: 320, height: 320, class: 'dm-sq-outline'
    }, squareView);
    svgEl('circle', {
      cx: 400, cy: 222, r: 160, class: 'dm-sq-circle'
    }, squareView);
    svgEl('line', {
      x1: 400, y1: 222, x2: 560, y2: 222, class: 'dm-radius-line'
    }, squareView);
    svgText(squareView, {
      x: 470, y: 206, class: 'dm-radius-label dm-halo', 'text-anchor': 'middle'
    }, 'r = 2 厘米');
    svgEl('line', {
      x1: 240, y1: 408, x2: 560, y2: 408, class: 'dm-dim-line'
    }, squareView);
    svgEl('path', {
      d: 'M 240 408 l 12 -6 l 0 12 Z', class: 'dm-dim-arrow'
    }, squareView);
    svgEl('path', {
      d: 'M 560 408 l -12 -6 l 0 12 Z', class: 'dm-dim-arrow'
    }, squareView);
    svgText(squareView, {
      x: 400, y: 438, class: 'dm-dim-label dm-dim-len dm-halo', 'text-anchor': 'middle'
    }, '边长 a = 4 厘米');
    svgText(squareView, {
      x: 30, y: 44, class: 'dm-pink-label dm-halo'
    }, '四角阴影 = 正方形 − 圆');

    var state = { sub: 'ring', p: 0, done: false, userStarted: false };
    var narrKey = '';
    var ui;
    var entered = false;

    var cards = panel.querySelectorAll('.dm-data .cl-stat');

    function setCard(index, label, value, tone, wide) {
      var card = cards[index];
      if (!card) return;
      card.className = 'cl-stat ' + (tone || '') + (wide ? ' dm-stat-wide' : '');
      card.querySelector('.stat-label').textContent = label;
      card.querySelector('.stat-value').textContent = value;
    }

    function updateCards() {
      if (state.sub === 'ring') {
        setCard(0, '外圆半径 R', '4 厘米', '', false);
        setCard(1, '内圆半径 r', '2 厘米', 'amber', false);
        setCard(2, '阴影面积', '37.68 平方厘米', 'pink', true);
      } else {
        setCard(0, '正方形边长 a', '4 厘米', '', false);
        setCard(1, '圆的半径 r', '2 厘米', 'amber', false);
        setCard(2, '阴影面积', '3.44 平方厘米', 'pink', true);
      }
    }

    function updateNarr() {
      var key = state.sub + '|' + (state.done ? 'done' : state.p < 0.08 ? 'start' : 'mid');
      if (key === narrKey) return;
      narrKey = key;
      var html;
      if (state.sub === 'ring') {
        if (state.done) {
          html = '圆环面积 = 大圆面积 − 小圆面积 = 3.14 × 4² − 3.14 × 2² = ' +
            '50.24 − 12.56 = <b>37.68 平方厘米</b>。';
        } else if (state.p < 0.08) {
          html = '先有一个半径 4 厘米的大圆，再从中间挖去半径 2 厘米的小圆。' +
            '剩下的粉色部分就是<b>圆环</b>。';
        } else {
          html = '小圆被一点点挖走，剩下的粉色部分就是圆环。' +
            '用「大圆面积 − 小圆面积」就能算出来。';
        }
      } else {
        if (state.done) {
          html = '阴影面积 = 正方形面积 − 圆面积 = 4² − 3.14 × 2² = ' +
            '16 − 12.56 = <b>3.44 平方厘米</b>。';
        } else if (state.p < 0.08) {
          html = '正方形里画一个最大的圆，圆的直径正好等于正方形的边长 4 厘米。';
        } else {
          html = '圆盖住的部分不算，四个粉色的角就是阴影。' +
            '用「正方形面积 − 圆面积」来计算。';
        }
      }
      setNarr(panel, html);

      if (state.sub === 'ring') {
        setFormula(panel,
          '<div class="cl-formula">S = <span class="pi">π</span>R² − <span class="pi">π</span>r²</div>' +
          '<div class="cl-formula">= 3.14 × 4² − 3.14 × 2²<br>= 50.24 − 12.56 = 37.68 平方厘米</div>');
      } else {
        setFormula(panel,
          '<div class="cl-formula">S = a² − <span class="pi">π</span>r²</div>' +
          '<div class="cl-formula">= 4² − 3.14 × 2²<br>= 16 − 12.56 = 3.44 平方厘米</div>');
      }
    }

    function render() {
      var p = state.sub === 'ring' ? state.p : 0;
      ringHole.setAttribute('r', f(80 * p));
      ringInnerCircle.style.opacity = String(0.25 + 0.75 * p);

      var sp = state.sub === 'square' ? state.p : 0;
      squareHole.setAttribute('r', f(160 * sp));

      setProgress(panel, state.p * 100);
    }

    var loop = makeLoop(function (dt) {
      state.p += dt / 1.3;
      if (state.p >= 1) {
        state.p = 1;
        state.done = true;
        loop.pause();
        render();
        updateNarr();
        syncPlay(ui, false, true);
        if (state.userStarted) {
          CL.ui.confetti({ count: 42 });
          CL.sound.correct();
        }
        return false;
      }
      render();
      updateNarr();
      return true;
    });

    ui = addButtons(panel, function () {
      if (loop.isPlaying()) {
        loop.pause();
        syncPlay(ui, false, state.done);
        return;
      }
      if (state.p >= 1) {
        state.p = 0;
        state.done = false;
        narrKey = '';
        render();
      }
      state.userStarted = true;
      loop.play();
      syncPlay(ui, true, false);
    }, function () {
      loop.pause();
      state.p = 0;
      state.done = false;
      state.userStarted = false;
      narrKey = '';
      render();
      updateNarr();
      syncPlay(ui, false, false);
    });

    var subSeg = q(panel, '[data-role="subseg"]');
    Array.prototype.forEach.call(subSeg.children, function (btn) {
      btn.addEventListener('click', function () {
        var sub = btn.getAttribute('data-sub');
        if (sub === state.sub) return;
        CL.sound.click();
        state.sub = sub;
        state.p = 0;
        state.done = false;
        state.userStarted = true;
        narrKey = '';
        loop.pause();
        Array.prototype.forEach.call(subSeg.children, function (child) {
          child.classList.toggle('active', child === btn);
        });
        ringView.style.display = sub === 'ring' ? '' : 'none';
        squareView.style.display = sub === 'square' ? '' : 'none';
        updateCards();
        render();
        updateNarr();
        loop.play();
        syncPlay(ui, true, false);
      });
    });

    var resumeOnReturn = false;

    function activate() {
      updateCards();
      render();
      updateNarr();
      if (!entered) {
        entered = true;
        if (!CL.prefersReducedMotion()) {
          loop.play();
          syncPlay(ui, true, false);
        }
        return;
      }
      resumeIfNeeded();
    }

    function resumeIfNeeded() {
      if (!resumeOnReturn) return;
      resumeOnReturn = false;
      loop.play();
      syncPlay(ui, true, false);
    }

    function deactivate() {
      resumeOnReturn = loop.isPlaying();
      loop.pause();
      syncPlay(ui, false, state.done);
    }

    return {
      panel: panel,
      activate: activate,
      deactivate: deactivate,
      refresh: function () {
        updateCards();
        render();
        updateNarr();
        resumeIfNeeded();
      }
    };
  }

  /* =======================================================
     七、模块入口：演示选择器 + 生命周期
     ======================================================= */

  var BUILDERS = {
    forming: buildForming,
    pi: buildPi,
    area: buildArea,
    sector: buildSector,
    shadow: buildShadow
  };

  CL.registerMode('demo', function (root) {
    var hashParts = (window.location.hash || '').replace(/^#/, '').split('/');
    var initialId = 'forming';
    if (hashParts[0] === 'demo' && BUILDERS[hashParts[1]]) initialId = hashParts[1];

    root.innerHTML =
      '<div class="cl-mode-head">' +
        '<div>' +
          '<h2><span class="head-emoji" aria-hidden="true">🎬</span>动画演示</h2>' +
          '<p>把圆的知识变成看得见的动画：点怎么画出圆、π 怎样被发现、' +
            '面积公式怎么拼出来…… 一边看一边想，数学就变简单啦！</p>' +
        '</div>' +
        '<span class="cl-head-chip">⭕ π 取 3.14 · 共 5 个演示</span>' +
      '</div>' +
      '<div class="dm-tabs cl-seg" role="tablist" aria-label="选择演示"></div>' +
      '<div class="dm-stages"></div>';

    var tabWrap = q(root, '.dm-tabs');
    var stages = q(root, '.dm-stages');
    var instances = {};
    var tabs = {};
    var current = null;

    DEMOS.forEach(function (demo) {
      var tab = el('button', 'dm-tab',
        '<span class="dm-tab-ico" aria-hidden="true">' + demo.icon + '</span>' +
        '<span>' + demo.tab + '</span>');
      tab.type = 'button';
      tab.id = 'dm-tab-' + demo.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'dm-panel-' + demo.id);
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('data-demo', demo.id);
      tab.addEventListener('click', function () {
        CL.sound.click();
        select(demo.id, true);
      });
      tab.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        var index = 0;
        for (var i = 0; i < DEMOS.length; i++) {
          if (DEMOS[i].id === demo.id) index = i;
        }
        var nextIndex = event.key === 'ArrowRight'
          ? (index + 1) % DEMOS.length
          : (index - 1 + DEMOS.length) % DEMOS.length;
        var nextId = DEMOS[nextIndex].id;
        select(nextId, true);
        tabs[nextId].focus();
      });
      tabWrap.appendChild(tab);
      tabs[demo.id] = tab;

      var panel = el('section', 'dm-demo');
      panel.id = 'dm-panel-' + demo.id;
      panel.setAttribute('data-demo', demo.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'dm-tab-' + demo.id);
      panel.hidden = true;
      stages.appendChild(panel);
      instances[demo.id] = BUILDERS[demo.id](panel);
    });

    function select(id, fromUser) {
      if (current === id) return;
      if (current) {
        instances[current].deactivate();
        instances[current].panel.hidden = true;
        instances[current].panel.classList.remove('active');
        tabs[current].classList.remove('active');
        tabs[current].setAttribute('aria-selected', 'false');
      }
      current = id;
      instances[id].panel.hidden = false;
      instances[id].panel.classList.add('active');
      tabs[id].classList.add('active');
      tabs[id].setAttribute('aria-selected', 'true');
      instances[id].activate();
      if (fromUser) {
        try {
          window.history.replaceState(null, '', '#demo/' + id);
        } catch (e) { /* 忽略 */ }
      }
    }

    select(initialId, false);

    return {
      start: function () {
        if (current) instances[current].refresh();
      },
      stop: function () {
        if (current) instances[current].deactivate();
      }
    };
  });
})();
