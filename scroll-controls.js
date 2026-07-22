// Global scroll controls injected into all pages
(function () {
  function createButton(text, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sc-btn " + (cls || "");
    b.textContent = text;
    return b;
  }

  function smoothScrollTo(y) {
    try {
      window.scrollTo({ top: y, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, y);
    }
  }

  function mount() {
    if (document.getElementById("scrollControls")) return;
    const wrap = document.createElement("div");
    wrap.id = "scrollControls";
    wrap.setAttribute("aria-hidden", "false");
    wrap.style.position = "fixed";
    wrap.style.left = "12px";
    wrap.style.bottom = "12px";
    wrap.style.zIndex = 99999;
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";

    const style = document.createElement("style");
    style.textContent = `
      .sc-btn{background:#0d6efd;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px}
      .sc-btn:disabled{opacity:.5;cursor:default}
    `;
    document.head.appendChild(style);

    const btnTop = createButton("أعلى الصفحة", "top");
    const btnMid = createButton("منتصف الصفحة", "mid");
    const btnBottom = createButton("أسفل الصفحة", "bottom");

    // Scroll so the target position centers in the viewport when possible.
    function calcMid() {
      const docH = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      const viewH = window.innerHeight || document.documentElement.clientHeight;
      const target = Math.max(0, Math.floor((docH - viewH) / 2));
      return target;
    }

    function calcBottom() {
      const docH = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      const viewH = window.innerHeight || document.documentElement.clientHeight;
      return Math.max(0, docH - viewH);
    }

    btnTop.addEventListener("click", () => smoothScrollTo(0));
    btnMid.addEventListener("click", () => smoothScrollTo(calcMid()));
    btnBottom.addEventListener("click", () => smoothScrollTo(calcBottom()));

    wrap.appendChild(btnTop);
    wrap.appendChild(btnMid);
    wrap.appendChild(btnBottom);
    document.body.appendChild(wrap);
  }

  if (document.readyState !== "loading") mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
