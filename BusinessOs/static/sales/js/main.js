/**
 * Biashara OS — Global UI Interactions v3.0
 * Mobile drawer, search filters, alert dismissals, theme persistence, password toggles.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ── 1. Mobile Sidebar Navigation Drawer ─────────────────────────
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

  // Close drawer on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDrawer();
    }
  });

  // Auto-close drawer when clicking any link inside sidebar
  if (sidebar) {
    sidebar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeDrawer);
    });
  }

  // ── 2. Alert Dismissal ───────────────────────────────────────────
  document.querySelectorAll(".alert-dismiss").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const alert = e.target.closest(".alert, .message");
      if (alert) {
        alert.style.transition = "opacity 0.2s ease, transform 0.2s ease";
        alert.style.opacity = "0";
        alert.style.transform = "translateY(-8px)";
        setTimeout(() => alert.remove(), 220);
      }
    });
  });

  // Auto-dismiss success and info alerts after 5 seconds
  setTimeout(() => {
    document.querySelectorAll(".alert-success, .alert-info").forEach((alert) => {
      alert.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      alert.style.opacity = "0";
      alert.style.transform = "translateY(-8px)";
      setTimeout(() => alert.remove(), 400);
    });
  }, 5000);

  // ── 3. Global Instant Search Filter ─────────────────────────────
  const searchInputs = document.querySelectorAll(".search-input");
  searchInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      const targetSelector = input.dataset.target || "table.data-table tbody tr, .searchable-item";
      const items = document.querySelectorAll(targetSelector);

      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = !term || text.includes(term) ? "" : "none";
      });
    });
  });

  // ── 4. Print Action ──────────────────────────────────────────────
  document.querySelectorAll('[data-action="print"]').forEach((btn) => {
    btn.addEventListener("click", () => window.print());
  });

  // ── 5. Password Visibility Toggle ───────────────────────────────
  document.querySelectorAll(".password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const targetId = toggle.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        toggle.textContent = isHidden ? "Hide" : "Show";
      }
    });
  });

  // ── 6. Dark / Light Theme Persistence & Sync ────────────────────
  function syncThemeUI() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.querySelectorAll(".theme-icon-light").forEach((el) => {
      el.style.display = isDark ? "none" : "";
    });
    document.querySelectorAll(".theme-icon-dark").forEach((el) => {
      el.style.display = isDark ? "" : "none";
    });
    document.querySelectorAll(".theme-toggle-label").forEach((el) => {
      el.textContent = isDark ? "Light Mode" : "Dark Mode";
    });
  }

  syncThemeUI();

  // ── 7. Lucide Icons Initializer ─────────────────────────────────
  if (window.lucide) {
    lucide.createIcons();
  }

  // ── 8. Modal Dialogs & Backdrops (non-Alpine fallback) ──────────
  document.querySelectorAll("[data-modal-target]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const targetId = trigger.getAttribute("data-modal-target");
      const modal = document.getElementById(targetId);
      if (modal) modal.classList.add("active");
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((modalBackdrop) => {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop || e.target.classList.contains("modal-close")) {
        modalBackdrop.classList.remove("active");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.active").forEach((m) => m.classList.remove("active"));
    }
  });
});

// ── 9. Skeleton Loading Helpers (global) ─────────────────────────
window.showSkeleton = function(container, count = 3) {
  if (!container) return;
  container.innerHTML = Array(count).fill(0).map(() => `
    <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--color-border);">
      <div class="skeleton skeleton-title" style="margin-bottom: 8px;"></div>
      <div class="skeleton skeleton-text" style="width: 55%;"></div>
    </div>
  `).join("");
};

window.hideSkeleton = function(container) {
  if (container) container.innerHTML = "";
};

// ── 10. Global theme toggle ─────────────────────────────────────
if (typeof window.toggleTheme === "undefined") {
  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("biashara-theme", next);
    if (typeof updateThemeIcons === "function") {
      updateThemeIcons();
    }
  };
}
