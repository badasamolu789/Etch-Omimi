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

  async function initListingCreateForm() {
    const form = document.querySelector("[data-listing-create-form]");
    if (!form || !window.EtchApi || !window.EtchSupabase || !window.EtchUI) return;
    const status = form.querySelector("[data-form-status]");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      if (status) status.textContent = "";
      window.EtchUI.setButtonLoading(button, true, "Publishing...");

      try {
        const session = await window.EtchSupabase.requireSession(["creator", "admin"]);
        if (!session) return;

        const payload = {
          owner_id: session.user.id,
          title: String(formData.get("title") || "").trim(),
          category: String(formData.get("category") || "").trim(),
          description: String(formData.get("description") || "").trim(),
          price: Number(formData.get("price") || 0),
          currency: "USD",
          status: String(formData.get("status") || "draft"),
          cover_url: String(formData.get("cover_url") || "").trim() || null,
          preview_url: String(formData.get("preview_url") || "").trim() || null,
          rights_summary: String(formData.get("rights_summary") || "").trim(),
        };

        if (!payload.title || !payload.category) {
          throw new Error("Add a title and category before saving the listing.");
        }

        const { error } = await window.EtchApi.createListing(payload);
        if (error) throw error;
        form.reset();
        if (status) status.textContent = "Listing saved. You can review it from your Listings page.";
      } catch (error) {
        if (status) status.textContent = "";
        window.EtchUI.toast(error.message || "Unable to save listing.", "error");
      } finally {
        window.EtchUI.setButtonLoading(button, false);
      }
    });
  }

  async function hydrateDashboard() {
    if (!window.EtchApi || !window.EtchSupabase || !window.EtchUI) return;
    const path = window.location.pathname;
    const isUserDashboard = path.includes("/user/dashboard");
    const isAdminDashboard = path.includes("/admin/dashboard");
    const isListings = path.includes("/user/listings");
    const creatorQueueMap = {
      "/user/storefront": {
        loader: (session) => window.EtchApi.getCreatorStorefront(session.user.id),
        feature: {
          label: "Storefront pulse",
          title: "Polish your storefront presentation to increase buyer confidence.",
          copy: "Optimize categories, hero assets, and live visibility from a clean storefront overview.",
        },
        listTitle: "Top storefront assets",
        emptyCopy: "Live storefront assets will appear here once your listings are published.",
      },
      "/user/messages": {
        loader: (session) => window.EtchApi.getCreatorMessages(session.user.id),
        feature: {
          label: "Workspace communication",
          title: "Respond quickly to buyers, collaborators, and licensing conversations.",
          copy: "Messages are grouped by urgency so you can prioritize requests from buyers and production partners.",
        },
        listTitle: "Recent messages",
        emptyCopy: "Buyer conversations will appear here once inquiries arrive.",
      },
      "/user/licensing": {
        loader: (session) => window.EtchApi.getCreatorLicensing(session.user.id),
        feature: {
          label: "Deal pipeline",
          title: "Manage licensing requests, proposals, and approvals from a central work feed.",
          copy: "Keep negotiations transparent and move each request through a clear approval path.",
        },
        listTitle: "Recent licensing activity",
        emptyCopy: "Licensing requests will appear here after buyers contact you.",
      },
      "/user/sales-earnings": {
        loader: (session) => window.EtchApi.getCreatorEarnings(session.user.id),
        feature: {
          label: "Earnings outlook",
          title: "See revenue, payouts, and performance in a single workspace.",
          copy: "Review income, payout state, and license value without leaving your CMS.",
        },
        listTitle: "Revenue timeline",
        emptyCopy: "Sales and payout activity will appear here after your first completed license.",
      },
    };
    const adminQueueMap = {
      "/admin/content-review": {
        type: "content",
        feature: {
          label: "Review pipeline",
          title: "Keep marketplace content aligned with quality standards and licensing policy.",
          copy: "Review new submissions, flag compliance issues, and route content to the right reviewer.",
        },
        listTitle: "Recent review items",
        emptyCopy: "Review items will appear here when creators submit listings.",
      },
      "/admin/licensing-queue": {
        type: "licensing",
        feature: {
          label: "Queue overview",
          title: "Monitor licensing demand, approvals, and request age.",
          copy: "Sort requests by status and assign tickets to compliance or fulfillment teams.",
        },
        listTitle: "Active licensing requests",
        emptyCopy: "Licensing requests will appear here when buyers contact creators.",
      },
      "/admin/escrow-payouts": {
        type: "payouts",
        feature: {
          label: "Payment control",
          title: "Oversee escrow releases, payout approvals, and settlement timing.",
          copy: "Keep all payment flows aligned with licensing agreements and buyer milestones.",
        },
        listTitle: "Recent payout actions",
        emptyCopy: "Pending payouts will appear here when payment records are created.",
      },
      "/admin/support-inbox": {
        type: "support",
        feature: {
          label: "Support queue",
          title: "Track open tickets and resolve issues for creators and buyers.",
          copy: "Prioritize responses and keep support requests flowing through a structured process.",
        },
        listTitle: "Recent inquiries",
        emptyCopy: "Support tickets will appear here when users request help.",
      },
      "/admin/users": {
        type: "users",
        feature: {
          label: "User oversight",
          title: "Review member status, permissions, and activity in a single admin workspace.",
          copy: "Manage creator, buyer, and admin accounts with clarity and security controls.",
        },
        listTitle: "User list",
        emptyCopy: "User profiles will appear here after account creation.",
      },
    };
    const creatorQueue = Object.entries(creatorQueueMap).find(([key]) => path.includes(key))?.[1];
    const adminQueue = Object.entries(adminQueueMap).find(([key]) => path.includes(key))?.[1];
    if (!isUserDashboard && !isAdminDashboard && !isListings && !creatorQueue && !adminQueue) return;

    const heroGrid = document.querySelector("[data-dashboard-stats]");
    const primaryList = document.querySelector("[data-dashboard-primary-list]");
    const secondaryList = document.querySelector("[data-dashboard-secondary-list]");
    const listingsTable = document.querySelector("[data-dashboard-listings]");

    if (heroGrid) heroGrid.innerHTML = window.EtchUI.skeletonCards(3);
    if (primaryList) primaryList.innerHTML = window.EtchUI.skeletonList(3);
    if (secondaryList) secondaryList.innerHTML = window.EtchUI.skeletonList(3);
    if (listingsTable) listingsTable.innerHTML = window.EtchUI.skeletonList(4);

    try {
      const session = await window.EtchSupabase.requireSession(isAdminDashboard || adminQueue ? ["admin"] : ["creator", "admin"]);
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

      if (adminQueue) {
        const dashboard = await window.EtchApi.getAdminWorkQueue(adminQueue.type);
        renderStats(heroGrid, dashboard.stats, { admin: true, feature: adminQueue.feature });
        renderList(primaryList, adminQueue.listTitle, dashboard.items, adminQueue.emptyCopy);
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

      if (creatorQueue) {
        const dashboard = await creatorQueue.loader(session);
        renderStats(heroGrid, dashboard.stats, { feature: creatorQueue.feature });
        renderList(primaryList, creatorQueue.listTitle, dashboard.items, creatorQueue.emptyCopy);
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
    initListingCreateForm();
  });
  window.EtchDashboard = { highlightNav, hydrateDashboard };
})();
