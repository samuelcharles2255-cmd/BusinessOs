/**
 * Biashara OS — Global UI Interactions
 * Mobile drawer navigation, instant search filters, alert dismissals, print triggers.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Mobile Sidebar Navigation Drawer
  const menuToggle = document.querySelector(".menu-toggle-btn");
  const sidebar = document.querySelector(".app-sidebar");
  const backdrop = document.querySelector(".sidebar-backdrop");

  function openDrawer() {
    if (sidebar) sidebar.classList.add("drawer-open");
    if (backdrop) backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    if (sidebar) sidebar.classList.remove("drawer-open");
    if (backdrop) backdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      if (sidebar && sidebar.classList.contains("drawer-open")) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeDrawer);
  }

  // 2. Alert Dismissal
  document.querySelectorAll(".alert-dismiss").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const alert = e.target.closest(".alert, .message");
      if (alert) {
        alert.style.opacity = "0";
        alert.style.transform = "translateY(-8px)";
        setTimeout(() => alert.remove(), 200);
      }
    });
  });

  // Auto-dismiss success messages after 5 seconds
  setTimeout(() => {
    document.querySelectorAll(".alert-success, .message-success").forEach((alert) => {
      alert.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      alert.style.opacity = "0";
      alert.style.transform = "translateY(-8px)";
      setTimeout(() => alert.remove(), 300);
    });
  }, 5000);

  // 3. Global Instant Search Filter (Data Tables & Card Lists)
  const searchInputs = document.querySelectorAll(".search-input");
  searchInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      const targetSelector = input.dataset.target || "table.data-table tbody tr, .searchable-item";
      const items = document.querySelectorAll(targetSelector);

      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        if (!term || text.includes(term)) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
    });
  });

  // 4. Print Action Trigger
  document.querySelectorAll('[data-action="print"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      window.print();
    });
  });

  // 5. Password Visibility Toggle
  document.querySelectorAll(".password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (e) => {
      const targetId = toggle.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === "password") {
          input.type = "text";
          toggle.textContent = "Hide";
        } else {
          input.type = "password";
          toggle.textContent = "Show";
        }
      }
    });
  });

  // 6. Dark / Light Theme Controller
  const storedTheme = localStorage.getItem("biashara_theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = storedTheme || (systemPrefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", initialTheme);

  function updateThemeUI(theme) {
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      const label = btn.querySelector(".theme-toggle-label");
      if (label) {
        label.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
      }
    });
  }
  updateThemeUI(initialTheme);

  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      localStorage.setItem("biashara_theme", nextTheme);
      updateThemeUI(nextTheme);
    });
  });

  // 7. Modal Dialogs & Backdrops
  document.querySelectorAll("[data-modal-target]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const targetId = trigger.getAttribute("data-modal-target");
      const modal = document.getElementById(targetId);
      if (modal) modal.classList.add("active");
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.classList.contains("modal-close")) {
        backdrop.classList.remove("active");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.active").forEach((m) => m.classList.remove("active"));
    }
  });
});


