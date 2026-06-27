(function () {
  const ui = window.EtchUI || {};

  function ensureToastRegion() {
    let region = document.querySelector("[data-toast-region]");
    if (region) return region;
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("data-toast-region", "");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-relevant", "additions");
    document.body.appendChild(region);
    return region;
  }

  ui.toast = function toast(message, type = "info", options = {}) {
    if (!message) return null;
    if (type === "success") return null;
    const region = ensureToastRegion();
    const item = document.createElement("div");
    item.className = `toast toast--${type}`;
    item.setAttribute("role", type === "error" ? "alert" : "status");
    item.innerHTML = `<strong>${type}</strong><span>${message}</span><button type="button" aria-label="Dismiss">&times;</button>`;
    region.appendChild(item);

    const close = () => {
      item.classList.add("toast--leaving");
      window.setTimeout(() => item.remove(), 180);
    };

    item.querySelector("button").addEventListener("click", close);
    window.setTimeout(close, options.duration || 4200);
    return item;
  };

  ui.setButtonLoading = function setButtonLoading(button, isLoading, label = "Working...") {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = label;
      button.disabled = true;
      button.classList.add("is-loading");
      return;
    }
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.classList.remove("is-loading");
  };

  ui.emptyState = function emptyState(title, copy, actionLabel, actionHref) {
    return `
      <div class="empty-state">
        <span class="empty-state__icon">+</span>
        <h3>${title}</h3>
        <p>${copy}</p>
        ${actionLabel && actionHref ? `<a class="button button--secondary" href="${actionHref}">${actionLabel}</a>` : ""}
      </div>`;
  };

  ui.skeletonCards = function skeletonCards(count = 3) {
    return Array.from({ length: count })
      .map(
        () => `
          <article class="dashboard-card skeleton-card" aria-hidden="true">
            <span class="skeleton-line skeleton-line--short"></span>
            <span class="skeleton-line skeleton-line--title"></span>
            <span class="skeleton-line"></span>
          </article>`
      )
      .join("");
  };

  ui.skeletonList = function skeletonList(count = 3) {
    return Array.from({ length: count })
      .map(
        () => `
          <div class="skeleton-list-row" aria-hidden="true">
            <span class="skeleton-line skeleton-line--title"></span>
            <span class="skeleton-line"></span>
          </div>`
      )
      .join("");
  };

  ui.openDialog = function openDialog({ title, content, actionLabel, onAction } = {}) {
    const existing = document.querySelector("[data-dialog-overlay]");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.setAttribute("data-dialog-overlay", "");
    overlay.innerHTML = `
      <section class="dialog-panel" role="dialog" aria-modal="true" aria-label="${title || "Dialog"}">
        <div class="dialog-panel__header">
          <h2>${title || ""}</h2>
          <button class="icon-button" type="button" data-dialog-close aria-label="Close">&times;</button>
        </div>
        <div class="dialog-panel__body">${content || ""}</div>
        ${actionLabel ? `<div class="dialog-panel__footer"><button class="button button--primary" type="button" data-dialog-action>${actionLabel}</button></div>` : ""}
      </section>`;

    document.body.appendChild(overlay);
    document.body.classList.add("has-dialog");

    function close() {
      overlay.remove();
      document.body.classList.remove("has-dialog");
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-dialog-close]")) close();
      if (event.target.closest("[data-dialog-action]") && typeof onAction === "function") onAction(close);
    });

    return { close, element: overlay };
  };

  window.EtchUI = ui;
})();
