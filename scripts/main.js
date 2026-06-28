const urlParams = new URLSearchParams(window.location.search);

const EtchRouter = window.EtchRouter || {};

function normalizeRoute(path) {
  if (!path) return "/";
  const url = new URL(path, window.location.origin);
  let pathname = url.pathname;
  pathname = pathname.replace(/\/index(?:\.html)?$/i, "/");
  pathname = pathname.replace(/\.html$/i, "");
  pathname = pathname.replace(/\/+$|^\/+/g, "/");
  return pathname === "" ? "/" : pathname;
}

function toExtensionlessHref(href) {
  if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
    return href;
  }

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return href;
    return normalizeRoute(url.pathname) + url.search + url.hash;
  } catch (error) {
    return href;
  }
}

function toFilePath(route) {
  if (!route) return "/index.html";
  const url = new URL(route, window.location.href);
  let pathname = url.pathname;
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  } else if (!pathname.includes(".") || pathname.endsWith("/")) {
    pathname = pathname.replace(/\/+$/, "") + ".html";
  }
  return pathname + url.search + url.hash;
}

function useFallbackRouting() {
  return (
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

EtchRouter.normalizeRoute = normalizeRoute;
EtchRouter.toExtensionlessHref = toExtensionlessHref;
EtchRouter.toFilePath = toFilePath;
EtchRouter.navigate = function navigate(route) {
  const normalized = normalizeRoute(route);
  const target = useFallbackRouting() ? toFilePath(normalized) : normalized;
  window.location.href = target;
};

function syncLocalFileLinkPaths() {
  if (!useFallbackRouting()) return;

  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
    if (href.includes(".html")) return;

    try {
      const url = new URL(href, window.location.href);
      let pathname = url.pathname;
      if (window.location.protocol === "file:" && pathname.startsWith("/")) {
        const currentDir = window.location.pathname.replace(/\/[^/]*$/, "/");
        pathname = currentDir + pathname.replace(/^\//, "");
      }
      if (pathname === "/" || pathname === "") {
        pathname = "/index.html";
      } else if (!pathname.includes(".")) {
        pathname = pathname.replace(/\/+$/, "") + ".html";
      }
      link.setAttribute("href", pathname + url.search + url.hash);
    } catch (error) {
      // ignore invalid file URL mappings
    }
  });
}

function syncInternalLinkPaths() {
  if (useFallbackRouting()) {
    syncLocalFileLinkPaths();
    return;
  }

  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const normalized = toExtensionlessHref(href);
    if (normalized !== href) {
      link.setAttribute("href", normalized);
    }
  });

  document.querySelectorAll("form[action]").forEach((form) => {
    const action = form.getAttribute("action");
    if (!action || action.startsWith("mailto:") || action.startsWith("tel:") || action.startsWith("#")) return;
    const normalized = toExtensionlessHref(action);
    if (normalized !== action) {
      form.setAttribute("action", normalized);
    }
  });
}

function handleInternalExtensionlessClicks(event) {
  const anchor = event.target.closest("a[href]");
  if (!anchor || event.defaultPrevented) return;
  const href = anchor.getAttribute("href");
  if (
    !href ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:") ||
    href.startsWith("#") ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download")
  ) {
    return;
  }

  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const normalized = normalizeRoute(url.pathname);
    if (normalized !== url.pathname || url.pathname.endsWith("/")) {
      if (!useFallbackRouting()) return;
      event.preventDefault();
      window.location.href = toFilePath(normalized + url.search + url.hash);
    }
  } catch (error) {
    // ignore parse errors
  }
}

function currentRouteKey() {
  const route = normalizeRoute(window.location.pathname);
  if (route === "/" || route === "/index") return "/index";
  const firstSegment = route.split("/").filter(Boolean)[0] || "index";
  return `/${firstSegment}`;
}

function linkRouteKey(link) {
  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return "";
  try {
    const url = new URL(href, window.location.href);
    const route = normalizeRoute(url.pathname);
    if (route === "/" || route === "/index") return "/index";
    const firstSegment = route.split("/").filter(Boolean)[0] || "index";
    return `/${firstSegment}`;
  } catch (error) {
    return "";
  }
}

function syncHeaderActiveState() {
  const activeKey = currentRouteKey();
  document.querySelectorAll(".site-header a[href]").forEach((link) => {
    const linkKey = linkRouteKey(link);
    const isActive = linkKey && linkKey === activeKey;
    link.classList.toggle("nav-link--active", isActive && link.classList.contains("nav-link"));
    link.classList.toggle("mobile-link--active", isActive && link.closest(".mobile-menu"));
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function bindHeaderInteractions() {
  document.querySelectorAll("[data-mobile-toggle]").forEach((toggle) => {
    if (toggle.dataset.boundMobileToggle === "true") return;
    const menuId = toggle.getAttribute("aria-controls");
    const menu = menuId ? document.getElementById(menuId) : document.getElementById("mobile-menu");
    if (!menu) return;
    toggle.dataset.boundMobileToggle = "true";

    function setMobileMenuState(isOpen) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      menu.hidden = !isOpen;
    }

    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      setMobileMenuState(!isExpanded);
    });

    menu.querySelector("[data-mobile-close]")?.addEventListener("click", () => {
      setMobileMenuState(false);
    });

    menu.querySelectorAll("a:not(.nav-avatar)").forEach((link) => {
      link.addEventListener("click", () => setMobileMenuState(false));
    });
  });

  syncHeaderActiveState();
}

document.addEventListener("DOMContentLoaded", () => {
  syncInternalLinkPaths();
  document.addEventListener("click", handleInternalExtensionlessClicks);
  bindHeaderInteractions();
  initPublicPageEnhancements();
});

window.EtchRouter = EtchRouter;

function iconForText(text = "") {
  const normalized = text.toLowerCase();
  if (normalized.includes("script") || normalized.includes("story")) return "file-text";
  if (normalized.includes("music") || normalized.includes("audio") || normalized.includes("sync")) return "music-2";
  if (normalized.includes("board") || normalized.includes("visual") || normalized.includes("art")) return "image";
  if (normalized.includes("motion") || normalized.includes("film") || normalized.includes("television")) return "clapperboard";
  if (normalized.includes("copy") || normalized.includes("campaign") || normalized.includes("brand")) return "pen-line";
  if (normalized.includes("license") || normalized.includes("rights") || normalized.includes("terms")) return "badge-check";
  if (normalized.includes("creator") || normalized.includes("verified")) return "user-check";
  if (normalized.includes("secure") || normalized.includes("protect")) return "shield-check";
  if (normalized.includes("search") || normalized.includes("discover") || normalized.includes("find")) return "search";
  if (normalized.includes("request") || normalized.includes("contact")) return "send";
  if (normalized.includes("deal") || normalized.includes("forward")) return "handshake";
  if (normalized.includes("support") || normalized.includes("help")) return "life-buoy";
  return "sparkles";
}

function addLucideIcon(target, iconName) {
  if (!target || target.querySelector(":scope > .ui-icon")) return;
  const icon = document.createElement("i");
  icon.className = "ui-icon";
  icon.setAttribute("data-lucide", iconName);
  icon.setAttribute("aria-hidden", "true");
  target.prepend(icon);
}

function renderLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
    return;
  }
  window.setTimeout(() => {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }, 600);
}

function applyPublicIcons() {
  const iconTargets = [
    ".premium-category-card",
    ".feature-tile",
    ".spotlight-card",
    ".process-grid article",
    ".timeline-grid article",
    ".plain-list div",
    ".license-card",
    ".industry-grid a",
    ".faq-list summary",
  ];

  document.querySelectorAll(iconTargets.join(",")).forEach((item) => {
    addLucideIcon(item, iconForText(item.textContent || ""));
  });
}

function initPublicPageEnhancements() {
  document.querySelectorAll("a, button, h1, h2, h3, span, strong").forEach((item) => {
    if ((item.textContent || "").trim() === "Find Projects") {
      item.textContent = "Browse Listings";
    }
  });

  applyPublicIcons();

  document.querySelectorAll(".section-heading, .luxury-hero__copy, .showcase-rotator, .page-hero__inner, .page-hero > .mx-auto, .page-intro__grid, .premium-category-card, .featured-carousel-card, .feature-tile, .spotlight-card, .market-card, .process-grid article, .timeline-grid article, .plain-list div, .product-detail-card, .contact-panel, .form-shell, .faq-list details").forEach((item, index) => {
    item.classList.add("reveal-item");
    item.style.setProperty("--reveal-delay", `${Math.min(index % 8, 7) * 55}ms`);
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll(".reveal-item").forEach((item) => observer.observe(item));
  } else {
    document.querySelectorAll(".reveal-item").forEach((item) => item.classList.add("is-visible"));
  }

  renderLucideIcons();
}

document.addEventListener("etch:include-loaded", () => {
  syncInternalLinkPaths();
  bindHeaderInteractions();
  initNewsletterForms();
  applyPublicIcons();
  renderLucideIcons();
});

const mobileToggle = document.querySelector("[data-mobile-toggle]");
const mobileMenu = document.getElementById("mobile-menu");
const mobileClose = document.querySelector("[data-mobile-close]");

if (mobileToggle && mobileMenu) {
  function setMobileMenuState(isOpen) {
    mobileToggle.setAttribute("aria-expanded", String(isOpen));
    mobileMenu.hidden = !isOpen;
  }

  mobileToggle.addEventListener("click", () => {
    const isExpanded = mobileToggle.getAttribute("aria-expanded") === "true";
    setMobileMenuState(!isExpanded);
  });

  if (mobileClose) {
    mobileClose.addEventListener("click", () => {
      setMobileMenuState(false);
    });
  }

  mobileMenu.querySelectorAll("a:not(.nav-avatar)").forEach((link) => {
    link.addEventListener("click", () => {
      setMobileMenuState(false);
    });
  });
}

const accountAvatars = document.querySelectorAll(".nav-avatar");

accountAvatars.forEach((avatar, index) => {
  const parent = avatar.parentElement;
  if (!parent || parent.querySelector(".account-dropdown")) return;

  const menuId = `account-menu-${index + 1}`;
  const dropdown = document.createElement("div");
  dropdown.className = "account-dropdown";
  dropdown.id = menuId;
  dropdown.hidden = true;
  dropdown.innerHTML = `
    <a href="user/dashboard">Dashboard</a>
    <a href="products">Saved listings</a>
    <a href="contact">Messages</a>
    <a href="auth/signin" data-signout>Sign out</a>
  `;

  avatar.setAttribute("role", "button");
  avatar.setAttribute("aria-haspopup", "menu");
  avatar.setAttribute("aria-expanded", "false");
  avatar.setAttribute("aria-controls", menuId);
  parent.classList.add("account-menu");
  parent.appendChild(dropdown);

  dropdown.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      dropdown.hidden = true;
      avatar.setAttribute("aria-expanded", "false");
      if (mobileMenu && parent.closest("#mobile-menu")) {
        mobileMenu.hidden = true;
        if (mobileToggle) mobileToggle.setAttribute("aria-expanded", "false");
      }
    });
  });

  avatar.addEventListener("click", (event) => {
    event.preventDefault();
    const isOpen = avatar.getAttribute("aria-expanded") === "true";

    document.querySelectorAll(".account-dropdown").forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll(".nav-avatar[aria-expanded='true']").forEach((item) => {
      item.setAttribute("aria-expanded", "false");
    });

    dropdown.hidden = isOpen;
    avatar.setAttribute("aria-expanded", String(!isOpen));
  });
});

document.addEventListener("click", (event) => {
  const signOutLink = event.target.closest("[data-signout]");
  if (signOutLink) {
    event.preventDefault();
    window.EtchSupabase?.signOut()
      .catch((error) => {
        window.EtchUI?.toast(error.message || "Unable to sign out.", "error");
      })
      .finally(() => {
        (window.EtchRouter?.navigate || ((path) => { window.location.href = path; }))("/auth/signin");
      });
    return;
  }

  if (event.target.closest(".account-menu")) return;

  document.querySelectorAll(".account-dropdown").forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll(".nav-avatar[aria-expanded='true']").forEach((avatar) => {
    avatar.setAttribute("aria-expanded", "false");
  });
});

function initNewsletterForms() {
  document.querySelectorAll("[data-newsletter-form]").forEach((newsletterForm) => {
    if (newsletterForm.dataset.newsletterReady === "true") return;
    const newsletterFeedback = newsletterForm.querySelector("[data-newsletter-feedback]") || newsletterForm.parentElement?.querySelector("[data-newsletter-feedback]");
    if (!newsletterFeedback) return;
    newsletterForm.dataset.newsletterReady = "true";

    newsletterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = new FormData(newsletterForm).get("email")?.toString().trim();
      if (!email) {
        newsletterFeedback.textContent = "Please enter your email address.";
        newsletterFeedback.classList.add("form-feedback--error");
        return;
      }

      const button = newsletterForm.querySelector("button[type='submit']");
      window.EtchUI?.setButtonLoading(button, true, "Subscribing...");
      try {
        const { error } = await window.EtchApi.subscribeNewsletter(email, "homepage");
        if (error) throw error;
        newsletterFeedback.textContent = "Subscription received.";
        newsletterFeedback.classList.remove("form-feedback--error");
        newsletterFeedback.classList.add("form-feedback--success");
        newsletterForm.reset();
      } catch (error) {
        newsletterFeedback.textContent = error.message || "Unable to subscribe right now.";
        newsletterFeedback.classList.add("form-feedback--error");
        window.EtchUI?.toast(newsletterFeedback.textContent, "error");
      } finally {
        window.EtchUI?.setButtonLoading(button, false);
      }
    });
  });
}

initNewsletterForms();

const searchQuery = urlParams.get("q");
const searchInputs = document.querySelectorAll('input[name="q"]');
const searchQueryLabel = document.querySelector("[data-search-query-label]");
const searchQueryCopy = document.querySelector("[data-search-query-copy]");

if (searchQuery) {
  searchInputs.forEach((input) => {
    input.value = searchQuery;
  });

  if (searchQueryLabel) {
    searchQueryLabel.textContent = searchQuery;
  }

  if (searchQueryCopy) {
    searchQueryCopy.textContent = searchQuery;
  }
}

const inlineForms = document.querySelectorAll("[data-inline-form]");

inlineForms.forEach((form) => {
  const feedback = form.querySelector("[data-inline-feedback]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (feedback) {
      feedback.textContent = "Request received. We will tailor the next step for your account.";
    }
    form.reset();
  });
});

const contactForm = document.querySelector("[data-contact-form]");
const contactFeedback = document.querySelector("[data-contact-feedback]");

if (contactForm && contactFeedback) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const payload = {
      name: formData.get("name")?.toString().trim(),
      email: formData.get("email")?.toString().trim(),
      audience: formData.get("audience")?.toString().trim(),
      category: formData.get("category")?.toString().trim(),
      message: formData.get("message")?.toString().trim(),
    };

    if (!payload.name || !payload.email || !payload.audience || !payload.message) {
      contactFeedback.textContent = "Please complete the required fields.";
      contactFeedback.classList.add("form-feedback--error");
      return;
    }

    const button = contactForm.querySelector("button[type='submit']");
    window.EtchUI?.setButtonLoading(button, true, "Sending...");
    try {
      const { error } = await window.EtchApi.submitContact(payload);
      if (error) throw error;
      contactFeedback.textContent =
        payload.audience === "executive"
          ? "Your inquiry has been received. Our team will respond within 24 to 48 hours."
          : "Thanks for reaching out. A team member will get back to you shortly.";
      contactFeedback.classList.remove("form-feedback--error");
      contactFeedback.classList.add("form-feedback--success");
      contactForm.reset();
    } catch (error) {
      contactFeedback.textContent = error.message || "Unable to send your inquiry right now.";
      contactFeedback.classList.add("form-feedback--error");
      window.EtchUI?.toast(contactFeedback.textContent, "error");
    } finally {
      window.EtchUI?.setButtonLoading(button, false);
    }
  });
}

function formatListingPrice(listing) {
  if (!listing.price) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: listing.currency || "USD",
    maximumFractionDigits: 0,
  }).format(Number(listing.price));
}

function listingUrl(listing) {
  const id = encodeURIComponent(listing.slug || listing.id);
  return `product-detail?id=${id}`;
}

function listingAvailability(listing) {
  const source = String(listing.rights_summary || listing.license_type || listing.status || "").toLowerCase();
  if (source.includes("option")) return "Optioned";
  if (source.includes("exclusive")) return "Exclusive";
  if (source.includes("license")) return "Licensed";
  if (source.includes("invite")) return "Invitation Only";
  return "Available";
}

function renderMarketCard(listing, index = 0) {
  const media = listing.cover_url
    ? `<img class="market-card__image" src="${listing.cover_url}" alt="${listing.title || ""}" loading="lazy" />`
    : "";
  return `
    <article class="market-card${index === 0 ? " market-card--featured" : ""}" data-market-card data-category="${listing.category || "Other"}">
      ${media}
      <div class="market-card__body">
        <div class="market-card__meta-row">
          <span class="market-card__label">${listing.category || "Listing"}</span>
          <span class="market-card__price">${listingAvailability(listing)}</span>
        </div>
        <h3>${listing.title || ""}</h3>
        <p>${listing.description || ""}</p>
        <div class="market-card__chips">
          ${listing.category ? `<span class="meta-pill">${listing.category}</span>` : ""}
          ${listing.rights_summary ? `<span class="meta-pill">${listing.rights_summary}</span>` : ""}
          ${listing.views_count ? `<span class="meta-pill">${new Intl.NumberFormat("en", { notation: "compact" }).format(listing.views_count)} views</span>` : ""}
        </div>
      </div>
      <div class="market-card__footer">
        <div class="market-card__seller"><strong>${listing.owner_name || ""}</strong><small>${listing.owner_title || ""}</small></div>
        <a class="market-card__cta" href="${listingUrl(listing)}">View</a>
      </div>
    </article>`;
}

function renderResultCard(listing, index = 0) {
  const media = listing.cover_url
    ? `<img class="result-card__image" src="${listing.cover_url}" alt="${listing.title || ""}" loading="lazy" />`
    : "";
  return `
    <article class="result-card">
      ${media}
      <div>
        <span class="eyebrow">${index === 0 ? "Featured result" : "Top match"}</span>
        <h3 class="section-title !text-3xl">${listing.title || ""}</h3>
        <p class="mt-3 text-slate leading-8">${listing.description || ""}</p>
        <div class="result-meta">
          ${listing.category ? `<span class="meta-pill">${listing.category}</span>` : ""}
          ${listing.rights_summary ? `<span class="meta-pill">${listing.rights_summary}</span>` : ""}
          ${formatListingPrice(listing) ? `<span class="meta-pill">${formatListingPrice(listing)}</span>` : ""}
        </div>
      </div>
    </article>`;
}

function skeletonMarketCards(count = 4) {
  return Array.from({ length: count }).map(() => `
    <article class="market-card skeleton-card" aria-hidden="true">
      <span class="skeleton-block"></span>
      <span class="skeleton-line skeleton-line--short"></span>
      <span class="skeleton-line skeleton-line--title"></span>
      <span class="skeleton-line"></span>
    </article>`).join("");
}

function skeletonHeroStatCards(count = 3) {
  return Array.from({ length: count }).map(() => `
    <article class="skeleton-card" aria-hidden="true">
      <span class="skeleton-line skeleton-line--title"></span>
      <span class="skeleton-line"></span>
    </article>`).join("");
}

function renderHeroStats(summary = {}) {
  return [
    {
      title: `${summary.liveListings ?? 0}`,
      label: "Live listings",
      copy: "Available assets in the marketplace.",
    },
    {
      title: `${summary.creatorCount ?? 0}`,
      label: "Live creators",
      copy: "Creators invited and onboarded to sell.",
    },
    {
      title: `${summary.liveCategories ?? 0}`,
      label: "Categories active",
      copy: "Creative channels currently represented.",
    },
  ]
    .map(
      (item) => `
        <article>
          <strong>${item.title}</strong>
          <span class="text-slate">${item.copy}</span>
        </article>`
    )
    .join("");
}

async function hydrateHeroStats() {
  const statsGrid = document.querySelector("[data-hero-stats]");
  if (!statsGrid || !window.EtchApi) return;

  statsGrid.innerHTML = skeletonHeroStatCards(3);

  try {
    const summary = await window.EtchApi.getPlatformSummary();
    statsGrid.innerHTML = renderHeroStats(summary);
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      statsGrid.innerHTML = renderHeroStats({
        liveListings: "Sample",
        creatorCount: "Preview",
        liveCategories: 6,
      });
      return;
    }
    statsGrid.innerHTML = window.EtchUI.emptyState
      ? window.EtchUI.emptyState("Unable to load stats", "Platform metrics could not be retrieved right now.", "Refresh page", window.location.href)
      : "<p>Unable to load stats.</p>";
    window.EtchUI?.toast(error.message || "Unable to load homepage stats.", "error");
  }
}

function showCollectionError(target, message) {
  if (!target) return;
  target.innerHTML = window.EtchUI?.emptyState
    ? window.EtchUI.emptyState("Unable to load", message, null, null)
    : `<p>${message}</p>`;
}

function isSupabaseConfigError(error) {
  return String(error?.message || error || "").toLowerCase().includes("supabase is not configured");
}

function showSamplePreviewState(target, title = "Sample preview", copy = "Live content will appear here after launch.") {
  if (!target) return;
  target.innerHTML = window.EtchUI?.emptyState
    ? window.EtchUI.emptyState(title, copy, null, null)
    : `<p>${title}</p>`;
}

async function hydratePublicListings() {
  if (!window.EtchApi) return;
  const marketGrid = document.querySelector("[data-public-listings]");
  const searchGrid = document.querySelector("[data-search-results]");
  if (!marketGrid && !searchGrid) return;

  const params = new URLSearchParams(window.location.search);
  const toolbar = document.querySelector("[data-marketplace-toolbar]");
  const query = toolbar?.querySelector("[name='q']")?.value || params.get("q") || "";
  const category = toolbar?.querySelector("[data-marketplace-category]")?.value || "";
  const license = toolbar?.querySelector("[data-marketplace-license]")?.value || "";
  const industry = toolbar?.querySelector("[data-marketplace-industry]")?.value || "";
  const price = toolbar?.querySelector("[data-marketplace-price]")?.value || "";
  const sort = toolbar?.querySelector("[data-marketplace-sort]")?.value || "newest";
  const countLabel = document.querySelector("[data-marketplace-count]");
  const target = marketGrid || searchGrid;
  target.innerHTML = skeletonMarketCards(searchGrid ? 3 : 6);
  if (countLabel) countLabel.textContent = "Loading listings...";

  try {
    const listings = await window.EtchApi.getPublicListings({
      limit: searchGrid ? 12 : 24,
      search: query,
      category,
      license,
      industry,
      price,
      sort,
    });
    if (!listings.length) {
      target.innerHTML = window.EtchUI.emptyState("Sample preview", "Live listings will appear here as creators publish. Browse the preview sections for launch examples.", "Browse all", "products");
      if (countLabel) countLabel.textContent = "0 listings found";
      return;
    }
    target.innerHTML = listings.map(searchGrid ? renderResultCard : renderMarketCard).join("");
    if (countLabel) countLabel.textContent = `${listings.length} listing${listings.length === 1 ? "" : "s"} shown`;
    document.querySelector("[data-market-empty]")?.setAttribute("hidden", "");
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      showSamplePreviewState(target, "Sample preview", "Live listings will appear here once Supabase is connected.");
      if (countLabel) countLabel.textContent = "Sample preview";
      return;
    }
    showCollectionError(target, error.message || "Listings could not be loaded.");
    if (countLabel) countLabel.textContent = "Unable to load listings";
    window.EtchUI?.toast(error.message || "Listings could not be loaded.", "error");
  }
}

function initMarketplaceToolbar() {
  const toolbar = document.querySelector("[data-marketplace-toolbar]");
  if (!toolbar) return;
  const searchForm = toolbar.querySelector("[data-marketplace-search]");
  const clearButton = toolbar.querySelector("[data-marketplace-clear]");

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.EtchApi?.clearCache("public-listings");
    hydratePublicListings();
  });

  toolbar.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", () => {
      window.EtchApi?.clearCache("public-listings");
      hydratePublicListings();
    });
  });

  clearButton?.addEventListener("click", () => {
    searchForm?.reset();
    toolbar.querySelectorAll("select").forEach((select) => {
      select.selectedIndex = 0;
    });
    window.EtchApi?.clearCache("public-listings");
    hydratePublicListings();
  });
}

async function hydrateFeaturedCreators() {
  const grid = document.querySelector("[data-featured-creators]");
  if (!grid || !window.EtchApi) return;
  grid.innerHTML = skeletonMarketCards(3);

  try {
    const creators = await window.EtchApi.getFeaturedCreators(3);
    if (!creators.length) {
      grid.innerHTML = window.EtchUI.emptyState("No creators yet", "Featured creators will appear here after onboarding.", null, null);
      return;
    }
    grid.innerHTML = creators.map((creator) => `
      <article class="spotlight-card">
        ${creator.avatar_url ? `<img class="spotlight-card__image" src="${creator.avatar_url}" alt="${creator.full_name || creator.studio_name || "Creator"}" loading="lazy" />` : ""}
        <span class="eyebrow">${creator.specialization || ""}</span>
        <h3>${creator.studio_name || creator.full_name || ""}</h3>
        <p class="text-slate leading-8">${creator.bio || ""}</p>
      </article>`).join("");
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      showSamplePreviewState(grid, "Sample preview", "Featured creators will appear here once creator profiles are connected.");
      return;
    }
    showCollectionError(grid, error.message || "Featured creators could not be loaded.");
    window.EtchUI?.toast(error.message || "Featured creators could not be loaded.", "error");
  }
}

async function hydrateListingDetail() {
  const panel = document.querySelector("[data-listing-detail]");
  if (!panel || !window.EtchApi) return;
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    panel.innerHTML = window.EtchUI.emptyState("No listing selected", "Open a listing from the marketplace to view details.", "Browse listings", "products");
    return;
  }
  panel.innerHTML = window.EtchUI?.skeletonList ? window.EtchUI.skeletonList(4) : "Loading...";

  try {
    const listing = await window.EtchApi.getListing(id);
    if (!listing) {
      panel.innerHTML = window.EtchUI.emptyState("Listing not found", "This listing may have been archived or is no longer public.", "Browse listings", "products");
      return;
    }

    document.title = `${listing.title} | Etch by OMIMI`;
    panel.innerHTML = `
      <span class="eyebrow">${listing.category || "Listing"}</span>
      <h1 class="section-title">${listing.title || ""}</h1>
      <p class="product-summary">${listing.description || ""}</p>
      <div class="product-meta">
        <span class="meta-pill">${formatListingPrice(listing)}</span>
        ${listing.rights_summary ? `<span class="meta-pill">${listing.rights_summary}</span>` : ""}
        <span class="meta-pill">${new Intl.NumberFormat("en", { notation: "compact" }).format(listing.views_count || 0)} views</span>
      </div>
      <div class="product-cta-stack">
        <a class="button button--primary" href="contact?listing=${encodeURIComponent(listing.slug || listing.id)}">Request Access</a>
        <a class="button button--secondary" href="auth/signin">Save Listing</a>
      </div>
      <div class="product-facts">
        <div><strong>Category</strong><span>${listing.category || ""}</span></div>
        <div><strong>Creator</strong><span>${listing.owner_name || ""}</span></div>
        <div><strong>Status</strong><span>${listing.status || ""}</span></div>
        <div><strong>Rights</strong><span>${listing.rights_summary || ""}</span></div>
      </div>`;

    const heroImage = document.querySelector(".product-hero-media img");
    if (heroImage && listing.cover_url) {
      heroImage.src = listing.cover_url;
      heroImage.alt = listing.title || "";
    }
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      return;
    }
    panel.innerHTML = window.EtchUI.emptyState("Unable to load listing", error.message || "Please try again shortly.", "Browse listings", "products");
    window.EtchUI?.toast(error.message || "Listing could not be loaded.", "error");
  }
}

async function hydrateRelatedListings() {
  const grid = document.querySelector("[data-related-listings]");
  if (!grid || !window.EtchApi) return;
  grid.innerHTML = skeletonMarketCards(3);
  try {
    const listings = await window.EtchApi.getPublicListings({ limit: 3 });
    grid.innerHTML = listings.length
      ? listings.map(renderMarketCard).join("")
      : window.EtchUI.emptyState("No related listings", "More public listings will appear here soon.", null, null);
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      grid.innerHTML = window.EtchUI.emptyState("Sample preview", "Related live listings will appear after launch.", null, null);
      return;
    }
    showCollectionError(grid, error.message || "Related listings could not be loaded.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMarketplaceToolbar();
  hydratePublicListings();
  hydrateFeaturedCreators();
  hydrateHeroStats();
  hydrateListingDetail();
  hydrateRelatedListings();
});

const marketTabGroups = document.querySelectorAll("[data-market-tabs]");

marketTabGroups.forEach((group) => {
  const section = group.closest("section");
  const cards = section ? section.querySelectorAll("[data-market-card]") : [];
  const emptyState = section ? section.querySelector("[data-market-empty]") : null;

  function syncMarketState(filter) {
    let visibleCount = 0;

    cards.forEach((card) => {
      const category = card.getAttribute("data-category");
      const shouldShow = filter === "all" || category === filter;
      card.hidden = !shouldShow;
      if (shouldShow) {
        visibleCount += 1;
      }
    });

    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }
  }

  group.querySelectorAll("[data-market-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.getAttribute("data-market-filter");

      group.querySelectorAll("[data-market-filter]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });

      syncMarketState(filter);
    });
  });

  syncMarketState("all");
});

const autoScrollTracks = document.querySelectorAll("[data-auto-scroll]");

autoScrollTracks.forEach((track) => {
  let isPointerOver = false;
  let resetTimer;
  const originalSlides = Array.from(track.children);
  const originalCount = originalSlides.length;

  originalSlides.forEach((slide) => {
    track.appendChild(slide.cloneNode(true));
  });

  function getMetrics() {
    const firstCard = track.children[0];
    if (!firstCard) {
      return { slideWidth: 0, originalWidth: 0 };
    }

    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 0);
    const slideWidth = firstCard.getBoundingClientRect().width + gap;
    return {
      slideWidth,
      originalWidth: slideWidth * originalCount,
    };
  }

  function normalizeScroll() {
    const { originalWidth } = getMetrics();
    if (!originalWidth) return;

    if (track.scrollLeft >= originalWidth) {
      track.scrollLeft -= originalWidth;
    }

    if (track.scrollLeft < 0) {
      track.scrollLeft += originalWidth;
    }
  }

  track.addEventListener("mouseenter", () => {
    isPointerOver = true;
  });

  track.addEventListener("mouseleave", () => {
    isPointerOver = false;
  });

  track.addEventListener("scroll", () => {
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(normalizeScroll, 120);
  });

  setInterval(() => {
    if (isPointerOver) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 0) return;

    const { slideWidth } = getMetrics();
    if (!slideWidth) return;

    const nextLeft = track.scrollLeft + slideWidth;

    track.scrollTo({
      left: nextLeft,
      behavior: "smooth",
    });
  }, 3500);
});

const loopScrollTracks = document.querySelectorAll("[data-loop-scroll]");

loopScrollTracks.forEach((track) => {
  let isPointerOver = false;
  let resetTimer;
  const originalCards = Array.from(track.children);
  const originalCount = originalCards.length;

  originalCards.forEach((card) => {
    track.appendChild(card.cloneNode(true));
  });

  function getMetrics() {
    const firstCard = track.children[0];
    if (!firstCard) {
      return { step: 0, originalWidth: 0 };
    }

    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 0);
    const step = firstCard.getBoundingClientRect().width + gap;

    return {
      step,
      originalWidth: step * originalCount,
    };
  }

  function normalizeScroll() {
    const { originalWidth } = getMetrics();
    if (!originalWidth) return;

    if (track.scrollLeft >= originalWidth) {
      track.scrollLeft -= originalWidth;
    }

    if (track.scrollLeft < 0) {
      track.scrollLeft += originalWidth;
    }
  }

  track.addEventListener("mouseenter", () => {
    isPointerOver = true;
  });

  track.addEventListener("mouseleave", () => {
    isPointerOver = false;
  });

  track.addEventListener("scroll", () => {
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(normalizeScroll, 120);
  });

  setInterval(() => {
    if (isPointerOver) return;
    const { step } = getMetrics();
    if (!step) return;

    track.scrollTo({
      left: track.scrollLeft + step,
      behavior: "smooth",
    });
  }, 3200);
});
