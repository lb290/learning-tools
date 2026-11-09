/* =========================================================
   小学生时钟乐园 · 交互逻辑
   ========================================================= */
(function () {
  'use strict';

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  const pad2 = function (n) { return String(n).padStart(2, '0'); };
  const randInt = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };
  const clampInt = function (value, min, max) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return 0;
    return Math.max(min, Math.min(max, n));
  };
  const shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };
  const pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  const QUIZ_LEN = 6;
  // 拨钟题一开始停在 9:20，三根指针互不重叠，方便孩子抓取
  const START_SET = { h: 9, m: 20, s: 0 };

  const state = {
    mode: 'live',
    liveRaf: 0,
    lastReadKey: '',
    time: { h: 8, m: 0, s: 0 },
    selectedHand: 'minute',
    display: { minuteNumbers: true, handLabels: true, h24: true },
    quiz: null,
    demo: null
  };

  const clock = new window.AnalogClock($('#clock'), {
    showMinuteNumbers: true,
    showHandLabels: true,
    interactive: false
  });

  /* ---------------- 基础工具 ---------------- */
  function nowTime() {
    const d = new Date();
    return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds() };
  }

  function timeFromSeconds(seconds) {
    const day = ((seconds % 86400) + 86400) % 86400;
    return {
      h: Math.floor(day / 3600),
      m: Math.floor((day % 3600) / 60),
      s: Math.floor(day % 60),
      ms: Math.round((day - Math.floor(day)) * 1000)
    };
  }

  function secondsOf(t) {
    return t.h * 3600 + t.m * 60 + t.s;
  }

  function displayHour(h) {
    const v = h % 12;
    return v === 0 ? 12 : v;
  }

  function label12(n) {
    const v = n % 12;
    return v === 0 ? 12 : v;
  }

  function periodOf(h) {
    if (h < 6) return '凌晨';
    if (h < 9) return '早上';
    if (h < 12) return '上午';
    if (h === 12) return '中午';
    if (h < 18) return '下午';
    if (h < 19) return '傍晚';
    return '晚上';
  }

  /** 数字钟文本，如 08:05:30 / 8:05:30 */
  function formatClockText(t, withSeconds) {
    const h = state.display.h24 ? pad2(t.h) : String(displayHour(t.h));
    const m = pad2(t.m);
    const s = pad2(t.s);
    if (withSeconds === false) return h + ':' + m;
    return h + ':' + m + ':' + s;
  }

  /** 中文读法，如“上午 8 时零 5 分 30 秒” */
  function formatReading(t) {
    let text;
    if (state.display.h24) {
      text = t.h + ' 时';
    } else {
      text = periodOf(t.h) + ' ' + displayHour(t.h) + ' 时';
    }
    const hasMinute = t.m > 0 || t.s > 0;
    if (hasMinute) {
      text += (t.m > 0 && t.m < 10 ? '零 ' : ' ') + t.m + ' 分';
    }
    if (t.s > 0) {
      text += ' ' + t.s + ' 秒';
    }
    if (!hasMinute && t.s === 0) text += '整';
    return text;
  }

  function hourInfoText(t) {
    const hourFloat = (t.h % 12) + t.m / 60 + t.s / 3600;
    const hFloor = Math.floor(hourFloat) % 12;
    const hNext = (hFloor + 1) % 12;
    const frac = hourFloat - Math.floor(hourFloat);
    if (t.m === 0 && t.s === 0) {
      return '正指向 ' + label12(hFloor) + '，表示 ' + label12(hFloor) + ' 时。';
    }
    const near = frac < 0.5 ? hFloor : hNext;
    return (
      '指在 ' + label12(hFloor) + ' 和 ' + label12(hNext) + ' 之间，' +
      '更靠近 ' + label12(near) + '，表示 ' + label12(hFloor) + ' 时多。'
    );
  }

  function minuteInfoText(t) {
    if (t.s === 0 && t.m % 5 === 0) {
      return '正指向 ' + label12(t.m / 5) + '，表示 ' + t.m + ' 分' + (t.m === 0 ? '（整时）' : '') + '。';
    }
    const lower = Math.floor(t.m / 5);
    const p1 = label12(lower);
    const p2 = label12(lower + 1);
    let text = '指在 ' + p1 + ' 和 ' + p2 + ' 之间，表示 ' + t.m + ' 分';
    if (t.s > 0) text += ' ' + t.s + ' 秒';
    return text + '。';
  }

  function secondInfoText(t) {
    if (t.s === 0) return '正指向 12，表示 0 秒，又要开始新的一圈啦。';
    if (t.s % 5 === 0) return '正指向 ' + label12(t.s / 5) + '，表示 ' + t.s + ' 秒。';
    const lower = Math.floor(t.s / 5);
    return '指在 ' + label12(lower) + ' 和 ' + label12(lower + 1) + ' 之间，表示 ' + t.s + ' 秒。';
  }

  /* ---------------- 界面刷新 ---------------- */
  function updateReadouts(t, live) {
    const key = t.h * 3600 + t.m * 60 + t.s;
    if (live && state.lastReadKey === key) return;
    state.lastReadKey = key;

    $('#dHour').textContent = state.display.h24 ? pad2(t.h) : String(displayHour(t.h));
    $('#dMin').textContent = pad2(t.m);
    $('#dSec').textContent = pad2(t.s);
    $('#periodBadge').textContent = periodOf(t.h);
    $('#reading').textContent = formatReading(t);

    $('#hourInfo').textContent = hourInfoText(t);
    $('#minuteInfo').textContent = minuteInfoText(t);
    $('#secondInfo').textContent = secondInfoText(t);
  }

  function updateSetReadout(t) {
    const el = $('#setReadout');
    if (!el) return;
    el.innerHTML = '现在拨到：<strong>' + formatClockText(t) + '</strong> · ' + formatReading(t);
  }

  function updateQuizSetReadout() {
    const el = $('#quizSetReadout');
    if (!el) return;
    const t = state.time;
    el.textContent = '现在钟面上是：' + formatReading(t);
  }

  function updateToday() {
    const el = $('#todayText');
    if (!el) return;
    try {
      el.textContent = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      }).format(new Date());
    } catch (err) {
      el.textContent = new Date().toLocaleDateString();
    }
  }

  function applyTime(t) {
    const nt = { h: t.h, m: t.m, s: t.s };
    state.time = nt;
    clock.render(nt);
    updateReadouts(nt, false);
    updateSetReadout(nt);
    updateQuizSetReadout();
  }

  clock.onTimeChange = function (t) {
    state.time = { h: t.h, m: t.m, s: t.s };
    updateReadouts(t, false);
    updateSetReadout(t);
    updateQuizSetReadout();
  };

  /* ---------------- 模式切换 ---------------- */
  function setMode(mode) {
    if (state.mode === mode) {
      if (mode === 'quiz') startQuiz();
      return;
    }
    cancelDemo();
    clock.highlightHand(null);
    state.mode = mode;
    document.body.classList.remove('mode-live', 'mode-set', 'mode-quiz');
    document.body.classList.add('mode-' + mode);
    $$('.mode-switch button').forEach(function (btn) {
      const active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    clock.setSecondVisible(true);

    if (mode === 'live') {
      clock.setInteractive(false);
      state.time = nowTime();
      startLiveLoop();
    } else {
      stopLiveLoop();
    }

    if (mode === 'set') {
      state.time = { h: state.time.h, m: state.time.m, s: state.time.s };
      clock.setInteractive(true);
      clock.render(state.time);
      clock.setActiveHand(state.selectedHand);
      updateReadouts(state.time, false);
      updateSetReadout(state.time);
      rebuildFineTune();
      updateSetTip();
    }

    if (mode === 'quiz') {
      startQuiz();
    }
  }

  /* ---------------- 实时走时 ---------------- */
  function startLiveLoop() {
    stopLiveLoop();
    state.lastReadKey = '';
    const loop = function () {
      if (state.mode !== 'live') return;
      const t = nowTime();
      state.time = t;
      clock.render(t);
      updateReadouts(t, true);
      state.liveRaf = requestAnimationFrame(loop);
    };
    state.liveRaf = requestAnimationFrame(loop);
  }

  function stopLiveLoop() {
    if (state.liveRaf) cancelAnimationFrame(state.liveRaf);
    state.liveRaf = 0;
  }

  /* ---------------- 动手拨钟 ---------------- */
  const FINE_STEPS = {
    hour: [{ delta: -1, unit: 'hour', text: '− 1 时' }, { delta: 1, unit: 'hour', text: '+ 1 时' }],
    minute: [
      { delta: -5, unit: 'minute', text: '− 5 分' },
      { delta: -1, unit: 'minute', text: '− 1 分' },
      { delta: 1, unit: 'minute', text: '+ 1 分' },
      { delta: 5, unit: 'minute', text: '+ 5 分' }
    ],
    second: [
      { delta: -5, unit: 'second', text: '− 5 秒' },
      { delta: -1, unit: 'second', text: '− 1 秒' },
      { delta: 1, unit: 'second', text: '+ 1 秒' },
      { delta: 5, unit: 'second', text: '+ 5 秒' }
    ]
  };

  const HAND_TIPS = {
    hour: '时针走 1 大格 = 1 小时；走 1 圈 = 12 小时。',
    minute: '分针走 1 小格 = 1 分钟；走 1 圈 = 60 分钟 = 1 小时。',
    second: '秒针走 1 小格 = 1 秒；走 1 圈 = 60 秒 = 1 分钟。'
  };

  function rebuildFineTune() {
    const wrap = $('#fineTune');
    if (!wrap) return;
    wrap.innerHTML = '';
    const steps = FINE_STEPS[state.selectedHand];
    steps.forEach(function (step) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-tune';
      btn.textContent = step.text;
      btn.addEventListener('click', function () {
        let seconds = secondsOf(state.time);
        if (step.unit === 'hour') seconds += step.delta * 3600;
        else if (step.unit === 'minute') seconds += step.delta * 60;
        else seconds += step.delta;
        applyTime(timeFromSeconds(seconds));
      });
      wrap.appendChild(btn);
    });
  }

  function updateSetTip() {
    const el = $('#setTip');
    if (el) el.textContent = HAND_TIPS[state.selectedHand];
  }

  function selectHand(hand) {
    state.selectedHand = hand;
    $$('.hand-chip').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-hand') === hand);
    });
    clock.setActiveHand(hand);
    rebuildFineTune();
    updateSetTip();
  }

  /* ---------------- 练习 ---------------- */
  function makeReadQuestion() {
    const h = randInt(1, 12);
    const m = randInt(0, 11) * 5;
    const correct = h + ':' + pad2(m);
    const distractors = [
      label12(h % 12 + 1) + ':' + pad2(m),
      h + ':' + pad2((m + 5) % 60),
      label12(h % 12 + 1) + ':' + pad2((m + 55) % 60)
    ];
    const labels = shuffle([correct].concat(distractors));
    const hourPart = m === 0 ? '时针指向 ' + h + '，' : '时针刚过 ' + h + '，';
    const minutePart = m === 0
      ? '分针指向 12，正好是整时，'
      : '分针指向 ' + label12(m / 5) + '，表示 ' + m + ' 分，';
    return {
      type: 'read',
      time: { h: h, m: m, s: 0 },
      prompt: '钟面上显示的是几时几分？',
      options: labels.map(function (label) { return { label: label, correct: label === correct }; }),
      explain: hourPart + minutePart + '所以是 ' + h + ' 时' + (m === 0 ? '整。' : ' ' + m + ' 分。')
    };
  }

  function makeIdentifyQuestion() {
    const target = pick(['hour', 'minute', 'second']);
    const desc = {
      hour: '蓝色，又短又粗',
      minute: '绿色，比时针长',
      second: '红色，最细最长'
    };
    const promptMap = {
      hour: '哪一根是时针？',
      minute: '哪一根是分针？',
      second: '哪一根是秒针？'
    };
    const explainMap = {
      hour: '时针最短最粗，它指到几（或刚过几）就是几时。',
      minute: '分针比时针长，它走 1 小格是 1 分钟，走 1 圈是 60 分钟。',
      second: '秒针最细最长、跑得最快，它走 1 小格是 1 秒，走 1 圈是 60 秒。'
    };
    const options = shuffle(['hour', 'minute', 'second']).map(function (hand) {
      return { hand: hand, label: desc[hand], correct: hand === target };
    });
    return {
      type: 'identify',
      answerHand: target,
      prompt: promptMap[target],
      options: options,
      explain: explainMap[target]
    };
  }

  const CONVERT_POOL = [
    { q: '1 时 =（ ）分', a: '60 分', opts: ['60 分', '100 分', '30 分', '12 分'], e: '1 时 = 60 分，分针要走 1 圈。' },
    { q: '1 分 =（ ）秒', a: '60 秒', opts: ['60 秒', '100 秒', '30 秒', '24 秒'], e: '1 分 = 60 秒，秒针要走 1 圈。' },
    { q: '2 时 =（ ）分', a: '120 分', opts: ['120 分', '60 分', '200 分', '90 分'], e: '2 时 = 2 × 60 = 120 分。' },
    { q: '3 分 =（ ）秒', a: '180 秒', opts: ['180 秒', '60 秒', '300 秒', '90 秒'], e: '3 分 = 3 × 60 = 180 秒。' },
    { q: '半小时 =（ ）分', a: '30 分', opts: ['30 分', '60 分', '15 分', '50 分'], e: '1 时 = 60 分，一半就是 30 分。' },
    { q: '一刻钟 =（ ）分', a: '15 分', opts: ['15 分', '30 分', '10 分', '45 分'], e: '1 时 = 60 分，分成 4 份，每份是 15 分。' },
    { q: '120 分 =（ ）时', a: '2 时', opts: ['2 时', '12 时', '1 时', '20 时'], e: '120 ÷ 60 = 2，所以是 2 时。' },
    { q: '180 秒 =（ ）分', a: '3 分', opts: ['3 分', '18 分', '30 分', '1 分'], e: '180 ÷ 60 = 3，所以是 3 分。' },
    { q: '1 时 30 分 =（ ）分', a: '90 分', opts: ['90 分', '60 分', '130 分', '30 分'], e: '1 时 = 60 分，60 + 30 = 90 分。' },
    { q: '90 秒 =（ ）', a: '1 分 30 秒', opts: ['1 分 30 秒', '1 分 90 秒', '9 分', '3 分'], e: '90 秒 = 60 秒 + 30 秒 = 1 分 30 秒。' },
    { q: '1 天 =（ ）时', a: '24 时', opts: ['24 时', '12 时', '60 时', '10 时'], e: '1 天有 24 小时，时针要走 2 圈。' },
    { q: '2 时 15 分 =（ ）分', a: '135 分', opts: ['135 分', '215 分', '120 分', '75 分'], e: '2 时 = 120 分，120 + 15 = 135 分。' }
  ];

  function makeConvertQuestion() {
    const item = pick(CONVERT_POOL);
    return {
      type: 'convert',
      prompt: item.q,
      options: shuffle(item.opts).map(function (label) { return { label: label, correct: label === item.a }; }),
      explain: item.e
    };
  }

  function makeRelationQuestion() {
    const pool = [
      {
        q: '秒针走 1 圈，分针走多少？',
        a: '1 小格',
        opts: ['1 小格', '1 大格', '5 小格', '60 小格'],
        e: '秒针走 1 圈是 60 秒 = 1 分，分针正好走 1 小格。'
      },
      {
        q: '分针走 1 圈，时针走多少？',
        a: '1 大格',
        opts: ['1 小格', '1 大格', '12 大格', '5 小格'],
        e: '分针走 1 圈是 60 分 = 1 时，时针正好走 1 大格。'
      },
      {
        q: '分针走 1 大格，是多少分钟？',
        a: '5 分',
        opts: ['1 分', '5 分', '10 分', '60 分'],
        e: '分针走 1 大格 = 5 小格 = 5 分钟。'
      }
    ];
    const item = pick(pool);
    return {
      type: 'convert',
      prompt: item.q,
      options: shuffle(item.opts).map(function (label) { return { label: label, correct: label === item.a }; }),
      explain: item.e
    };
  }

  function makeSetQuestion() {
    let h = randInt(1, 12);
    let m = randInt(1, 11) * 5;
    while (h === START_SET.h && m === START_SET.m) {
      h = randInt(1, 12);
      m = randInt(1, 11) * 5;
    }
    return {
      type: 'set',
      time: { h: h, m: m, s: 0 },
      prompt: '请把钟拨到 ' + h + ':' + pad2(m),
      explain:
        '分针指向 ' + label12(m / 5) + ' 是 ' + m + ' 分，时针刚过 ' + h +
        '，所以是 ' + h + ' 时 ' + m + ' 分。'
    };
  }

  function buildQuizQuestions() {
    return [
      makeReadQuestion(),
      makeReadQuestion(),
      makeConvertQuestion(),
      makeIdentifyQuestion(),
      makeSetQuestion(),
      Math.random() < 0.5 ? makeConvertQuestion() : makeRelationQuestion()
    ];
  }

  function startQuiz() {
    clock.highlightHand(null);
    cancelDemo();
    stopLiveLoop();
    state.quiz = {
      questions: buildQuizQuestions(),
      idx: 0,
      score: 0,
      answered: false,
      attempts: 0,
      done: false
    };
    renderQuizQuestion();
  }

  function updateQuizHead() {
    const quiz = state.quiz;
    if (!quiz) return;
    $('#quizScore').textContent = String(quiz.score);
    const indexEl = $('#quizIndex');
    indexEl.textContent = quiz.done
      ? '本轮完成'
      : '第 ' + Math.min(quiz.idx + 1, QUIZ_LEN) + ' 题 / 共 ' + QUIZ_LEN + ' 题';
    const dots = $('#quizDots');
    dots.innerHTML = '';
    for (let i = 0; i < QUIZ_LEN; i++) {
      const dot = document.createElement('span');
      if (i < quiz.idx || (i === quiz.idx && quiz.answered)) dot.className = 'done';
      else if (i === quiz.idx && !quiz.done) dot.className = 'current';
      dots.appendChild(dot);
    }
  }

  function clearQuizChrome() {
    const feedback = $('#quizFeedback');
    feedback.hidden = true;
    feedback.className = 'quiz-feedback';
    feedback.innerHTML = '';
    $('#quizActions').innerHTML = '';
  }

  function showQuizFeedback(kind, title, text) {
    const el = $('#quizFeedback');
    el.hidden = false;
    el.className = 'quiz-feedback ' + (kind === 'ok' ? 'ok' : 'bad');
    el.innerHTML = '<b>' + title + '</b><span>' + text + '</span>';
  }

  function showNextButton() {
    const actions = $('#quizActions');
    actions.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.textContent = state.quiz.idx + 1 >= QUIZ_LEN ? '查看成绩 🏆' : '下一题 →';
    btn.addEventListener('click', nextQuestion);
    actions.appendChild(btn);
  }

  function renderOptions(container, options, custom) {
    const wrap = document.createElement('div');
    wrap.className = 'options';
    wrap.id = 'quizOptions';
    options.forEach(function (opt, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      if (custom === 'identify') {
        btn.innerHTML =
          '<span class="key">' + 'ABCD'[i] + '</span>' +
          '<span class="hand-swatch ' + opt.hand + '"><i></i></span>' +
          '<span class="option-text">' + opt.label + '</span>';
      } else {
        btn.innerHTML =
          '<span class="key">' + 'ABCD'[i] + '</span>' +
          '<span class="option-text">' + opt.label + '</span>';
      }
      btn.addEventListener('click', function () { chooseAnswer(i); });
      wrap.appendChild(btn);
    });
    container.appendChild(wrap);
  }

  function renderQuizQuestion() {
    const quiz = state.quiz;
    if (!quiz) return;
    const q = quiz.questions[quiz.idx];
    quiz.answered = false;
    quiz.attempts = 0;
    clearQuizChrome();
    updateQuizHead();
    clock.highlightHand(null);
    clock.setActiveHand(null);
    clock.setSecondVisible(true);

    const body = $('#quizBody');
    body.innerHTML = '';

    if (q.type === 'read') {
      clock.setInteractive(false);
      applyTime(q.time);
      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = q.prompt;
      body.appendChild(prompt);
      renderOptions(body, q.options);
      const tip = document.createElement('p');
      tip.className = 'quiz-tip';
      tip.textContent = '小提示：先看时针，再看分针。';
      body.appendChild(tip);
    } else if (q.type === 'identify') {
      clock.setInteractive(false);
      applyTime({ h: 10, m: 10, s: 25 });
      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = q.prompt;
      body.appendChild(prompt);
      renderOptions(body, q.options, 'identify');
      const tip = document.createElement('p');
      tip.className = 'quiz-tip';
      tip.textContent = '小提示：最短最粗、最长最细，颜色也不一样哦。';
      body.appendChild(tip);
    } else if (q.type === 'set') {
      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.innerHTML = '请把钟拨到 <span class="em">' + q.time.h + ':' + pad2(q.time.m) + '</span>';
      body.appendChild(prompt);
      const reminder = document.createElement('p');
      reminder.className = 'quiz-tip';
      reminder.textContent = '拖动钟面上的时针和分针，拨好以后点“检查一下”。';
      body.appendChild(reminder);
      const readout = document.createElement('div');
      readout.className = 'quiz-set-readout';
      readout.id = 'quizSetReadout';
      body.appendChild(readout);
      clock.setSecondVisible(false);
      applyTime(START_SET);
      clock.setInteractive(true);
      const actions = $('#quizActions');
      actions.innerHTML = '';
      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'btn btn-primary';
      checkBtn.id = 'checkSet';
      checkBtn.textContent = '检查一下';
      checkBtn.addEventListener('click', checkSetAnswer);
      actions.appendChild(checkBtn);
    } else {
      clock.setInteractive(false);
      const prompt = document.createElement('p');
      prompt.className = 'quiz-prompt';
      prompt.textContent = q.prompt;
      body.appendChild(prompt);
      renderOptions(body, q.options);
    }
  }

  function chooseAnswer(index) {
    const quiz = state.quiz;
    if (!quiz || quiz.answered) return;
    const q = quiz.questions[quiz.idx];
    if (q.type === 'set') return;
    quiz.answered = true;
    const correctIndex = q.options.findIndex(function (opt) { return opt.correct; });
    const buttons = $$('#quizOptions .option-btn');
    buttons.forEach(function (btn, i) {
      btn.disabled = true;
      if (i === correctIndex) btn.classList.add('correct');
      if (i === index && index !== correctIndex) btn.classList.add('wrong');
    });
    const right = index === correctIndex;
    if (right) quiz.score++;
    showQuizFeedback(
      right ? 'ok' : 'bad',
      right ? '🎉 答对啦！' : '再想想～',
      q.explain
    );
    if (q.type === 'identify' && q.answerHand) {
      clock.highlightHand(q.answerHand);
    }
    showNextButton();
    updateQuizHead();
  }

  function checkSetAnswer() {
    const quiz = state.quiz;
    if (!quiz || quiz.answered) return;
    const q = quiz.questions[quiz.idx];
    if (q.type !== 'set') return;

    const targetH12 = q.time.h % 12;
    const currentH12 = state.time.h % 12;
    const sameHour = targetH12 === currentH12;
    const sameMinute = Math.abs(state.time.m - q.time.m) <= 1;

    if (sameHour && sameMinute) {
      quiz.answered = true;
      quiz.score++;
      clock.setInteractive(false);
      showQuizFeedback('ok', '🎉 拨对啦！', q.explain);
      showNextButton();
      updateQuizHead();
      return;
    }

    quiz.attempts++;
    if (quiz.attempts >= 2) {
      quiz.answered = true;
      clock.setInteractive(false);
      applyTime(q.time);
      showQuizFeedback(
        'bad',
        '这次没拨对，正确答案是 ' + q.time.h + ':' + pad2(q.time.m) + '。',
        q.explain
      );
      showNextButton();
      updateQuizHead();
    } else {
      let hint = '再试一次！提示：';
      hint += q.time.m === 0
        ? '分针要指向 12，此时是整时；'
        : '分针指向 ' + label12(q.time.m / 5) + ' 就是 ' + q.time.m + ' 分；';
      hint += '时针要刚过 ' + q.time.h + '。';
      showQuizFeedback('bad', '还差一点点', hint);
      updateQuizHead();
    }
  }

  function nextQuestion() {
    const quiz = state.quiz;
    if (!quiz) return;
    quiz.idx++;
    quiz.answered = false;
    quiz.attempts = 0;
    if (quiz.idx >= QUIZ_LEN) {
      renderQuizResult();
    } else {
      renderQuizQuestion();
    }
  }

  function renderQuizResult() {
    const quiz = state.quiz;
    quiz.done = true;
    updateQuizHead();
    clock.setInteractive(false);
    clock.setSecondVisible(true);
    clock.highlightHand(null);
    applyTime({ h: 10, m: 10, s: 30 });

    const stars = quiz.score === QUIZ_LEN ? 3 : quiz.score >= 4 ? 2 : quiz.score >= 2 ? 1 : 0;
    const messages = [
      '别灰心，先去看看“指针的关系”，再来挑战一次吧！',
      '不错的开始！多练几轮，你会越来越快。',
      '很棒！再仔细一点就能全对啦。',
      '太厉害了，你就是时间小达人！'
    ];
    const emoji = stars === 3 ? '🏆' : stars === 0 ? '💪' : '🎉';

    const body = $('#quizBody');
    body.innerHTML =
      '<div class="quiz-result">' +
      '<div class="result-emoji">' + emoji + '</div>' +
      '<h3>答对 ' + quiz.score + ' / ' + QUIZ_LEN + ' 题</h3>' +
      '<div class="stars">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</div>' +
      '<p>' + messages[stars] + '</p>' +
      '</div>';
    const feedback = $('#quizFeedback');
    feedback.hidden = true;
    feedback.innerHTML = '';
    feedback.className = 'quiz-feedback';
    const actions = $('#quizActions');
    actions.innerHTML = '';
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn-primary';
    again.textContent = '再来一轮';
    again.addEventListener('click', startQuiz);
    actions.appendChild(again);
    const learnBtn = document.createElement('button');
    learnBtn.type = 'button';
    learnBtn.className = 'btn btn-ghost';
    learnBtn.textContent = '去小课堂看看';
    learnBtn.addEventListener('click', function () {
      switchLearnTab('relation');
      document.getElementById('learn').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    actions.appendChild(learnBtn);
  }

  /* ---------------- 教学演示 ---------------- */
  function runDemo(kind) {
    cancelDemo();
    if (state.mode !== 'set') setMode('set');
    if (state.mode !== 'set') return;

    const statusEl = $('#demoStatus');
    const buttons = $$('[data-demo]');
    buttons.forEach(function (btn) { btn.disabled = true; });
    clock.setInteractive(false);

    const startHour = 3;
    const from = startHour * 3600;
    const total = kind === 'second' ? 60 : 3600;
    const duration = kind === 'second' ? 4400 : 5600;
    const t0 = performance.now();
    state.demo = { raf: 0 };

    function frame(now) {
      const p = Math.min(1, (now - t0) / duration);
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const offset = total * eased;
      const t = timeFromSeconds(from + offset);
      clock.render(t);
      updateReadouts(t, false);
      updateSetReadout(t);
      state.time = { h: t.h, m: t.m, s: t.s };

      if (kind === 'second') {
        statusEl.textContent =
          '秒针走了 ' + Math.round(offset) + ' / 60 小格 · 分针前进了 ' + (offset / 60).toFixed(2) + ' / 1 小格';
      } else {
        statusEl.textContent =
          '分针走了 ' + Math.round(offset / 60) + ' / 60 小格 · 时针走了 ' + (offset / 3600).toFixed(2) + ' / 1 大格';
      }

      if (p < 1) {
        state.demo.raf = requestAnimationFrame(frame);
      } else {
        state.demo = null;
        buttons.forEach(function (btn) { btn.disabled = false; });
        const end = timeFromSeconds(from + total);
        state.time = { h: end.h, m: end.m, s: end.s };
        clock.render(end);
        clock.setInteractive(true);
        if (kind === 'second') {
          statusEl.textContent = '✅ 秒针走 1 圈 = 60 小格 = 60 秒 = 1 分，分针正好前进了 1 小格（1 分钟）。';
        } else {
          statusEl.textContent = '✅ 分针走 1 圈 = 60 小格 = 60 分 = 1 时，时针正好前进了 1 大格（1 小时）。';
        }
      }
    }

    statusEl.textContent = kind === 'second'
      ? '秒针开始转圈啦，盯住分针看看它有没有动……'
      : '分针开始转圈啦，盯住时针看看它走了几大格……';
    state.demo.raf = requestAnimationFrame(frame);
  }

  function cancelDemo() {
    if (!state.demo) return;
    cancelAnimationFrame(state.demo.raf);
    state.demo = null;
    $$('[data-demo]').forEach(function (btn) { btn.disabled = false; });
  }

  /* ---------------- 小课堂 ---------------- */
  function switchLearnTab(name) {
    $$('.learn-tab').forEach(function (btn) {
      const active = btn.getAttribute('data-tab') === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.learn-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.getAttribute('data-panel') === name);
    });
  }

  let toastTimer = 0;
  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
  }

  const HIGHLIGHT_TIPS = {
    hour: '看！蓝色又短又粗的，就是时针。它指到几，就是几时。',
    minute: '看！绿色、比时针长的，就是分针。它走 1 圈是 60 分钟。',
    second: '看！红色最细最长的，就是秒针。它跑得最快，1 圈是 60 秒。'
  };

  function highlightHand(hand) {
    clock.highlightHand(hand, 3200);
    showToast(HIGHLIGHT_TIPS[hand]);
  }

  /* ---------------- 进率换算器 ---------------- */
  function updateConverter() {
    const h = clampInt($('#cvH').value, 0, 99);
    const m = clampInt($('#cvM').value, 0, 99);
    const s = clampInt($('#cvS').value, 0, 99);
    const totalMinutes = h * 60 + m + s / 60;
    const totalSeconds = h * 3600 + m * 60 + s;
    const minutesText = Number.isInteger(totalMinutes) ? String(totalMinutes) : totalMinutes.toFixed(2);
    $('#cvResult').textContent =
      h + ' 时 ' + m + ' 分 ' + s + ' 秒 = ' + minutesText + ' 分 = ' + totalSeconds + ' 秒';
  }

  /* ---------------- 时间读写示例 ---------------- */
  const EXAMPLES = [
    { h: 8, m: 0, digital: '8:00', cn: '8 时整', note: '分针指 12' },
    { h: 8, m: 30, digital: '8:30', cn: '8 时 30 分（半时）', note: '分针指 6' },
    { h: 8, m: 5, digital: '8:05', cn: '8 时零 5 分', note: '分针指 1' },
    { h: 3, m: 45, digital: '3:45', cn: '3 时 45 分', note: '分针指 9' }
  ];

  function buildExamples() {
    const wrap = $('#timeExamples');
    if (!wrap) return;
    EXAMPLES.forEach(function (item) {
      const card = document.createElement('div');
      card.className = 'example-card';
      const clockEl = document.createElement('div');
      clockEl.className = 'mini-clock';
      card.appendChild(clockEl);
      const digital = document.createElement('div');
      digital.className = 'example-digital';
      digital.textContent = item.digital;
      card.appendChild(digital);
      const cn = document.createElement('div');
      cn.className = 'example-cn';
      cn.textContent = item.cn;
      card.appendChild(cn);
      const note = document.createElement('div');
      note.className = 'example-note';
      note.textContent = item.note;
      card.appendChild(note);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', '在钟面上看看 ' + item.digital + ' ' + item.cn);
      card.addEventListener('click', function () { showExampleOnClock(item); });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showExampleOnClock(item);
        }
      });
      wrap.appendChild(card);

      const mini = new window.AnalogClock(clockEl, {
        showMinuteNumbers: false,
        showHandLabels: false,
        interactive: false,
        mini: true
      });
      mini.render({ h: item.h, m: item.m, s: 0 });
    });
  }

  function showExampleOnClock(item) {
    setMode('set');
    applyTime({ h: item.h, m: item.m, s: 0 });
    const stage = document.querySelector('.clock-stage');
    if (stage && stage.scrollIntoView) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    showToast('钟面上是 ' + item.cn + '，看看三根针分别在哪里～');
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    // 顶部模式切换
    $$('.mode-switch button').forEach(function (btn) {
      btn.addEventListener('click', function () { setMode(btn.getAttribute('data-mode')); });
    });

    // 显示开关
    $$('.switch-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-toggle');
        const active = !btn.classList.contains('active');
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (key === 'h24') {
          state.display.h24 = active;
          updateReadouts(state.time, false);
          updateSetReadout(state.time);
          updateQuizSetReadout();
        } else if (key === 'minuteNumbers') {
          state.display.minuteNumbers = active;
          clock.setOptions({ showMinuteNumbers: active });
        } else if (key === 'handLabels') {
          state.display.handLabels = active;
          clock.setOptions({ showHandLabels: active });
        }
      });
    });

    // 看现在 → 动手拨
    $('#gotoSet').addEventListener('click', function () { setMode('set'); });

    // 指针选择
    $$('.hand-chip').forEach(function (btn) {
      btn.addEventListener('click', function () { selectHand(btn.getAttribute('data-hand')); });
    });

    // 快速设置
    $$('[data-quick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const kind = btn.getAttribute('data-quick');
        if (kind === 'hour') {
          applyTime({ h: state.time.h, m: 0, s: 0 });
        } else if (kind === 'half') {
          applyTime({ h: state.time.h, m: 30, s: 0 });
        } else if (kind === 'now') {
          const t = nowTime();
          applyTime({ h: t.h, m: t.m, s: t.s });
        } else {
          applyTime({ h: randInt(1, 12), m: randInt(0, 11) * 5, s: 0 });
        }
      });
    });

    // 小课堂 tab
    $$('.learn-tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchLearnTab(btn.getAttribute('data-tab')); });
    });

    // 高亮指针
    $$('[data-highlight]').forEach(function (btn) {
      btn.addEventListener('click', function () { highlightHand(btn.getAttribute('data-highlight')); });
    });

    // 演示
    $$('[data-demo]').forEach(function (btn) {
      btn.addEventListener('click', function () { runDemo(btn.getAttribute('data-demo')); });
    });

    // 换算器
    ['cvH', 'cvM', 'cvS'].forEach(function (id) {
      const input = document.getElementById(id);
      input.addEventListener('input', updateConverter);
      input.addEventListener('change', function () {
        input.value = String(clampInt(input.value, 0, 99));
        updateConverter();
      });
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    updateToday();
    buildExamples();
    bindEvents();
    updateConverter();
    rebuildFineTune();
    updateSetTip();
    state.time = nowTime();
    clock.render(state.time);
    updateReadouts(state.time, false);
    startLiveLoop();
  }

  init();
})();
