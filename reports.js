(function () {
  const TX_KEY = "transactions_v1";
  const WALLETS_KEY = "wallets_v1";

  function q(id) {
    return document.getElementById(id);
  }

  function getTx() {
    try {
      return JSON.parse(localStorage.getItem(TX_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function getWallets() {
    try {
      return JSON.parse(localStorage.getItem(WALLETS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function format(n) {
    return Number(n || 0).toFixed(2);
  }

  function normalizeDateValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getTxProfit(t) {
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paid || t.price || 0);
    const storedProfit = Number(t.tradeProfit);

    if (Number.isFinite(storedProfit) && storedProfit !== 0) {
      return storedProfit;
    }

    return t.type === "buy" ? amt - paid : paid - amt;
  }

  function populateWallets() {
    const sel = q("reportWalletSelect");
    if (!sel) return;
    const wallets = getWallets();
    sel.innerHTML =
      '<option value="">الكل</option>' +
      wallets
        .map((w) => `<option value="${w.id}">${w.phone || w.id}</option>`)
        .join("");
  }

  // react to wallet updates from other tabs/scripts
  try {
    window.addEventListener("walletsUpdated", () => {
      try {
        populateWallets();
      } catch (e) {}
    });
    window.addEventListener("storage", (e) => {
      if (e.key === "wallets_v1") populateWallets();
    });
  } catch (e) {}

  function renderProfitValues(netProfit) {
    latestNetProfit = Number(netProfit) || 0;
    const placeholder = "••••";
    const displayValue = profitVisibilityUnlocked
      ? format(latestNetProfit)
      : placeholder;

    const netEl = q("rptNetProfit");
    const summaryEl = q("rptNetProfitSummary");

    if (netEl) netEl.textContent = displayValue;
    if (summaryEl) summaryEl.textContent = displayValue;
  }

  function unlockProfitValues() {
    const inputPassword = prompt("أدخل كلمة المرور لعرض الأرباح", "");
    if (String(inputPassword || "").trim() === PROFIT_VIEW_PASSWORD) {
      profitVisibilityUnlocked = true;
      renderProfitValues(latestNetProfit);
      return true;
    }

    alert("كلمة المرور غير صحيحة");
    return false;
  }

  let lastFiltered = [];
  let chartInstance = null;
  let viewMode = "accordion"; // 'accordion' or 'table'
  let currentPage = 1;
  let pageSize = 10;
  const PROFIT_VIEW_PASSWORD = "8878";
  let profitVisibilityUnlocked = false;
  let latestNetProfit = 0;

  function debounce(fn, wait = 300) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function runReport(e) {
    if (e && e.preventDefault) e.preventDefault();
    const walletId = q("reportWalletSelect").value;
    const category = q("reportCategory") ? q("reportCategory").value : "";
    const from = q("reportFrom").value;
    const to = q("reportTo").value;
    const type = q("reportType").value;
    const opId = (q("reportOpId")?.value || "").trim();
    const phone = (q("reportPhone")?.value || "").trim();
    const minAmount = Number(q("reportMinAmount")?.value || 0) || 0;
    const maxAmount = Number(q("reportMaxAmount")?.value || 0) || 0;
    const search = (q("reportSearch").value || "").trim().toLowerCase();

    const tx = getTx().slice();
    const wallets = getWallets();

    const filtered = tx.filter((t) => {
      if (walletId && String(t.walletId) !== String(walletId)) return false;
      if (category) {
        const w = getWallets().find((w) => String(w.id) === String(t.walletId));
        if (!w || (w.main || "") !== category) return false;
      }
      if (opId && String(t.id) !== String(opId)) return false;
      if (
        phone &&
        !(
          String(t.phone || "").includes(phone) ||
          String(t.walletId || "").includes(phone)
        )
      )
        return false;
      if (type && t.type !== type) return false;
      const txDate = normalizeDateValue(t.date);
      if (from && txDate < from) return false;
      if (to && txDate > to) return false;
      const amt = Number(t.amount) || 0;
      if (minAmount && amt < minAmount) return false;
      if (maxAmount && maxAmount > 0 && amt > maxAmount) return false;
      if (search) {
        const hay = (
          (t.phone || "") +
          " " +
          (t.id || "") +
          " " +
          (t.note || "")
        )
          .toString()
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    // compute aggregates
    const totalTx = filtered.length;
    let totalBuy = 0,
      totalSell = 0,
      totalAmount = 0,
      netProfit = 0;
    filtered.forEach((t) => {
      const amt = Number(t.amount) || 0;
      totalAmount += amt;
      if (t.type === "buy") totalBuy += amt;
      if (t.type === "sell") totalSell += amt;
      const profit = getTxProfit(t);
      netProfit += profit;
    });

    q("rptTotalTx").textContent = totalTx;
    q("rptTotalBuy").textContent = format(totalBuy);
    q("rptTotalSell").textContent = format(totalSell);
    q("rptTotalAmount").textContent = format(totalAmount);
    renderProfitValues(netProfit);

    currentPage = 1;
    renderResults(filtered, wallets, currentPage);
    renderChart(filtered);
    lastFiltered = filtered;
  }

  function renderResults(rows, wallets, page = 1) {
    const acc = q("reportResultsAccordion");
    const tblWrap = q("reportResultsTable");
    if (viewMode === "table") {
      if (acc) acc.style.display = "none";
      if (tblWrap) tblWrap.style.display = "block";
      renderGrid(rows, wallets, page);
    } else {
      if (acc) acc.style.display = "block";
      if (tblWrap) tblWrap.style.display = "none";
      renderTable(rows, wallets);
    }
    renderPagination(rows.length, page, pageSize);
  }

  function renderGrid(rows, wallets, page = 1) {
    const container = q("reportResultsTable");
    container.innerHTML = "";
    const start = (page - 1) * pageSize;
    const pageRows = rows
      .slice()
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      )
      .slice(start, start + pageSize);

    const table = document.createElement("table");
    table.className =
      "table table-striped table-bordered align-middle text-end table-hover";
    table.style.borderRadius = "16px";
    table.style.overflow = "hidden";
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>رقم العملية</th>
        <th>التاريخ</th>
        <th>المحفظة</th>
        <th>النوع</th>
        <th>الرصيد</th>
        <th>المدفوع</th>
        <th>الربح</th>
        <th>الإجراءات</th>
      </tr>
    `;
    table.appendChild(thead);
    const tb = document.createElement("tbody");
    pageRows.forEach((t) => {
      const w = (wallets || getWallets()).find(
        (x) => String(x.id) === String(t.walletId),
      );
      const walletLabel = w ? w.phone || w.id : t.walletId || "";
      const profit =
        Number(t.tradeProfit) ||
        (t.type === "buy"
          ? Number(t.amount || 0) - Number(t.paid || 0)
          : Number(t.paid || 0) - Number(t.amount || 0));
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="fw-bold text-primary">#${t.id}</span></td>
        <td>${(t.date || "").replace("T", " ").slice(0, 19)}</td>
        <td><span class="fw-semibold">${walletLabel}</span></td>
        <td><span class="badge rounded-pill ${t.type === "buy" ? "bg-primary" : "bg-success"}">${t.type === "buy" ? "شراء" : "بيع"}</span></td>
        <td>${format(t.amount)}</td>
        <td>${format(t.paid || t.price)}</td>
        <td class="text-${profit >= 0 ? "success" : "danger"} fw-bold">${format(profit)}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary view-btn">عرض</button>
            <button class="btn btn-outline-success edit-btn">تعديل</button>
            <button class="btn btn-outline-danger del-btn">حذف</button>
            <button class="btn btn-outline-secondary print-btn">طباعة</button>
          </div>
        </td>
      `;
      // attach actions
      tb.appendChild(tr);
      const viewBtn = tr.querySelector(".view-btn");
      const editBtn = tr.querySelector(".edit-btn");
      const delBtn = tr.querySelector(".del-btn");
      const printBtn = tr.querySelector(".print-btn");
      viewBtn.addEventListener("click", () => {
        alert(`تفاصيل العملية #${t.id}\n\nملاحظة: ${t.note || "-"}`);
      });
      editBtn.addEventListener("click", () => editTx(t.id));
      delBtn.addEventListener("click", () => deleteTx(t.id));
      printBtn.addEventListener("click", () => {
        try {
          if (typeof printTx === "function") {
            printTx(t.id);
          } else {
            printSingleTx(t.id);
          }
        } catch (e) {
          printSingleTx(t.id);
        }
      });
    });
    table.appendChild(tb);
    container.appendChild(table);
  }

  function renderPagination(totalRows, page, perPage) {
    const nav = q("reportPagination");
    if (!nav) return;
    nav.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
    const ul = document.createElement("ul");
    ul.className = "pagination justify-content-center my-2";

    function pageItem(p, label = null, active = false, disabled = false) {
      const li = document.createElement("li");
      li.className =
        "page-item" + (active ? " active" : "") + (disabled ? " disabled" : "");
      const a = document.createElement("a");
      a.className = "page-link";
      a.href = "#";
      a.textContent = label || String(p);
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (p === page || disabled) return;
        currentPage = p;
        renderResults(lastFiltered, getWallets(), currentPage);
      });
      li.appendChild(a);
      return li;
    }

    ul.appendChild(pageItem(Math.max(1, page - 1), "«", false, page <= 1));
    // show a small window of pages
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let p = start; p <= end; p++)
      ul.appendChild(pageItem(p, null, p === page));
    ul.appendChild(
      pageItem(Math.min(totalPages, page + 1), "»", false, page >= totalPages),
    );
    nav.appendChild(ul);
  }

  function renderTable(rows, wallets) {
    const container = q("reportResultsAccordion");
    container.innerHTML = "";
    rows
      .slice()
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      )
      .forEach((t, idx) => {
        const wallet = (wallets || getWallets()).find(
          (w) => String(w.id) === String(t.walletId),
        );
        const walletLabel = wallet
          ? wallet.phone || wallet.id
          : t.walletId || "";
        const dateStr = (t.date || "").replace("T", " ").slice(0, 19);
        const profit =
          Number(t.tradeProfit) ||
          (t.type === "buy"
            ? Number(t.amount || 0) - Number(t.paid || 0)
            : Number(t.paid || 0) - Number(t.amount || 0));

        const item = document.createElement("div");
        item.className = "accordion-item mb-2";
        const statusLabel = t.status || (t.completed ? "مكتمل" : t.state || "");
        const clientName =
          t.client || t.name || (t.phone ? t.phone : walletLabel);
        const product = t.product || t.note || "-";
        const qty = t.qty || t.quantity || t.count || "";
        item.innerHTML = `
          <h2 class="accordion-header" id="heading${t.id}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${t.id}" aria-expanded="false" aria-controls="collapse${t.id}">
              <div class="w-100">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    ${statusLabel ? `<span class="badge rounded-pill bg-success-subtle text-success-emphasis me-2">${statusLabel}</span>` : ""}
                  </div>
                  <div class="text-primary fw-bold">ORD-${t.id}</div>
                </div>

                <div class="row text-center gy-2">
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">العميل:</div>
                    <div class="fw-semibold">${clientName}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">الهاتف:</div>
                    <div>${t.phone || "-"}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">المنتج:</div>
                    <div>${product}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">الإجمالي:</div>
                    <div class="text-warning fw-bold">${format(t.amount)}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">الكمية:</div>
                    <div>${qty || "-"}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">التاريخ:</div>
                    <div>${dateStr}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">المدفوع:</div>
                    <div>${format(t.paid || t.price)}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted small">الربح:</div>
                    <div class="fw-bold text-${profit >= 0 ? "success" : "danger"}">${format(profit)}</div>
                  </div>
                </div>
              </div>
            </button>
          </h2>
          <div id="collapse${t.id}" class="accordion-collapse collapse" aria-labelledby="heading${t.id}" data-bs-parent="#reportResultsAccordion">
            <div class="accordion-body">
              <div class="mb-2">ملاحظة: ${t.note || "-"}</div>
              <div class="d-flex gap-2 flex-wrap justify-content-end">
                <button class="btn btn-sm btn-outline-primary view-btn">عرض</button>
                <button class="btn btn-sm btn-outline-success edit-btn">تعديل</button>
                <button class="btn btn-sm btn-outline-danger del-btn">حذف</button>
                <button class="btn btn-sm btn-outline-secondary print-btn">طباعة</button>
              </div>
            </div>
          </div>
        `;

        // attach actions
        container.appendChild(item);
        const viewBtn = item.querySelector(".view-btn");
        const editBtn = item.querySelector(".edit-btn");
        const delBtn = item.querySelector(".del-btn");
        const printBtn = item.querySelector(".print-btn");
        viewBtn.addEventListener("click", () => {
          const el = item.querySelector(".accordion-collapse");
          const bs = bootstrap.Collapse.getOrCreateInstance(el);
          bs.toggle();
        });
        editBtn.addEventListener("click", () => editTx(t.id));
        delBtn.addEventListener("click", () => deleteTx(t.id));
        printBtn.addEventListener("click", () => {
          // prefer the full print function from home.js if available
          try {
            if (typeof printTx === "function") {
              printTx(t.id);
            } else {
              printSingleTx(t.id);
            }
          } catch (e) {
            printSingleTx(t.id);
          }
        });
      });
  }

  async function deleteTx(id) {
    if (!(await swalConfirm("تأكيد حذف العملية؟"))) return;
    const tx = getTx();
    const idx = tx.findIndex((t) => t.id === id);
    if (idx === -1) return alert("المعاملة غير موجودة");
    tx.splice(idx, 1);
    localStorage.setItem(TX_KEY, JSON.stringify(tx));
    runReport();
  }

  function editTx(id) {
    const tx = getTx();
    const idx = tx.findIndex((t) => t.id === id);
    if (idx === -1) return alert("المعاملة غير موجودة");
    const t = tx[idx];
    const newAmt = prompt("تعديل الرصيد المشحون", t.amount);
    if (newAmt === null) return;
    const newPaid = prompt("تعديل المبلغ المدفوع", t.paid || t.price || 0);
    if (newPaid === null) return;
    const newPhone = prompt("تعديل رقم الهاتف/المحفظة", t.phone || "");
    if (newPhone === null) return;
    t.amount = Number(newAmt) || 0;
    t.paid = Number(newPaid) || 0;
    t.phone = newPhone;
    t.tradeProfit =
      t.type === "buy"
        ? Number(t.amount) - Number(t.paid)
        : Number(t.paid) - Number(t.amount);
    t.total = Number(t.diff || 0) + Number(t.tradeProfit || 0);
    t.date = new Date().toISOString();
    tx[idx] = t;
    localStorage.setItem(TX_KEY, JSON.stringify(tx));
    runReport();
  }

  function printSingleTx(id) {
    const tx = getTx().find((t) => t.id === id);
    if (!tx) return alert("المعاملة غير موجودة");
    const w = getWallets().find((x) => String(x.id) === String(tx.walletId));
    const logo = "";
    const shop = "";
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة</title><style>@page{margin:6mm}body{font-family:Inter,Arial,sans-serif;direction:rtl;padding:6px} .center{text-align:center}</style></head><body><div class="center">${shop}</div><div>التاريخ: ${(tx.date || "").replace("T", " ").slice(0, 19)}</div><div>رقم العملية: ${tx.id}</div><div>نوع: ${tx.type}</div><div>المحفظة: ${w ? w.phone || w.id : tx.walletId}</div><hr><div>الرصيد المشحون: ${format(tx.amount)}</div><div>المبلغ المدفوع: ${format(tx.paid || tx.price)}</div><div>الربح: ${format(Number(tx.tradeProfit) || 0)}</div></body></html>`;
    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  function renderChart(rows) {
    // simple dataset: total buy vs sell
    const buys = rows
      .filter((r) => r.type === "buy")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const sells = rows
      .filter((r) => r.type === "sell")
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    if (typeof Chart === "undefined") {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = draw;
      document.head.appendChild(s);
    } else draw();
  }

  function exportCsv() {
    if (!lastFiltered || !lastFiltered.length)
      return alert("لا توجد بيانات للتصدير");
    const rows = lastFiltered;
    const headers = [
      "id",
      "date",
      "wallet",
      "type",
      "amount",
      "paid",
      "profit",
    ];
    const wallets = getWallets();
    const lines = [headers.join(",")];
    rows.forEach((t) => {
      const w = wallets.find((x) => String(x.id) === String(t.walletId));
      const walletLabel = w ? w.phone || w.id : t.walletId || "";
      const profit = Number(t.tradeProfit) || 0;
      lines.push(
        [
          t.id,
          t.date || "",
          walletLabel,
          t.type,
          format(t.amount),
          format(t.paid || t.price),
          format(profit),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    if (!lastFiltered || !lastFiltered.length)
      return alert("لا توجد بيانات للتصدير");
    // load SheetJS if needed
    function runXlsx() {
      const ws_data = [
        ["id", "date", "wallet", "type", "amount", "paid", "profit"],
      ];
      const wallets = getWallets();
      lastFiltered.forEach((t) => {
        const w = wallets.find((x) => String(x.id) === String(t.walletId));
        const walletLabel = w ? w.phone || w.id : t.walletId || "";
        const profit = Number(t.tradeProfit) || 0;
        ws_data.push([
          t.id,
          t.date || "",
          walletLabel,
          t.type,
          Number(t.amount) || 0,
          Number(t.paid || t.price) || 0,
          profit,
        ]);
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    if (typeof XLSX === "undefined") {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
      s.onload = runXlsx;
      document.head.appendChild(s);
    } else runXlsx();
  }

  function printReport() {
    const rows = lastFiltered || [];
    const wallets = getWallets();
    let html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير</title><style>body{font-family:Inter,Arial,sans-serif;direction:rtl;padding:10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:right}</style></head><body>`;
    html += `<h3>تقرير — ${new Date().toLocaleString()}</h3>`;
    html +=
      "<table><thead><tr><th>رقم العملية</th><th>التاريخ</th><th>المحفظة</th><th>نوع</th><th>الرصيد المشحون</th><th>المبلغ المدفوع</th><th>الأرباح</th></tr></thead><tbody>";
    rows.forEach((t) => {
      const w = wallets.find((x) => String(x.id) === String(t.walletId));
      const walletLabel = w ? w.phone || w.id : t.walletId || "";
      const profit = Number(t.tradeProfit) || 0;
      html += `<tr><td>${t.id}</td><td>${t.date || ""}</td><td>${walletLabel}</td><td>${t.type}</td><td>${format(t.amount)}</td><td>${format(t.paid || t.price)}</td><td>${format(profit)}</td></tr>`;
    });
    html += "</tbody></table>";
    html += "</body></html>";
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  function attach() {
    q("runReportBtn")?.addEventListener("click", runReport);
    // live filters: change events trigger report
    ["reportWalletSelect", "reportFrom", "reportTo", "reportType"].forEach(
      (id) => q(id)?.addEventListener("change", runReport),
    );
    // search input with debounce
    const searchEl = q("reportSearch");
    if (searchEl) searchEl.addEventListener("input", debounce(runReport, 300));
    q("exportCsv")?.addEventListener("click", exportCsv);
    q("exportExcel")?.addEventListener("click", exportExcel);
    q("printReport")?.addEventListener("click", printReport);
    q("unlockProfitBtn")?.addEventListener("click", unlockProfitValues);
    q("unlockProfitSummaryBtn")?.addEventListener("click", unlockProfitValues);
    // populate wallets and run initial report
    populateWallets();
    // view toggle
    const accBtn = q("reportViewAccordion");
    const tblBtn = q("reportViewTable");
    if (accBtn && tblBtn) {
      accBtn.addEventListener("click", () => {
        viewMode = "accordion";
        accBtn.classList.add("active");
        tblBtn.classList.remove("active");
        renderResults(lastFiltered, getWallets(), 1);
      });
      tblBtn.addEventListener("click", () => {
        viewMode = "table";
        tblBtn.classList.add("active");
        accBtn.classList.remove("active");
        renderResults(lastFiltered, getWallets(), 1);
      });
    }
    // populate categories if available
    try {
      const raw = localStorage.getItem("wallet_categories_v1");
      const cats = raw ? JSON.parse(raw) : [];
      const catSel = q("reportCategory");
      if (catSel)
        catSel.innerHTML =
          '<option value="">الكل</option>' +
          cats
            .map((c) => `<option value="${c.name}">${c.name}</option>`)
            .join("");
    } catch (e) {}
    runReport();
  }

  document.addEventListener("DOMContentLoaded", attach);
})();
