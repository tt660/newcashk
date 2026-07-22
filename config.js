// config.js - save/load invoice settings (logo image, shop name, mid/footer messages)
(function () {
  const INVOICE_KEY = "invoice_settings_v1";

  const logoInput = document.getElementById("logoInput");
  const logoPreview = document.getElementById("logoPreview");
  const logoPreviewWrap = document.getElementById("logoPreviewWrap");
  const clearLogo = document.getElementById("clearLogo");
  const shopName = document.getElementById("shopName");
  const midMessage = document.getElementById("midMessage");
  const footerMessage = document.getElementById("footerMessage");
  const saveBtn = document.getElementById("saveSettings");
  const resetBtn = document.getElementById("resetSettings");
  const addFixedBtn = document.getElementById("addFixedBtn");
  const fixedListEl = document.getElementById("fixedList");

  let fixedValues = [];

  function readImageFile(file, cb) {
    const fr = new FileReader();
    fr.onload = function () {
      cb(fr.result);
    };
    fr.onerror = function () {
      cb(null);
    };
    fr.readAsDataURL(file);
  }

  function saveSettings() {
    const data = {
      shopName: shopName?.value || "",
      midMessage: midMessage?.value || "",
      footerMessage: footerMessage?.value || "",
      logoDataUrl:
        logoPreview?.src && logoPreview.style.display !== "none"
          ? logoPreview.src
          : null,
      fixedValues: Array.isArray(fixedValues) ? fixedValues : [],
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(INVOICE_KEY, JSON.stringify(data));
      if (typeof swal === "function") {
        swal({
          title: "تم الحفظ",
          text: "تم حفظ إعدادات الفاتورة بنجاح",
          icon: "success",
        });
      } else {
        alert("تم حفظ إعدادات الفاتورة");
      }
    } catch (e) {
      console.error("saveSettings error", e);
      if (typeof swal === "function") {
        swal({ title: "خطأ", text: "حدث خطأ أثناء الحفظ", icon: "error" });
      } else {
        alert("حدث خطأ أثناء الحفظ");
      }
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(INVOICE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (shopName) shopName.value = obj.shopName || "";
      if (midMessage) midMessage.value = obj.midMessage || "";
      if (footerMessage) footerMessage.value = obj.footerMessage || "";
      if (obj.logoDataUrl) {
        if (logoPreview) {
          logoPreview.src = obj.logoDataUrl;
          logoPreview.style.display = "block";
        }
      }
      if (Array.isArray(obj.fixedValues)) {
        fixedValues = obj.fixedValues.slice();
      }
      renderFixedValues();
    } catch (e) {
      console.error("loadSettings", e);
    }
  }

  function renderFixedValues() {
    if (!fixedListEl) return;
    fixedListEl.innerHTML = "";
    if (!Array.isArray(fixedValues) || fixedValues.length === 0) {
      fixedListEl.textContent = "لا توجد قيم ثابتة";
      return;
    }
    fixedValues.forEach((fv) => {
      const item = document.createElement("div");
      item.className = "fixed-item";
      const left = document.createElement("div");
      left.className = "left";
      const amt = document.createElement("div");
      amt.className = "amount";
      amt.textContent = (Number(fv.amount) || 0).toFixed(2) + " ج.م";
      left.appendChild(amt);

      const actions = document.createElement("div");
      actions.className = "actions";
      const editBtn = document.createElement("button");
      editBtn.className = "btn";
      editBtn.textContent = "تعديل";
      const delBtn = document.createElement("button");
      delBtn.className = "btn danger";
      delBtn.textContent = "حذف";

      editBtn.addEventListener("click", () => {
        // replace amt with editable input
        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.01";
        input.value = fv.amount;
        input.style.marginRight = "8px";
        const saveBtn = document.createElement("button");
        saveBtn.className = "btn primary";
        saveBtn.textContent = "حفظ";
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn";
        cancelBtn.textContent = "إلغاء";

        item.replaceChild(input, left);
        actions.innerHTML = "";
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);

        saveBtn.addEventListener("click", () => {
          const val = Number(input.value) || 0;
          fv.amount = val;
          saveSettings();
          renderFixedValues();
        });
        cancelBtn.addEventListener("click", () => renderFixedValues());
      });

      delBtn.addEventListener("click", async () => {
        if (!(await swalConfirm("هل تريد حذف هذه القيمة؟"))) return;
        fixedValues = fixedValues.filter((x) => x.id !== fv.id);
        saveSettings();
        renderFixedValues();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(left);
      item.appendChild(actions);
      fixedListEl.appendChild(item);
    });
  }

  function addFixedValueUI() {
    if (!fixedListEl) return;
    // show input area at top
    const container = document.createElement("div");
    container.className = "fixed-item";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.01";
    input.placeholder = "المبلغ";
    input.style.marginRight = "8px";
    const save = document.createElement("button");
    save.className = "btn primary";
    save.textContent = "حفظ";
    const cancel = document.createElement("button");
    cancel.className = "btn";
    cancel.textContent = "إلغاء";
    const right = document.createElement("div");
    right.className = "actions";
    right.appendChild(save);
    right.appendChild(cancel);
    const left = document.createElement("div");
    left.appendChild(input);
    container.appendChild(left);
    container.appendChild(right);
    fixedListEl.insertBefore(container, fixedListEl.firstChild);

    cancel.addEventListener("click", () => renderFixedValues());
    save.addEventListener("click", () => {
      const val = Number(input.value);
      if (!isFinite(val)) {
        if (typeof swal === "function") {
          swal({ title: "تنبيه", text: "أدخل مبلغًا صحيحًا", icon: "warning" });
        } else {
          alert("أدخل مبلغًا صحيحًا");
        }
        return;
      }
      fixedValues.unshift({ id: Date.now(), amount: val });
      saveSettings();
      renderFixedValues();
    });
  }

  function clearLogoPreview() {
    if (logoPreview) {
      logoPreview.src = "";
      logoPreview.style.display = "none";
    }
    if (logoInput) logoInput.value = "";
  }

  async function resetSettings() {
    if (
      !(await swalConfirm("هل تريد إعادة ضبط إعدادات الفاتورة إلى الافتراضي؟"))
    )
      return;
    try {
      localStorage.removeItem(INVOICE_KEY);
    } catch (e) {}
    if (shopName) shopName.value = "";
    if (midMessage) midMessage.value = "";
    if (footerMessage) footerMessage.value = "";
    clearLogoPreview();
    if (typeof swal === "function") {
      swal({
        title: "تمت إعادة الضبط",
        text: "تمت إعادة ضبط الإعدادات",
        icon: "success",
      });
    } else {
      alert("تم إعادة الضبط");
    }
  }

  if (logoInput) {
    logoInput.addEventListener("change", function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return clearLogoPreview();
      readImageFile(f, function (dataUrl) {
        if (dataUrl && logoPreview) {
          logoPreview.src = dataUrl;
          logoPreview.style.display = "block";
        }
      });
    });
  }
  if (clearLogo) clearLogo.addEventListener("click", clearLogoPreview);
  if (saveBtn) saveBtn.addEventListener("click", saveSettings);
  if (resetBtn) resetBtn.addEventListener("click", resetSettings);
  if (addFixedBtn) addFixedBtn.addEventListener("click", addFixedValueUI);

  document.addEventListener("DOMContentLoaded", loadSettings);
})();
