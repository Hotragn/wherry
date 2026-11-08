// Wherry service worker: after the first visit, /app and /play keep working with no network.
// Pages: network first, cached copy offline. Hashed build assets: cache first.
// Solana RPC and the faucet are never cached.
const CACHE = "wherry-v1";
const SHELL = ["/", "/app", "/app/phone", "/app/shop", "/app/owner", "/play"];

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    SHELL.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await cache.put(path, res);
        // Cache the scripts, styles and fonts each page references, so it renders offline too.
        const assets = new Set([...html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)].map((m) => m[0]));
        await Promise.all(
          [...assets].map(async (url) => {
            if (await cache.match(url)) return;
            const r = await fetch(url).catch(() => null);
            if (r && r.ok) await cache.put(url, r);
          }),
        );
      } catch {
        // One page failing must not stop the others.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || (await caches.match(url.pathname)) || Response.error()),
  );
});
