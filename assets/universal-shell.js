(() => {
  "use strict";

  const links = [
    ["/", "Home"],
    ["/broadcast/", "Broadcast"],
    ["/records/", "Records"],
    ["/work/", "Work"],
    ["/tools/", "Tools"],
    ["/cryptids/", "Cryptids"],
    ["/ai-lab/", "AI Labs"],
    ["/contact/", "Contact"]
  ];

  const focusAreas = [
    "Speedrunning",
    "Retro Gaming",
    "Live Broadcasts",
    "Game Development",
    "Cryptid Research",
    "AI Experiments"
  ];

  function activePath(href) {
    const path = location.pathname.replace(/\/index\.html$/, "/");
    if (href === "/") return path === "/";
    return !href.startsWith("http") && path.startsWith(href);
  }

  function makeNav() {
    const nav = document.createElement("nav");
    nav.className = "main-nav";
    nav.setAttribute("aria-label", "Primary navigation");
    links.forEach(([href, label, external]) => {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.textContent = label;
      if (external) {
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
      }
      if (activePath(href)) {
        anchor.className = "active";
        anchor.setAttribute("aria-current", "page");
      }
      nav.append(anchor);
    });
    return nav;
  }

  function normalizeHeader() {
    const header = document.querySelector(".site-header-dock .site-header");
    if (!header) return;
    const wordmark = header.querySelector(".wordmark");
    if (wordmark) {
      wordmark.href = "/";
      wordmark.setAttribute("aria-label", "Zendigo homepage");
      wordmark.querySelector(".wordmark-model")?.remove();
    }
    const current = header.querySelector(".main-nav");
    const replacement = makeNav();
    if (current?.outerHTML !== replacement.outerHTML) current?.replaceWith(replacement);
  }

  function makeSignalStrip() {
    const strip = document.createElement("div");
    strip.className = "footer-signal-strip";
    strip.setAttribute("aria-label", "Zendigo focus areas");
    const inner = document.createElement("div");
    focusAreas.forEach((label, index) => {
      const text = document.createElement("span");
      text.textContent = label;
      inner.append(text);
      if (index < focusAreas.length - 1) {
        const marker = document.createElement("i");
        marker.textContent = "◆";
        inner.append(marker);
      }
    });
    strip.append(inner);
    return strip;
  }

  function normalizeFooter() {
    const footer = document.querySelector("footer.site-footer, main > footer, body > footer");
    if (!footer) return;
    // Remove the retired homepage focus strip if hydration restores it.
    document.querySelectorAll(".signal-strip").forEach(strip => strip.remove());
    const expectedLinks = links.map(([href, label, external]) =>
      `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${label}</a>`
    ).join("");
    const expected = `<a class="footer-wordmark" href="/"><strong>ZENDIGO</strong><span>Independent creator system</span></a><div>${expectedLinks}</div><p>© 2026 ZENDIGO</p>`;
    footer.className = "site-footer";
    if (footer.innerHTML !== expected) footer.innerHTML = expected;
    if (!footer.previousElementSibling?.classList.contains("footer-signal-strip")) {
      footer.before(makeSignalStrip());
    }
  }

  function normalize() {
    normalizeHeader();
    normalizeFooter();
  }

  normalize();
  document.addEventListener("DOMContentLoaded", normalize, { once: true });
  const observer = new MutationObserver(normalize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 5000);
})();
