(function () {
  var completionConfig = window.GUIDE_COMPLETION_CONFIG || {};
  var docsData = document.getElementById("docs-data");
  var pages = [];
  var currentPath = "";
  var homeUrl = "/";
  var statsUrl = "";
  var guideCompletionState = null;
  var sidebarStatsPanelsInitialized = false;

  if (docsData) {
    try {
      var parsed = JSON.parse(docsData.textContent || "{}");
      currentPath = parsed.currentPath || "";
      homeUrl = parsed.homeUrl || "/";
      statsUrl = parsed.statsUrl || "";
      pages = Array.isArray(parsed.pages) ? parsed.pages : [];
    } catch (_) {}
  }

  if (!pages.length && !currentPath && homeUrl === "/") {
    pages = Array.isArray(window.DOCS_PAGES) ? window.DOCS_PAGES.slice() : [];
    currentPath = window.CURRENT_PATH || "";
    homeUrl = window.HOME_URL || "/";
  }

  function normalizePath(path) {
    return String(path || "").replace(/^\/+|\/+$/g, "");
  }

  function normalizeRequiredPaths(paths) {
    var seen = Object.create(null);
    return (Array.isArray(paths) ? paths : []).map(function (path) {
      return normalizePath(path);
    }).filter(function (path) {
      if (!path || seen[path]) return false;
      seen[path] = true;
      return true;
    });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  }

  function asNonNegativeInteger(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  }

  var guideCompletionRequiredPaths = normalizeRequiredPaths(completionConfig.requiredPaths);
  var guideCompletionEventName = String(completionConfig.completionEventName || "guide_completed");
  var guideCompletionBaseline = asNonNegativeInteger(completionConfig.legacyCompletions);
  var guideCompletionStorageVersion = asNonNegativeInteger(completionConfig.storageVersion) || 1;
  var guideCompletionStorageKey = [
    "guide-completion",
    guideCompletionEventName,
    "v" + guideCompletionStorageVersion
  ].join("::");

  function isDocsNavPath(path) {
    return /^guide\/.+\.md$/.test(path) || path === "CHANGELOG.md";
  }

  function displayTitle(raw) {
    return String(raw || "").replace(/\.md$/i, "").replace(/-/g, " ");
  }

  function hasLeadingIcon(title) {
    return /^[\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]/u.test(String(title || "").trim());
  }

  function displayChapterTitle(page) {
    var title = displayTitle(page && page.title ? page.title : "");
    if (!title) {
      title = displayTitle(page && page.path ? page.path.split("/").pop() : "");
    }
    if (hasLeadingIcon(title)) return title;
    return "📄 " + title;
  }

  function guideSort(a, b) {
    var ap = normalizePath(a.path);
    var bp = normalizePath(b.path);
    var aIsChangelog = ap === "CHANGELOG.md";
    var bIsChangelog = bp === "CHANGELOG.md";
    var aIsUpdates = /\/Updates\.md$/i.test(ap);
    var bIsUpdates = /\/Updates\.md$/i.test(bp);
    if (aIsChangelog && !bIsChangelog) return 1;
    if (!aIsChangelog && bIsChangelog) return -1;
    if (aIsUpdates && !bIsUpdates) return 1;
    if (!aIsUpdates && bIsUpdates) return -1;
    return ap.localeCompare(bp, undefined, { numeric: true, sensitivity: "base" });
  }

  pages = pages.filter(function (p) {
    return p && isDocsNavPath(normalizePath(p.path));
  }).sort(guideSort);

  function buildTree(items) {
    var root = { children: Object.create(null), order: [] };

    items.forEach(function (item) {
      var rel = normalizePath(item.path).replace(/^guide\//, "").replace(/\.md$/i, "");
      var parts = rel.split("/");
      var node = root;

      for (var i = 0; i < parts.length; i += 1) {
        var key = parts[i];
        if (!node.children[key]) {
          node.children[key] = { key: key, children: Object.create(null), order: [], page: null };
          node.order.push(key);
        }
        node = node.children[key];
        if (i === parts.length - 1) {
          node.page = item;
        }
      }
    });

    return root;
  }

  function renderNode(node, list, level) {
    var keys = node.order.slice();

    keys.forEach(function (key) {
      var child = node.children[key];
      var li = document.createElement("li");
      var hasChildren = child.order.length > 0;

      if (hasChildren && child.page) {
        var details = document.createElement("details");
        details.open = currentPath.indexOf(child.page.path.replace(/\.md$/i, "")) >= 0;
        var summary = document.createElement("summary");
        summary.className = "nav-summary";
        summary.textContent = displayChapterTitle(child.page);
        details.appendChild(summary);

        var link = document.createElement("a");
        link.className = "nav-link";
        link.href = child.page.url;
        link.textContent = "Open chapter";
        if (normalizePath(child.page.path) === normalizePath(currentPath)) {
          link.setAttribute("aria-current", "page");
        }
        details.appendChild(link);

        var sub = document.createElement("ul");
        sub.className = "nav-children";
        renderNode(child, sub, level + 1);
        details.appendChild(sub);
        li.appendChild(details);
      } else if (child.page) {
        var a = document.createElement("a");
        a.className = "nav-link";
        a.href = child.page.url;
        a.textContent = displayChapterTitle(child.page);
        if (normalizePath(child.page.path) === normalizePath(currentPath)) {
          a.setAttribute("aria-current", "page");
        }
        li.appendChild(a);
      }

      if (li.childNodes.length > 0) {
        list.appendChild(li);
      }
    });
  }

  function renderSidebar() {
    var mount = document.getElementById("sidebar-nav");
    if (!mount) return;

    var home = document.createElement("a");
    home.className = "nav-link";
    home.href = homeUrl;
    home.textContent = "🍿 Home";

    if (normalizePath(currentPath) === "index.md" || normalizePath(currentPath) === "") {
      home.setAttribute("aria-current", "page");
    }

    var ul = document.createElement("ul");
    renderNode(buildTree(pages), ul, 0);

    mount.innerHTML = "";
    mount.appendChild(home);
    mount.appendChild(ul);
  }

  function renderPager() {
    var pager = document.getElementById("pager");
    if (!pager) return;

    var index = pages.findIndex(function (p) {
      return normalizePath(p.path) === normalizePath(currentPath);
    });

    if (index === -1) {
      pager.hidden = true;
      return;
    }

    var prev = pages[index - 1];
    var next = pages[index + 1];

    pager.innerHTML = "";
    if (prev) {
      var prevLink = document.createElement("a");
      prevLink.href = prev.url;
      prevLink.className = "pager__prev";
      prevLink.innerHTML = "<span>Previous</span><strong>" + displayChapterTitle(prev) + "</strong>";
      pager.appendChild(prevLink);
    }

    if (next) {
      var nextLink = document.createElement("a");
      nextLink.href = next.url;
      nextLink.className = "pager__next";
      nextLink.innerHTML = "<span>Next</span><strong>" + displayChapterTitle(next) + "</strong>";
      pager.appendChild(nextLink);
    }

    pager.hidden = pager.children.length === 0;
  }

  function renderQuickNav() {
    var quick = document.getElementById("quick-nav");
    var list = document.getElementById("quick-nav-list");
    var article = document.querySelector(".doc-card");
    if (!quick || !list || !article) return;

    list.innerHTML = "";
    var headers = Array.prototype.slice.call(article.querySelectorAll("h2")).filter(function (h) {
      return !h.closest("#quick-nav");
    });
    if (headers.length === 0) {
      quick.hidden = true;
      return;
    }

    headers.forEach(function (h) {
      if (!h.id) return;
      var li = document.createElement("li");
      li.style.marginLeft = "0";
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
    });

    if (list.children.length > 0) {
      var h1 = article.querySelector("h1");
      if (h1 && h1.nextSibling) {
        article.insertBefore(quick, h1.nextSibling);
      }
      quick.hidden = false;
    }
  }

  function setupThemeToggle() {
    var key = "stremio_docs_theme";
    var toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    function currentTheme() {
      return document.documentElement.getAttribute("data-theme") || "light";
    }

    function apply(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      try {
        localStorage.setItem(key, theme);
      } catch (_) {}
    }

    apply(currentTheme());
    toggle.addEventListener("click", function () {
      apply(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  function setupMobileNav() {
    var body = document.body;
    var toggle = document.getElementById("nav-toggle");
    var backdrop = document.getElementById("nav-backdrop");

    if (!toggle || !backdrop) return;

    function closeNav() {
      body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var next = !body.classList.contains("nav-open");
      body.classList.toggle("nav-open", next);
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
    });

    backdrop.addEventListener("click", closeNav);
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1040) {
        closeNav();
      }
    });
  }

  function canUseLocalStorage() {
    try {
      var probe = "__guide_completion_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadGuideCompletionState() {
    if (!canUseLocalStorage()) {
      return { seenPaths: Object.create(null), eventSent: false };
    }

    try {
      var parsed = JSON.parse(window.localStorage.getItem(guideCompletionStorageKey) || "{}");
      var state = {
        seenPaths: Object.create(null),
        eventSent: parsed.eventSent === true
      };

      Object.keys(parsed.seenPaths || {}).forEach(function (path) {
        var normalized = normalizePath(path);
        if (normalized) {
          state.seenPaths[normalized] = true;
        }
      });

      return state;
    } catch (_) {
      return { seenPaths: Object.create(null), eventSent: false };
    }
  }

  function saveGuideCompletionState() {
    if (!canUseLocalStorage() || !guideCompletionState) return;

    try {
      window.localStorage.setItem(guideCompletionStorageKey, JSON.stringify({
        seenPaths: guideCompletionState.seenPaths,
        eventSent: guideCompletionState.eventSent
      }));
    } catch (_) {}
  }

  function sendGuideCompletionEvent() {
    if (typeof window.gtag !== "function") return;

    window.gtag("event", guideCompletionEventName, {
      required_page_count: guideCompletionRequiredPaths.length,
      completion_storage_version: guideCompletionStorageVersion
    });
  }

  function trackGuideCompletion() {
    var normalizedCurrentPath = normalizePath(currentPath);
    if (!guideCompletionRequiredPaths.length || !normalizedCurrentPath) return;

    guideCompletionState = loadGuideCompletionState();
    if (guideCompletionRequiredPaths.indexOf(normalizedCurrentPath) === -1) return;

    guideCompletionState.seenPaths[normalizedCurrentPath] = true;

    var isComplete = guideCompletionRequiredPaths.every(function (path) {
      return guideCompletionState.seenPaths[path] === true;
    });

    if (isComplete && !guideCompletionState.eventSent) {
      sendGuideCompletionEvent();
      guideCompletionState.eventSent = true;
    }

    saveGuideCompletionState();
  }

  var guideCompletionCountObserver = null;

  function animateGuideCompletionCount(node, target, duration) {
    var prefersReducedMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    target = asNonNegativeInteger(target);
    duration = asNonNegativeInteger(duration) || 1400;

    if (prefersReducedMotion) {
      node.textContent = formatNumber(target);
      return;
    }

    var start = 0;
    var startTime = window.performance && window.performance.now
      ? window.performance.now()
      : Date.now();

    function frame(now) {
      var currentTime = typeof now === "number" ? now : Date.now();
      var elapsed = currentTime - startTime;
      var progress = Math.min(elapsed / duration, 1);

      // Ease-out: fast at first, slower near the final number
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(start + (target - start) * eased);

      node.textContent = formatNumber(current);

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        node.textContent = formatNumber(target);
      }
    }

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(frame);
    } else {
      node.textContent = formatNumber(target);
    }
  }

  function setupGuideCompletionCountObserver() {
    if (guideCompletionCountObserver || typeof window.IntersectionObserver !== "function") {
      return;
    }

    guideCompletionCountObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var node = entry.target;

        if (entry.isIntersecting) {
          if (node.getAttribute("data-guide-count-visible") === "true") return;

          node.setAttribute("data-guide-count-visible", "true");

          var target = asNonNegativeInteger(
            node.getAttribute("data-guide-count-target")
          );

          animateGuideCompletionCount(node, target, 1400);
        } else {
          node.setAttribute("data-guide-count-visible", "false");
        }
      });
    }, {
      threshold: 0.5
    });
  }

  function isGuideCompletionCountVisible(node) {
    if (!node || typeof node.getBoundingClientRect !== "function") return false;

    var rect = node.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  function applyGuideCompletionCount(total, updatedAt, animate) {
    var nodes = document.querySelectorAll("[data-guide-completion-count]");
    if (!nodes.length) return;

    var value = asNonNegativeInteger(total);

    Array.prototype.forEach.call(nodes, function (node) {
      var previousTarget = asNonNegativeInteger(
        node.getAttribute("data-guide-count-target")
      );

      node.setAttribute("data-guide-count-target", String(value));

      if (updatedAt) {
        node.setAttribute("title", "Updated " + updatedAt);
      }

      if (!animate) {
        node.textContent = formatNumber(value);
        return;
      }

      setupGuideCompletionCountObserver();

      if (guideCompletionCountObserver) {
        guideCompletionCountObserver.observe(node);
      }

      var isVisible = isGuideCompletionCountVisible(node);
      var targetChanged = previousTarget !== value;

      if (isVisible && targetChanged) {
        animateGuideCompletionCount(node, value, 1400);
        node.setAttribute("data-guide-count-visible", "true");
      } else if (!guideCompletionCountObserver) {
        animateGuideCompletionCount(node, value, 1400);
      }
    });
  }

  function applyWizardAccountCount(total, updatedAt, animate) {
    var nodes = document.querySelectorAll("[data-wizard-account-count]");
    if (!nodes.length) return;

    var value = asNonNegativeInteger(total);

    Array.prototype.forEach.call(nodes, function (node) {
      var previousTarget = asNonNegativeInteger(
        node.getAttribute("data-guide-count-target")
      );

      node.setAttribute("data-guide-count-target", String(value));

      if (updatedAt) {
        node.setAttribute("title", "Updated " + updatedAt);
      }

      if (!animate) {
        node.textContent = formatNumber(value);
        return;
      }

      setupGuideCompletionCountObserver();

      if (guideCompletionCountObserver) {
        guideCompletionCountObserver.observe(node);
      }

      var isVisible = isGuideCompletionCountVisible(node);
      var targetChanged = previousTarget !== value;

      if (isVisible && targetChanged) {
        animateGuideCompletionCount(node, value, 1400);
        node.setAttribute("data-guide-count-visible", "true");
      } else if (!guideCompletionCountObserver) {
        animateGuideCompletionCount(node, value, 1400);
      }
    });
  }

  function clearNode(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function setSidebarStatsOpen(card, open) {
    if (!card) return;
    var toggle = card.querySelector("[data-sidebar-stats-toggle]");
    var panel = card.querySelector("[data-sidebar-stats-panel]");
    card.setAttribute("data-sidebar-stats-open", open ? "true" : "false");
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (panel) {
      panel.setAttribute("aria-hidden", open ? "false" : "true");
    }
    if (open) {
      updateSidebarStatsPanelLayout(card);
    }
  }

  function closeSidebarStatsPanels(exceptCard) {
    var cards = document.querySelectorAll("[data-sidebar-stats-card]");
    Array.prototype.forEach.call(cards, function (card) {
      if (exceptCard && card === exceptCard) return;
      setSidebarStatsOpen(card, false);
    });
  }

  function setupSidebarStatsPanels() {
    if (sidebarStatsPanelsInitialized) return;
    sidebarStatsPanelsInitialized = true;

    document.addEventListener("click", function (event) {
      var cards = document.querySelectorAll("[data-sidebar-stats-card]");
      Array.prototype.forEach.call(cards, function (card) {
        if (card.contains(event.target)) return;
        setSidebarStatsOpen(card, false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeSidebarStatsPanels();
    });

    window.addEventListener("resize", function () {
      var cards = document.querySelectorAll("[data-sidebar-stats-card]");
      Array.prototype.forEach.call(cards, function (card) {
        updateSidebarStatsPanelLayout(card);
      });
    });
  }

  function updateSidebarStatsPanelLayout(card) {
    if (!card) return;
    var rootStyle = window.getComputedStyle(document.documentElement);
    var headerHeight = parseFloat(rootStyle.getPropertyValue("--header-height")) || 74;
    var rect = card.getBoundingClientRect();
    var availableHeight = Math.max(250, Math.floor(rect.top - headerHeight - 8));
    card.style.setProperty("--sidebar-stats-max-height", availableHeight + "px");
  }

  function resolveStatsAssetPath(path) {
    if (!path) return "";
    return new URL(String(path).replace(/^\/+/, ""), new URL(homeUrl, window.location.href)).toString();
  }

  function createStatsModeIcon(type) {
    var svgNs = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("sidebar-stats-mode-icon");

    function path(d) {
      var el = document.createElementNS(svgNs, "path");
      el.setAttribute("d", d);
      el.setAttribute("fill", "none");
      el.setAttribute("stroke", "currentColor");
      el.setAttribute("stroke-width", "2");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
      svg.appendChild(el);
    }

    if (type === "create") {
      path("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2");
      path("M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z");
      path("M19 8v6");
      path("M22 11h-6");
      return svg;
    }

    path("M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4");
    path("m10 17 5-5-5-5");
    path("M15 12H3");
    return svg;
  }

  function createStatsImage(path, alt, className) {
    var img = document.createElement("img");
    img.className = className;
    img.src = resolveStatsAssetPath(path);
    img.alt = alt || "";
    img.loading = "lazy";
    return img;
  }

  function renderSidebarStatsRow(labelText, items, variant) {
    var row = document.createElement("section");
    row.className = "sidebar-stats-row";

    var label = document.createElement("div");
    label.className = "sidebar-stats-row__label";
    label.textContent = labelText;
    row.appendChild(label);

    var grid = document.createElement("div");
    grid.className = "sidebar-stats-icon-row sidebar-stats-icon-row--" + variant;

    (Array.isArray(items) ? items : []).forEach(function (item) {
      var box = document.createElement("div");
      box.className = "sidebar-stats-icon-item";
      if (item && item.title) {
        box.setAttribute("title", item.title);
      }

      var iconWrap = document.createElement("div");
      iconWrap.className = "sidebar-stats-icon-item__icon";

      if (item.logoPath) {
        iconWrap.appendChild(createStatsImage(item.logoPath, item.label || item.title || "", "sidebar-stats-icon-item__logo"));
      } else if (item.emoji) {
        var emoji = document.createElement("span");
        emoji.className = "sidebar-stats-icon-item__emoji";
        emoji.textContent = item.emoji;
        iconWrap.appendChild(emoji);
      } else if (item.iconSvg) {
        iconWrap.appendChild(item.iconSvg);
      }

      box.appendChild(iconWrap);

      var count = document.createElement("strong");
      count.className = "sidebar-stats-icon-item__count";
      count.textContent = item.countText || formatNumber(asNonNegativeInteger(item.count));
      box.appendChild(count);
      grid.appendChild(box);
    });

    row.appendChild(grid);
    return row;
  }

  function renderSidebarStatsAccounts(summary) {
    var section = document.createElement("section");
    section.className = "sidebar-stats-accounts";

    var totalCard = document.createElement("div");
    totalCard.className = "sidebar-stats-total-card";

    var totalLabel = document.createElement("span");
    totalLabel.className = "sidebar-stats-total-card__label";
    totalLabel.textContent = "Total";
    totalCard.appendChild(totalLabel);

    var totalValue = document.createElement("strong");
    totalValue.className = "sidebar-stats-total-card__value";
    totalValue.textContent = formatNumber(asNonNegativeInteger(summary && summary.accounts ? summary.accounts.total : 0));
    totalCard.appendChild(totalValue);

    section.appendChild(totalCard);

    var platformGrid = document.createElement("div");
    platformGrid.className = "sidebar-stats-platform-grid";

    (summary && summary.accounts && Array.isArray(summary.accounts.platforms) ? summary.accounts.platforms : []).forEach(function (platform) {
      var card = document.createElement("div");
      card.className = "sidebar-stats-platform-card";

      var head = document.createElement("div");
      head.className = "sidebar-stats-platform-card__head";
      if (platform.logoPath) {
        head.appendChild(createStatsImage(platform.logoPath, platform.label || "", "sidebar-stats-platform-card__logo"));
      }
      card.appendChild(head);

      var total = document.createElement("strong");
      total.className = "sidebar-stats-platform-card__value";
      total.textContent = formatNumber(asNonNegativeInteger(platform.total));
      card.appendChild(total);

      var modes = document.createElement("div");
      modes.className = "sidebar-stats-platform-card__modes";

      [
        { type: "signin", value: platform.signin, title: "Existing" },
        { type: "create", value: platform.create, title: "New" }
      ].forEach(function (mode) {
        var modeBox = document.createElement("div");
        modeBox.className = "sidebar-stats-platform-card__mode";
        modeBox.setAttribute("title", mode.title);
        modeBox.appendChild(createStatsModeIcon(mode.type));
        var modeValue = document.createElement("strong");
        modeValue.textContent = formatNumber(asNonNegativeInteger(mode.value));
        modeBox.appendChild(modeValue);
        modes.appendChild(modeBox);
      });

      card.appendChild(modes);
      platformGrid.appendChild(card);
    });

    section.appendChild(platformGrid);
    return section;
  }

  function renderSidebarStatsSummary(summary) {
    var cards = document.querySelectorAll("[data-sidebar-stats-card]");
    if (!cards.length) return;

    Array.prototype.forEach.call(cards, function (card) {
      var toggle = card.querySelector("[data-sidebar-stats-toggle]");
      var panel = card.querySelector("[data-sidebar-stats-panel]");
      var content = card.querySelector("[data-sidebar-stats-panel-content]");
      var header = panel ? panel.querySelector(".sidebar-stats-panel__header span") : null;
      var hasSummary = !!(
        summary
        && asNonNegativeInteger(summary.rowCount) > 0
      );

      if (!toggle || !panel || !content || !hasSummary) {
        if (toggle) toggle.hidden = true;
        if (content) clearNode(content);
        setSidebarStatsOpen(card, false);
        return;
      }

      toggle.hidden = false;
      clearNode(content);

      content.appendChild(renderSidebarStatsAccounts(summary));
      updateSidebarStatsPanelLayout(card);

      if (summary.debrid && summary.debrid.length) {
        content.appendChild(renderSidebarStatsRow("Debrid", summary.debrid, "logos"));
      }
      if (summary.audio && summary.audio.length) {
        content.appendChild(renderSidebarStatsRow("Audio", summary.audio, "emoji"));
      }
      if (summary.subtitles && summary.subtitles.length) {
        content.appendChild(renderSidebarStatsRow("Subtitles", summary.subtitles, "emoji"));
      }
      if (summary.catalogs && summary.catalogs.discover && summary.catalogs.discover.length) {
        content.appendChild(renderSidebarStatsRow("Discover", summary.catalogs.discover, "discover"));
      }
      if (summary.catalogs && summary.catalogs.categories && summary.catalogs.categories.length) {
        content.appendChild(renderSidebarStatsRow("Categories", summary.catalogs.categories, "categories"));
      }
      if (summary.formatter && summary.formatter.length) {
        content.appendChild(renderSidebarStatsRow("Formatter", summary.formatter, "formatter"));
      }

      content.appendChild(
        renderSidebarStatsRow(
          "Addons",
          [
            { emoji: "🍥", title: "Anime", count: summary.addons ? summary.addons.anime : 0 },
            {
              emoji: "🌐",
              title: "HTTP",
              countText: "➕ " + formatNumber(asNonNegativeInteger(summary.addons ? summary.addons.httpInstall : 0)) + " / 🔒 " + formatNumber(asNonNegativeInteger(summary.addons ? summary.addons.httpOnly : 0))
            },
            { emoji: "🧊", title: "Debridio", count: summary.addons ? summary.addons.debridio : 0 }
          ],
          "addons"
        )
      );

      if (header) {
        header.textContent = "Popular Choices";
      }

      toggle.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        var isOpen = card.getAttribute("data-sidebar-stats-open") === "true";
        closeSidebarStatsPanels(card);
        setSidebarStatsOpen(card, !isOpen);
      };
    });

    setupSidebarStatsPanels();
  }

  function loadGuideCompletionCount() {
    var guideNodes = document.querySelectorAll("[data-guide-completion-count]");
    var wizardNodes = document.querySelectorAll("[data-wizard-account-count]");
    if (!guideNodes.length && !wizardNodes.length) return;

    applyGuideCompletionCount(guideCompletionBaseline, null, true);
    applyWizardAccountCount(0, null, true);

    if (!statsUrl || typeof window.fetch !== "function") return;

    window.fetch(statsUrl, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load guide stats");
      }
      return response.json();
    }).then(function (stats) {
      applyGuideCompletionCount(stats.totalCompletions, stats.updatedAt, true);
      applyWizardAccountCount(stats && stats.wizard ? stats.wizard.totalAccountsCreated : 0, stats.updatedAt, true);
      renderSidebarStatsSummary(stats && stats.wizard && stats.wizard.analytics ? stats.wizard.analytics.summary : null);
    }).catch(function () {});
  }

  renderSidebar();
  renderQuickNav();
  renderPager();
  setupThemeToggle();
  setupMobileNav();
  trackGuideCompletion();
  loadGuideCompletionCount();
})();
