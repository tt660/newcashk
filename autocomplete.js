/* autocomplete.js
   Non-destructive autocomplete for input fields across the app.
   - Attaches to text/search/tel/email inputs (unless data-autocomplete="off").
   - Suggests wallet phones/names from localStorage `wallets_v1` when relevant.
   - Keeps small recent-values store per-input in localStorage `recent_inputs_v1`.
   - Purely additive: injects DOM elements and CSS, does not modify other localStorage keys.
*/
(function () {
  'use strict';

  const RECENT_KEY = 'recent_inputs_v1';
  const WALLETS_KEY = 'wallets_v1';
  const INVOICE_KEY = 'invoice_settings_v1';
  const MAX_SUGGEST = 8;
  const DEBOUNCE_MS = 160;
  let walletIndex = { phones: [], names: [] };

  function safeJsonParse(v) {
    try {
      return JSON.parse(v);
    } catch (e) {
      return null;
    }
  }

  function getWallets() {
    try {
      return JSON.parse(localStorage.getItem(WALLETS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function loadIndex() {
    try {
      const wallets = getWallets();
      const phones = [];
      const names = [];
      wallets.forEach((w) => {
        try {
          const ph = String(w.phone || w.id || '').trim();
          if (ph) phones.push(ph);
          const nm = String(w.walletName || w.name || w.main || '').trim();
          if (nm) names.push(nm);
          const owner = w.owner && (w.owner.name || w.owner.fullName);
          if (owner) names.push(String(owner).trim());
        } catch (e) {}
      });
      walletIndex = { phones, names };
    } catch (e) {
      walletIndex = { phones: [], names: [] };
    }
  }

  function getRecent() {
    return safeJsonParse(localStorage.getItem(RECENT_KEY)) || {};
  }
  function saveRecent(obj) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(obj));
    } catch (e) {}
  }
  function pushRecent(key, value) {
    if (!key || !value) return;
    const all = getRecent();
    const list = Array.isArray(all[key]) ? all[key] : [];
    // keep unique, newest first
    const v = String(value).trim();
    const idx = list.indexOf(v);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(v);
    if (list.length > 12) list.length = 12;
    all[key] = list;
    saveRecent(all);
  }

  function createStyle() {
    const css = `
      .ac-suggestions { position: absolute; z-index: 99999; background:#fff; border:1px solid rgba(0,0,0,0.08); box-shadow:0 6px 18px rgba(0,0,0,0.08); max-height:260px; overflow:auto; min-width:160px; font-size:14px; }
      .ac-suggestions.rtl { direction: rtl; }
      .ac-item { padding:8px 10px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .ac-item:hover, .ac-item.active { background: #f1f5f9; }
      .ac-muted { color:#64748b; font-size:12px; display:block; opacity:0.9 }
    `;
    const s = document.createElement('style');
    s.setAttribute('data-autocomplete-style', '1');
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  function prefersPhoneHints(input) {
    const id = (input.id || '') + ' ' + (input.name || '') + ' ' + (input.className || '');
    const low = id.toLowerCase();
    return /phone|tel|wallet|mobile| رقم|محفظ/.test(low);
  }

  function prefersNameHints(input) {
    const id = (input.id || '') + ' ' + (input.name || '') + ' ' + (input.className || '');
    const low = id.toLowerCase();
    return /name|walletname|owner|ownername|اسم|المالك/.test(low);
  }

  function buildSuggestionsFor(input, q) {
    q = String(q || '').trim();
    const results = new Set();
    // use prebuilt index for faster searches
    if (prefersPhoneHints(input)) {
      walletIndex.phones.forEach((ph) => {
        if (!q || ph.indexOf(q) !== -1) results.add(ph);
      });
    }
    if (prefersNameHints(input)) {
      walletIndex.names.forEach((nm) => {
        if (!q || nm.indexOf(q) !== -1) results.add(nm);
      });
    }

    // fallback to recent values for this input
    if (results.size === 0) {
      const recent = getRecent();
      const list = Array.isArray(recent[input.id]) ? recent[input.id] : [];
      list.forEach((v) => {
        if (!q || String(v).indexOf(q) !== -1) results.add(v);
      });
    }

    // also include recent global matches
    const recent = getRecent();
    Object.keys(recent).forEach((k) => {
      recent[k].forEach((v) => {
        if (!q || String(v).indexOf(q) !== -1) results.add(v);
      });
    });

    return Array.from(results).slice(0, MAX_SUGGEST);
  }

  function attachTo(input) {
    if (!input || input.__ac_attached) return;
    input.__ac_attached = true;
    let container = null;
    let active = -1;
    let items = [];
    let visible = false;

    function makeContainer() {
      container = document.createElement('div');
      container.className = 'ac-suggestions';
      container.id = 'ac_' + Math.random().toString(36).slice(2, 9);
      container.style.minWidth = (input.offsetWidth || 160) + 'px';
      // start hidden
      container.style.display = 'none';
      container.setAttribute('role', 'listbox');
      document.body.appendChild(container);
      if (getComputedStyle(input).direction === 'rtl') container.classList.add('rtl');
      container.addEventListener('mousedown', (ev) => {
        // prevent blur on click
        ev.preventDefault();
      });
    }

    function position() {
      if (!container) return;
      const r = input.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      container.style.left = (r.left + scrollLeft) + 'px';
      container.style.top = (r.bottom + scrollTop) + 'px';
      container.style.minWidth = Math.max(160, r.width) + 'px';
    }

    function showList(list) {
      if (!container) makeContainer();
      container.innerHTML = '';
      items = [];
      active = -1;
      if (!list || !list.length) {
        hide();
        return;
      }
      // set ARIA attributes
      try {
        input.setAttribute('aria-expanded', 'true');
        input.setAttribute('aria-controls', container.id);
      } catch (e) {}
      list.forEach((v, i) => {
        const item = document.createElement('div');
        item.className = 'ac-item';
        item.setAttribute('role', 'option');
        item.id = container.id + '_item_' + i;
        item.dataset.index = String(i);
        // show value and a muted hint if it's a wallet phone vs name
        const span = document.createElement('span');
        span.textContent = v;
        item.appendChild(span);
        container.appendChild(item);
        items.push(item);
        item.addEventListener('click', () => {
          pick(i);
        });
      });
      position();
      container.style.display = '';
      visible = true;
    }

    function hide() {
      if (container) container.style.display = 'none';
      visible = false;
      active = -1;
    }

    function pick(i) {
      const v = items[i] && items[i].textContent;
      if (v !== undefined && v !== null) {
        input.value = v;
        pushRecent(input.id || input.name || '_global', v);
        // trigger input event for other listeners
        const ev = new Event('input', { bubbles: true });
        input.dispatchEvent(ev);
      }
      try {
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
      } catch (e) {}
      hide();
      input.focus();
    }

    function highlight(idx) {
      if (!items || !items.length) return;
      items.forEach((it) => it.classList.remove('active'));
      if (idx >= 0 && items[idx]) items[idx].classList.add('active');
      active = idx;
      try {
        if (active >= 0 && items[active]) input.setAttribute('aria-activedescendant', items[active].id);
        else input.removeAttribute('aria-activedescendant');
      } catch (e) {}
    }

    let debounceTimer = null;
    function scheduleSuggest() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSuggest, DEBOUNCE_MS);
    }

    function doSuggest() {
      const q = String(input.value || '').trim();
      const list = buildSuggestionsFor(input, q);
      showList(list);
    }

    input.addEventListener('focus', () => {
      // ignore if feature disabled in settings
      if (!isEnabled()) return;
      scheduleSuggest();
    });
    input.addEventListener('input', () => {
      if (!isEnabled()) return;
      scheduleSuggest();
    });
    input.addEventListener('keydown', (ev) => {
      if (!visible) return;
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        highlight(Math.min(items.length - 1, active + 1));
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        highlight(Math.max(0, active - 1));
      } else if (ev.key === 'Enter') {
        if (active >= 0) {
          ev.preventDefault();
          pick(active);
        }
      } else if (ev.key === 'Escape') {
        hide();
      }
    });

    input.addEventListener('blur', () => {
      // hide slightly delayed to allow click handlers
      setTimeout(() => hide(), 150);
    });

    // set ARIA baseline
    try {
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-expanded', 'false');
    } catch (e) {}

    // reposition on window resize/scroll
    window.addEventListener('resize', () => position());
    window.addEventListener('scroll', () => position(), true);
  }

  function isEnabled() {
    try {
      const raw = localStorage.getItem(INVOICE_KEY);
      if (!raw) return true;
      const obj = JSON.parse(raw);
      if (obj && Object.prototype.hasOwnProperty.call(obj, 'autocompleteEnabled')) return Boolean(obj.autocompleteEnabled);
      return true;
    } catch (e) {
      return true;
    }
  }

  function observeNewInputs() {
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (!m.addedNodes) return;
        m.addedNodes.forEach((n) => {
          try {
            if (n && n.querySelectorAll) {
              const inputs = Array.from(n.querySelectorAll('input'))
                .filter((el) => {
                  const t = (el.type || '').toLowerCase();
                  return t === 'text' || t === 'search' || t === 'tel' || t === 'email';
                });
              inputs.forEach((i) => attachTo(i));
            }
            if (n && n.matches && n.matches('input')) attachTo(n);
          } catch (e) {}
        });
      });
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }

  function init() {
    try {
      createStyle();
      loadIndex();
      // listen for wallet changes
      try {
        window.addEventListener('walletsUpdated', () => loadIndex());
      } catch (e) {}
      try {
        window.addEventListener('storage', (e) => {
          if (e.key === WALLETS_KEY) loadIndex();
          if (e.key === INVOICE_KEY) {
            // if disabled, nothing to do; if enabled, we can attach to inputs later
          }
        });
      } catch (e) {}
      const inputs = Array.from(document.querySelectorAll('input'))
        .filter((el) => {
          if (!el) return false;
          const t = (el.type || '').toLowerCase();
          if (!t) return false;
          if (t === 'text' || t === 'search' || t === 'tel' || t === 'email') {
            if (el.getAttribute('data-autocomplete') === 'off') return false;
            return true;
          }
          return false;
        });
      if (isEnabled()) inputs.forEach(attachTo);
      observeNewInputs();
    } catch (e) {
      console.error('autocomplete init error', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
