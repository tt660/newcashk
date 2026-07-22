// alert.js — wrapper for SweetAlert2 and Toastr
(function () {
  function loadCss(href) {
    if (!document.querySelector('link[href="' + href + '"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    }
  }

  // ensure css (in case some pages miss adding it in <head>)
  loadCss(
    "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css",
  );
  loadCss(
    "https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css",
  );

  // Wait until libraries are available, otherwise provide simple fallbacks
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    // basic Toast setup for SweetAlert2
    if (window.Swal) {
      window.SwalToast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }

    // Toastr defaults
    if (window.toastr) {
      toastr.options = {
        closeButton: true,
        debug: false,
        newestOnTop: true,
        progressBar: true,
        positionClass: "toast-top-right",
        preventDuplicates: true,
        showDuration: "300",
        hideDuration: "1000",
        timeOut: "3000",
        extendedTimeOut: "1000",
      };
    }
  });

  // Global helpers
  window.showAlert = function (title, text, icon) {
    icon = icon || "info";
    if (window.Swal)
      return Swal.fire({ title: title || "", text: text || "", icon: icon });
    alert((title ? title + "\n" : "") + (text || ""));
  };

  window.showToast = function (message, type) {
    type = (type || "info").toLowerCase();
    if (window.toastr) {
      if (["success", "info", "warning", "error"].includes(type))
        toastr[type](message);
      else toastr.info(message);
      return;
    }
    if (window.SwalToast)
      return SwalToast.fire({
        icon:
          type === "error" ? "error" : type === "success" ? "success" : "info",
        title: message,
      });
    console.log("Toast:", type, message);
  };

  // Override native alert to use SweetAlert2 when available
  (function () {
    var _nativeAlert = window.alert;
    window.alert = function (msg) {
      try {
        if (window.Swal) {
          Swal.fire({ text: String(msg || ""), icon: "info" });
          return;
        }
      } catch (e) {
        // fall through to native
      }
      _nativeAlert(String(msg || ""));
    };
  })();

  // Simple notification/todo manager for header badges and dropdowns
  (function () {
    const STORAGE_KEY = "header_notifications_v1";
    const TYPES = {
      trade: { label: "شعارات الشراء", bell: "🛎️" },
      limit: { label: "شعارات الحدود", bell: "🔔" },
      call: { label: "شعارات المكالمات", bell: "📯" },
    };

    function safeParse(value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    }

    const store = safeParse(localStorage.getItem(STORAGE_KEY)) || { items: [] };
    if (!Array.isArray(store.items)) store.items = [];

    function saveStore() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }

    function reloadStore() {
      const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.items)) {
        store.items = parsed.items;
      } else if (!Array.isArray(store.items)) {
        store.items = [];
      }
    }

    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function getCounts() {
      return Object.keys(TYPES).reduce((acc, type) => {
        acc[type] = store.items.filter(
          (item) => item.type === type && !item.read,
        ).length;
        return acc;
      }, {});
    }

    function updateBadges() {
      const counts = getCounts();
      Object.keys(TYPES).forEach((type) => {
        const el = document.getElementById(`${type}Count`);
        if (!el) return;
        el.textContent = counts[type] > 0 ? counts[type] : "0";
        el.style.opacity = counts[type] > 0 ? "1" : "0.65";
      });
    }

    function renderList(type) {
      const listEl = document.getElementById("notificationList");
      const titleEl = document.getElementById("boxTitle");
      if (!listEl || !titleEl) return;
      const typeMeta = TYPES[type] || { label: "الإشعارات" };
      titleEl.textContent = `${typeMeta.bell || "🔔"} ${typeMeta.label}`;
      const items = store.items
        .filter((item) => (type ? item.type === type : true))
        .sort(
          (a, b) =>
            Number(a.read) - Number(b.read) ||
            new Date(b.createdAt) - new Date(a.createdAt),
        );
      if (items.length === 0) {
        listEl.innerHTML = `<li class="read"><div class="item-title">لا يوجد عناصر حالية</div><div class="item-meta">يمكنك إضافة مهام جديدة من إعدادات النظام.</div></li>`;
        return;
      }
      listEl.innerHTML = items
        .map((item) => {
          const stateLabel = item.status || "جديد";
          return `
            <li class="${item.type} ${item.read ? "read" : "unread"}" data-id="${item.id}">
              <div class="item-title">
                <span class="item-icon"></span>
                <span>${item.title || "مهمة"}</span>
                <span>${TYPES[item.type]?.bell || "🔔"}</span>
              </div>
              <div class="item-meta">
                <span>الحالة: ${stateLabel}</span>
                <span>الاسم السابق: ${item.previousName || "غير متوفر"}</span>
              </div>
            </li>`;
        })
        .join("");
    }

    function getNotificationBox() {
      return document.getElementById("notificationBox");
    }

    function hideNotificationBox() {
      const box = getNotificationBox();
      if (box) box.classList.add("hidden");
    }

    function openBox(type) {
      const box = getNotificationBox();
      if (!box) return;
      if (!box.classList.contains("hidden") && box.dataset.type === type) {
        hideNotificationBox();
        return;
      }
      box.dataset.type = type;
      renderList(type);
      box.classList.remove("hidden");
    }

    function markAllRead() {
      const type = getNotificationBox()?.dataset.type;
      store.items.forEach((item) => {
        if (!type || item.type === type) item.read = true;
      });
      saveStore();
      renderList(type);
      updateBadges();
    }

    function addNotification(type, title, status, previousName) {
      if (!TYPES[type]) type = "trade";
      const item = {
        id: generateId(),
        type,
        title,
        status: status || "معلق",
        previousName: previousName || "بدون اسم سابق",
        createdAt: new Date().toISOString(),
        read: false,
      };
      store.items.unshift(item);
      saveStore();
      updateBadges();
      playNotificationSound(type);
      return item;
    }

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        reloadStore();
        updateBadges();
        const currentType = getNotificationBox()?.dataset.type;
        renderList(currentType);
      }
    });

    window.addEventListener("headerNotificationsUpdated", () => {
      reloadStore();
      updateBadges();
      const currentType = getNotificationBox()?.dataset.type;
      renderList(currentType);
    });

    const audioTypes = {
      trade: { freq: 900, waveform: "sine" },
      limit: { freq: 660, waveform: "square" },
      call: { freq: 520, waveform: "triangle" },
    };

    let audioContext;
    let audioUnlocked = false;

    function unlockAudio() {
      if (audioUnlocked) return;
      if (!window.AudioContext && !window.webkitAudioContext) return;
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === "suspended") {
          audioContext
            .resume()
            .then(() => {
              audioUnlocked = true;
            })
            .catch(() => {});
        } else {
          audioUnlocked = true;
        }
      } catch (e) {
        audioContext = null;
      }
    }

    function playNotificationSound(type) {
      if (!audioContext) {
        unlockAudio();
      }
      if (!audioContext || audioContext.state === "suspended") return;
      const config = audioTypes[type] || audioTypes.trade;
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = config.waveform;
      oscillator.frequency.setValueAtTime(config.freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    }

    function bootstrapAudioUnlock() {
      const unlock = () => {
        unlockAudio();
        document.body.removeEventListener("click", unlock);
        document.body.removeEventListener("keydown", unlock);
        document.body.removeEventListener("touchstart", unlock);
      };
      document.body.addEventListener("click", unlock, {
        once: true,
        passive: true,
      });
      document.body.addEventListener("keydown", unlock, {
        once: true,
        passive: true,
      });
      document.body.addEventListener("touchstart", unlock, {
        once: true,
        passive: true,
      });
    }

    function initDefaults() {
      if (store.items.length > 0) return;
      addNotification(
        "trade",
        "تفعيل الشعار المطلوب للشراء",
        "مفتوح",
        "شراء سابق",
      );
      addNotification(
        "limit",
        "مراجعة حدود المحفظة حسب الحالة",
        "قيد التنفيذ",
        "الحد السابق",
      );
      addNotification("call", "جدولة مكالمة جديدة", "جديد", "مكالمة سابقة");
      saveStore();
      updateBadges();
    }

    function clickOutsideHandler(event) {
      const box = getNotificationBox();
      const anyButton = event.target.closest(".icon-btn");
      if (!box || box.classList.contains("hidden")) return;
      if (box.contains(event.target) || anyButton) return;
      hideNotificationBox();
    }

    window.openBox = openBox;
    window.markAllRead = markAllRead;
    window.addNotificationTask = addNotification;
    window.notificationManager = {
      add: addNotification,
      markAllRead,
      getCounts,
      getItems: () => store.items,
    };

    document.addEventListener("DOMContentLoaded", () => {
      initDefaults();
      updateBadges();
      document.addEventListener("click", clickOutsideHandler);
      bootstrapAudioUnlock();
    });
  })();
})();
