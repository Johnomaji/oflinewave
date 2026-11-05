/*
 * Oflinewave service worker.
 *
 * Goal: tickets and the door scanner keep working with bad or no signal.
 *  - Build assets (/_next/static, icons, posters): cache-first, they're immutable.
 *  - Ticket, order and scanner pages: network-first, falling back to the last
 *    copy, so a ticket you opened once still shows its QR offline.
 *  - Other pages: network-first, falling back to /offline.
 *  - Never cached: /api (except QR images), /admin, auth, payments.
 */
const VERSION = "ow-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/icon-192.png", "/icon-512.png", "/brand/logo.png"];

const OFFLINE_PAGES = [/^\/tickets(\/|$)/, /^\/orders\//, /^\/scan$/];
const NEVER = [/^\/api\/(?!qr\/)/, /^\/admin/, /^\/login/, /^\/dev\//];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, { keep }) {
  try {
    const response = await fetch(request);
    if (keep && response.ok) (await caches.open(PAGE_CACHE)).put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (request.mode === "navigate") return (await caches.match("/offline")) ?? Response.error();
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((re) => re.test(url.pathname))) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/posters/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/api/qr/") || /\/icon[-\w]*\.png$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  const isPage = request.mode === "navigate" || request.headers.get("RSC") === "1";
  if (isPage) {
    const keep = OFFLINE_PAGES.some((re) => re.test(url.pathname));
    event.respondWith(networkFirst(request, { keep }));
  }
});

// Signing out clears saved ticket pages from this device.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGE_CACHE));
});
