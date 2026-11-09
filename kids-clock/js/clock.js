/* =========================================================
   圆盘钟表组件（原生 SVG，无依赖）
   - 60 格刻度、1~12 数字、分钟数字、三根指针、指针名称
   - 可拖动指针拨动时间（时针 / 分针 / 秒针）
   - 支持高亮某一根指针用于教学
   ========================================================= */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const CX = 200;
  const CY = 200;

  const HANDS = {
    hour: { color: '#2563eb', len: 100, tail: 14, width: 13, labelRadius: 70, name: '时针' },
    minute: { color: '#10b981', len: 144, tail: 16, width: 8, labelRadius: 104, name: '分针' },
    second: { color: '#ef4444', len: 164, tail: 34, width: 3.2, labelRadius: 156, name: '秒针' }
  };

  let uid = 0;
  const nextId = () => 'clock-' + (++uid);

  function svgEl(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        node.setAttribute(key, attrs[key]);
      });
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  /** 以 12 点方向为 0°，顺时针计算某角度、某半径上的坐标 */
  function polarPoint(radius, degrees) {
    const rad = ((degrees - 90) * Math.PI) / 180;
    return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
  }

  function normalizeTime(t) {
    const h = ((Math.floor(t.h || 0) % 24) + 24) % 24;
    const m = ((Math.floor(t.m || 0) % 60) + 60) % 60;
    const s = ((Math.floor(t.s || 0) % 60) + 60) % 60;
    const ms = Math.max(0, Math.min(999, Math.round(t.ms || 0)));
    return { h: h, m: m, s: s, ms: ms };
  }

  class AnalogClock {
    constructor(container, options) {
      this.container = container;
      this.options = Object.assign(
        {
          showMinuteNumbers: true,
          showHandLabels: true,
          interactive: false,
          mini: false
        },
        options || {}
      );
      this.time = { h: 0, m: 0, s: 0, ms: 0 };
      this.onTimeChange = null;
      this._dragging = null;
      this._boundMove = this._onPointerMove.bind(this);
      this._boundUp = this._onPointerUp.bind(this);
      this.build();
      this.setOptions(this.options);
      this.setInteractive(this.options.interactive);
      this.render(this.time);
    }

    /* ---------- 构建表盘 ---------- */
    build() {
      const svg = svgEl('svg', {
        viewBox: '0 0 400 400',
        class: 'clock-svg',
        role: 'img',
        'aria-label': '圆盘钟表，可拖动指针'
      });
      this.svg = svg;

      const faceId = nextId();
      const rimId = nextId();
      const glossId = nextId();
      const defs = svgEl('defs', {}, svg);

      const faceGrad = svgEl('radialGradient', { id: faceId, cx: '34%', cy: '26%', r: '88%' }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': '#ffffff' }, faceGrad);
      svgEl('stop', { offset: '62%', 'stop-color': '#f8fbff' }, faceGrad);
      svgEl('stop', { offset: '100%', 'stop-color': '#e8f1fd' }, faceGrad);

      const rimGrad = svgEl('linearGradient', { id: rimId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': '#ffffff' }, rimGrad);
      svgEl('stop', { offset: '45%', 'stop-color': '#dbeafe' }, rimGrad);
      svgEl('stop', { offset: '100%', 'stop-color': '#bfdbfe' }, rimGrad);

      const gloss = svgEl('radialGradient', { id: glossId, cx: '50%', cy: '50%', r: '50%' }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.85' }, gloss);
      svgEl('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' }, gloss);

      // 外圈 + 表盘
      svgEl('circle', { cx: CX, cy: CY, r: 196, fill: 'url(#' + rimId + ')', class: 'clock-rim' }, svg);
      svgEl('circle', { cx: CX, cy: CY, r: 187, fill: 'url(#' + faceId + ')', class: 'clock-face' }, svg);
      svgEl('circle', { cx: CX, cy: CY, r: 150, class: 'clock-inner-ring' }, svg);
      svgEl('ellipse', { cx: 200, cy: 92, rx: 108, ry: 62, fill: 'url(#' + glossId + ')', class: 'clock-gloss' }, svg);

      // 刻度
      const ticks = svgEl('g', { class: 'ticks' }, svg);
      for (let i = 0; i < 60; i++) {
        const isHour = i % 5 === 0;
        const deg = i * 6;
        const p1 = polarPoint(isHour ? 158 : 168, deg);
        const p2 = polarPoint(181, deg);
        svgEl(
          'line',
          {
            x1: p1[0].toFixed(2),
            y1: p1[1].toFixed(2),
            x2: p2[0].toFixed(2),
            y2: p2[1].toFixed(2),
            class: isHour ? 'tick tick-hour' : 'tick tick-minute'
          },
          ticks
        );
      }

      // 1~12
      const numbersGroup = svgEl('g', { class: 'hour-numbers' }, svg);
      for (let n = 1; n <= 12; n++) {
        const p = polarPoint(128, n * 30);
        const text = svgEl(
          'text',
          {
            x: p[0].toFixed(2),
            y: p[1].toFixed(2),
            class: 'hour-number',
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          },
          numbersGroup
        );
        text.textContent = String(n);
      }

      // 分钟数字（5、10 …… 60）
      this.minuteNumbersGroup = svgEl('g', { class: 'minute-numbers' }, svg);
      for (let n = 1; n <= 12; n++) {
        const p = polarPoint(157, n * 30);
        const text = svgEl(
          'text',
          {
            x: p[0].toFixed(2),
            y: p[1].toFixed(2),
            class: 'minute-number',
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          },
          this.minuteNumbersGroup
        );
        text.textContent = n === 12 ? '60' : String(n * 5);
      }

      // 指针
      this.hands = {};
      const handOrder = ['hour', 'minute', 'second'];
      for (let idx = 0; idx < handOrder.length; idx++) {
        const hand = handOrder[idx];
        const conf = HANDS[hand];
        const g = svgEl('g', { class: 'hand hand-' + hand, 'data-hand': hand }, svg);
        svgEl(
          'line',
          { x1: CX, y1: CY + conf.tail, x2: CX, y2: CY - conf.len, class: 'hand-body', 'data-hand': hand },
          g
        );
        if (hand === 'second') {
          svgEl('circle', { cx: CX, cy: CY - conf.len + 12, r: 5.5, class: 'hand-tip-dot' }, g);
        }
        // 透明加粗的拖动感应区
        svgEl(
          'line',
          {
            x1: CX,
            y1: CY + Math.max(conf.tail, 10),
            x2: CX,
            y2: CY - conf.len,
            class: 'hand-hit',
            'data-hand': hand
          },
          g
        );
        this.hands[hand] = { g: g, angle: 0 };
      }

      // 指针名称（不跟着转，保持正立）
      this.handLabels = {};
      const labels = svgEl('g', { class: 'hand-labels', 'aria-hidden': 'true' }, svg);
      this.labelsGroup = labels;
      for (let idx = 0; idx < handOrder.length; idx++) {
        const hand = handOrder[idx];
        const g = svgEl('g', { class: 'hand-label ' + hand }, labels);
        const text = svgEl(
          'text',
          {
            x: 0,
            y: 0,
            class: 'hand-label-text',
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          },
          g
        );
        text.textContent = HANDS[hand].name;
        this.handLabels[hand] = g;
      }

      // 中心轴
      const cap = svgEl('g', { class: 'clock-cap', 'aria-hidden': 'true' }, svg);
      svgEl('circle', { cx: CX, cy: CY, r: 10, class: 'cap-outer' }, cap);
      svgEl('circle', { cx: CX, cy: CY, r: 5.2, class: 'cap-inner' }, cap);

      // 拖动事件（事件委托到感应线上）
      svg.addEventListener('pointerdown', this._onPointerDown.bind(this));

      this.container.appendChild(svg);
    }

    /* ---------- 设置显示项 ---------- */
    setOptions(options) {
      this.options = Object.assign({}, this.options, options || {});
      this.svg.classList.toggle('no-minute-numbers', !this.options.showMinuteNumbers);
      this.svg.classList.toggle('hide-hand-labels', !this.options.showHandLabels);
    }

    setInteractive(on) {
      this.options.interactive = !!on;
      this.svg.classList.toggle('is-interactive', !!on);
      if (!on) {
        this._dragging = null;
        this.svg.classList.remove('dragging');
      }
    }

    /** 拨钟练习时只保留时针和分针，避免秒针挡住分针 */
    setSecondVisible(visible) {
      this.svg.classList.toggle('hide-second', !visible);
    }

    /** 让某根针显示在最上层，重叠时优先被拖动 */
    setActiveHand(hand) {
      const order = ['hour', 'minute', 'second'];
      const finalOrder = hand ? order.filter(function (h) { return h !== hand; }).concat(hand) : order;
      const self = this;
      finalOrder.forEach(function (h) {
        self.svg.insertBefore(self.hands[h].g, self.labelsGroup);
      });
    }

    /* ---------- 渲染 ---------- */
    render(time) {
      const t = normalizeTime(time);
      this.time = t;
      const ms = t.ms || 0;
      const secFloat = t.s + ms / 1000;
      const minFloat = t.m + secFloat / 60;
      const hourFloat = (t.h % 12) + minFloat / 60;

      this.angles = {
        hour: hourFloat * 30,
        minute: minFloat * 6,
        second: secFloat * 6
      };

      const order = ['hour', 'minute', 'second'];
      for (let i = 0; i < order.length; i++) {
        const hand = order[i];
        const angle = this.angles[hand];
        this.hands[hand].g.setAttribute('transform', 'rotate(' + angle.toFixed(2) + ' ' + CX + ' ' + CY + ')');
        // 名称标签沿着指针方向放在手指旁边，并朝顺时针方向偏一点，避免压住数字
        const rad = ((angle - 90) * Math.PI) / 180;
        const radius = HANDS[hand].labelRadius;
        const offset = 27;
        const lx = CX + radius * Math.cos(rad) + offset * Math.cos(rad + Math.PI / 2);
        const ly = CY + radius * Math.sin(rad) + offset * Math.sin(rad + Math.PI / 2);
        const label = this.handLabels[hand];
        label.setAttribute('transform', 'translate(' + lx.toFixed(2) + ' ' + ly.toFixed(2) + ')');
      }
    }

    /* ---------- 高亮某根针 ---------- */
    highlightHand(hand, duration) {
      this.svg.classList.remove('hl-hour', 'hl-minute', 'hl-second');
      clearTimeout(this._hlTimer);
      if (!hand) return;
      this.svg.classList.add('hl-' + hand);
      const self = this;
      this._hlTimer = setTimeout(function () {
        self.svg.classList.remove('hl-' + hand);
      }, duration || 2800);
    }

    /* ---------- 拖动拨钟 ---------- */
    _onPointerDown(event) {
      if (!this.options.interactive) return;
      const target = event.target.closest ? event.target.closest('[data-hand]') : null;
      if (!target) return;
      const hand = target.getAttribute('data-hand');
      if (!hand) return;

      event.preventDefault();
      this._dragging = {
        hand: hand,
        base: normalizeTime(this.time),
        lastAngle: this._pointerAngle(event),
        acc: 0
      };
      this.svg.classList.add('dragging');
      this.svg.setAttribute('data-dragging', hand);
      window.addEventListener('pointermove', this._boundMove, { passive: false });
      window.addEventListener('pointerup', this._boundUp);
      window.addEventListener('pointercancel', this._boundUp);
    }

    /** 把鼠标/手指位置换算成钟面上的角度（12 点方向为 0°，顺时针 0~360） */
    _pointerAngle(event) {
      const point = this.svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = this.svg.getScreenCTM();
      if (!matrix) return 0;
      const local = point.matrixTransform(matrix.inverse());
      const angle = (Math.atan2(local.y - CY, local.x - CX) * 180) / Math.PI + 90;
      return ((angle % 360) + 360) % 360;
    }

    _onPointerMove(event) {
      const drag = this._dragging;
      if (!drag) return;
      event.preventDefault();
      const angle = this._pointerAngle(event);
      let delta = angle - drag.lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      drag.acc += delta;
      drag.lastAngle = angle;

      const base = drag.base;
      const baseSeconds = base.h * 3600 + base.m * 60 + base.s;
      let nextSeconds;

      if (drag.hand === 'second') {
        // 秒针：6° = 1 秒
        nextSeconds = baseSeconds + drag.acc / 6;
        nextSeconds = Math.round(nextSeconds);
      } else if (drag.hand === 'minute') {
        // 分针：6° = 1 分钟
        nextSeconds = baseSeconds + (drag.acc / 6) * 60;
        nextSeconds = Math.round(nextSeconds / 60) * 60;
      } else {
        // 时针：30° = 1 小时
        nextSeconds = baseSeconds + (drag.acc / 30) * 3600;
        nextSeconds = Math.round(nextSeconds / 60) * 60;
      }

      const daySeconds = ((nextSeconds % 86400) + 86400) % 86400;
      const t = {
        h: Math.floor(daySeconds / 3600),
        m: Math.floor((daySeconds % 3600) / 60),
        s: daySeconds % 60
      };
      this.render(t);
      if (typeof this.onTimeChange === 'function') this.onTimeChange({ h: t.h, m: t.m, s: t.s });
    }

    _onPointerUp() {
      if (!this._dragging) return;
      this._dragging = null;
      this.svg.classList.remove('dragging');
      this.svg.removeAttribute('data-dragging');
      window.removeEventListener('pointermove', this._boundMove);
      window.removeEventListener('pointerup', this._boundUp);
      window.removeEventListener('pointercancel', this._boundUp);
    }
  }

  window.AnalogClock = AnalogClock;
})();
