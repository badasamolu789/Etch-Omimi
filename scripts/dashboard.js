(function () {
  const navSelector = ".dashboard-nav__item";
  const activeClass = "dashboard-nav__item--active";

  function normalizePath(path) {
    return path
      .replace(/\/index(?:\.html)?$/i, "")
      .replace(/\.html$/i, "")
      .replace(/\/$/, "");
  }

  function highlightNav() {
    const currentPath = normalizePath(window.location.pathname);
    document.querySelectorAll(navSelector).forEach((item) => {
      item.classList.remove(activeClass);
      const href = item.getAttribute("href");
      if (!href || href === "#") return;
      const itemPath = normalizePath(new URL(href, window.location.origin).pathname);
      if (itemPath === currentPath) {
        item.classList.add(activeClass);
      }
    });
  }

  function renderStats(target, stats, options = {}) {
    if (!target) return;
    const feature = options.feature || {};
    target.innerHTML = `
      <article class="dashboard-card dashboard-card--feature${options.admin ? " dashboard-card--admin" : ""}">
        <p class="dashboard-label">${feature.label || "Workspace readiness"}</p>
        <h2>${feature.title || "Manage your creative marketplace from one polished workspace."}</h2>
        <p>${feature.copy || "Track content, licensing, conversations, and revenue without losing operational context."}</p>
      </article>
      ${(stats || [])
        .slice(0, 2)
        .map(
          (stat) => `
            <article class="dashboard-card dashboard-card--metric${options.admin ? " dashboard-card--admin-soft" : ""}">
              <p class="dashboard-label">${stat.label}</p>
              <strong>${stat.value}</strong>
              <span>${stat.detail}</span>
            </article>`
        )
        .join("")}`;
  }

  function renderList(target, title, items, emptyCopy) {
    if (!target) return;
    target.innerHTML = `
      <div class="dashboard-card__header">
        <h3>${title}</h3>
        <span class="meta-pill">Live</span>
      </div>
      ${
        items && items.length
          ? `<div class="dashboard-list">${items
              .map((item) => `<div><strong>${item.title}</strong><span>${item.meta}</span></div>`)
              .join("")}</div>`
          : window.EtchUI.emptyState("Nothing here yet", emptyCopy, null, null)
      }`;
  }

  function statusClass(status) {
    if (status === "live") return "status-pill--live";
    if (status === "review" || status === "changes_requested") return "status-pill--review";
    return "status-pill--draft";
  }

  function renderListingsTable(target, rows) {
    if (!target) return;
    if (!rows.length) {
      target.innerHTML = window.EtchUI.emptyState(
        "No listings yet",
        "Upload your first asset to start building a storefront buyers can trust.",
        "Add listing",
        "uploads"
      );
      return;
    }

    target.innerHTML = `
      <div class="table-shell">
        <table class="dashboard-table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Status</th><th>Views</th></tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td>${row.title || "Untitled"}</td>
                    <td>${row.category || "Uncategorized"}</td>
                    <td><span class="status-pill ${statusClass(row.status)}">${row.status || "draft"}</span></td>
                    <td>${new Intl.NumberFormat("en", { notation: "compact" }).format(row.views_count || 0)}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function hydrateDashboard() {
    if (!window.EtchApi || !window.EtchSupabase || !window.EtchUI) return;
    const path = window.location.pathname;
    const isUserDashboard = path.includes("/user/dashboard");
    const isAdminDashboard = path.includes("/admin/dashboard");
    const isListings = path.includes("/user/listings");
    if (!isUserDashboard && !isAdminDashboard && !isListings) return;

    const heroGrid = document.querySelector("[data-dashboard-stats]");
    const primaryList = document.querySelector("[data-dashboard-primary-list]");
    const secondaryList = document.querySelector("[data-dashboard-secondary-list]");
    const listingsTable = document.querySelector("[data-dashboard-listings]");

    if (heroGrid) heroGrid.innerHTML = window.EtchUI.skeletonCards(3);
    if (primaryList) primaryList.innerHTML = window.EtchUI.skeletonList(3);
    if (secondaryList) secondaryList.innerHTML = window.EtchUI.skeletonList(3);
    if (listingsTable) listingsTable.innerHTML = window.EtchUI.skeletonList(4);

    try {
      const session = await window.EtchSupabase.requireSession(isAdminDashboard ? ["admin"] : ["buyer", "creator", "admin"]);
      if (!session) return;

      if (isAdminDashboard) {
        const dashboard = await window.EtchApi.getAdminDashboard();
        renderStats(heroGrid, dashboard.stats, {
          admin: true,
          feature: {
            label: "Operations overview",
            title: "Moderate, route, and secure the ecosystem with clarity.",
            copy: "Keep content quality, licensing requests, and buyer support flowing through a calm, high-trust workspace.",
          },
        });
        renderList(primaryList, "Admin priorities", dashboard.priorities, "Review queues will appear here as creators submit content.");
        renderList(secondaryList, "Support queue", dashboard.queue, "Support tickets will appear here when buyers or creators need help.");
        return;
      }

      if (isListings) {
        const rows = await window.EtchApi.listCreatorListings(session.user.id);
        renderListingsTable(listingsTable, rows);
        const live = rows.filter((row) => row.status === "live").length;
        const drafts = rows.filter((row) => row.status === "draft").length;
        renderStats(heroGrid, [
          { label: "Active titles", value: live, detail: "Assets currently available in your storefront." },
          { label: "Drafts", value: drafts, detail: "Work in progress awaiting final publishing." },
        ], {
          feature: {
            label: "Live inventory",
            title: "Keep your listings organized, priced, and matched to buyer demand.",
            copy: "Review active assets, update availability, and keep your catalog polished.",
          },
        });
        return;
      }

      const dashboard = await window.EtchApi.getCreatorDashboard(session.user.id);
      renderStats(heroGrid, dashboard.stats, {
        feature: {
          label: "Storefront readiness",
          title: "Present your work like premium IP, not a loose archive.",
          copy: "Track product readiness, protected previews, and licensing conversations from one refined workspace.",
        },
      });
      renderList(primaryList, "Recent listings", dashboard.listings, "Listings will appear here after your first upload.");
      renderList(secondaryList, "Recent activity", dashboard.activity, "Buyer and listing activity will appear here once your storefront is live.");
    } catch (error) {
      console.warn("Dashboard hydration failed:", error);
      window.EtchUI.toast(error.message || "Unable to load dashboard data.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    highlightNav();
    hydrateDashboard();
  });
  window.EtchDashboard = { highlightNav, hydrateDashboard };
})();
