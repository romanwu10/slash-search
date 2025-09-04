"use strict";

// Slash Search — content script
// Captures '/' and focuses the page's primary search input.

// Guard: don't run in editable contexts or designMode
const isEditableTarget = (el) => {
  if (!el) return false;
  // If within a shadow root, use the composed path's first element
  const t = el instanceof Element ? el : null;
  const editableRoles = ["textbox", "combobox", "searchbox"];
  return (
    (t && (t.closest('input, textarea, [contenteditable="true"]') !== null)) ||
    (t && editableRoles.some((r) => t.closest(`[role="${r}"]`) !== null))
  );
};

const isVisible = (el) => {
  if (!(el instanceof Element)) return false;
  // Filter out disabled/readonly/hidden
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.hasAttribute("hidden")) return false;

  let e = el;
  while (e) {
    const style = window.getComputedStyle(e);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
      return false;
    }
    e = e.parentElement;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
};

const focusAndSelect = (el) => {
  try {
    // Try not to jump scroll; if not visible, center it
    el.focus({ preventScroll: true });
  } catch (_) {
    el.focus();
  }
  if (!isInViewport(el)) {
    el.scrollIntoView({ block: "center", inline: "nearest" });
  }
  // Select existing text to make replacing easy
  try {
    if (typeof el.select === "function") {
      el.select();
    } else if (el.setSelectionRange && typeof el.value === "string") {
      el.setSelectionRange(0, el.value.length);
    }
  } catch (_) {
    // noop
  }
};

const isInViewport = (el) => {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

// Site-specific selectors for reliability
const SITE_ADAPTERS = [
  // Chrome Web Store (new experience uses shadow DOM)
  {
    test: (h) => /(^|\.)chromewebstore\.google\.com$/i.test(h),
    find: () => {
      // First try obvious light DOM cases
      const light = pickFirstVisible([
        "[role='search'] input[type='search']",
        "form[role='search'] input[type='search']",
        "input[role='searchbox']",
        "input[type='search']",
        "input[aria-label*='search' i]",
        "input[placeholder*='search' i]"
      ]);
      if (light) return light;

      // Fallback: search through open shadow roots for common patterns
      const deep = pickFirstVisibleDeep([
        "[role='search'] input[type='search']",
        "form[role='search'] input[type='search']",
        "input[role='searchbox']",
        "input[type='search']",
        "input[name='q']",
        "input[name*='search' i]",
        "input[id*='search' i]",
        "input[class*='search' i]",
        "input[aria-label*='search' i]",
        "input[placeholder*='search' i]",
        "#search, #search-box, #searchbox, #search-field, #search-query, #search-input"
      ]);
      return deep || null;
    }
  },
  // Microsoft Edge site (Edge Add-ons pages)
  {
    test: (h) => /(^|\.)microsoftedge\.microsoft\.com$/i.test(h),
    find: () => {
      const light = pickFirstVisible([
        "[role='search'] input[type='search']",
        "form[role='search'] input[type='search']",
        "input[role='searchbox']",
        "input[type='search']",
        "input[name='q']",
        "input[aria-label*='search' i]",
        "input[placeholder*='search' i]",
        "input[placeholder*='extensions' i]"
      ]);
      if (light) return light;

      const deep = pickFirstVisibleDeep([
        "[role='search'] input[type='search']",
        "form[role='search'] input[type='search']",
        "input[role='searchbox']",
        "input[type='search']",
        "input[name='q']",
        "input[name*='search' i]",
        "input[id*='search' i]",
        "input[class*='search' i]",
        "input[aria-label*='search' i]",
        "input[placeholder*='search' i]",
        "input[placeholder*='extensions' i]",
        "#search, #search-box, #searchbox, #search-field, #search-query, #search-input"
      ]);
      return deep || null;
    }
  },
  {
    test: (h) => /(^|\.)amazon\./i.test(h),
    selectors: [
      "#twotabsearchtextbox",
      "#nav-bb-search",
      "form[name='site-search'] input[type='search']"
    ]
  },
  {
    test: (h) => /(^|\.)linkedin\.com$/i.test(h) || /(^|\.)linkedin\.com$/i.test(h.replace(/^www\./, "")),
    selectors: [
      "input.search-global-typeahead__input",
      "input.search-global-typeahead__search-input",
      "input[placeholder*='Search' i][role='combobox']",
      "header input[placeholder*='Search' i]"
    ]
  },
  // Reddit (improve coverage)
  {
    test: (h) => /(^|\.)reddit\.com$/i.test(h),
    selectors: [
      "#header-search-bar",
      "input[placeholder*='Search' i]"
    ]
  },
  // Bilibili
  {
    test: (h) => /(^|\.)bilibili\.com$/i.test(h),
    selectors: [
      "#nav-searchform input[type='text']",
      "input.nav-search-input",
      "input#search-keyword",
      "input[placeholder*='搜索']",
      "input[placeholder*='Search' i]"
    ]
  },
  // SHEIN
  {
    test: (h) => /(^|\.)shein\.com$/i.test(h),
    selectors: [
      "input#searchInput",
      "input[name='keywords']",
      "input[name='q']",
      "input[type='search']",
      "input[placeholder*='Search' i]"
    ]
  },
  // Apple (may need to open the search UI first)
  {
    test: (h) => /(^|\.)apple\.com$/i.test(h),
    find: () => {
      const queryInput = () =>
        document.querySelector(
          "#ac-gn-searchform-input, form#ac-gn-searchform input[type='search'], .ac-gn-searchform input[type='search']"
        );
      let input = queryInput();
      if (input && isVisible(input)) return input;
      const opener = document.querySelector(
        "button.ac-gn-link-search, a#ac-gn-link-search, .ac-gn-link-search, button[aria-label*='Search' i], [data-analytics-title='open-search']"
      );
      if (opener) {
        try { opener.click(); } catch (_) {}
        // Force a sync layout pass and try again
        void document.body.offsetHeight;
        input = queryInput();
        if (input && isVisible(input)) return input;
      }
      return input && isSearchyInput(input) ? input : null;
    }
  },
  // TikTok
  {
    test: (h) => /(^|\.)tiktok\.com$/i.test(h),
    selectors: [
      "input[data-e2e='search-user-input']",
      "form[role='search'] input[type='search']",
      "input[placeholder*='Search' i]"
    ]
  },
  // Pinterest
  {
    test: (h) => /(^|\.)pinterest\.com$/i.test(h),
    selectors: [
      "input[data-test-id='search-box-input']",
      "input[name='q']",
      "input[placeholder*='Search' i]"
    ]
  },
  // IMDb
  {
    test: (h) => /(^|\.)imdb\.com$/i.test(h),
    selectors: [
      "input#suggestion-search",
      "form[action*='/find'] input[type='text']",
      "form[action*='/find'] input[type='search']",
      "input[aria-label*='Search IMDb' i]",
      "input[placeholder*='Search IMDb' i]",
      "header input[name='q']"
    ]
  },
  // AliExpress
  {
    test: (h) => /(^|\.)aliexpress\./i.test(h),
    selectors: [
      "input#search-key",
      "input#search-words",
      "input[name='SearchText']",
      "form[role='search'] input[type='search']",
      "input[aria-label*='Search' i]",
      "input[placeholder*='Search' i]"
    ]
  },
  // ePorner
  {
    test: (h) => /(^|\.)eporner\.com$/i.test(h),
    selectors: [
      "form#search_form input[type='text']",
      "input#query",
      "input[name='q']",
      "input[type='search']",
      "header input[placeholder*='Search' i]"
    ]
  },
  // Home Depot
  {
    test: (h) => /(^|\.)homedepot\.com$/i.test(h),
    selectors: [
      "input#headerSearch",
      "input#SearchBox",
      "input[name='keyword']",
      "form[role='search'] input[type='search']",
      "input[placeholder*='Search' i]"
    ]
  },
  // Realtor.ca
  {
    test: (h) => /(^|\.)realtor\.ca$/i.test(h),
    selectors: [
      "input#homeSearch",
      "input[name='searchText']",
      "input[aria-label*='Search' i]",
      "input[placeholder*='Search' i]",
      "form[role='search'] input[type='search']"
    ]
  },
  // Costco
  {
    test: (h) => /(^|\.)costco\.com$/i.test(h),
    selectors: [
      "input#search-field",
      "input[name='keyword']",
      "form[role='search'] input[type='search']",
      "input[placeholder*='Search' i]"
    ]
  },
  // MeteoMedia (The Weather Network FR)
  {
    test: (h) => /(^|\.)meteomedia\.com$/i.test(h),
    selectors: [
      "input#search",
      "input[name='search']",
      "form[role='search'] input[type='search']",
      "input[aria-label*='Recherche' i]",
      "input[placeholder*='Recherche' i]",
      "input[placeholder*='Search' i]"
    ]
  },
  // eBay
  {
    test: (h) => /(^|\.)ebay\.com$/i.test(h),
    selectors: [
      "#gh-ac",
      "input[name='_nkw']",
      "form[role='search'] input[type='search']",
      "input[placeholder*='Search' i]"
    ]
  },
  // Weather.com
  {
    test: (h) => /(^|\.)weather\.com$/i.test(h),
    selectors: [
      "#LocationSearch_input",
      "form[role='search'] input[type='search']",
      "input[aria-label*='Search' i]",
      "input[placeholder*='Search' i]"
    ]
  },
  // Fandom
  {
    test: (h) => /(^|\.)fandom\.com$/i.test(h),
    selectors: [
      "#searchInput",
      "input[name='search']",
      "input[name='query']",
      "form[role='search'] input[type='search']",
      "input[placeholder*='Search' i]"
    ]
  },
  // Pornhub
  {
    test: (h) => /(^|\.)pornhub\.com$/i.test(h),
    selectors: [
      "input#search",
      "input#searchInput",
      "input#search-input",
      "input#searchBar",
      "input[name='search']",
      "input[type='search']",
      "header input[placeholder*='Search' i]"
    ]
  },
  // XVideos
  {
    test: (h) => /(^|\.)xvideos\.com$/i.test(h),
    selectors: [
      "input#search-input",
      "input[name='k']",
      "input[name='q']",
      "input[type='search']",
      "header input[placeholder*='Search' i]"
    ]
  },
  // XHamster
  {
    test: (h) => /(^|\.)xhamster\.com$/i.test(h),
    selectors: [
      "input[name='q']",
      "input#search-input",
      "input[type='search']",
      "header input[placeholder*='Search' i]"
    ]
  },
  // XNXX
  {
    test: (h) => /(^|\.)xnxx\.com$/i.test(h),
    selectors: [
      "input#search-input",
      "input[name='search']",
      "input[name='k']",
      "input[name='q']",
      "input[type='search']",
      "header input[placeholder*='Search' i]"
    ]
  },
  {
    test: (h) => /(^|\.)wikipedia\.org$/i.test(h),
    selectors: ["#searchInput", "input[name='search']"]
  },
  {
    test: (h) => /(^|\.)stackoverflow\.com$/i.test(h),
    selectors: ["input.s-input[name='q']", "input[name='q']"]
  }
];

const candidateSelectors = [
  // Strong, semantic indicators
  "[role='search'] input[type='search']",
  "form[role='search'] input[type='search']",
  "input[role='searchbox']",
  "input[type='search']",
  // Common names/ids/classes
  "input[name='q']",
  "input[name*='search' i]",
  "input[id*='search' i]",
  "input[class*='search' i]",
  // ARIA and placeholders
  "[role='search'] input",
  "form[role='search'] input",
  "input[aria-label*='search' i]",
  "input[placeholder*='search' i]",
  // Common ids
  "#search, #search-box, #searchbox, #search-field, #search-query, #search-input",
  // Occasionally textarea is used
  "textarea[aria-label*='search' i]"
];

const isSearchyInput = (el) => {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    const ok = ["search", "text", "url", "tel", "email"]; // exclude password
    if (!ok.includes(type)) return false;
  }
  return true;
};

const scoreCandidate = (el) => {
  let score = 0;
  const type = (el.getAttribute("type") || "").toLowerCase();
  if (type === "search") score += 5;
  const name = (el.getAttribute("name") || "").toLowerCase();
  const id = (el.getAttribute("id") || "").toLowerCase();
  const cls = (el.getAttribute("class") || "").toLowerCase();
  const aria = (el.getAttribute("aria-label") || "").toLowerCase();
  const ph = (el.getAttribute("placeholder") || "").toLowerCase();

  if (name === "q") score += 4;
  if (name.includes("search")) score += 3;
  if (id.includes("search")) score += 3;
  if (cls.includes("search")) score += 2;
  if (aria.includes("search")) score += 3;
  if (ph.includes("search")) score += 3;
  if (el.closest("[role='search'], form[role='search']")) score += 4;

  // Prefer inputs near top-left (common placement)
  const rect = el.getBoundingClientRect();
  const vpW = Math.max(1, window.innerWidth || 1);
  const vpH = Math.max(1, window.innerHeight || 1);
  const y = Math.max(0, rect.top) / vpH; // 0 top, 1 bottom
  const x = Math.max(0, rect.left) / vpW; // 0 left, 1 right
  score += Math.max(0, 2 - (y * 2 + x)); // bias for top-left

  return score;
};

const pickFirstVisible = (selectors) => {
  for (const sel of selectors) {
    const nodes = Array.from(document.querySelectorAll(sel));
    for (const n of nodes) {
      if (isVisible(n) && isSearchyInput(n)) return n;
    }
  }
  return null;
};

// Deep query helpers: traverse open shadow roots
const queryAllDeepFromRoot = (root, selectors, outSet) => {
  try {
    for (const sel of selectors) {
      const nodes = root.querySelectorAll ? root.querySelectorAll(sel) : [];
      for (const n of nodes) outSet.add(n);
    }
    // Walk all elements in this root and descend into open shadow roots
    const all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const el of all) {
      if (el && el.shadowRoot) {
        queryAllDeepFromRoot(el.shadowRoot, selectors, outSet);
      }
    }
  } catch (_) {
    // ignore errors from closed roots or access issues
  }
};

const queryAllDeep = (selectors) => {
  const out = new Set();
  queryAllDeepFromRoot(document, selectors, out);
  return Array.from(out);
};

const pickFirstVisibleDeep = (selectors) => {
  const nodes = queryAllDeep(selectors);
  for (const n of nodes) {
    if (isVisible(n) && isSearchyInput(n)) return n;
  }
  return null;
};

const findSiteSpecific = () => {
  const h = location.hostname.toLowerCase();
  for (const adapter of SITE_ADAPTERS) {
    try {
      if (adapter.test(h)) {
        if (adapter.find) {
          const el = adapter.find();
          if (el) return el;
        }
        if (adapter.selectors) {
          const el = pickFirstVisible(adapter.selectors);
          if (el) return el;
        }
      }
    } catch (_) {
      // continue
    }
  }
  return null;
};

const findGeneric = () => {
  const all = new Set();
  for (const sel of candidateSelectors) {
    for (const n of document.querySelectorAll(sel)) {
      if (isVisible(n) && isSearchyInput(n)) all.add(n);
    }
  }
  if (all.size === 0) return null;
  // Score and pick best
  let best = null;
  let bestScore = -Infinity;
  for (const el of all) {
    const sc = scoreCandidate(el);
    if (sc > bestScore) {
      best = el;
      bestScore = sc;
    }
  }
  return best;
};

const findSearchInput = () => {
  // 1) Site adapters
  let el = findSiteSpecific();
  if (el) return el;
  // 2) Generic heuristics
  return findGeneric();
};

const onKeyDown = (e) => {
  try {
    if (e.defaultPrevented) return;
    if (document.designMode && document.designMode.toLowerCase() === "on") return;
    // Only plain '/'. Avoid ctrl/cmd/alt. Keep shift off to avoid '?'.
    if (e.key !== "/") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.shiftKey) return;

    // Ignore if focus is already in an editable area
    if (isEditableTarget(e.target)) return;

    const input = findSearchInput();
    if (input) {
      e.preventDefault();
      e.stopPropagation();
      focusAndSelect(input);
    }
  } catch (_) {
    // swallow errors — content scripts should be resilient
  }
};

// Attach at capture phase to pre-empt page hotkeys
document.addEventListener("keydown", onKeyDown, true);
