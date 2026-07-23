// home.js - dashboard and buy/sell actions
// ensure a safe global exists early to avoid ReferenceError from console calls
try {
  if (typeof window.renderWalletSelect === "undefined") {
    window.renderWalletSelect = function () {
      console.warn(
        "renderWalletSelect called before initialization; call ignored.",
      );
    };
  }
  // also create a global lexical binding so bare `renderWalletSelect()` calls work
  try {
    if (typeof renderWalletSelect === "undefined") {
      /* eslint-disable no-var */
      var renderWalletSelect = window.renderWalletSelect;
    }
  } catch (e) {}
} catch (e) {}

(function () {
  const WALLETS_KEY = "wallets_v1";
  const TX_KEY = "transactions_v1";
  const INVOICE_KEY = "invoice_settings_v1";
  const SELECTED_WALLET_KEY = "selected_wallet_v1";
  const DAILY_UI_KEY = "daily_ui_state_v1";
  const TODO_KEY = "home_todo_list_v1";
  let editingTxId = null;

  function getWallets() {
    try {
      return JSON.parse(localStorage.getItem(WALLETS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveWallets(ws) {
    try {
      const payload = JSON.stringify(ws);
      localStorage.setItem(WALLETS_KEY, payload);
      try {
        window.dispatchEvent(new Event("walletsUpdated"));
      } catch (e) {}
      try {
        const se = new StorageEvent("storage", {
          key: WALLETS_KEY,
          newValue: payload,
        });
        window.dispatchEvent(se);
      } catch (e) {}
    } catch (e) {}
  }
  function getTx() {
    try {
      return JSON.parse(localStorage.getItem(TX_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveTx(t) {
    try {
      const payload = JSON.stringify(t);
      localStorage.setItem(TX_KEY, payload);
      try {
        window.dispatchEvent(new Event("txsUpdated"));
      } catch (e) {}
      try {
        const se = new StorageEvent("storage", {
          key: TX_KEY,
          newValue: payload,
        });
        window.dispatchEvent(se);
      } catch (e) {}
      if (Array.isArray(t)) {
        console.debug("saveTx: txs saved", t.length);
      } else {
        console.debug("saveTx: tx saved", t && t.id);
      }
    } catch (e) {
      console.error("saveTx error", e);
    }
  }
  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(INVOICE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function q(id) {
    return document.getElementById(id);
  }

  function clearActionInputs() {
    try {
      const ap = q("actionPhone");
      const ca = q("chargedAmount");
      const pa = q("paidAmount");
      if (ap) ap.value = "";
      if (ca) ca.value = "";
      if (pa) pa.value = "";
      console.debug("clearActionInputs: cleared action inputs");
    } catch (e) {
      console.error("clearActionInputs error", e);
    }
  }

  function clearAmounts() {
    try {
      const ap = q("actionPhone");
      const ca = q("chargedAmount");
      const pa = q("paidAmount");
      if (ap) ap.value = "";
      if (ca) ca.value = "";
      if (pa) pa.value = "";
      console.debug(
        "clearAmounts: cleared actionPhone, chargedAmount and paidAmount",
      );
    } catch (e) {
      console.error("clearAmounts error", e);
    }
  }

  function showActionMessage(msg, timeout = 3000) {
    try {
      let el = document.getElementById("actionStatus");
      if (!el) {
        el = document.createElement("div");
        el.id = "actionStatus";
        el.style.position = "fixed";
        el.style.right = "20px";
        el.style.bottom = "20px";
        el.style.zIndex = 9999;
        el.style.padding = "10px 14px";
        el.style.borderRadius = "8px";
        el.style.background = "#16a34a";
        el.style.color = "white";
        el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.display = "block";
      setTimeout(() => {
        try {
          el.style.display = "none";
        } catch (e) {}
      }, timeout);
    } catch (e) {
      console.error("showActionMessage error", e);
    }
  }

  function safeText(id, value) {
    const el = q(id);
    if (el) el.textContent = value;
  }

  // daily invoices sync (auto-create invoices from main transactions)
  const DAILY_INVOICES_KEY = "daily_invoices_v1";

  function genInvId() {
    return "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  }

  function getDailyInvoices() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_INVOICES_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveDailyInvoices(list) {
    try {
      localStorage.setItem(DAILY_INVOICES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  }

  function getDailyUIState() {
    return (
      safeJsonParse(localStorage.getItem(DAILY_UI_KEY)) || {
        lastActiveDay: "",
        clearedPreviousDay: false,
      }
    );
  }

  function saveDailyUIState(state) {
    try {
      localStorage.setItem(DAILY_UI_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function getDefaultTodoList() {
    return [
      {
        id: "daily-refresh",
        title: "تحديث الصفحة لبداية يوم جديد",
        description:
          "يتحقق النظام من أن الصفحة تُعاد تحميلها تلقائيًا عند بدء يوم جديد.",
        status: "pending",
        icon: "🔄",
      },
      {
        id: "clear-old-ops",
        title: "مسح العمليات القديمة من الواجهة",
        description:
          "في بداية اليوم الجديد يتم عرض العمليات الخاصة باليوم الحالي فقط.",
        status: "pending",
        icon: "🧹",
      },
      {
        id: "sync-notifications",
        title: "تحديث الشعارات حسب الحالة",
        description:
          "يتأكد النظام من أن كل شعار يعرض الحالة الصحيحة في قائمة المهام.",
        status: "pending",
        icon: "🔔",
      },
    ];
  }

  function getTodoList() {
    return (
      safeJsonParse(localStorage.getItem(TODO_KEY)) || getDefaultTodoList()
    );
  }

  function saveTodoList(list) {
    try {
      localStorage.setItem(TODO_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function setTodoStatus(id, status) {
    const todos = getTodoList();
    const updated = todos.map((item) =>
      item.id === id ? Object.assign({}, item, { status }) : item,
    );
    saveTodoList(updated);
    renderTodoList();
  }

  function renderTodoList() {
    const container = q("todoItems");
    const status = q("dailyStatus");
    if (!container) return;
    const todos = getTodoList();
    container.innerHTML = todos
      .map(
        (item) => `
          <div class="todo-card ${item.status === "done" ? "done" : ""}" data-id="${item.id}">
            <div class="todo-header">
              <div class="d-flex align-items-center gap-2">
                <span class="todo-icon">${item.icon}</span>
                <div>
                  <div class="fw-bold">${item.title}</div>
                </div>
              </div>
              <span class="badge ${
                item.status === "done" ? "bg-success" : "bg-secondary"
              }">${item.status === "done" ? "مكتمل" : "معلق"}</span>
            </div>
            <div class="todo-meta">${item.description}</div>
            <div class="todo-actions">
              <button type="button" class="btn btn-sm btn-outline-primary toggle-todo">
                ${item.status === "done" ? "إعادة فتح" : "إنهاء"}
              </button>
            </div>
          </div>`,
      )
      .join("");
    if (status) {
      const daily = getDailyUIState();
      status.textContent = `آخر تحديث: ${daily.lastActiveDay || getTodayDate()}`;
    }
    container.querySelectorAll(".toggle-todo").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const card = event.target.closest(".todo-card");
        if (!card) return;
        const id = card.dataset.id;
        const todo = getTodoList().find((item) => item.id === id);
        if (!todo) return;
        setTodoStatus(id, todo.status === "done" ? "pending" : "done");
      });
    });
  }

  function resetTodoList() {
    saveTodoList(getDefaultTodoList());
    renderTodoList();
  }

  function ensureDailyUI() {
    const today = getTodayDate();
    const state = getDailyUIState();
    if (state.lastActiveDay !== today) {
      const nextState = {
        lastActiveDay: today,
        clearedPreviousDay: true,
        refreshedAt: new Date().toISOString(),
      };
      saveDailyUIState(nextState);
      resetTodoList();
      setTodoStatus("daily-refresh", "done");
      setTodoStatus("clear-old-ops", "done");
      if (!sessionStorage.getItem("dailyReloaded")) {
        sessionStorage.setItem("dailyReloaded", "1");
        location.reload();
        return true;
      }
    }
    return false;
  }

  function onRefreshDay() {
    sessionStorage.removeItem("dailyReloaded");
    location.reload();
  }

  // New logic: show hourly reminder if risky wallets exist, and only stop when user confirms.
  function shouldShowDailyRiskAlert() {
    try {
      const state =
        JSON.parse(localStorage.getItem(DAILY_RISK_KEY) || "{}") || {};
      const now = Date.now();
      // if user already acknowledged today, do not show
      if (state.acknowledgedDate === getTodayDate()) return false;
      // if never shown before, allow
      if (!state.lastShownAt) return true;
      // show if at least one hour passed since last shown
      const last = Number(state.lastShownAt) || 0;
      return now - last >= 60 * 60 * 1000;
    } catch (e) {
      return true;
    }
  }

  function markDailyRiskShown() {
    try {
      const raw =
        JSON.parse(localStorage.getItem(DAILY_RISK_KEY) || "{}") || {};
      raw.lastShownAt = Date.now();
      localStorage.setItem(DAILY_RISK_KEY, JSON.stringify(raw));
    } catch (e) {}
  }

  function markRiskAcknowledged() {
    try {
      const raw =
        JSON.parse(localStorage.getItem(DAILY_RISK_KEY) || "{}") || {};
      raw.acknowledgedDate = getTodayDate();
      raw.ackAt = new Date().toISOString();
      raw.lastShownAt = Date.now();
      localStorage.setItem(DAILY_RISK_KEY, JSON.stringify(raw));
    } catch (e) {}
  }

  function showDailyRiskAlert() {
    try {
      const risky = gatherRiskyWallets();
      if (!risky.length) return;
      if (!shouldShowDailyRiskAlert()) return;
      // mark shown time immediately to avoid rapid repeats
      markDailyRiskShown();
      const lines = risky
        .map((r) => {
          const w = r.wallet;
          const id = w.phone || w.id || "محفظة";
          const reasons = r.reasons.join("، ");
          return `<li style="margin-bottom:6px"><strong>${escapeHtml(String(id))}</strong>: ${escapeHtml(reasons)}</li>`;
        })
        .join("");
      const html = `<div style="text-align:right;direction:rtl"><p>المحافظ المعرضة للخطر:</p><ul style="padding-inline-start:18px">${lines}</ul><p>ستستمر هذه التذكيرات كل ساعة حتى تقوم بالموافقة.</p></div>`;
      if (window.Swal && typeof window.Swal.fire === "function") {
        try {
          Swal.fire({
            title: "تنبيه للمحافظ المعرضة للخطر",
            html: html,
            icon: "warning",
            confirmButtonText: "أوافق",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showCloseButton: false,
            didOpen: () => {
              // focus confirm for accessibility
              const btn = document.querySelector(".swal2-confirm");
              if (btn) btn.focus();
            },
          }).then((res) => {
            if (res.isConfirmed) {
              markRiskAcknowledged();
            }
          });
        } catch (e) {
          // fallback to blocking confirm() — treat OK as acknowledgment
          try {
            const ok = window.confirm(
              "تنبيه: بعض المحافظ معرضة للخطر. اضغط موافق للاعتماد وإيقاف التذكير.",
            );
            if (ok) markRiskAcknowledged();
          } catch (er) {}
        }
      } else {
        try {
          const ok = window.confirm(
            "تنبيه: بعض المحافظ معرضة للخطر. اضغط موافق للاعتماد وإيقاف التذكير.",
          );
          if (ok) markRiskAcknowledged();
        } catch (er) {}
      }
    } catch (e) {
      console.error("showDailyRiskAlert error", e);
    }
  }
  function syncDailyListOnLoad() {
    initTodoPanel();
  }

  function initTodoPanel() {
    renderTodoList();
  }

  function setupDailyUI() {
    try {
      const reloaded = ensureDailyUI();
      if (reloaded) return true;
      initTodoPanel();
    } catch (e) {
      console.error("setupDailyUI error", e);
    }
    return false;
  }

  function format(n) {
    return Number(n || 0).toFixed(2);
  }

  function displayType(type) {
    if (type === "buy") return "شراء((سحب))";
    if (type === "sell") return "بيع((تحويل))";
    return type;
  }

  function computeOverview() {
    const wallets = getWallets();
    // compute profit/loss from transaction diffs (diff stored on each tx)
    const tx = getTx();
    let totalProfit = 0,
      totalLoss = 0;
    tx.forEach((t) => {
      const d = computeDiffForTx(t);
      const paid = Number(t.paid || t.price || 0);
      const amt = Number(t.amount) || 0;
      const tradeProfit = t.type === "buy" ? amt - paid : paid - amt;
      const total = d + tradeProfit;
      if (total > 0) totalProfit += total;
      else if (total < 0) totalLoss += Math.abs(total);
    });
    safeText("totalGain", format(totalProfit));
    safeText("totalLoss", format(totalLoss));
    safeText("netProfit", format(totalProfit - totalLoss));
    safeText(
      "allBalances",
      format(wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0)),
    );
  }

  function computeDiffForTx(t) {
    // if diff is present and numeric, use it
    const stored = t && t.diff;
    if (stored !== undefined && stored !== null && isFinite(Number(stored)))
      return Number(stored);
    // otherwise compute using rounding logic
    const amount = Number(t.amount) || 0;
    const target = Math.round(amount / 1000) * 1000;
    let diff = 0;
    if (t.type === "buy") diff = target - amount;
    else diff = amount - target;
    return diff;
  }

  function normalizeTxs() {
    const tx = getTx();
    let changed = false;
    tx.forEach((t) => {
      if (t.diff === undefined || t.diff === null) {
        t.diff = computeDiffForTx(t);
        changed = true;
      }
      // ensure tradeProfit and total exist for older tx objects
      if (t.tradeProfit === undefined || t.tradeProfit === null) {
        const paid = Number(t.paid || t.price || 0);
        const amt = Number(t.amount) || 0;
        t.tradeProfit = t.type === "buy" ? amt - paid : paid - amt;
        changed = true;
      }
      if (t.total === undefined || t.total === null) {
        t.total = Number(t.diff || 0) + Number(t.tradeProfit || 0);
        changed = true;
      }
    });
    if (changed) saveTx(tx);
  }

  function computeTodayReport() {
    const tx = getTx();
    const today = new Date().toISOString().slice(0, 10);
    const todayTx = tx.filter((t) => (t.date || "").slice(0, 10) === today);
    const buy = todayTx.filter((t) => t.type === "buy");
    const sell = todayTx.filter((t) => t.type === "sell");
    safeText("todayBuyCount", buy.length);
    safeText("todaySellCount", sell.length);
    safeText(
      "todayBuyTotal",
      format(buy.reduce((s, t) => s + (Number(t.amount) || 0), 0)),
    );
    safeText(
      "todaySellTotal",
      format(sell.reduce((s, t) => s + (Number(t.amount) || 0), 0)),
    );
    // today's profit = sell total - buy total
    safeText(
      "todayProfit",
      format(
        sell.reduce((s, t) => s + (Number(t.amount) || 0), 0) -
          buy.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      ),
    );
  }

  function getTodayBuyTotalForWallet(walletId, excludeTxId) {
    const tx = getTx();
    const today = new Date().toISOString().slice(0, 10);
    return tx
      .filter(
        (t) => String(t.walletId) === String(walletId) && t.type === "buy",
      )
      .filter((t) => (t.date || "").slice(0, 10) === today)
      .filter((t) =>
        excludeTxId ? String(t.id) !== String(excludeTxId) : true,
      )
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }

  // Daily risk alert: aggregate wallets that are "at risk" and show once per day
  const DAILY_RISK_KEY = "daily_risk_alert_v1";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Ensure SweetAlert2 is loaded (returns a promise)
  function ensureSwal(timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (window.Swal) return resolve(window.Swal);
      // if a loader is already present, wait for it
      const existing = document.querySelector("script[data-swallow-loader]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.Swal));
        existing.addEventListener("error", () => resolve(null));
        return setTimeout(() => resolve(window.Swal || null), timeoutMs);
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
      s.setAttribute("data-swallow-loader", "1");
      s.onload = function () {
        resolve(window.Swal || null);
      };
      s.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(s);
      // fallback timeout
      setTimeout(() => resolve(window.Swal || null), timeoutMs);
    });
  }

  function gatherRiskyWallets() {
    const wallets = getWallets();
    const result = [];
    wallets.forEach((w) => {
      const reasons = [];
      const bal = Number(w.balance || 0);
      const maxReceive = Number(w.maxReceive || 0);
      const dailyMax = Number(w.dailyMax || 0);
      const todayBuy = getTodayBuyTotalForWallet(w.id, null) || 0;

      if (maxReceive > 0) {
        if (bal >= maxReceive)
          reasons.push("وصل إلى الحد الأقصى للاستقبال الشهري");
        else if (bal >= maxReceive * 0.9)
          reasons.push("قريب من الحد الأقصى للاستقبال الشهري");
      }

      if (dailyMax > 0) {
        if (todayBuy >= dailyMax) reasons.push("وصل الحد اليومي للمشتريات");
        else if (todayBuy >= dailyMax * 0.9)
          reasons.push("اقترب من الحد اليومي للمشتريات");
      }

      // low balance heuristic: prefer explicit `alertThreshold`, fallback to 20% of initialBalance, else fixed 100
      let lowThreshold = Number(w.alertThreshold || 0);
      if (!lowThreshold) lowThreshold = Number(w.initialBalance || 0) * 0.2;
      if (!lowThreshold) lowThreshold = 100;
      if (bal <= lowThreshold) reasons.push("الرصيد منخفض");

      if (reasons.length) result.push({ wallet: w, reasons });
    });
    return result;
  }

  function shouldShowDailyRiskAlert() {
    try {
      const state =
        JSON.parse(localStorage.getItem(DAILY_RISK_KEY) || "{}") || {};
      return state.lastShown !== getTodayDate();
    } catch (e) {
      return true;
    }
  }

  function markDailyRiskShown() {
    try {
      localStorage.setItem(
        DAILY_RISK_KEY,
        JSON.stringify({
          lastShown: getTodayDate(),
          shownAt: new Date().toISOString(),
        }),
      );
    } catch (e) {}
  }

  function showDailyRiskAlert() {
    try {
      const risky = gatherRiskyWallets();
      if (!risky.length) return;
      if (!shouldShowDailyRiskAlert()) return;
      const lines = risky
        .map((r) => {
          const w = r.wallet;
          const id = w.phone || w.id || "محفظة";
          const reasons = r.reasons.join("، ");
          return `<li style="margin-bottom:6px"><strong>${escapeHtml(String(id))}</strong>: ${escapeHtml(reasons)}</li>`;
        })
        .join("");
      const html = `<div style="text-align:right;direction:rtl"><p>المحافظ المعرضة للخطر اليوم:</p><ul style="padding-inline-start:18px">${lines}</ul></div>`;
      if (window.Swal && typeof window.Swal.fire === "function") {
        try {
          Swal.fire({
            title: "تنبيه يومي للمحافظ",
            html: html,
            icon: "warning",
            confirmButtonText: "حسناً",
          });
        } catch (e) {
          window.alert("تنبيه: بعض المحافظ معرضة للخطر. تحقق من لوحة التحكم.");
        }
      } else {
        window.alert("تنبيه: بعض المحافظ معرضة للخطر. تحقق من لوحة التحكم.");
      }
      markDailyRiskShown();
    } catch (e) {
      console.error("showDailyRiskAlert error", e);
    }
  }

  function addLog(phone, type, amount, diff, dateStr, tradeProfit) {
    const tb = q("log");
    if (!tb) return;
    const item = document.createElement("div");
    item.className = "accordion-item";
    item.dataset.date = dateStr;
    item.innerHTML = `
      <button class="accordion-header" type="button">
        <div class="hdr-left"><span class="phone">${phone}</span> <span class="date">${dateStr}</span></div>
        <div class="hdr-right"><span class="type">${displayType(type)}</span> <span class="amount">${format(amount)}</span> <span class="diff ${tradeProfit >= 0 ? "profit" : "loss"}">${tradeProfit >= 0 ? "+" : ""}${format(tradeProfit || 0)}</span></div>
      </button>
      <div class="accordion-body">
        <div class="accordion-actions">
          <button class="edit">تعديل</button>
          <button class="del">حذف</button>
          <button class="print">طباعة</button>
        </div>
      </div>
    `;
    tb.appendChild(item);
  }

  async function deleteTx(id) {
    const tx = getTx();
    const idx = tx.findIndex((t) => t.id === id);
    if (idx === -1) return;
    if (!(await swalConfirm("تأكيد حذف العملية؟"))) return;
    // revert wallet effect if possible
    const t = tx[idx];
    try {
      const wallets = getWallets();
      const w = wallets.find((x) => String(x.id) === String(t.walletId));
      if (w) {
        if (t.type === "buy")
          w.balance = (Number(w.balance) || 0) - (Number(t.amount) || 0);
        else w.balance = (Number(w.balance) || 0) + (Number(t.amount) || 0);
        saveWallets(wallets);
      }
    } catch (e) {}
    tx.splice(idx, 1);
    saveTx(tx);
    // remove synced daily invoice if any
    try {
      const inv = getDailyInvoices().filter(
        (i) => String(i.txId) !== String(id),
      );
      saveDailyInvoices(inv);
    } catch (e) {}
    computeOverview();
    computeTodayReport();
    renderWalletSelect();
    onWalletChange();
    renderTxLog();
  }

  function startEditTx(id) {
    const tx = getTx().find((t) => t.id === id);
    if (!tx) return alert("المعاملة غير موجودة");
    editingTxId = id;
    // populate form
    q("walletSelect").value = tx.walletId || "";
    try {
      localStorage.setItem(SELECTED_WALLET_KEY, String(tx.walletId || ""));
    } catch (e) {}
    q("actionPhone").value = tx.phone || "";
    q("chargedAmount").value = tx.amount;
    q("paidAmount").value = tx.paid || tx.price || 0;
    // highlight edit mode
    alert("وضع التعديل مُفعّل. اضغط تنفيذ شراء/بيع لحفظ التعديل.");
  }

  function printTx(id) {
    // legacy single-arg print (kept for compatibility)
    printTx(id, 80, false);
  }

  function printTx(id, sizeMM = 80, viaBluetooth = false) {
    const tx = getTx().find((t) => t.id === id);
    if (!tx) return alert("المعاملة غير موجودة");
    const settings = getSettings() || {};
    const logo = settings.logoDataUrl || null;
    const shop = settings.shopName || "";
    const mid = settings.midMessage || "";
    const footer = settings.footerMessage || "";

    const width = sizeMM === 58 ? "58mm" : "80mm";
    const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة طباعة</title>
        <style>
          @page { size: ${width} auto; margin: 6mm; }
          body { font-family: Inter, Arial, sans-serif; direction: rtl; width: ${width}; margin:0; color:#111; }
          .ticket { width: 100%; box-sizing: border-box; }
          .logo { text-align: center; margin-bottom: 6px; }
          .logo img { max-width: 100%; height: auto; }
          .shop { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 6px; }
          .meta { font-size: 12px; margin-bottom: 6px; }
          .meta div { margin: 3px 0; }
          .meta .bold { font-weight: 700; font-size: 14px; }
          .section { border-top:1px dashed #ccc; padding-top:6px; margin-top:6px; }
          .center { text-align: center; }
          .values { display:flex; justify-content:space-between; gap:8px; font-size:13px; }
          .values .label { color:#666 }
          .wallet-number { font-weight: 800; font-size: 16px; display:inline-block; margin-right:6px }
          .footer { margin-top:8px; font-size:12px; text-align:center; }
        </style>
      </head>
      <body>
        <div class="ticket">
          ${logo ? `<div class="logo"><img src="${logo}" alt="logo" /></div>` : ""}
          <div class="shop">${shop}</div>
          <div class="meta">
            <div>التاريخ: <span class="bold">${(tx.date || "").replace("T", " ").slice(0, 19)}</span></div>
            <div>رقم العملية: <span class="bold">${tx.id}</span></div>
            <div>نوع العملية: <span class="bold">${displayType(tx.type)}</span></div>
            <div>رقم المحفظة: <span class="wallet-number">${tx.phone || tx.walletId}</span></div>
          </div>

          <div class="section">
            <div class="values"><div class="label">الرصيد المشحون</div><div class="bold">${format(tx.amount)}</div></div>
          </div>

          ${mid ? `<div class="section center">${mid}</div>` : ""}

          <div class="section">
            <div class="values"><div class="label">المبلغ المدفوع</div><div class="bold">${format(tx.paid || tx.price)}</div></div>
          </div>

          <div class="footer">${footer}</div>
        </div>
      </body>
      </html>
    `;

    if (viaBluetooth) {
      // Open print preview and rely on OS/browser to select Bluetooth printer.
      const w = window.open("", "_blank", "width=400,height=600");
      if (!w) return alert("لا يمكن فتح نافذة الطباعة");
      w.document.write(html);
      w.document.close();
      w.focus();
      // show instruction for Bluetooth (many browsers use system dialog)
      setTimeout(() => w.print(), 500);
      return;
    }

    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return alert("لا يمكن فتح نافذة الطباعة");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  function shouldShowTodayTransactions() {
    try {
      return getDailyUIState().clearedPreviousDay;
    } catch (e) {
      return false;
    }
  }

  function renderTxLog() {
    const container = q("log");
    if (!container) return;
    const txRecords = getTx();
    const todayOnly = shouldShowTodayTransactions();
    const filteredTx = todayOnly
      ? txRecords.filter((t) => (t.date || "").slice(0, 10) === getTodayDate())
      : txRecords;

    container.innerHTML = "";
    if (!filteredTx.length) {
      container.innerHTML = `<div class="empty-log" style="padding:16px;color:#555;text-align:center;">${
        todayOnly
          ? "لا توجد عمليات لهذا اليوم بعد. قم بتنفيذ عملية جديدة أو حرّك الصفحة."
          : "لا توجد عمليات حتى الآن."
      }</div>`;
      return;
    }

    const tx = filteredTx.slice().sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      const ta = isFinite(da) ? da : a.id || 0;
      const tb = isFinite(db) ? db : b.id || 0;
      return tb - ta;
    });

    tx.forEach((t) => {
      const d = computeDiffForTx(t);
      const paid = Number(t.paid || t.price || 0);
      const amt = Number(t.amount) || 0;
      const tradeProfit = t.type === "buy" ? amt - paid : paid - amt;
      const total = d + tradeProfit;
      const dateStr = (t.date || "").replace("T", " ").slice(0, 19);

      const item = document.createElement("div");
      item.className = "accordion-item";
      item.dataset.id = t.id;
      const header = document.createElement("button");
      header.className = "accordion-header";
      header.type = "button";
      header.innerHTML = `<div class="hdr-left"><span class="phone">${t.phone || t.walletId}</span> <span class="date">${dateStr}</span></div><div class="hdr-right"><span class="type">${displayType(t.type)}</span> <span class="amount">${format(amt)}</span> <span class="paid">${format(paid)}</span> <span class="diff ${tradeProfit >= 0 ? "profit" : "loss"}">${tradeProfit >= 0 ? "+" : ""}${format(tradeProfit)}</span></div>`;

      const body = document.createElement("div");
      body.className = "accordion-body";
      body.innerHTML = `<div>ربح الصفقة: <strong class="${tradeProfit >= 0 ? "profit" : "loss"}">${tradeProfit >= 0 ? "+" : ""}${format(tradeProfit)}</strong> — الصافي: <strong class="${total >= 0 ? "profit" : "loss"}">${total >= 0 ? "+" : ""}${format(total)}</strong></div>`;

      const actions = document.createElement("div");
      actions.className = "accordion-actions";
      const editBtn = document.createElement("button");
      editBtn.textContent = "تعديل";
      editBtn.className = "edit";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startEditTx(t.id);
      });
      const delBtn = document.createElement("button");
      delBtn.textContent = "حذف";
      delBtn.className = "del";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTx(t.id);
      });
      const print80 = document.createElement("button");
      print80.textContent = "طباعة 80mm";
      print80.className = "print80";
      print80.addEventListener("click", (e) => {
        e.stopPropagation();
        printTx(t.id, 80, false);
      });
      const print58 = document.createElement("button");
      print58.textContent = "طباعة 58mm";
      print58.className = "print58";
      print58.addEventListener("click", (e) => {
        e.stopPropagation();
        printTx(t.id, 58, false);
      });
      const printBT = document.createElement("button");
      printBT.textContent = "طباعة بلوتوث";
      printBT.className = "print-bt";
      printBT.addEventListener("click", (e) => {
        e.stopPropagation();
        printTx(t.id, 80, true);
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      actions.appendChild(print80);
      actions.appendChild(print58);
      actions.appendChild(printBT);
      body.appendChild(actions);

      header.addEventListener("click", () => item.classList.toggle("open"));
      item.appendChild(header);
      item.appendChild(body);
      container.appendChild(item);
    });
  }

  function renderWalletSelect() {
    const sel = q("walletSelect");
    if (!sel) return;
    // Prefer persisted wallets (localStorage). Use in-memory getter only when it
    // returns a non-empty array to avoid hiding stored wallets with an empty cache.
    let wallets = getWallets();
    try {
      if (typeof window.__cashy_getWallets === "function") {
        const mem = window.__cashy_getWallets() || [];
        if (Array.isArray(mem) && mem.length > 0) wallets = mem;
      }
    } catch (e) {}
    sel.innerHTML =
      '<option value="">-- اختر --</option>' +
      (Array.isArray(wallets)
        ? wallets
            .map((w) => {
              const bal = Number(w.balance || 0).toFixed(2);
              const main = w.main || "";
              const sub = w.sub ? " • " + w.sub : "";
              return `<option value="${w.id}">${w.phone} • ${main}${sub} • ${bal}</option>`;
            })
            .join("")
        : "");
    // restore previously selected wallet if any
    try {
      const saved = localStorage.getItem(SELECTED_WALLET_KEY);
      if (saved) sel.value = saved;
    } catch (e) {}
    // category filter
    const catSel = q("categoryFilter");
    if (catSel) {
      const rawCats = localStorage.getItem("wallet_categories_v1");
      let cats = [];
      try {
        cats = JSON.parse(rawCats) || [];
      } catch (e) {}
      catSel.innerHTML =
        '<option value="">الكل</option>' +
        cats
          .map((c) => `<option value="${c.name}">${c.name}</option>`)
          .join("");
    }
    // fixed values: render as Bootstrap buttons
    const fixed = getSettings().fixedValues || [];
    const btnContainer = q("fixedValueButtons");
    const fv = q("fixedValueSelect");
    if (btnContainer) {
      btnContainer.innerHTML = "";
      fixed.forEach((f) => {
        const amt = Number(f.amount || 0).toFixed(2);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-outline-primary";
        b.dataset.amount = f.amount;
        b.textContent = `${amt} ج.م`;
        b.addEventListener("click", (e) => {
          // set charged amount
          q("chargedAmount").value = amt;
          // update hidden select for compatibility
          if (fv) fv.value = f.amount;
          // update active styles
          Array.from(btnContainer.children).forEach((c) => {
            c.className = "btn btn-outline-primary";
          });
          b.className = "btn btn-primary";
        });
        btnContainer.appendChild(b);
      });
    }
  }

  function onWalletChange() {
    const id = q("walletSelect").value;
    try {
      localStorage.setItem(SELECTED_WALLET_KEY, id || "");
    } catch (e) {}
    const wallets = getWallets();
    const w = wallets.find((x) => String(x.id) === String(id));
    if (!w) {
      safeText("selBalance", "-");
      safeText("selBuyTotal", "0.00");
      safeText("selSellTotal", "0.00");
      safeText("selRemaining", "-");
      safeText("selProfit", "0.00");
      return;
    }
    const tx = getTx().filter((t) => String(t.walletId) === String(w.id));
    const buyTotal = tx
      .filter((t) => t.type === "buy")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const sellTotal = tx
      .filter((t) => t.type === "sell")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    safeText("selBalance", format(w.balance));
    safeText("selBuyTotal", format(buyTotal));
    safeText("selSellTotal", format(sellTotal));
    const rem = (Number(w.maxReceive) || 0) - (Number(w.balance) || 0);
    safeText("selRemaining", w.maxReceive ? format(Math.max(0, rem)) : "-");
    // compute profit for this wallet from recorded transactions (sum of tradeProfit)
    const walletProfit = tx.reduce(
      (s, t) => s + (Number(t.tradeProfit) || 0),
      0,
    );
    // fallback: if no transactions, compute from balance vs initialBalance
    const profit = tx.length
      ? walletProfit
      : (Number(w.balance) || 0) - (Number(w.initialBalance) || 0);
    safeText("selProfit", format(profit));
  }

  async function doAction(type) {
    console.debug("doAction start", { type });
    const walletId = q("walletSelect").value;
    const phone = q("actionPhone").value.trim();
    const amount = Number(q("chargedAmount").value) || 0;
    const paid = Number(q("paidAmount").value) || 0;
    if (!walletId && !phone) return alert("حدد محفظة أو أدخل رقم");
    const wallets = getWallets();
    let wallet = wallets.find((w) => String(w.id) === String(walletId));
    if (!wallet && phone) {
      wallet = wallets.find((w) => (w.phone || "") === phone);
    }
    if (!wallet) {
      return alert("المحفظة غير موجودة");
    }
    if (type === "sell" && (Number(wallet.balance) || 0) < amount)
      return alert("الرصيد لا يكفي للبيع");
    // Prevent buys that would exceed wallet monthly receive limit
    const maxReceive = Number(wallet.maxReceive || 0);
    if (type === "buy" && maxReceive > 0) {
      const currentBalance = Number(wallet.balance || 0);
      if (currentBalance >= maxReceive) {
        return alert(
          "تحذير: وصل الرصيد إلى الحد الأقصى للاستقبال الشهري. لا يمكن تنفيذ شراء جديد.",
        );
      }
      if (currentBalance + amount > maxReceive) {
        return alert(
          "تحذير: تنفيذ هذه العملية سيتجاوز الحد الأقصى للشهر للمحفظة الحالية. خفف المبلغ أو عدّل الحد.",
        );
      }
      // daily limit check for selected wallet only
      const dailyMax = Number(wallet.dailyMax || 0);
      if (dailyMax > 0) {
        const selectedWalletId = String(wallet.id || "");
        const todayTotal = getTodayBuyTotalForWallet(selectedWalletId, null);
        if (todayTotal >= dailyMax) {
          return alert(
            "تحذير: وصلت مشتريات اليوم للمحفظة الحالية إلى الحد اليومي. لا يمكن تنفيذ شراء جديد.",
          );
        }
        if (todayTotal + amount > dailyMax) {
          return alert(
            "تحذير: تنفيذ هذه العملية سيتجاوز الحد اليومي للمشتريات للمحفظة الحالية. خفف المبلغ أو عدّل الحد.",
          );
        }
      }
    }
    // compute diff like example (rounding to nearest 1000)
    const target = Math.round(amount / 1000) * 1000;
    let diff = 0;
    if (type === "buy") diff = target - amount;
    else diff = amount - target;

    // If editing an existing tx, update it by reverting/applying balances
    const tx = getTx();
    let lastTxId = null;
    if (editingTxId) {
      const origIdx = tx.findIndex((t) => t.id === editingTxId);
      if (origIdx === -1) {
        editingTxId = null;
        return alert("المعاملة القديمة غير موجودة");
      }
      const orig = tx[origIdx];
      // revert original wallet effect
      try {
        const origWallet = wallets.find(
          (w) => String(w.id) === String(orig.walletId),
        );
        if (origWallet) {
          if (orig.type === "buy")
            origWallet.balance =
              (Number(origWallet.balance) || 0) - (Number(orig.amount) || 0);
          else
            origWallet.balance =
              (Number(origWallet.balance) || 0) + (Number(orig.amount) || 0);
        }
      } catch (e) {}

      // apply new effect to (possibly different) wallet
      if (type === "buy") {
        // check maxReceive when editing
        const maxReceive = Number(wallet.maxReceive || 0);
        if (
          maxReceive > 0 &&
          Number(wallet.balance || 0) + amount > maxReceive
        ) {
          return alert(
            "تحذير: تنفيذ هذا التعديل سيتجاوز الحد الأقصى للشهر. العملية ملغاة.",
          );
        }
        const dailyMaxEdit = Number(wallet.dailyMax || 0);
        if (dailyMaxEdit > 0) {
          const selectedWalletId = String(wallet.id || "");
          // exclude the original tx if it was a buy today
          const todayTotalExcl = getTodayBuyTotalForWallet(
            selectedWalletId,
            orig && orig.id,
          );
          if (todayTotalExcl + amount > dailyMaxEdit) {
            return alert(
              "تحذير: تعديل هذه العملية سيتجاوز الحد اليومي للمشتريات للمحفظة الحالية. العملية ملغاة.",
            );
          }
        }
        wallet.balance = (Number(wallet.balance) || 0) + amount;
      } else {
        // check sufficiency
        if ((Number(wallet.balance) || 0) < amount) {
          // restore original wallet before abort
          try {
            const origWallet = wallets.find(
              (w) => String(w.id) === String(orig.walletId),
            );
            if (origWallet) {
              if (orig.type === "buy")
                origWallet.balance =
                  (Number(origWallet.balance) || 0) +
                  (Number(orig.amount) || 0);
              else
                origWallet.balance =
                  (Number(origWallet.balance) || 0) -
                  (Number(orig.amount) || 0);
              saveWallets(wallets);
            }
          } catch (e) {}
          return alert("الرصيد لا يكفي للبيع");
        }
        wallet.balance = (Number(wallet.balance) || 0) - amount;
      }
      saveWallets(wallets);

      // update tx object
      const tradeProfit = type === "buy" ? amount - paid : paid - amount;
      tx[origIdx] = Object.assign({}, orig, {
        walletId: wallet.id,
        type: type,
        amount: amount,
        paid: paid,
        phone: phone || wallet.phone,
        date: new Date().toISOString(),
        diff: diff,
        tradeProfit: tradeProfit,
        total: diff + tradeProfit,
      });
      saveTx(tx);
      // sync to daily invoices (update existing or create)
      try {
        syncTxToInvoice(tx[origIdx]);
      } catch (e) {}
      lastTxId = tx[origIdx].id;
      editingTxId = null;
    } else {
      // apply balance change for new tx
      if (type === "buy") {
        // check maxReceive for new transactions
        const maxReceiveNew = Number(wallet.maxReceive || 0);
        if (
          maxReceiveNew > 0 &&
          Number(wallet.balance || 0) + amount > maxReceiveNew
        ) {
          return alert(
            "تحذير: تنفيذ هذه العملية سيتجاوز الحد الأقصى للاستقبال الشهري للمحفظة.",
          );
        }
        const dailyMaxNew = Number(wallet.dailyMax || 0);
        if (dailyMaxNew > 0) {
          const selectedWalletId = String(wallet.id || "");
          const todayTotalNew = getTodayBuyTotalForWallet(
            selectedWalletId,
            null,
          );
          if (todayTotalNew + amount > dailyMaxNew) {
            return alert(
              "تحذير: تنفيذ هذه العملية سيتجاوز الحد اليومي للمشتريات للمحفظة الحالية.",
            );
          }
        }
        wallet.balance = (Number(wallet.balance) || 0) + amount;
      } else {
        wallet.balance = (Number(wallet.balance) || 0) - amount;
      }
      saveWallets(wallets);

      // record tx with diff
      const tradeProfit = type === "buy" ? amount - paid : paid - amount;
      const txObj = {
        id: Date.now(),
        walletId: wallet.id,
        type: type,
        amount: amount,
        paid: paid,
        phone: phone || wallet.phone,
        date: new Date().toISOString(),
        diff: diff,
        tradeProfit: tradeProfit,
        total: diff + tradeProfit,
      };
      tx.push(txObj);
      saveTx(tx);
      // sync new tx to daily invoices
      try {
        syncTxToInvoice(txObj);
      } catch (e) {}
      lastTxId = txObj.id;
    }

    // update UI
    computeOverview();
    computeTodayReport();
    renderWalletSelect();
    onWalletChange();
    renderTxLog();

    // clear amount fields (no modal) then continue to dispatch and print prompt
    try {
      clearAmounts();
      console.debug("doAction: amounts cleared");
    } catch (e) {
      console.error("post-action clearAmounts error", e);
    }

    // dispatch event so other parts can react (scroll to new tx, highlight, etc.)
    try {
      if (lastTxId) {
        try {
          window.dispatchEvent(
            new CustomEvent("actionCompleted", { detail: { txId: lastTxId } }),
          );
        } catch (e) {}
      }

      // prompt to print immediately after action
      const wantPrint = await swalConfirm(
        "تم تنفيذ العملية. هل تريد طباعة الفاتورة الآن؟",
      );
      if (wantPrint && lastTxId) {
        const size = prompt(
          "اختر حجم الطباعة: اكتب 80 أو 58. اكتب bt للطباعة عبر بلوتوث. تركه فارغ = 80.",
        );
        if (size && String(size).trim().toLowerCase() === "58")
          printTx(lastTxId, 58, false);
        else if (size && String(size).trim().toLowerCase() === "bt")
          printTx(lastTxId, 80, true);
        else printTx(lastTxId, 80, false);
      }
    } catch (e) {
      console.error("post-action print/dispatch error", e);
    }
  }

  function attach() {
    const sel = q("walletSelect");
    if (sel) sel.addEventListener("change", () => onWalletChange());
    // fixed value buttons handle charged amount; hidden select kept for compatibility
    const doBuyBtn = q("doBuy");
    if (doBuyBtn) doBuyBtn.addEventListener("click", () => doAction("buy"));
    const doSellBtn = q("doSell");
    if (doSellBtn) doSellBtn.addEventListener("click", () => doAction("sell"));
    q("categoryFilter")?.addEventListener("change", (e) => {
      const v = e.target.value;
      const wallets = getWallets();
      const sel = q("walletSelect");
      sel.innerHTML =
        '<option value="">-- اختر --</option>' +
        wallets
          .filter((w) => !v || w.main === v)
          .map(
            (w) =>
              `<option value="${w.id}">${w.phone} • ${w.main || ""} ${w.sub ? "• " + w.sub : ""}</option>`,
          )
          .join("");
      // restore saved selection if still available
      try {
        const saved = localStorage.getItem(SELECTED_WALLET_KEY);
        if (saved) sel.value = saved;
      } catch (e) {}
    });
  }

  // Robust delegated listeners so clicks work even if initial bindings fail
  try {
    document.addEventListener("click", (ev) => {
      try {
        const t = ev.target;
        if (!t) return;
        if (t.closest && t.closest("#doBuy")) {
          ev.preventDefault();
          try {
            doAction("buy");
          } catch (err) {
            console.error("doBuy handler error", err);
            alert(
              "حدث خطأ أثناء تنفيذ الشراء: " +
                (err && err.message ? err.message : err),
            );
          }
          return;
        }
        if (t.closest && t.closest("#doSell")) {
          ev.preventDefault();
          try {
            doAction("sell");
          } catch (err) {
            console.error("doSell handler error", err);
            alert(
              "حدث خطأ أثناء تنفيذ البيع: " +
                (err && err.message ? err.message : err),
            );
          }
          return;
        }
      } catch (e) {
        console.error("delegated click handler error", e);
      }
    });
  } catch (e) {}

  // test helper to invoke actions from console
  try {
    window.testDoAction = function (type) {
      if (type !== "buy" && type !== "sell")
        return console.warn("use testDoAction('buy'|'sell')");
      try {
        doAction(type);
      } catch (e) {
        console.error("testDoAction error", e);
      }
    };
  } catch (e) {}

  document.addEventListener("DOMContentLoaded", () => {
    // ensure legacy transactions have computed diffs
    normalizeTxs();
    computeOverview();
    computeTodayReport();
    if (setupDailyUI()) return;
    renderWalletSelect();
    renderTxLog();
    attach();
    // show aggregated daily risk alert (once per day)
    try {
      showDailyRiskAlert();
    } catch (e) {}
    // keep checking every hour while page is open
    try {
      setInterval(
        () => {
          try {
            showDailyRiskAlert();
          } catch (e) {}
        },
        60 * 60 * 1000,
      );
    } catch (e) {}
    // snapshot current wallets JSON for polling comparison
    try {
      window.__cashy_lastWalletsJson = localStorage.getItem("wallets_v1") || "";
    } catch (e) {
      window.__cashy_lastWalletsJson = "";
    }
  });

  // expose key functions for console / other pages to call directly
  try {
    window.renderWalletSelect = renderWalletSelect;
    window.onWalletChange = onWalletChange;
    window.computeOverview = computeOverview;
    window.computeTodayReport = computeTodayReport;
  } catch (e) {}

  // react to wallets updated in other scripts (same window)
  try {
    window.addEventListener("walletsUpdated", () => {
      try {
        renderWalletSelect();
        onWalletChange();
        computeOverview();
        computeTodayReport();
        renderTxLog();
      } catch (e) {
        console.error("walletsUpdated handler error", e);
      }
    });
  } catch (e) {}
  // also handle storage events (other tabs/windows)
  try {
    window.addEventListener("storage", (e) => {
      try {
        if (e.key === "wallets_v1" || e.key === "transactions_v1") {
          renderWalletSelect();
          onWalletChange();
          computeOverview();
          computeTodayReport();
          renderTxLog();
        }
      } catch (err) {}
    });
  } catch (e) {}
  // Test helper: create sample wallets and run the risk alert immediately
  try {
    window.runRiskAlertTest = function () {
      const original = localStorage.getItem("wallets_v1");
      const sample = [
        {
          id: "w1",
          phone: "01011110001",
          balance: 9500,
          maxReceive: 10000,
          dailyMax: 2000,
          initialBalance: 10000,
        },
        {
          id: "w2",
          phone: "01011110002",
          balance: 50,
          maxReceive: 0,
          dailyMax: 0,
          initialBalance: 500,
        },
        {
          id: "w3",
          phone: "01011110003",
          balance: 200,
          maxReceive: 5000,
          dailyMax: 1000,
          initialBalance: 1000,
        },
      ];
      try {
        localStorage.setItem("wallets_v1", JSON.stringify(sample));
      } catch (e) {}
      try {
        // clear any previous acknowledgement so alerts show
        localStorage.removeItem(DAILY_RISK_KEY);
      } catch (e) {}
      try {
        showDailyRiskAlert();
      } catch (e) {
        console.error("runRiskAlertTest error", e);
      }
      // restore original after short delay to avoid persistent test data
      setTimeout(() => {
        try {
          if (original === null) localStorage.removeItem("wallets_v1");
          else localStorage.setItem("wallets_v1", original);
        } catch (e) {}
      }, 2000);
    };
  } catch (e) {}

  // Listen for completed actions to highlight and scroll to the new transaction
  try {
    window.addEventListener("actionCompleted", (ev) => {
      try {
        const txId = ev && ev.detail && ev.detail.txId;
        if (!txId) return;
        // ensure log is rendered
        try {
          renderTxLog();
        } catch (e) {}
        // find element in DOM
        const el = document.querySelector(`[data-id="${txId}"]`);
        if (!el) return;
        // scroll into view and highlight briefly
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const origBg = el.style.boxShadow;
        el.style.boxShadow =
          "0 0 0 3px rgba(79,70,229,0.12), 0 6px 24px rgba(15,23,42,0.08)";
        setTimeout(() => {
          try {
            el.style.boxShadow = origBg || "";
          } catch (e) {}
        }, 3500);
      } catch (e) {
        console.error("actionCompleted handler error", e);
      }
    });
  } catch (e) {}
  // Poll localStorage as robust fallback for same-tab updates
  try {
    setInterval(() => {
      try {
        const raw = localStorage.getItem("wallets_v1") || "";
        if (raw !== window.__cashy_lastWalletsJson) {
          window.__cashy_lastWalletsJson = raw;
          renderWalletSelect();
          onWalletChange();
          computeOverview();
          computeTodayReport();
        }
      } catch (e) {}
    }, 2000);
  } catch (e) {}
})();
