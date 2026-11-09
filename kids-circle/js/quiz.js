/* =========================================================
   圆的乐园 · 测试模块（闯关答题）
   ---------------------------------------------------------
   · 52 道题，覆盖 8 个知识点：单选（四选一）/ 判断 / 填空
   · π 一律取 3.14，数值保留两位小数，填空容差 ±0.01
   · 每轮 10 题：进度条 → 即时反馈 → 分步讲解 → 结算星级与错题回顾
   · 题库通过 window.CircleLab.parts.quiz 暴露，方便 Node 脚本逐题复算
   ========================================================= */
(function () {
  'use strict';

  var CL = window.CircleLab;
  var ROUND_LEN = 10;
  var BEST_KEY = 'quizBest';
  var STATS_KEY = 'quizStats';
  var LETTERS = ['A', 'B', 'C', 'D'];

  /* 8 个知识点（need 为 BUILD-SPEC 要求的题量，供自检脚本核对） */
  var KPS = {
    concept: { name: '圆的概念', color: 'blue', need: 6 },
    pi: { name: '圆周率 π', color: 'amber', need: 6 },
    piTable: { name: '1π~100π', color: 'purple', need: 6 },
    rd: { name: '半径与直径', color: 'blue', need: 6 },
    circ: { name: '圆的周长', color: 'purple', need: 8 },
    area: { name: '圆的面积', color: 'green', need: 8 },
    sector: { name: '扇形', color: 'amber', need: 6 },
    shadow: { name: '阴影面积', color: 'pink', need: 6 }
  };

  var DIFFS = [
    { key: 'basic', name: '基础', emoji: '🌱', desc: '概念与简单计算，先热热身' },
    { key: 'mid', name: '进阶', emoji: '🚀', desc: '两步计算，注意常见易错点' },
    { key: 'hard', name: '挑战', emoji: '🔥', desc: '综合应用与阴影面积难题' },
    { key: 'mix', name: '综合', emoji: '🎲', desc: '8 个知识点随机抽题' }
  ];

  function getDiff(key) {
    for (var i = 0; i < DIFFS.length; i++) {
      if (DIFFS[i].key === key) return DIFFS[i];
    }
    return DIFFS[0];
  }

  /* =======================================================
     一、数字与选项小工具
     ======================================================= */

  function r2(n) {
    return CL.round(n, 2);
  }

  function num(n) {
    return CL.fmtNum(n, 2);
  }

  function withUnit(n, unit) {
    return num(n) + (unit ? ' ' + unit : '');
  }

  /** 1π ~ 100π 表中的第 n 项，保证与 CL.PI_TABLE 完全一致 */
  function piN(n) {
    return CL.PI_TABLE[n - 1].value;
  }

  /** 单选题选项：正确项放第一个，错项过滤掉重复文本 */
  function choose(correctText, wrongTexts) {
    var list = [{ text: correctText, ok: true }];
    var seen = Object.create(null);
    seen[correctText] = true;
    for (var i = 0; i < wrongTexts.length; i++) {
      var text = wrongTexts[i];
      if (!seen[text]) {
        seen[text] = true;
        list.push({ text: text, ok: false });
      }
    }
    return list;
  }

  function numChoose(correct, wrongs, unit) {
    return choose(withUnit(correct, unit), wrongs.map(function (v) {
      return withUnit(v, unit);
    }));
  }

  function extend(base, extra) {
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        base[key] = extra[key];
      });
    }
    return base;
  }

  /* ---------------- 题目工厂 ---------------- */

  function textSingle(id, kp, diff, prompt, correct, wrongs, explain, extra) {
    return extend({
      id: id, kp: kp, diff: diff, type: 'single',
      prompt: prompt, options: choose(correct, wrongs), explain: explain
    }, extra);
  }

  function numSingle(id, kp, diff, prompt, correct, wrongs, unit, explain, extra) {
    return extend({
      id: id, kp: kp, diff: diff, type: 'single', prompt: prompt,
      options: numChoose(correct, wrongs, unit),
      answerValue: r2(correct),
      optionUnit: unit || '',
      explain: explain
    }, extra);
  }

  function judgeQ(id, kp, diff, prompt, answer, explain, extra) {
    return extend({
      id: id, kp: kp, diff: diff, type: 'judge',
      prompt: prompt, answer: !!answer, explain: explain
    }, extra);
  }

  function fillQ(id, kp, diff, prompt, answer, unit, explain, extra) {
    return extend({
      id: id, kp: kp, diff: diff, type: 'fill', prompt: prompt,
      answer: r2(answer), unit: unit || '', tolerance: 0.01, explain: explain
    }, extra);
  }

  /* =======================================================
     二、题目配图（纯字符串 SVG，不依赖 DOM，方便复用）
     ======================================================= */

  function svgWrap(inner) {
    return '<svg class="qz-svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  function svgCircle(r, cls) {
    return '<circle cx="100" cy="100" r="' + r + '" class="' + cls + '"/>';
  }

  function svgLine(x1, y1, x2, y2, cls) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="' + cls + '"/>';
  }

  function svgDot() {
    return '<circle cx="100" cy="100" r="4.5" class="qz-fig-center"/>';
  }

  function svgText(x, y, text, cls) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" class="qz-svg-t' +
      (cls ? ' ' + cls : '') + '">' + text + '</text>';
  }

  function svgPoint(deg, r) {
    var p = CL.geom.polar(100, 100, r, deg);
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
  }

  /** 圆 + 一条半径 */
  function figRadius(rText, areaText) {
    var list = [];
    if (areaText) list.push(svgCircle(64, 'qz-fig-area'));
    list.push(svgCircle(64, 'qz-fig-ring'));
    list.push(svgLine(100, 100, 164, 100, 'qz-fig-r'));
    list.push(svgDot());
    list.push(svgText(132, 92, rText, 'blue'));
    if (areaText) list.push(svgText(100, 188, areaText, 'green'));
    return svgWrap(list.join(''));
  }

  /** 圆 + 一条直径 */
  function figDiameter(dText) {
    var list = [];
    list.push(svgCircle(64, 'qz-fig-ring'));
    list.push(svgLine(36, 100, 164, 100, 'qz-fig-d'));
    list.push(svgDot());
    list.push(svgText(100, 88, dText, 'amber'));
    return svgWrap(list.join(''));
  }

  /** 圆 + 三条相等的半径，说明“到圆心距离都相等” */
  function figThreeRadii() {
    var list = [svgCircle(64, 'qz-fig-ring')];
    [0, 120, 240].forEach(function (deg) {
      var p = svgPoint(deg, 60);
      list.push(svgLine(100, 100, p.x, p.y, 'qz-fig-r'));
      var lp = svgPoint(deg, 34);
      list.push(svgText(lp.x, lp.y + 4, 'r', 'blue'));
    });
    list.push(svgDot());
    return svgWrap(list.join(''));
  }

  /** 半圆：弧 + 直径 */
  function figSemicircle(dText) {
    var list = [];
    list.push('<path d="' + CL.geom.arcPath(100, 100, 64, 270, 90) + '" class="qz-fig-arc"/>');
    list.push(svgLine(36, 100, 164, 100, 'qz-fig-d'));
    list.push(svgDot());
    list.push(svgText(100, 62, '半圆弧', 'purple'));
    list.push(svgText(100, 120, dText, 'amber'));
    return svgWrap(list.join(''));
  }

  /** 扇形：圆心角从 12 点方向顺时针张开 */
  function figSector(angle, angleText) {
    var list = [];
    list.push('<path d="' + CL.geom.sectorPath(100, 100, 64, 0, angle) + '" class="qz-fig-fill"/>');
    list.push(svgCircle(64, 'qz-fig-ring'));
    list.push(svgLine(100, 100, 164, 100, 'qz-fig-r'));
    list.push(svgDot());
    list.push(svgText(128, 86, angleText, 'amber'));
    return svgWrap(list.join(''));
  }

  /** 圆环：R / r 两条半径 */
  function figRing() {
    var list = [];
    list.push('<path d="' + CL.geom.donutPath(100, 100, 66, 38) +
      '" fill-rule="evenodd" class="qz-fig-shadow"/>');
    list.push(svgCircle(66, 'qz-fig-ring'));
    list.push(svgCircle(38, 'qz-fig-ring'));
    list.push(svgLine(100, 100, 166, 100, 'qz-fig-r'));
    list.push(svgLine(100, 100, 100, 62, 'qz-fig-r'));
    list.push(svgDot());
    list.push(svgText(141, 92, 'R', 'blue'));
    list.push(svgText(110, 78, 'r', 'blue'));
    return svgWrap(list.join(''));
  }

  /** 外方内圆：正方形里最大的圆，四角是阴影 */
  function figSquareCircle(sideText) {
    var list = [];
    list.push('<rect x="30" y="30" width="140" height="140" rx="8" class="qz-fig-shadow"/>');
    list.push(svgCircle(70, 'qz-fig-cover'));
    list.push(svgCircle(70, 'qz-fig-ring'));
    list.push(svgText(100, 190, sideText, ''));
    return svgWrap(list.join(''));
  }

  /** 内方外圆：正方形内接于圆，正方形外面 4 块是阴影；对角线画出圆的直径 */
  function figCircleSquare(dText) {
    var list = [];
    list.push(svgCircle(70, 'qz-fig-shadow'));
    var pts = [45, 135, 225, 315].map(function (deg) {
      var p = svgPoint(deg, 70);
      return p.x + ',' + p.y;
    }).join(' ');
    list.push('<polygon points="' + pts + '" class="qz-fig-cover"/>');
    list.push(svgCircle(70, 'qz-fig-ring'));
    var a = svgPoint(135, 70);
    var b = svgPoint(315, 70);
    list.push(svgLine(a.x, a.y, b.x, b.y, 'qz-fig-d'));
    list.push(svgDot());
    list.push(svgText(100, 192, dText, 'amber'));
    return svgWrap(list.join(''));
  }

  /* =======================================================
     三、题库（52 题）
     ---------------------------------------------------------
     check 字段只给 Node 复核脚本使用：
       f      公式名
       其余键  公式参数
       shown  判断题中被断言“等于”的数值
     ======================================================= */

  var BANK = [

    /* ==================== 1. 圆的概念（6 题） ==================== */

    textSingle('C1', 'concept', 'basic',
      '圆的位置是由（　）决定的。',
      '圆心', ['半径', '直径', '周长'],
      ['圆心是圆的中心点，圆画在哪里，由圆心的位置决定。',
        '半径只决定圆有多大，不会改变圆的位置。',
        '所以记住：圆心定位置，半径定大小。']),

    textSingle('C2', 'concept', 'basic',
      '在同一个圆里，圆上任意一点到圆心的距离（　）。',
      '都相等', ['各不相同', '越远越大', '正好等于直径'],
      ['圆的定义：到圆心的距离都相等的所有点，组成一个圆。',
        '这个固定的距离就是半径。',
        '所以圆上任意一点到圆心的距离都相等。'],
      { figure: figThreeRadii() }),

    judgeQ('C3', 'concept', 'basic',
      '圆是轴对称图形，它有无数条对称轴。',
      true,
      ['把圆沿着任意一条直径对折，两边都能完全重合。',
        '每条直径所在的直线都是圆的对称轴，而直径有无数条。',
        '所以圆有无数条对称轴，这句话是对的。']),

    textSingle('C4', 'concept', 'basic',
      '用圆规画圆时，圆规两只脚张开的距离是圆的（　）。',
      '半径', ['直径', '周长', '面积'],
      ['圆规的针尖固定在圆心，铅笔尖画出的点到针尖的距离，就是半径。',
        '所以圆规两脚张开的距离就是半径。',
        '例如要画直径 6 厘米的圆，两脚应张开 3 厘米。']),

    judgeQ('C5', 'concept', 'mid',
      '在同一个圆里，所有直径的长度都相等。',
      true,
      ['直径 = 2 × 半径。',
        '同一个圆的所有半径都相等，所以所有直径也都相等。',
        '注意前提：必须是同一个圆，或相等的圆。']),

    textSingle('C6', 'concept', 'hard',
      '下面说法正确的是（　）。',
      '圆心决定圆的位置，半径决定圆的大小',
      ['圆的半径越大，圆周率 π 就越大',
        '圆只有 2 条对称轴',
        '半圆的周长就是圆周长的一半'],
      ['圆心在哪里，圆就在哪里；半径有多长，圆就有多大。',
        'π 是固定的数，和圆的大小无关；圆有无数条对称轴。',
        '半圆周长 = 圆周长的一半 + 一条直径，比圆周长的一半多。']),

    /* ==================== 2. 圆周率 π（6 题） ==================== */

    textSingle('P1', 'pi', 'basic',
      '圆周率 π 表示的是（　）的比值。',
      '圆的周长与直径', ['圆的面积与半径', '圆的直径与半径', '圆的周长与半径'],
      ['人们发现：不管圆多大多小，周长总是直径的 3 倍多一点。',
        '这个固定的倍数，就是圆周率 π。',
        '所以 π = 周长 ÷ 直径。']),

    textSingle('P2', 'pi', 'basic',
      '我们计算圆的相关问题时，π 通常取（　）。',
      '3.14', ['3.1', '3.15', '3.41'],
      ['π 的真实值是 3.1415926…，是一个无限不循环小数。',
        '为了计算方便，小学阶段统一取 π = 3.14。',
        '所以算出的周长、面积都是近似值。']),

    judgeQ('P3', 'pi', 'basic',
      'π = 3.14，所以圆周率就是 3.14。',
      false,
      ['π 是无限不循环小数，真实值是 3.1415926…',
        '3.14 只是计算时取的近似值，不是准确值。',
        '所以要说“π ≈ 3.14”，这句话是错的。']),

    textSingle('P4', 'pi', 'mid',
      '关于圆周率 π，下面说法正确的是（　）。',
      'π 是一个无限不循环小数',
      ['π 是一个有限小数', 'π 是一个循环小数', 'π 是一个整数'],
      ['π = 3.1415926535…，小数位无限多。',
        '它的小数部分没有循环节，所以是无限不循环小数。',
        '计算时用 3.14 代替它，既方便又够用。']),

    textSingle('P5', 'pi', 'mid',
      '任何一个圆的周长，都是它直径的（　）。',
      'π 倍（约 3.14 倍）', ['2 倍', '3 倍', '4 倍'],
      ['周长 ÷ 直径 = π，这就是圆周率的定义。',
        '所以周长 = π × 直径 = 3.14 × 直径。',
        '圆大圆小都一样，这个倍数永远是 π。']),

    textSingle('P6', 'pi', 'hard',
      '我国南北朝时期的数学家祖冲之，把圆周率精确到小数点后第（　）位。',
      '七', ['三', '五', '十'],
      ['祖冲之算出 3.1415926 < π < 3.1415927。',
        '也就是精确到小数点后第七位，这个纪录保持了一千多年。',
        '他用的方法叫“割圆术”，把圆不断分割来逼近圆周长。']),

    /* ==================== 3. 1π ~ 100π（6 题） ==================== */

    fillQ('T1', 'piTable', 'basic',
      '算一算：3.14 × 5 = （　）',
      piN(5), '',
      ['3.14 × 5 就是 5 个 3.14 相加。',
        '3.14 × 5 = 15.7。',
        '记住常用值，算周长和面积会快很多。'],
      { check: { f: 'pi-n', n: 5 } }),

    numSingle('T2', 'piTable', 'basic',
      '3.14 × 7 = （　）',
      piN(7), [21.88, 22.98, 21.08], '',
      ['3.14 × 7 = 3.14 × 5 + 3.14 × 2。',
        '= 15.7 + 6.28 = 21.98。',
        '也可以直接记住：7π = 21.98。'],
      { check: { f: 'pi-n', n: 7 } }),

    fillQ('T3', 'piTable', 'mid',
      '算一算：3.14 × 15 = （　）',
      piN(15), '',
      ['把 15 拆成 10 + 5。',
        '3.14 × 10 = 31.4，3.14 × 5 = 15.7。',
        '31.4 + 15.7 = 47.1，所以 15π = 47.1。'],
      { check: { f: 'pi-n', n: 15 } }),

    numSingle('T4', 'piTable', 'mid',
      '3.14 × 25 = （　）',
      piN(25), [78.05, 77.5, 75.5], '',
      ['3.14 × 25 = 3.14 × 100 ÷ 4。',
        '= 314 ÷ 4 = 78.5。',
        '所以 25π = 78.5。'],
      { check: { f: 'pi-n', n: 25 } }),

    numSingle('T5', 'piTable', 'hard',
      '3.14 × 36 = （　）',
      piN(36), [113.4, 110.4, 103.04], '',
      ['把 36 拆成 30 + 6。',
        '3.14 × 30 = 94.2，3.14 × 6 = 18.84。',
        '94.2 + 18.84 = 113.04，所以 36π = 113.04。'],
      { check: { f: 'pi-n', n: 36 } }),

    judgeQ('T6', 'piTable', 'hard',
      '3.14 × 8 = 25.12。',
      true,
      ['3.14 × 8 = 3.14 × 4 × 2。',
        '3.14 × 4 = 12.56，12.56 × 2 = 25.12。',
        '所以 8π = 25.12，这句话是对的。'],
      { check: { f: 'pi-n', n: 8, shown: 25.12 } }),

    /* ==================== 4. 半径与直径（6 题） ==================== */

    fillQ('R1', 'rd', 'basic',
      '一个圆的半径是 4 厘米，它的直径是多少厘米？',
      8, '厘米',
      ['直径 = 2 × 半径。',
        'd = 2 × 4 = 8（厘米）。',
        '半径是从圆心到圆上，直径穿过圆心，正好是两条半径。'],
      { figure: figRadius('r = 4 厘米'), check: { f: 'd-r', r: 4 } }),

    numSingle('R2', 'rd', 'basic',
      '一个圆的直径是 10 厘米，它的半径是多少厘米？',
      5, [20, 2.5, 100], '厘米',
      ['半径 = 直径 ÷ 2。',
        'r = 10 ÷ 2 = 5（厘米）。',
        '直径是半径的 2 倍，半径是直径的一半。'],
      { figure: figDiameter('d = 10 厘米'), check: { f: 'r-d', d: 10 } }),

    textSingle('R3', 'rd', 'basic',
      '用 d 表示直径，r 表示半径，下面关系正确的是（　）。',
      'd = 2r', ['d = r ÷ 2', 'd = r + 2', 'd = r²'],
      ['直径穿过圆心，两端都在圆上，等于两条半径拼起来。',
        '所以 d = r + r = 2r。',
        '反过来，r = d ÷ 2。']),

    fillQ('R4', 'rd', 'mid',
      '一个圆的直径是 7 厘米，它的半径是多少厘米？',
      3.5, '厘米',
      ['半径 = 直径 ÷ 2。',
        '7 ÷ 2 = 3.5（厘米）。',
        '直径是单数时，半径会出现小数，这是正常的。'],
      { check: { f: 'r-d', d: 7 } }),

    numSingle('R5', 'rd', 'mid',
      '一个圆的半径是 2.5 分米，它的直径是多少分米？',
      5, [1.25, 6.28, 7.85], '分米',
      ['d = 2r。',
        '2.5 × 2 = 5（分米）。',
        '单位是“分米”，不要写成平方分米。'],
      { figure: figRadius('r = 2.5 分米'), check: { f: 'd-r', r: 2.5 } }),

    judgeQ('R6', 'rd', 'hard',
      '一个圆的半径是 6 分米，它的周长是 37.68 分米。',
      true,
      ['先求直径：d = 2 × 6 = 12（分米）。',
        '再求周长：C = 3.14 × 12 = 37.68（分米）。',
        '所以这句话正确。'],
      { check: { f: 'C-r', r: 6, shown: 37.68 } }),

    /* ==================== 5. 圆的周长（8 题） ==================== */

    fillQ('Z1', 'circ', 'basic',
      '一个圆的半径是 3 厘米，它的周长是多少厘米？',
      18.84, '厘米',
      ['先求直径：d = 2 × 3 = 6（厘米）。',
        '再用公式：C = πd = 3.14 × 6。',
        'C = 18.84（厘米）。'],
      { figure: figRadius('r = 3 厘米'), check: { f: 'C-r', r: 3 } }),

    numSingle('Z2', 'circ', 'basic',
      '一个圆的直径是 4 厘米，它的周长是多少厘米？',
      12.56, [6.28, 25.12, 50.24], '厘米',
      ['已知直径，直接用 C = πd。',
        'C = 3.14 × 4 = 12.56（厘米）。',
        '也可以先求半径 2 厘米，再用 C = 2πr。'],
      { figure: figDiameter('d = 4 厘米'), check: { f: 'C-d', d: 4 } }),

    textSingle('Z3', 'circ', 'basic',
      '圆的周长公式是（　）。',
      'C = πd = 2πr', ['C = πr²', 'C = πr', 'C = 2πd'],
      ['周长是圆一整圈的长度，等于 π × 直径。',
        '因为直径 = 2 × 半径，所以 C = πd = 2πr。',
        'πr² 是面积公式，别把周长和面积弄混。']),

    fillQ('Z4', 'circ', 'mid',
      '一个圆的直径是 10 分米，它的周长是多少分米？',
      31.4, '分米',
      ['C = πd。',
        'C = 3.14 × 10 = 31.4（分米）。',
        'π 取 3.14，算出的结果是近似值。'],
      { check: { f: 'C-d', d: 10 } }),

    numSingle('Z5', 'circ', 'mid',
      '一个圆的半径是 0.5 米，它的周长是多少米？',
      3.14, [1.57, 6.28, 0.785], '米',
      ['先求直径：d = 2 × 0.5 = 1（米）。',
        'C = πd = 3.14 × 1 = 3.14（米）。',
        '半径只有 0.5 米，周长却超过 3 米，因为周长是绕一整圈的长度。'],
      { check: { f: 'C-r', r: 0.5 } }),

    judgeQ('Z6', 'circ', 'mid',
      '一个圆的直径扩大到原来的 2 倍，它的周长也扩大到原来的 2 倍。',
      true,
      ['C = πd，π 是固定不变的。',
        '直径乘 2，周长也跟着乘 2。',
        '所以直径扩大到原来的 2 倍，周长也扩大到原来的 2 倍。'],
      { check: { f: 'scale-C', k: 2, shown: 2 } }),

    fillQ('Z7', 'circ', 'hard',
      '一根绳子长 31.4 厘米，正好围成一个圆，这个圆的半径是多少厘米？',
      5, '厘米',
      ['绳子的长度就是圆的周长：C = 31.4 厘米。',
        '直径 d = C ÷ π = 31.4 ÷ 3.14 = 10（厘米）。',
        '半径 r = 10 ÷ 2 = 5（厘米）。'],
      { check: { f: 'reverse-r-from-C', C: 31.4 } }),

    numSingle('Z8', 'circ', 'hard',
      '一个半径是 2 厘米的半圆，它的周长是多少厘米？（含直径）',
      10.28, [6.28, 8.28, 12.56], '厘米',
      ['半圆的周长 = 圆周长的一半 + 一条直径。',
        '弧长 = 3.14 × 2 × 2 ÷ 2 = 6.28（厘米），直径 = 4 厘米。',
        '6.28 + 4 = 10.28（厘米）。易错：别忘了加直径！'],
      { figure: figSemicircle('d = 4 厘米'), figureNote: '半圆的周长 = 弧长 + 直径', check: { f: 'half-C', r: 2 } }),

    /* ==================== 6. 圆的面积（8 题） ==================== */

    fillQ('A1', 'area', 'basic',
      '一个圆的半径是 2 厘米，它的面积是多少平方厘米？',
      12.56, '平方厘米',
      ['S = πr²，先算 r² = 2 × 2 = 4。',
        'S = 3.14 × 4 = 12.56（平方厘米）。',
        'r² 是 r 乘 r，不是 2r。'],
      { figure: figRadius('r = 2 厘米', 'S = ?'), check: { f: 'S-r', r: 2 } }),

    numSingle('A2', 'area', 'basic',
      '一个圆的直径是 4 厘米，它的面积是多少平方厘米？',
      12.56, [25.12, 6.28, 50.24], '平方厘米',
      ['先求半径：r = 4 ÷ 2 = 2（厘米）。',
        '再算面积：S = 3.14 × 2² = 3.14 × 4。',
        'S = 12.56（平方厘米）。'],
      { check: { f: 'S-d', d: 4 } }),

    textSingle('A3', 'area', 'basic',
      '圆的面积公式是（　）。',
      'S = πr²', ['S = 2πr', 'S = πr', 'S = πd'],
      ['把圆剪拼成近似长方形，长 ≈ πr，宽 = r。',
        '长方形的面积 = 长 × 宽 = πr × r = πr²。',
        '所以 S = πr²。']),

    fillQ('A4', 'area', 'mid',
      '一个圆的半径是 10 分米，它的面积是多少平方分米？',
      314, '平方分米',
      ['r² = 10 × 10 = 100。',
        'S = 3.14 × 100 = 314（平方分米）。',
        '半径 10 分米，面积已经三百多，因为面积用的是“平方”单位。'],
      { check: { f: 'S-r', r: 10 } }),

    numSingle('A5', 'area', 'mid',
      '一个圆的半径是 4 厘米，它的面积是多少平方厘米？',
      50.24, [25.12, 100.48, 12.56], '平方厘米',
      ['r² = 4 × 4 = 16。',
        'S = 3.14 × 16 = 50.24（平方厘米）。',
        '可以这样算：3.14 × 16 = 3.14 × 8 × 2 = 25.12 × 2。'],
      { figure: figRadius('r = 4 厘米', 'S = ?'), check: { f: 'S-r', r: 4 } }),

    judgeQ('A6', 'area', 'mid',
      '一个圆的半径扩大到原来的 2 倍，它的面积也扩大到原来的 2 倍。',
      false,
      ['S = πr²，半径要平方。',
        '半径乘 2，面积要乘 2 × 2 = 4。',
        '所以半径扩大 2 倍，面积扩大到原来的 4 倍，这句话是错的。'],
      { check: { f: 'scale-S', k: 2, shown: 2 } }),

    fillQ('A7', 'area', 'hard',
      '一个圆的周长是 18.84 厘米，它的面积是多少平方厘米？',
      28.26, '平方厘米',
      ['先由周长求直径：d = 18.84 ÷ 3.14 = 6（厘米）。',
        '半径 r = 6 ÷ 2 = 3（厘米）。',
        'S = 3.14 × 3² = 3.14 × 9 = 28.26（平方厘米）。'],
      { check: { f: 'area-from-C', C: 18.84 } }),

    numSingle('A8', 'area', 'hard',
      '一个圆的面积是 12.56 平方厘米，它的半径是多少厘米？',
      2, [4, 6.28, 1], '厘米',
      ['S = πr²，所以 r² = S ÷ π = 12.56 ÷ 3.14 = 4。',
        'r² = 4，因为 2 × 2 = 4，所以 r = 2（厘米）。',
        '注意 r² = 4 时，r 是 2，不是 4。'],
      { check: { f: 'reverse-r-from-S', S: 12.56 } }),

    /* ==================== 7. 扇形（6 题） ==================== */

    textSingle('S1', 'sector', 'basic',
      '圆心角是 90° 的扇形，面积占所在整圆的（　）。',
      '四分之一', ['二分之一', '三分之一', '八分之一'],
      ['整圆的圆心角是 360°。',
        '90° ÷ 360° = 1/4。',
        '所以这个扇形的面积是整圆面积的 1/4。'],
      { figure: figSector(90, '90°') }),

    fillQ('S2', 'sector', 'basic',
      '半径 2 厘米、圆心角 90° 的扇形，面积是多少平方厘米？',
      3.14, '平方厘米',
      ['整圆面积 = 3.14 × 2² = 12.56（平方厘米）。',
        '扇形占整圆的 90/360 = 1/4。',
        '12.56 ÷ 4 = 3.14（平方厘米）。'],
      { check: { f: 'sector-area', r: 2, angle: 90 } }),

    judgeQ('S3', 'sector', 'basic',
      '半径相同时，圆心角 90° 的扇形面积是圆心角 45° 的扇形面积的 2 倍。',
      true,
      ['扇形面积 = πr² × 圆心角 ÷ 360。',
        '半径相同，面积就和圆心角成正比。',
        '90° 是 45° 的 2 倍，所以面积也是 2 倍。'],
      { check: { f: 'sector-ratio', a: 90, b: 45, shown: 2 } }),

    fillQ('S4', 'sector', 'mid',
      '半径 6 厘米、圆心角 60° 的扇形，弧长是多少厘米？',
      6.28, '厘米',
      ['整圆周长 = 2 × 3.14 × 6 = 37.68（厘米）。',
        '60/360 = 1/6。',
        '弧长 = 37.68 ÷ 6 = 6.28（厘米）。'],
      { figure: figSector(60, '60°'), check: { f: 'sector-arc', r: 6, angle: 60 } }),

    numSingle('S5', 'sector', 'mid',
      '半径 4 分米、圆心角 180° 的扇形，面积是多少平方分米？',
      25.12, [50.24, 12.56, 100.48], '平方分米',
      ['这是半个圆。',
        '整圆面积 = 3.14 × 4² = 50.24（平方分米）。',
        '一半就是 50.24 ÷ 2 = 25.12（平方分米）。'],
      { check: { f: 'sector-area', r: 4, angle: 180 } }),

    fillQ('S6', 'sector', 'hard',
      '半径 10 厘米、圆心角 72° 的扇形，弧长是多少厘米？',
      12.56, '厘米',
      ['整圆周长 = 2 × 3.14 × 10 = 62.8（厘米）。',
        '72/360 = 1/5。',
        '弧长 = 62.8 ÷ 5 = 12.56（厘米）。'],
      { check: { f: 'sector-arc', r: 10, angle: 72 } }),

    /* ==================== 8. 阴影面积（6 题） ==================== */

    judgeQ('Y1', 'shadow', 'basic',
      '圆环的面积可以用 π(R² − r²) 来计算（R 是外圆半径，r 是内圆半径）。',
      true,
      ['圆环 = 大圆挖去小圆。',
        '大圆面积 = πR²，小圆面积 = πr²。',
        '所以圆环面积 = πR² − πr² = π(R² − r²)。']),

    fillQ('Y2', 'shadow', 'basic',
      '一个圆环，外圆半径 4 厘米，内圆半径 2 厘米，圆环面积是多少平方厘米？',
      37.68, '平方厘米',
      ['R² − r² = 4² − 2² = 16 − 4 = 12。',
        '圆环面积 = 3.14 × 12。',
        '= 37.68（平方厘米）。'],
      { figure: figRing(), figureNote: '圆环 = 大圆 − 小圆', check: { f: 'ring', R: 4, r: 2 } }),

    numSingle('Y3', 'shadow', 'mid',
      '边长 4 厘米的正方形内画一个最大的圆，四个角上的阴影部分面积一共是多少平方厘米？',
      3.44, [12.56, 6.88, 3.14], '平方厘米',
      ['正方形的边长 4 厘米，最大的圆直径也是 4 厘米，半径 2 厘米。',
        '正方形面积 = 4 × 4 = 16，圆面积 = 3.14 × 4 = 12.56。',
        '阴影 = 16 − 12.56 = 3.44（平方厘米）。'],
      { figure: figSquareCircle('边长 4 厘米'), figureNote: '四角阴影 = 正方形 − 圆', check: { f: 'sq-minus-circle', s: 4 } }),

    fillQ('Y4', 'shadow', 'mid',
      '正方形边长 10 厘米，里面画一个最大的圆，四个角的阴影面积一共是多少平方厘米？',
      21.5, '平方厘米',
      ['正方形面积 = 10 × 10 = 100（平方厘米）。',
        '圆的半径 = 5 厘米，面积 = 3.14 × 25 = 78.5（平方厘米）。',
        '阴影 = 100 − 78.5 = 21.5（平方厘米）。'],
      { check: { f: 'sq-minus-circle', s: 10 } }),

    numSingle('Y5', 'shadow', 'mid',
      '一个圆环，外圆半径 5 分米，内圆半径 3 分米，圆环面积是多少平方分米？',
      50.24, [100.48, 25.12, 157], '平方分米',
      ['R² − r² = 25 − 9 = 16。',
        '圆环面积 = 3.14 × 16 = 50.24（平方分米）。',
        '也可以分别算出两个圆的面积，再相减。'],
      { check: { f: 'ring', R: 5, r: 3 } }),

    fillQ('Y6', 'shadow', 'hard',
      '一个正方形正好内接于直径 4 厘米的圆，正方形外面的阴影（4 块）面积一共是多少平方厘米？',
      4.56, '平方厘米',
      ['圆的半径 2 厘米，面积 = 3.14 × 4 = 12.56（平方厘米）。',
        '正方形的对角线就是圆的直径 4 厘米，正方形面积 = 对角线 × 对角线 ÷ 2 = 4 × 4 ÷ 2 = 8（平方厘米）。',
        '阴影 = 12.56 − 8 = 4.56（平方厘米）。'],
      { figure: figCircleSquare('d = 4 厘米'), figureNote: '正方形的对角线 = 圆的直径', check: { f: 'circle-minus-square', d: 4 } })
  ];

  /* =======================================================
     四、抽题：按知识点轮转，保证覆盖面
     ======================================================= */

  function poolOf(key) {
    if (key === 'mix') return BANK.slice();
    return BANK.filter(function (q) {
      return q.diff === key;
    });
  }

  /** 先按知识点轮转各取一题，再补足剩下的名额 */
  function spreadPick(pool, count) {
    var groups = {};
    var order = [];
    pool.forEach(function (q) {
      if (!groups[q.kp]) {
        groups[q.kp] = [];
        order.push(q.kp);
      }
      groups[q.kp].push(q);
    });
    order.forEach(function (kp) {
      groups[kp] = CL.shuffle(groups[kp]);
    });
    var out = [];
    var round = 0;
    while (out.length < count) {
      var added = false;
      for (var i = 0; i < order.length && out.length < count; i++) {
        var list = groups[order[i]];
        if (round < list.length) {
          out.push(list[round]);
          added = true;
        }
      }
      round++;
      if (!added) break;
    }
    return out;
  }

  function drawQuestions(key) {
    return CL.shuffle(spreadPick(poolOf(key), ROUND_LEN));
  }

  /* =======================================================
     五、本地存储
     ======================================================= */

  function loadBest() {
    var raw = CL.store.get(BEST_KEY, null);
    return raw && typeof raw === 'object' ? raw : {};
  }

  function saveBest(map) {
    CL.store.set(BEST_KEY, map);
  }

  function loadStats() {
    var raw = CL.store.get(STATS_KEY, null);
    if (!raw || typeof raw !== 'object') {
      return { rounds: 0, correct: 0, questions: 0 };
    }
    return {
      rounds: Number(raw.rounds) || 0,
      correct: Number(raw.correct) || 0,
      questions: Number(raw.questions) || 0
    };
  }

  /* =======================================================
     六、界面：外壳 + 状态
     ======================================================= */

  var state = {
    screen: 'home',
    diff: 'basic',
    queue: [],
    index: 0,
    correctCount: 0,
    confirmed: false,
    picked: null,
    fillValue: '',
    optionOrder: null,
    answers: [],
    resultTimer: 0
  };

  var dom = { stage: null };
  var keysBound = false;
  var startedOnce = false;

  function typeName(type) {
    if (type === 'single') return '单选题';
    if (type === 'judge') return '判断题';
    return '填空题';
  }

  function starsHTML(stars) {
    var html = '';
    for (var i = 0; i < 3; i++) {
      html += '<span class="qz-star' + (i < stars ? ' on' : '') + '">' +
        (i < stars ? '★' : '☆') + '</span>';
    }
    return html;
  }

  function statCell(label, value, tone) {
    return '<div class="cl-stat' + (tone ? ' ' + tone : '') + '">' +
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-value">' + value + '</div></div>';
  }

  /* ---------------- 开始页 ---------------- */

  function renderHome() {
    state.screen = 'home';
    var best = loadBest();
    var stats = loadStats();
    var sel = getDiff(state.diff);
    var html = '';

    html += '<div class="qz-home">';
    html += '<div class="qz-home-grid">';

    /* 主列：难度 + 规则 */
    html += '<div class="qz-main">';
    html += '<section class="cl-card qz-card">';
    html += '<div class="cl-card-head"><div><h3>🎯 选择难度</h3>' +
      '<p class="cl-card-sub">每轮 ' + ROUND_LEN + ' 道题，从对应难度的题库中随机抽取</p></div>' +
      '<span class="cl-chip cl-chip-blue">题库共 ' + BANK.length + ' 题</span></div>';
    html += '<div class="qz-diff-grid" role="group" aria-label="选择难度">';
    DIFFS.forEach(function (d) {
      var on = state.diff === d.key;
      html += '<button type="button" class="qz-diff' + (on ? ' active' : '') +
        '" data-act="diff" data-diff="' + d.key + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="qz-diff-top"><span class="qz-diff-emoji" aria-hidden="true">' + d.emoji + '</span>' +
        '<span class="qz-diff-name">' + d.name + '</span></span>' +
        '<span class="qz-diff-desc">' + d.desc + '</span>' +
        '<span class="qz-diff-count">' + poolOf(d.key).length + ' 题可选</span>' +
        '</button>';
    });
    html += '</div>';
    html += '<div class="qz-start-row">' +
      '<button type="button" class="cl-btn cl-btn-primary qz-start-btn" data-act="start">开始挑战 · ' +
      sel.name + ' ' + sel.emoji + '</button></div>';
    html += '<div class="cl-note warn qz-hint"><span class="note-icon">💡</span>' +
      '<span>本轮全部按 <b>π = 3.14</b> 计算，结果保留两位小数；填空题可以填 15.7 或 15.70，误差 ±0.01 都算对。</span></div>';
    html += '</section>';

    html += '<section class="cl-card qz-card">';
    html += '<div class="cl-card-head"><h3>📋 闯关规则</h3>' +
      '<span class="cl-card-sub">看懂规则再开始，更稳！</span></div>';
    html += '<ol class="qz-rules">' +
      '<li>每轮 <b>10 道题</b>，从 8 个知识点中随机抽取，顶部有进度条和题号。</li>' +
      '<li>选好答案或填好数字后点「<b>确认答案</b>」，马上告诉你对错，并给出<b>分步讲解</b>。</li>' +
      '<li>答对 <b>≥90%</b> 得三星，<b>≥70%</b> 得二星，其余一星；结束后有错题回顾。</li>' +
      '<li>最好成绩会自动保存在这台电脑上，随时回来挑战新纪录。</li>' +
      '</ol>';
    html += '</section>';
    html += '</div>';

    /* 侧栏：最好成绩 + 覆盖面 */
    html += '<aside class="qz-side">';
    html += '<section class="cl-card qz-card">';
    html += '<div class="cl-card-head"><div><h3>🏅 最好成绩</h3>' +
      '<p class="cl-card-sub">只保存在本机，不会上传</p></div></div>';
    html += '<div class="qz-best-list">';
    DIFFS.forEach(function (d) {
      var rec = best[d.key];
      html += '<div class="qz-best-row">' +
        '<span class="qz-best-name">' + d.emoji + ' ' + d.name + '</span>' +
        (rec
          ? '<span class="qz-best-score"><span class="qz-best-stars" aria-label="' + rec.stars +
            ' 颗星">' + starsHTML(rec.stars) + '</span><b class="qz-best-pct">' + rec.pct + '%</b></span>'
          : '<span class="qz-best-empty">还没有记录</span>') +
        '</div>';
    });
    html += '</div>';
    if (stats.rounds > 0) {
      html += '<div class="cl-divider"></div>' +
        '<p class="qz-stats-line">已经闯关 <b>' + stats.rounds + '</b> 次，累计答对 <b>' +
        stats.correct + '</b> 题</p>';
    }
    html += '</section>';

    html += '<section class="cl-card qz-card">';
    html += '<div class="cl-card-head"><h3>📚 题库覆盖面</h3></div>';
    html += '<div class="qz-kp-chips">';
    Object.keys(KPS).forEach(function (key) {
      var count = BANK.filter(function (q) {
        return q.kp === key;
      }).length;
      html += '<span class="cl-chip cl-chip-' + KPS[key].color + '">' +
        KPS[key].name + ' · ' + count + ' 题</span>';
    });
    html += '</div>';
    html += '<p class="qz-tip">单选、判断、填空三种题型都会考到，每道题都有分步讲解。</p>';
    html += '</section>';
    html += '</aside>';

    html += '</div></div>';
    dom.stage.innerHTML = html;
  }

  /* ---------------- 答题页 ---------------- */

  function currentQ() {
    return state.queue[state.index] || null;
  }

  function renderAnswerArea(q) {
    var html = '';
    if (q.type === 'single') {
      html += '<div class="qz-options" role="group" aria-label="答案选项">';
      state.optionOrder.forEach(function (opt, i) {
        html += '<button type="button" class="qz-opt" data-act="pick" data-i="' + i +
          '" aria-pressed="false">' +
          '<span class="qz-opt-key" aria-hidden="true">' + LETTERS[i] + '</span>' +
          '<span class="qz-opt-text">' + opt.text + '</span>' +
          '<span class="qz-opt-mark" aria-hidden="true"></span></button>';
      });
      html += '</div>';
    } else if (q.type === 'judge') {
      html += '<div class="qz-judge" role="group" aria-label="判断对错">' +
        '<button type="button" class="qz-judge-btn" data-act="pick" data-v="true" aria-pressed="false">' +
        '<span aria-hidden="true">✓</span> 正确</button>' +
        '<button type="button" class="qz-judge-btn" data-act="pick" data-v="false" aria-pressed="false">' +
        '<span aria-hidden="true">✗</span> 错误</button>' +
        '</div>';
    } else {
      html += '<div class="qz-fill">' +
        '<input type="text" class="cl-input qz-fill-input" id="qz-fill-input" inputmode="decimal" ' +
        'autocomplete="off" placeholder="输入数字" aria-label="输入答案">' +
        (q.unit ? '<span class="qz-fill-unit">' + q.unit + '</span>' : '') +
        '</div>';
      html += '<p class="qz-fill-hint">' +
        (q.unit ? '只填数字，单位已经写好啦；' : '') +
        '结果保留两位小数，误差在 ±0.01 以内都算对。</p>';
    }
    return html;
  }

  function renderQuestion() {
    var q = currentQ();
    if (!q) return;
    var total = state.queue.length;
    var index = state.index;
    var diff = getDiff(state.diff);
    var filled = Math.round(((index + 1) / total) * 100);
    state.optionOrder = q.type === 'single' ? CL.shuffle(q.options) : null;

    var html = '<div class="qz-play">';
    html += '<div class="qz-play-top">';
    html += '<div class="qz-play-meta">' +
      '<span class="cl-chip cl-chip-blue">第 ' + (index + 1) + ' / ' + total + ' 题</span>' +
      '<span class="cl-chip">' + diff.emoji + ' ' + diff.name + '</span>' +
      '<span class="cl-chip cl-chip-green qz-score-chip">答对 ' + state.correctCount + ' 题</span>' +
      '<button type="button" class="cl-btn cl-btn-ghost cl-btn-sm qz-quit" data-act="quit">退出挑战</button>' +
      '</div>';
    html += '<div class="qz-progress-line">' +
      '<div class="cl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total +
      '" aria-valuenow="' + (index + 1) + '"><i style="width:' + filled + '%"></i></div>' +
      '<span class="qz-progress-num">' + filled + '%</span></div>';
    html += '</div>';

    html += '<section class="cl-card qz-card qz-question" data-qid="' + q.id + '" data-type="' + q.type + '">';
    html += '<div class="qz-q-head">' +
      '<span class="cl-chip cl-chip-' + KPS[q.kp].color + '">' + KPS[q.kp].name + '</span>' +
      '<span class="cl-chip">' + typeName(q.type) + '</span>' +
      (q.diff === 'hard' ? '<span class="cl-chip cl-chip-red">挑战</span>' : '') +
      '</div>';
    html += '<h3 class="qz-q-prompt">' + q.prompt + '</h3>';
    if (q.figure) {
      html += '<figure class="qz-figure">' + q.figure +
        (q.figureNote ? '<figcaption>' + q.figureNote + '</figcaption>' : '') +
        '</figure>';
    }
    html += renderAnswerArea(q);
    html += '<div class="qz-feedback-slot" aria-live="polite"></div>';
    html += '<div class="qz-explain-slot"></div>';
    html += '<div class="qz-actions">' +
      '<button type="button" class="cl-btn cl-btn-primary qz-confirm" data-act="confirm" disabled>确认答案</button>' +
      '<button type="button" class="cl-btn cl-btn-green qz-next" data-act="next" hidden>' +
      (index + 1 >= total ? '查看成绩 🏆' : '下一题 →') + '</button>' +
      '</div>';
    html += '</section></div>';

    dom.stage.innerHTML = html;

    if (q.type === 'fill') {
      var input = dom.stage.querySelector('.qz-fill-input');
      if (input) {
        state.fillValue = '';
        input.addEventListener('input', function () {
          state.fillValue = input.value;
          syncConfirm();
        });
        if (window.matchMedia && window.matchMedia('(min-width: 760px)').matches) {
          try {
            input.focus({ preventScroll: true });
          } catch (e) {
            input.focus();
          }
        }
      }
    }
  }

  /* ---------------- 结算页 ---------------- */

  function renderResult(total, score, pct, stars, isRecord) {
    var wrong = state.answers.filter(function (a) {
      return !a.ok;
    });
    var title = stars === 3 ? '太棒了，三星通关！'
      : stars === 2 ? '很不错，二星通过！'
        : '完成挑战，继续加油！';
    var sub = stars === 3 ? '圆的 8 个知识点你已经掌握得很牢固，可以挑战更高难度啦。'
      : stars === 2 ? '把错题讲解看一遍，弄懂为什么错，下次就能拿三星。'
        : '先看看下面的错题讲解，理解了再测一次，进步会很快。';

    var html = '<div class="qz-result">';
    html += '<section class="cl-card qz-card qz-score-card">';
    html += '<div class="qz-stars" aria-label="获得 ' + stars + ' 颗星">' + starsHTML(stars) + '</div>';
    html += '<div class="qz-score-pct">' + pct + '<small>%</small></div>';
    html += '<h3 class="qz-score-title">' + title + '</h3>';
    html += '<p class="qz-score-sub">' + sub + '</p>';
    if (isRecord) {
      html += '<span class="qz-new-record">🎉 新纪录！</span>';
    }
    var points = Math.round((score / total) * 100);
    html += '<div class="cl-stat-grid qz-result-stats">' +
      statCell('得分', points + ' 分', 'amber') +
      statCell('答对', score + ' 题', 'green') +
      statCell('答错', (total - score) + ' 题', 'pink') +
      statCell('正确率', pct + '%', '') +
      '</div>';
    html += '<div class="cl-btn-row qz-result-actions">' +
      '<button type="button" class="cl-btn cl-btn-primary" data-act="retry">再测一次 🔁</button>' +
      '<button type="button" class="cl-btn" data-act="home">换个难度</button>' +
      '</div>';
    html += '</section>';

    html += '<section class="cl-card qz-card">';
    html += '<div class="cl-card-head"><div><h3>📝 错题回顾</h3>' +
      '<p class="cl-card-sub">' +
      (wrong.length ? '共 ' + wrong.length + ' 题，点开看看每一步怎么算' : '全部答对，太厉害了！') +
      '</p></div></div>';
    if (!wrong.length) {
      html += '<div class="cl-note good"><span class="note-icon">🌟</span>' +
        '<span>这一轮没有错题！可以去挑战更高难度，或者再测一次冲击满分。</span></div>';
    } else {
      html += '<div class="qz-review">';
      wrong.forEach(function (a) {
        var q = a.q;
        var qIndex = state.answers.indexOf(a) + 1;
        html += '<article class="qz-review-item">' +
          '<div class="qz-review-head">' +
          '<span class="cl-chip cl-chip-' + KPS[q.kp].color + '">' + KPS[q.kp].name + '</span>' +
          '<span class="cl-chip">第 ' + qIndex + ' 题 · ' + typeName(q.type) + '</span>' +
          '</div>' +
          '<p class="qz-review-q">' + q.prompt + '</p>' +
          '<div class="qz-review-ans">' +
          '<span class="bad">你的答案：' + a.given + '</span>' +
          '<span class="ok">正确答案：' + answerText(q) + '</span>' +
          '</div>' +
          '<details class="qz-review-detail"><summary>查看分步讲解</summary>' +
          '<ol class="qz-steps">' + q.explain.map(function (step) {
            return '<li>' + step + '</li>';
          }).join('') + '</ol></details>' +
          '</article>';
      });
      html += '</div>';
    }
    html += '</section></div>';

    dom.stage.innerHTML = html;
  }

  /* =======================================================
     七、答题逻辑
     ======================================================= */

  function answerText(q) {
    if (q.type === 'single') {
      var opt = q.options.filter(function (o) {
        return o.ok;
      })[0];
      return opt ? opt.text : '';
    }
    if (q.type === 'judge') return q.answer ? '正确' : '错误';
    return withUnit(q.answer, q.unit);
  }

  /** 把全角数字、中文句号等归一化，方便孩子输入 */
  function normalizeNumber(text) {
    if (text == null) return null;
    var s = String(text).trim();
    if (!s) return null;
    s = s.replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).replace(/[．。]/g, '.').replace(/[－−]/g, '-').replace(/\s+/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function canConfirm(q) {
    if (!q) return false;
    if (q.type === 'fill') return normalizeNumber(state.fillValue) !== null;
    if (q.type === 'judge') return state.picked === true || state.picked === false;
    return state.picked != null;
  }

  function syncConfirm() {
    var q = currentQ();
    var btn = dom.stage.querySelector('[data-act="confirm"]');
    if (btn && q) btn.disabled = !canConfirm(q);
  }

  function isCorrect(q) {
    if (q.type === 'fill') {
      var v = normalizeNumber(state.fillValue);
      if (v === null) return false;
      return Math.abs(v - q.answer) <= (q.tolerance || 0.01) + 1e-9;
    }
    if (q.type === 'judge') return state.picked === q.answer;
    var opt = state.optionOrder ? state.optionOrder[state.picked] : null;
    return !!(opt && opt.ok);
  }

  function givenText(q) {
    if (q.type === 'fill') {
      var v = normalizeNumber(state.fillValue);
      return v === null ? '（没有填写）' : withUnit(v, q.unit);
    }
    if (q.type === 'judge') return state.picked === true ? '正确' : '错误';
    var opt = state.optionOrder ? state.optionOrder[state.picked] : null;
    return opt ? opt.text : '（没有选择）';
  }

  function handlePick(btn) {
    if (state.confirmed || !btn) return;
    var q = currentQ();
    if (!q) return;
    if (q.type === 'judge') {
      var value = btn.getAttribute('data-v') === 'true';
      state.picked = value;
      CL.sound.tick();
      CL.dom.$$('.qz-judge-btn', dom.stage).forEach(function (b) {
        var on = (b.getAttribute('data-v') === 'true') === value;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    } else if (q.type === 'single') {
      var i = Number(btn.getAttribute('data-i'));
      state.picked = i;
      CL.sound.tick();
      CL.dom.$$('.qz-opt', dom.stage).forEach(function (b) {
        var on = Number(b.getAttribute('data-i')) === i;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    syncConfirm();
  }

  function paintAnswerState(q, ok) {
    if (q.type === 'single') {
      var opts = CL.dom.$$('.qz-opt', dom.stage);
      opts.forEach(function (btn, i) {
        var opt = state.optionOrder[i];
        btn.disabled = true;
        btn.classList.remove('selected');
        var mark = btn.querySelector('.qz-opt-mark');
        if (opt && opt.ok) {
          btn.classList.add('correct');
          if (mark) mark.textContent = '✓';
        } else if (i === state.picked) {
          btn.classList.add('wrong');
          if (mark) mark.textContent = '✗';
        }
      });
    } else if (q.type === 'judge') {
      CL.dom.$$('.qz-judge-btn', dom.stage).forEach(function (btn) {
        var value = btn.getAttribute('data-v') === 'true';
        btn.disabled = true;
        btn.classList.remove('selected');
        if (value === q.answer) btn.classList.add('correct');
        else if (value === state.picked) btn.classList.add('wrong');
      });
    } else {
      var input = dom.stage.querySelector('.qz-fill-input');
      if (input) {
        input.disabled = true;
        input.classList.add(ok ? 'correct' : 'wrong');
      }
    }

    var confirmBtn = dom.stage.querySelector('[data-act="confirm"]');
    if (confirmBtn) confirmBtn.hidden = true;
    var nextBtn = dom.stage.querySelector('[data-act="next"]');
    if (nextBtn) nextBtn.hidden = false;

    var scoreChip = dom.stage.querySelector('.qz-score-chip');
    if (scoreChip) scoreChip.textContent = '答对 ' + state.correctCount + ' 题';
  }

  function paintFeedback(q, ok) {
    var slot = dom.stage.querySelector('.qz-feedback-slot');
    var explainSlot = dom.stage.querySelector('.qz-explain-slot');
    if (!slot || !explainSlot) return;

    var icon = ok ? '🎉' : '😊';
    var title = ok ? '答对啦！' : '再想想～';
    var detail = ok ? '这一步很稳，继续保持！'
      : '正确答案：<b>' + answerText(q) + '</b>';
    slot.innerHTML = '<div class="cl-result ' + (ok ? 'good' : 'bad') + ' qz-feedback">' +
      '<span class="qz-feedback-icon" aria-hidden="true">' + icon + '</span>' +
      '<span><b>' + title + '</b> ' + detail + '</span></div>';

    var steps = q.explain.map(function (step) {
      return '<li>' + step + '</li>';
    }).join('');
    explainSlot.innerHTML = '<div class="qz-explain">' +
      '<div class="qz-explain-title"><span aria-hidden="true">📝</span> 分步讲解</div>' +
      '<ol class="qz-steps">' + steps + '</ol></div>';
  }

  function startRound(key) {
    state.diff = key;
    state.queue = drawQuestions(key);
    state.index = 0;
    state.correctCount = 0;
    state.confirmed = false;
    state.picked = null;
    state.fillValue = '';
    state.answers = [];
    state.optionOrder = null;
    state.screen = 'playing';
    CL.sound.click();
    renderQuestion();
  }

  function confirmAnswer() {
    if (state.confirmed) return;
    var q = currentQ();
    if (!q) return;
    if (!canConfirm(q)) {
      CL.ui.toast('先选好答案，或者填上数字，再点确认哦～', 'warn');
      return;
    }
    var ok = isCorrect(q);
    state.confirmed = true;
    if (ok) {
      state.correctCount += 1;
      CL.sound.correct();
      CL.ui.confetti({ count: 26 });
    } else {
      CL.sound.wrong();
    }
    state.answers.push({ q: q, ok: ok, given: givenText(q) });
    paintAnswerState(q, ok);
    paintFeedback(q, ok);
  }

  function nextQuestion() {
    if (!state.confirmed) return;
    CL.sound.click();
    state.index += 1;
    state.confirmed = false;
    state.picked = null;
    state.fillValue = '';
    if (state.index >= state.queue.length) {
      finishRound();
    } else {
      renderQuestion();
    }
  }

  function finishRound() {
    state.screen = 'result';
    var total = state.queue.length;
    var score = state.correctCount;
    var pct = Math.round((score / total) * 100);
    var stars = pct >= 90 ? 3 : (pct >= 70 ? 2 : 1);

    var best = loadBest();
    var prev = best[state.diff];
    var isRecord = !prev || pct > prev.pct;
    if (isRecord) {
      best[state.diff] = {
        pct: pct, stars: stars, score: score, total: total, at: Date.now()
      };
      saveBest(best);
    }

    var stats = loadStats();
    stats.rounds += 1;
    stats.correct += score;
    stats.questions += total;
    CL.store.set(STATS_KEY, stats);

    renderResult(total, score, pct, stars, isRecord);

    if (stars === 3) {
      state.resultTimer = window.setTimeout(function () {
        CL.ui.celebrate();
      }, 280);
    } else {
      CL.sound.win();
    }
  }

  /* =======================================================
     八、事件与生命周期
     ======================================================= */

  function onStageClick(event) {
    var target = event.target;
    var btn = target && target.closest ? target.closest('[data-act]') : null;
    if (!btn || !dom.stage.contains(btn)) return;
    var act = btn.getAttribute('data-act');

    if (act === 'diff') {
      var key = btn.getAttribute('data-diff');
      if (!key || key === state.diff) return;
      state.diff = key;
      CL.sound.tick();
      renderHome();
      return;
    }
    if (act === 'start') {
      startRound(state.diff);
      return;
    }
    if (act === 'pick') {
      handlePick(btn);
      return;
    }
    if (act === 'confirm') {
      confirmAnswer();
      return;
    }
    if (act === 'next') {
      nextQuestion();
      return;
    }
    if (act === 'retry') {
      startRound(state.diff);
      return;
    }
    if (act === 'home') {
      renderHome();
      return;
    }
    if (act === 'quit') {
      state.queue = [];
      state.answers = [];
      state.screen = 'home';
      renderHome();
      CL.ui.toast('已退出本次挑战，随时可以再来！', 'info');
    }
  }

  function onKeyDown(event) {
    if (state.screen !== 'playing') return;
    var q = currentQ();
    if (!q) return;

    if (event.key === 'Enter') {
      if (!state.confirmed) {
        if (canConfirm(q)) {
          event.preventDefault();
          confirmAnswer();
        }
      } else {
        event.preventDefault();
        nextQuestion();
      }
      return;
    }

    if (!state.confirmed && q.type === 'single' && /^[1-4]$/.test(event.key)) {
      var index = Number(event.key) - 1;
      var buttons = CL.dom.$$('.qz-opt', dom.stage);
      if (buttons[index]) handlePick(buttons[index]);
    }
  }

  function bindKeys() {
    if (keysBound) return;
    document.addEventListener('keydown', onKeyDown);
    keysBound = true;
  }

  function unbindKeys() {
    if (!keysBound) return;
    document.removeEventListener('keydown', onKeyDown);
    keysBound = false;
  }

  function build(root) {
    CL.dom.clear(root);
    var wrap = CL.dom.el('div', 'qz-wrap');
    var head = CL.dom.el('div', 'cl-mode-head');
    head.innerHTML = '<div><h2><span class="head-emoji" aria-hidden="true">🏆</span>测试闯关</h2>' +
      '<p>每次 10 道题，覆盖圆的 8 个知识点。确认后马上知道对错和分步讲解，最后看看你能拿几颗星！</p></div>' +
      '<span class="cl-head-chip">📚 题库 ' + BANK.length + ' 题 · π 取 3.14</span>';
    wrap.appendChild(head);

    dom.stage = CL.dom.el('div', 'qz-stage');
    wrap.appendChild(dom.stage);
    root.appendChild(wrap);

    dom.stage.addEventListener('click', onStageClick);
    renderHome();
  }

  CL.registerMode('quiz', function (root) {
    build(root);
    return {
      start: function () {
        bindKeys();
        if (startedOnce && state.screen === 'home') renderHome();
        startedOnce = true;
      },
      stop: function () {
        unbindKeys();
        if (state.resultTimer) {
          window.clearTimeout(state.resultTimer);
          state.resultTimer = 0;
        }
      }
    };
  });

  /* 供 Node 自检脚本读取题库并模拟抽题（不属于页面 UI） */
  if (CL.parts) {
    CL.parts.quiz = {
      bank: BANK,
      kps: KPS,
      diffs: DIFFS,
      roundLen: ROUND_LEN,
      draw: drawQuestions,
      poolOf: poolOf,
      answerText: answerText
    };
  }
})();
