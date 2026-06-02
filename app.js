const urlParams = new URLSearchParams(window.location.search);

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
    <a href="user-dashboard.html">Dashboard</a>
    <a href="products.html">Saved listings</a>
    <a href="contact.html">Messages</a>
    <a href="signin.html">Sign out</a>
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
  if (event.target.closest(".account-menu")) return;

  document.querySelectorAll(".account-dropdown").forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll(".nav-avatar[aria-expanded='true']").forEach((avatar) => {
    avatar.setAttribute("aria-expanded", "false");
  });
});

const newsletterForm = document.querySelector("[data-newsletter-form]");
const newsletterFeedback = document.querySelector("[data-newsletter-feedback]");

if (newsletterForm && newsletterFeedback) {
  newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    newsletterFeedback.textContent =
      "Subscription received. Expect curated marketplace insights and creator resources soon.";
    newsletterForm.reset();
  });
}

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
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const audience = formData.get("audience");

    if (audience === "executive") {
      contactFeedback.textContent =
        "Your inquiry has been successfully etched into our system. Our team is reviewing your request and you can expect a response within 24 to 48 hours.";
    } else {
      contactFeedback.textContent =
        "Thanks for reaching out. We've received your message and a team member will get back to you shortly to support your creative journey.";
    }

    contactForm.reset();
  });
}

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
