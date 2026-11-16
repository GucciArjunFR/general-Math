// Shared helpers: settings, nav, tab cloak, panic key, about:blank launcher, URL resolving
(() => {
  const DEFAULTS = {
    engine: "https://duckduckgo.com/?q=%s",
    cloakTitle: "",
    cloakIcon: "",
    panicKey: "`",
    panicUrl: "https://classroom.google.com",
    autoBlank: false,
  };

  const Settings = {
    get(key) {
      try {
        const v = localStorage.getItem("gm." + key);
        return v === null ? DEFAULTS[key] : JSON.parse(v);
      } catch { return DEFAULTS[key]; }
    },
    set(key, value) {
      try { localStorage.setItem("gm." + key, JSON.stringify(value)); } catch {}
    },
    reset() {
      Object.keys(localStorage).filter((k) => k.startsWith("gm.")).forEach((k) => localStorage.removeItem(k));
    },
    DEFAULTS,
  };

  // ---------- URL resolving ----------
  function resolveInput(input) {
    const v = input.trim();
    if (!v) return null;
    try {
      const u = new URL(v);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {}
    // looks like a domain (has a dot, no spaces)
    if (/^[^\s]+\.[^\s]{2,}$/.test(v) && !v.includes(" ")) {
      try { return new URL("https://" + v).toString(); } catch {}
    }
    return Settings.get("engine").replace("%s", encodeURIComponent(v));
  }

  function go(input) {
    const url = resolveInput(input);
    if (!url) return;
    location.href = "/browse?url=" + encodeURIComponent(url);
  }

  // ---------- tab cloak ----------
  function applyCloak() {
    const title = Settings.get("cloakTitle");
    const icon = Settings.get("cloakIcon");
    if (title) document.title = title;
    if (icon) {
      document.querySelectorAll("link[rel~='icon']").forEach((l) => l.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = icon;
      document.head.appendChild(link);
    }
  }

  // ---------- panic key ----------
  function bindPanic(target = window) {
    target.addEventListener("keydown", (e) => {
      const key = Settings.get("panicKey");
      if (!key) return;
      const tag = (e.target && e.target.tagName) || "";
      if ((tag === "INPUT" || tag === "TEXTAREA") && key.length === 1) return;
      if (e.key === key) {
        e.preventDefault();
        panic();
      }
    });
  }
  function panic() {
    const url = Settings.get("panicUrl") || "https://www.google.com";
    try { window.top.location.replace(url); } catch { location.replace(url); }
  }

  // ---------- about:blank cloak ----------
  function openBlank(path = location.pathname + location.search) {
    if (window.top !== window.self) return false; // already framed
    const win = window.open("about:blank", "_blank");
    if (!win) return false;
    const d = win.document;
    d.title = Settings.get("cloakTitle") || "about:blank";
    const icon = Settings.get("cloakIcon");
    if (icon) {
      const l = d.createElement("link");
      l.rel = "icon"; l.href = icon;
      d.head.appendChild(l);
    }
    const style = d.createElement("style");
    style.textContent = "html,body{margin:0;height:100%;overflow:hidden;background:#0b0d12}iframe{border:0;width:100%;height:100%}";
    d.head.appendChild(style);
    const f = d.createElement("iframe");
    f.src = location.origin + path;
    f.allow = "fullscreen; clipboard-read; clipboard-write; autoplay; gamepad";
    d.body.appendChild(f);
    location.replace(Settings.get("panicUrl") || "https://www.google.com");
    return true;
  }

  function maybeAutoBlank() {
    if (!Settings.get("autoBlank") || window.top !== window.self) return;
    // Popups need a user gesture: launch on first click anywhere
    const once = () => {
      document.removeEventListener("click", once, true);
      openBlank();
    };
    document.addEventListener("click", once, true);
  }

  // ---------- nav ----------
  function renderNav() {
    const el = document.querySelector("[data-nav]");
    if (!el) return;
    const here = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    const links = [["/", "Home"], ["/apps", "Apps"], ["/games", "Games"], ["/settings", "Settings"]];
    el.innerHTML = `
      <a class="brand" href="/"><span class="logo">∑</span><span>General Mathematics</span></a>
      <nav class="nav-links">${links
        .map(([h, t]) => `<a href="${h}" class="${here === h || (h === "/" && here === "/index") ? "active" : ""}">${t}</a>`)
        .join("")}</nav>`;
  }

  // ---------- toast ----------
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- tiles ----------
  const PALETTE = ["#7c9cff", "#a78bfa", "#f472b6", "#fb923c", "#facc15", "#4ade80", "#22d3ee", "#f87171"];
  function colorFor(str) {
    let h = 0;
    for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.GM = { Settings, resolveInput, go, applyCloak, bindPanic, panic, openBlank, toast, colorFor, escapeHtml };

  applyCloak();
  bindPanic();
  document.addEventListener("DOMContentLoaded", () => {
    renderNav();
    maybeAutoBlank();
  });
})();
