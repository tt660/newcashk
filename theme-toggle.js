(function () {
  const storageKey = "cashak-theme";
  const root = document.documentElement;
  const toggleButtons = document.querySelectorAll("[data-theme-toggle]");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  function getStoredTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch (e) {
      return null;
    }
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    document.body?.setAttribute("data-theme", theme);
    toggleButtons.forEach((button) => {
      const icon = button.querySelector(".theme-toggle__icon");
      const label = button.querySelector(".theme-toggle__label");
      if (icon) {
        icon.textContent = theme === "dark" ? "☀️" : "🌙";
      }
      if (label) {
        label.textContent = theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن";
      }
      button.setAttribute(
        "aria-label",
        theme === "dark"
          ? "التبديل إلى الوضع الفاتح"
          : "التبديل إلى الوضع الداكن",
      );
    });
    try {
      localStorage.setItem(storageKey, theme);
    } catch (e) {}
  }

  const initialTheme = getStoredTheme() || (prefersDark ? "dark" : "light");
  setTheme(initialTheme);

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme =
        root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    });
  });
})();
