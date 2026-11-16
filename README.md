# General Mathematics v2

A self-hosted web proxy with a clean UI. Rebuilt from scratch on the current
[Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) + Wisp stack
(the original used the deprecated TompHTTP "bare" server, which no longer works with current Ultraviolet).

## Features
- **Proxied browser**: address bar, back/forward/reload, fullscreen, search-or-URL input
- **Apps & Games pages**: built-in shortcuts plus your own (saved per browser)
- **Settings**: search engine, tab cloak (title + icon), about:blank launcher, panic key, reset tools
- **Optional password** for the whole site (`SITE_PASSWORD`)
- **Safe defaults**: the proxy can't reach your server's localhost or private LAN, and only proxies ports 80 and 443

## How it works
```
Browser ──> Ultraviolet service worker (rewrites every request)
        ──> bare-mux + epoxy (TLS runs in the browser, via WebAssembly)
        ──> WebSocket /wisp/  ──> server.js ──> raw TCP to the website
```
Because TLS is done in the browser, the server only relays encrypted bytes.

## Run locally
Requires Node.js 18 or newer.
```sh
npm install
npm start
# open http://localhost:8080
```

## Put it on a private server (so you can use it anywhere)
**HTTPS is required.** Browsers only allow service workers on `https://` or `localhost`.
If you open it over plain `http://your-ip:8080`, the site loads but every proxied page will fail.

You need: a VPS (any $4–6/month Linux box works: Hetzner, DigitalOcean, Vultr, Oracle free tier)
and a domain or subdomain whose DNS **A record** points to the server's IP.
(No domain? Free options include DuckDNS.)

### Option A: Docker (easiest)
```sh
git clone <your repo> general-mathematics && cd general-mathematics
nano deploy/Caddyfile.docker          # replace proxy.example.com with your domain
nano docker-compose.yml               # optional: uncomment SITE_PASSWORD
docker compose up -d --build
```
Caddy gets the HTTPS certificate automatically. Visit `https://your-domain`.

### Option B: Node + systemd + Caddy
```sh
# as root on Ubuntu/Debian
apt install -y nodejs npm caddy        # or install Node 22 from nodesource
useradd -r -s /usr/sbin/nologin gm
git clone <your repo> /opt/general-mathematics
cd /opt/general-mathematics && npm ci --omit=dev && chown -R gm: .
cp deploy/general-mathematics.service /etc/systemd/system/
systemctl enable --now general-mathematics
cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit the domain first
systemctl reload caddy
```
Open ports 80 and 443 in your firewall. Don't expose 8080 publicly.

### Option C: home computer
This works, but you need port forwarding (80/443) on your router plus a dynamic-DNS domain, and the
computer must stay on. A VPS is less hassle.

## Configuration (environment variables)
| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | Port the Node server listens on |
| `HOST` | `0.0.0.0` | Interface to bind (`127.0.0.1` when behind Caddy) |
| `SITE_PASSWORD` | unset | If set, the whole site asks for a password (any username) |
| `ALLOW_ALL_PORTS` | unset | Set to `1` to proxy ports other than 80/443 |
| `WISP_DEBUG` | unset | Set to `1` for verbose connection logs |

## Known limits
Every web proxy has these:
- **Google sign-in and some captchas** often block proxied traffic. Sites with heavy anti-bot checks
  (some Cloudflare pages, Netflix DRM) may not work.
- **The website sees your server's IP**, not yours. If many people share your server, sites may rate-limit it.
- **A public proxy attracts abuse**: spam, scraping, or worse traffic that will come back to your IP and
  your hosting account. Set `SITE_PASSWORD` unless you really mean to run a public service.

## Project layout
```
server.js            Express + Wisp server
public/              Site (HTML/CSS/JS)
  uv/                Ultraviolet config + service worker
  js/proxy.js        Service-worker + transport bootstrap
  js/common.js       Settings, tab cloak, panic key, about:blank
  js/catalog.js      Built-in Apps/Games shortcuts (edit freely)
deploy/              Caddy + systemd configs
```

License: GPL-3.0-or-later (same as the original).
