// Proxy bootstrap: registers the Ultraviolet service worker and connects bare-mux to the Wisp tunnel.
import { BareMuxConnection } from "/baremux/index.mjs";

let readyPromise = null;

export function proxyReady() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers aren't available. Use a modern browser, and make sure the site is served over HTTPS (or localhost). Private/incognito windows in Firefox also block them.");
    }
    const reg = await navigator.serviceWorker.register("/uv/sw.js", { scope: __uv$config.prefix });
    // navigator.serviceWorker.ready only fires for workers controlling *this* page, so wait on the registration
    await waitForActive(reg);

    const wispUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
    const conn = new BareMuxConnection("/baremux/worker.js");
    if ((await conn.getTransport()) !== "/epoxy/index.mjs") {
      await conn.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    }
  })();
  readyPromise.catch(() => (readyPromise = null));
  return readyPromise;
}

function waitForActive(reg) {
  if (reg.active) return Promise.resolve();
  const sw = reg.installing || reg.waiting;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("The proxy service worker didn't start. Try Settings → Reset proxy engine.")), 15000);
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") { clearTimeout(t); resolve(); }
      if (sw.state === "redundant") { clearTimeout(t); reject(new Error("The proxy service worker failed to install.")); }
    });
  });
}

export function encode(url) {
  return __uv$config.prefix + __uv$config.encodeUrl(url);
}

export function decode(proxiedHref) {
  try {
    const u = new URL(proxiedHref, location.origin);
    if (!u.pathname.startsWith(__uv$config.prefix)) return null;
    return __uv$config.decodeUrl(u.pathname.slice(__uv$config.prefix.length) + u.search + u.hash);
  } catch {
    return null;
  }
}
