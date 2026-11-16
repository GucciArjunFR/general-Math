// General Mathematics — self-hosted web proxy server
// Stack: Express (static site) + Wisp (WebSocket TCP tunnel) + Ultraviolet (service-worker URL rewriter)
import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const nm = (p) => join(__dirname, "node_modules", p);

const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = process.env.HOST || "0.0.0.0";

// ---- Wisp tunnel hardening ----
// Never let the proxy reach your LAN, your router, or the server itself.
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;
wisp.options.allow_udp_streams = false;      // web browsing only needs TCP
wisp.options.port_whitelist = process.env.ALLOW_ALL_PORTS ? null : [80, 443];
wisp.options.stream_limit_per_host = 64;
wisp.options.dns_result_order = "ipv4first";
logging.set_level(process.env.WISP_DEBUG ? logging.DEBUG : logging.WARN);

const app = express();
app.disable("x-powered-by");

// Optional password gate (set SITE_PASSWORD to keep it private)
const PASSWORD = process.env.SITE_PASSWORD;
const TOKEN = PASSWORD ? createHash("sha256").update("gm:" + PASSWORD).digest("hex") : null;
if (PASSWORD) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization || "";
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const pass = Buffer.from(encoded, "base64").toString().split(":").slice(1).join(":");
      if (pass === PASSWORD) {
        // WebSockets can't carry Basic auth, so give the browser a cookie the /wisp/ upgrade can check
        res.cookie("gm_auth", TOKEN, { httpOnly: true, sameSite: "strict", maxAge: 30 * 864e5 });
        return next();
      }
    }
    res.set("WWW-Authenticate", 'Basic realm="General Mathematics"').status(401).send("Authentication required");
  });
}

// Proxy engine files (our config + service worker override the stock ones)
app.use("/uv/", express.static(join(__dirname, "public", "uv"), { index: false }));
app.use("/uv/", express.static(nm("@titaniumnetwork-dev/ultraviolet/dist"), { index: false }));
app.use("/epoxy/", express.static(nm("@mercuryworkshop/epoxy-transport/dist"), { index: false }));
app.use("/baremux/", express.static(nm("@mercuryworkshop/bare-mux/dist"), { index: false }));

// Site
app.use(express.static(join(__dirname, "public"), { extensions: ["html"] }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use((_req, res) => res.status(404).sendFile(join(__dirname, "public", "404.html")));

const server = createServer(app);

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/wisp/")) {
    if (PASSWORD) {
      const ok = (req.headers.cookie || "").split(/;\s*/).includes("gm_auth=" + TOKEN);
      if (!ok) return socket.destroy();
    }
    return wisp.routeRequest(req, socket, head);
  }
  socket.destroy();
});

server.listen(PORT, HOST, () => {
  console.log(`General Mathematics running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  if (PASSWORD) console.log("Password protection: ON");
});

function shutdown() {
  console.log("Shutting down...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
