/* =========================================================
   圆的乐园 · 模式路由
   - 四个模式面板：演示 / 学习 / 操作 / 测试
   - 首次进入时才初始化模块（懒加载）
   - 支持 URL hash（#demo、#learn、#lab、#quiz）与方向键切换
   ========================================================= */
(function () {
  'use strict';

  var CL = window.CircleLab;
  var MODES = ['demo', 'learn', 'lab', 'quiz'];
  var TITLES = {
    demo: '演示 · 圆的乐园',
    learn: '学习 · 圆的乐园',
    lab: '操作 · 圆的乐园',
    quiz: '测试 · 圆的乐园'
  };

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.mode-tab'));
  var panels = {};
  var roots = {};
  var instances = {};
  var current = null;
  var switching = false;

  MODES.forEach(function (mode) {
    panels[mode] = document.querySelector('.mode-panel[data-mode="' + mode + '"]');
    roots[mode] = document.querySelector('.mode-root[data-mode="' + mode + '"]') ||
      document.getElementById('mode-' + mode);
  });

  function modeFromHash() {
    var name = (location.hash || '').replace(/^#/, '').split('/')[0];
    return MODES.indexOf(name) >= 0 ? name : null;
  }

  function setHash(mode) {
    if (('#' + mode) === location.hash) return;
    try {
      history.replaceState(null, '', '#' + mode);
    } catch (e) {
      location.hash = mode;
    }
  }

  function ensureMounted(mode) {
    if (instances[mode]) return instances[mode];
    var factory = CL && CL.modes ? CL.modes[mode] : null;
    var root = roots[mode];
    if (!factory || !root) return null;
    var instance = null;
    try {
      instance = factory(root) || {};
    } catch (e) {
      console.error('模块初始化失败：' + mode, e);
      root.innerHTML = '<div class="cl-error">这个板块暂时没有加载成功，刷新页面试试吧。</div>';
      instance = {};
    }
    instances[mode] = instance;
    return instance;
  }

  function updateTabs(mode) {
    tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-mode') === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });
  }

  function switchMode(mode, options) {
    var opts = options || {};
    if (!mode || MODES.indexOf(mode) < 0) mode = MODES[0];
    if (switching) return;
    switching = true;

    if (current && current !== mode) {
      var prev = instances[current];
      if (prev && typeof prev.stop === 'function') {
        try { prev.stop(); } catch (e) { console.error(e); }
      }
      panels[current].classList.remove('active');
      panels[current].hidden = true;
    }

    var next = ensureMounted(mode);
    panels[mode].hidden = false;
    // 触发重排，保证进入动画生效
    void panels[mode].offsetWidth;
    panels[mode].classList.add('active');
    updateTabs(mode);
    document.body.setAttribute('data-mode', mode);
    document.title = TITLES[mode] || '圆的乐园';

    current = mode;
    switching = false;

    if (!opts.fromHash) setHash(mode);

    if (next && typeof next.start === 'function') {
      try { next.start(); } catch (e) { console.error(e); }
    }

    // 切换时回到板块顶部
    var top = panels[mode].getBoundingClientRect().top + window.pageYOffset - 84;
    window.scrollTo({ top: Math.max(0, top), behavior: opts.instant ? 'auto' : 'smooth' });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchMode(tab.getAttribute('data-mode'));
    });
    tab.addEventListener('keydown', function (event) {
      var idx = MODES.indexOf(tab.getAttribute('data-mode'));
      var next = null;
      if (event.key === 'ArrowRight') next = MODES[(idx + 1) % MODES.length];
      if (event.key === 'ArrowLeft') next = MODES[(idx - 1 + MODES.length) % MODES.length];
      if (event.key === 'Home') next = MODES[0];
      if (event.key === 'End') next = MODES[MODES.length - 1];
      if (!next) return;
      event.preventDefault();
      switchMode(next);
      var btn = tabs[MODES.indexOf(next)];
      if (btn) btn.focus();
    });
  });

  window.addEventListener('hashchange', function () {
    var mode = modeFromHash();
    if (mode && mode !== current) switchMode(mode, { fromHash: true, instant: true });
  });

  /* ---------------- 音效开关 ---------------- */
  var soundBtn = document.getElementById('soundToggle');
  var paintSound = function () {
    if (!soundBtn) return;
    var on = CL.sound.enabled;
    soundBtn.textContent = on ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? '关闭音效' : '开启音效');
  };
  if (soundBtn) {
    paintSound();
    soundBtn.addEventListener('click', function () {
      var on = CL.sound.toggle();
      paintSound();
      if (on) CL.sound.click();
      CL.ui.toast(on ? '音效已开启 🔊' : '音效已关闭 🔇', 'info', 1600);
    });
  }

  // 首次进入：优先使用 URL hash
  var initial = modeFromHash() || 'demo';
  MODES.forEach(function (mode) {
    var panel = panels[mode];
    if (!panel) return;
    var active = mode === initial;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  updateTabs(initial);
  document.body.setAttribute('data-mode', initial);
  document.title = TITLES[initial] || '圆的乐园';
  current = initial;
  var first = ensureMounted(initial);
  if (first && typeof first.start === 'function') {
    try { first.start(); } catch (e) { console.error(e); }
  }
  if (modeFromHash()) setHash(initial);
})();
