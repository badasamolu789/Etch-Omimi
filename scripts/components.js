(function () {
  const registry = new Map();
  const components = window.EtchComponents || {};

  components.register = function register(name, renderFn) {
    registry.set(name, renderFn);
  };

  components.render = function render(name, el, props = {}) {
    const renderFn = registry.get(name);
    if (!renderFn) return;
    const output = renderFn(props);
    if (typeof output === "string") {
      el.innerHTML = output;
    } else if (output instanceof Node) {
      el.appendChild(output);
    } else if (Array.isArray(output)) {
      output.forEach((node) => el.appendChild(node));
    }
    el.classList.add("component-rendered", `component-${name}`);
  };

  function appendIncludeNode(node, target) {
    if (node.nodeName === "SCRIPT") {
      const script = document.createElement("script");
      for (const attr of node.attributes) {
        script.setAttribute(attr.name, attr.value);
      }
      script.textContent = node.textContent;
      target.appendChild(script);
      return;
    }

    if (node.nodeName === "LINK" || node.nodeName === "META" || node.nodeName === "STYLE") {
      const clone = document.createElement(node.nodeName.toLowerCase());
      for (const attr of node.attributes) {
        clone.setAttribute(attr.name, attr.value);
      }
      clone.textContent = node.textContent;
      target.appendChild(clone);
      return;
    }

    target.appendChild(node.cloneNode(true));
  }

  components.init = function init() {
    document.querySelectorAll("[data-component]").forEach((mount) => {
      const name = mount.dataset.component;
      if (!name) return;
      if (name === "include") {
        const src = mount.dataset.src;
        if (src) {
          fetch(src)
            .then((response) => response.text())
            .then((html) => {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, "text/html");
              mount.innerHTML = "";

              Array.from(doc.head.children).forEach((node) => {
                appendIncludeNode(node, document.head);
              });

              Array.from(doc.body.children).forEach((node) => {
                appendIncludeNode(node, mount);
              });

              document.dispatchEvent(new CustomEvent("etch:include-loaded", {
                detail: { src, mount },
              }));
            })
            .catch((error) => {
              console.warn("Unable to load include", src, error);
            });
        }
        return;
      }
      let props = {};
      const json = mount.querySelector("script[type='application/json']");
      if (json) {
        try {
          props = JSON.parse(json.textContent || "{}");
        } catch (error) {
          console.warn("Unable to parse component props", error);
        }
      }
      components.render(name, mount, props);
    });
  };

  const basicCards = (items = []) =>
    items
      .map(
        (item) =>
          `<article class="dashboard-card dashboard-card--compact">
            <p class="dashboard-label">${item.label}</p>
            <h3>${item.title}</h3>
            <p>${item.subtitle}</p>
            ${item.value ? `<strong>${item.value}</strong>` : ""}
          </article>`
      )
      .join("");

  components.register("hero-stat-grid", (props) => {
    const items = props.items || [
      { label: "Curated discovery", title: "Review target under 48 hours.", subtitle: "Premium IP surfaced by category." },
      { label: "Escrow-ready flow", title: "Held in trust until confirmed.", subtitle: "Every transaction is protected through delivery." },
      { label: "Global outlook", title: "Built for rights-led teams.", subtitle: "Creators and buyers can work across markets." },
    ];
    return `<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">${basicCards(items)}</div>`;
  });

  components.register("dashboard-summary-panels", (props) => {
    const items = props.items || [
      { label: "Active projects", title: "14", subtitle: "New work in motion." },
      { label: "Pending approvals", title: "6", subtitle: "Waiting on legal or review." },
      { label: "Live conversations", title: "21", subtitle: "Buyer / creator threads." },
    ];
    return `<div class="dashboard-summary-grid">${basicCards(items)}</div>`;
  });

  components.register("dashboard-activity-list", (props) => {
    const events = props.events || [
      { title: "New license request", meta: "City of Echoes • Draft approval" },
      { title: "Storefront refreshed", meta: "3 titles published" },
      { title: "Payout scheduled", meta: "Next payment in 3 days" },
    ];
    return `
      <div class="component-activity-card">
        <div class="section-header"><h2>Recent activity</h2></div>
        <div class="dashboard-list">${events
        .map(
          (event) =>
            `<div>
                <strong>${event.title}</strong>
                <span>${event.meta}</span>
              </div>`
        )
        .join("")}</div>
      </div>`;
  });

  components.register("dashboard-table", (props) => {
    const columns = props.columns || ["Item", "Owner", "Status", "Action"];
    const rows = props.rows || [];
    const tableHeader = columns.map((col) => `<th>${col}</th>`).join("");
    const tableRows = rows
      .map(
        (row) =>
          `<tr>${columns
            .map((key) => `<td>${row[key.toLowerCase().replace(/\s+/g, "_")] || ""}</td>`)
            .join("")}</tr>`
      )
      .join("");
    return `
      <div class="table-shell">
        <table class="dashboard-table">
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
  });

  function normalizeComponentLink(href) {
    if (!href) return href;
    if (window.EtchRouter && typeof window.EtchRouter.toExtensionlessHref === "function") {
      return window.EtchRouter.toExtensionlessHref(href);
    }
    return href.replace(/\.html$/i, "");
  }

  components.register("dashboard-sidebar", (props) => {
    const items = props.items || [];
    const title = props.title || "Etch dashboard";
    return `
      <div class="dashboard-sidebar">
        <a href="${normalizeComponentLink(props.homeHref || "../index")}" class="brand-mark brand-mark--light">
          <img class="brand-mark__logo" src="${props.logo || "../img/logo/logo.png"}" alt="Etch logo" />
          <span><strong>${title}</strong><small>${props.subTitle || "Workspace"}</small></span>
        </a>
        <nav class="dashboard-nav">
          ${items
        .map(
          (item) => {
            const href = normalizeComponentLink(item.href || "#");
            return `<a class="dashboard-nav__item${item.active ? " dashboard-nav__item--active" : ""}" href="${href}">${item.label}</a>`;
          }
        )
        .join("")}
        </nav>
      </div>`;
  });

  components.register("dashboard-topbar", (props) => {
    return `
      <header class="dashboard-topbar">
        <div>
          <p class="eyebrow">${props.subtitle || "Dashboard"}</p>
          <h1>${props.title || "Overview"}</h1>
        </div>
        <div class="topbar-actions">
          ${props.actionHref ? `<a class="button ${props.actionStyle || "button--primary"}" href="${props.actionHref}">${props.actionLabel || "Action"}</a>` : ""}
        </div>
      </header>`;
  });

  document.addEventListener("DOMContentLoaded", components.init);
  window.EtchComponents = components;
})();
