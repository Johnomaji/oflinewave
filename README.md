# Oflinewave

Events and ticketing for Oflinewave: public event pages, Paystack checkout, QR tickets by email, an admin dashboard and a mobile door scanner.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · shadcn-style UI on Radix · Motion · PostgreSQL + Prisma 7 · Auth.js v5 · Paystack · Resend · Vercel

---

## Quick start

Requirements: Node 20+, PostgreSQL 14+.

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then fill in the required values (see below)
createdb oflinewave             # or point DATABASE_URL at a hosted database
npm run db:migrate               # apply migrations
npm run db:seed                  # sample events, tiers, orders, staff
npm run dev                      # http://localhost:3000
```

Generate secrets with `npx auth secret` (for `AUTH_SECRET`) and `openssl rand -base64 32` (for `TICKET_SIGNING_SECRET`).

### Running locally without third-party keys

Everything works offline from Paystack and Resend in development:

| Missing key | Dev behaviour |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Checkout redirects to `/dev/pay`, a simulator with "succeed" and "fail" buttons. Disabled in production. |
| `RESEND_API_KEY` | Emails (tickets and sign-in links) are printed to the `npm run dev` console. Copy the sign-in link from there. |
| `BLOB_READ_WRITE_TOKEN` | Poster uploads are saved to `public/uploads/`. |
| `NEXT_PUBLIC_SENTRY_DSN` | Errors only go to the console. |
| Wallet keys | The Apple and Google Wallet buttons are hidden. |
| `AUTH_GOOGLE_*` | The Google button is hidden. Magic link still works. |

### Seed data

`npm run db:seed` **wipes and reseeds** the database (it refuses to run with `NODE_ENV=production`). It creates:

- **3 upcoming events:** *Signal Lost* (featured, 5 tiers including a sold-out Early Bird, an "Only N left" VIP, a table that admits 6, and a hidden code-only tier), *Sunday Slowdown* (collects a name per ticket, group bundle), and *Wave Live* (free RSVP plus a paid tier; organizer absorbs fees).
- **2 past events** for the recap strip, with check-in history.
- About 490 paid orders spread over the last 3 weeks, so the dashboard and charts have data.
- **Promo codes:** `WAVE10` (10% off everything), `FRIENDS` (unlocks the hidden tier on Signal Lost), `SUNDAY2K` (₦2,000 off Sunday Slowdown), `ADMIN-WAVE` (the admin's Wave Club referral code: 10% off, and the admin earns points).
- **Add-ons:** parking and a drinks bundle on Signal Lost, a mimosa jug on Sunday Slowdown.
- **Wave Club:** points backfilled for every seeded buyer. The admin is a Swell-tier member, so it can buy the member-only *Wave Club Early Entry* tier.
- **Funnel analytics:** 30 days of sample traffic, so the funnel charts have data.
- **Staff:** `SUPER_ADMIN_EMAIL` as super admin, plus `door@oflinewave.test` as door staff.
- **A scannable test ticket** with code `TESTDOOR` on Signal Lost. The seed prints its URL.

To sign in as the admin, go to `/login`, enter `SUPER_ADMIN_EMAIL` and click the link printed in the dev console.

---

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string. |
| `APP_URL` | ✅ | Public base URL, no trailing slash. Used in emails, QR image links and OG tags. |
| `AUTH_SECRET` | ✅ | Auth.js session encryption. |
| `TICKET_SIGNING_SECRET` | ✅ | HMAC key for QR codes. **Never rotate after tickets exist**: old QRs would stop scanning. |
| `SUPER_ADMIN_EMAIL` | ✅ | Gets `SUPER_ADMIN` on sign-in. Use it to bootstrap the first admin. |
| `PAYSTACK_SECRET_KEY` | ✅ prod | `sk_test_…` for staging, `sk_live_…` for production. |
| `RESEND_API_KEY` | ✅ prod | The sending domain must be verified in Resend. |
| `EMAIL_FROM` | | Defaults to `Oflinewave <tickets@oflinewave.com>`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | | Google sign-in. |
| `BLOB_READ_WRITE_TOKEN` | uploads on Vercel | Vercel Blob, for poster uploads. Without it, uploads go to disk. |
| `UPLOAD_DIR` | | Disk folder for uploads on cPanel or a VPS. Keep it outside the app folder. |
| `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`) | recommended | Error monitoring. Sentry stays off until the DSN is set. The auth token uploads source maps at build time. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | | Optional Plausible page analytics. The ticket funnel is built in and needs no setup. |
| `GOOGLE_WALLET_*` | | Issuer ID, service account email and private key. Shows "Save to Google Wallet". |
| `APPLE_PASS_*`, `APPLE_TEAM_ID`, `APPLE_WWDR_CERT` | | Pass Type ID certificate and key (PEM). Shows "Add to Apple Wallet". |

Secrets live only in env vars, never in the database. The admin Settings page shows which integrations are connected.

---

## Deploying

**Hostinger, cPanel or a VPS:** see [DEPLOY.md](DEPLOY.md). Hosts that build for you get `npm run zip:source`; hosts that can't build get `npm run package`.

### Vercel + managed Postgres

1. **Database.** Create a Postgres database (Neon, Supabase or Vercel Postgres). Use the pooled connection string for `DATABASE_URL`. Turn on automated backups or point-in-time recovery.
2. **Project.** Import the repo into Vercel and add every variable from the table above for Production (and Preview, using test keys).
3. **Migrations.** Run `npm run db:deploy` against the production database before or as part of each deploy. For example, set the build command to `npm run db:deploy && npm run build`.
4. **Paystack webhook.** In Paystack → Settings → API Keys & Webhooks, set the webhook URL to:
   ```
   https://YOUR_DOMAIN/api/payments/paystack/webhook
   ```
   The signature is verified with `PAYSTACK_SECRET_KEY`. The callback URL is set per transaction, so there's nothing to configure for it.
5. **Resend.** Verify your sending domain and set `EMAIL_FROM` to an address on it.
6. **Google (optional).** Add `https://YOUR_DOMAIN/api/auth/callback/google` as an authorized redirect URI.
7. **Blob.** Create a Vercel Blob store and link it to the project; this sets `BLOB_READ_WRITE_TOKEN`.
8. Sign in with `SUPER_ADMIN_EMAIL`, then invite the team from **Admin → Settings → Team**.

> The build prerenders public pages, which reads from the database, so `DATABASE_URL` must be reachable at build time.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate`, apply pending migrations, production build |
| `npm run zip:source` | Source zip for hosts that build for you (no secrets, no node_modules) |
| `npm run package` | Pre-built server zip for hosts that can't build |
| `npm run db:migrate` | Create and apply a migration in dev (`prisma migrate dev`) |
| `npm run db:deploy` | Apply pending migrations in production |
| `npm run db:seed` | Wipe and reseed dev data |
| `npm run typecheck` / `npm run lint` | `tsc` / ESLint |
| `npm run test:smoke` | Service-level smoke test (checkout, add-ons, Wave Club, transfers, check-in, waitlist, funnel) against the **dev** database. Reseed afterwards. |

---

## How it works

### Project layout

```
app/
  (site)/            public site: home, events, checkout, orders, tickets, login, content pages
  admin/             dashboard: overview, events, orders, promos, check-in, settings
  scan/              door scanner (mobile)
  api/               checkout, Paystack webhook, scan endpoints, QR/PDF, CSV, upload, auth
  dev/pay/           payment simulator (dev only)
components/
  ui/                shadcn-style primitives (Button, Input, Badge, Card)
  site/ admin/ scan/ feature components
lib/
  services/          checkout, fulfillment, check-in, refunds (business logic)
  payments/          provider interface + Paystack + mock
  data/              read queries (public queries are cached)
  tickets/           QR signing, QR images, PDF
  email/             Resend wrapper + templates
  pricing.ts         fee / discount maths shared by UI and server
prisma/              schema, migrations, seed
proxy.ts             optimistic auth redirect for /admin and /scan
```

### Design tokens

The palette, fonts, radii and glow shadows live in the `@theme` block of [app/globals.css](app/globals.css). This is Tailwind v4's CSS-first config, which replaces `tailwind.config.js`. It generates utilities such as `bg-ink`, `bg-surface`, `border-line`, `text-muted`, `bg-brand`, `hover:bg-brand-hover`, `font-display` and `shadow-glow`. [lib/tokens.ts](lib/tokens.ts) mirrors the colours for places Tailwind can't reach (OG images, emails, PDFs). Keep the two in sync.

Display headings use **Syne** and body text uses **Inter**. Animations respect `prefers-reduced-motion`.

### Money

All amounts are **integer kobo** (₦1 = 100). [lib/pricing.ts](lib/pricing.ts) is the single pricing function used by both the checkout preview and the server, so the numbers always match:

- Fee = `feePercent × (subtotal − discount) + flatFee × paid tickets`. Free tickets carry no fee.
- `PASS_TO_BUYER` adds the fee to the buyer's total. `ABSORB` takes it out of the payout.
- Fee rules are set globally in Settings and can be overridden per event.

### Checkout and inventory

1. `POST /api/checkout` (rate-limited, zod-validated) locks the requested tier rows with `SELECT … FOR UPDATE`. It counts sold tickets plus **active holds** (pending orders less than 10 minutes old), then creates a `PENDING` order that holds the seats.
2. Expired holds stop counting automatically; no cron job is needed.
3. Free orders (and orders discounted to ₦0) are fulfilled immediately. Paid orders go to Paystack. Each attempt gets its own payment reference, so "Pay again" works.
4. **Fulfilment is idempotent.** It locks the order row and only `PENDING`/`FAILED` orders are fulfilled. Duplicate webhooks, the callback and the webhook racing each other, and retries all issue tickets exactly once. A payment smaller than the order total is not fulfilled and is written to the audit log.
5. The Paystack webhook verifies `x-paystack-signature` (HMAC-SHA512) and records each event under a unique key before processing.
6. Buyers return to `/orders/[id]?t=…&verify=1`, which checks the transaction with Paystack directly so tickets show without waiting for the webhook.

Hidden (code-only) tiers become purchasable only when a promo code that lists them is applied.

### Tickets and QR codes

The QR payload is `OW1.<ticketId>.<HMAC-SHA256 signature>`. Ticket ids are random 96-bit values, so codes can't be guessed, and the signature means they can't be forged or edited. Tickets arrive by email (QR images plus a PDF attachment), on the order page, and in **My tickets**. Guests reach My tickets through a one-tap email link, so no password is needed.

### Door check-in (`/scan`)

- Uses the phone camera (`qr-scanner`) and shows a full-screen green **VALID**, red **ALREADY USED** (with time and scanner name), or amber **WRONG EVENT** / **INVALID**, with a vibration and beep.
- Check-in is a single conditional `UPDATE … WHERE status = 'VALID'`, so two staff scanning the same ticket at the same moment get exactly one VALID.
- **Offline mode:** the device caches the event's ticket list. Without signal, scans are checked against that list, marked used locally and queued. The queue syncs when the device is back online, and tickets someone else scanned in the meantime are reported as conflicts.
- Manual lookup by name, email, ticket code or order reference.

### Transfers and name changes

Buyers (from the order page) and current holders (from the single-ticket link) can **transfer** a ticket or **change the name** on it until a per-event cutoff, which defaults to 24 hours before start. Organizers can switch transfers off per event or change the cutoff. Admins can transfer or rename at any time from the order page.

A transfer **re-issues the QR**: the token gains a random nonce, and check-in requires the token stored on the ticket. The old holder's screenshot or PDF stops scanning, including on offline scanners, which compare a fingerprint of the current QR. The new holder gets their own email and link (`/tickets/[id]?t=…`), and both sides are recorded in the trail.

### Waitlist

Sold-out events take waitlist sign-ups. People are emailed automatically, oldest first and each only once, when a refund frees seats or an admin adds capacity. Admins can also email the waitlist from the event page.

### Add-ons

Per-event extras such as parking, drinks or merch, each with its own stock. Stock is locked and held the same way as ticket tiers. Add-ons count toward the percentage fee, but promo codes and the flat per-ticket fee don't apply to them. At the door, a VALID scan lists the order's add-ons with a **Hand over 1** button that can't exceed what was bought.

### Wave Club (loyalty and referrals)

- Every paid order earns points: 1 per ₦100, minimum 10. Accounts are keyed by email, so guest purchases count too.
- **Tiers** by lifetime points: Wave (any order), Swell (1,000+), Tsunami (5,000+).
- **Member-only ticket tiers** (visibility "Wave Club members only") need a signed-in member.
- **Referral codes:** members create a personal code in My tickets. Friends get 10% off and the member earns 500 points per order. Self-referral is blocked, and every award is idempotent per order.

### Analytics

A first-party, cookie-free funnel: *event view → checkout view → payment started → paid*. Visitors are counted by a salted hash of IP and user agent that rotates daily, so nobody can be tracked across days. Do Not Track and bots are skipped, and only the referring domain is kept. Funnels show on the admin overview (30 days) and on each event (90 days).

### Email copy

**Settings → Email copy** edits the subject, heading and message for the ticket, sign-in, waitlist and transfer emails, with `{{placeholders}}`. The layout, tickets and buttons stay in code, and all inserted values are HTML-escaped. "Send me a test" sends the saved copy to your own inbox.

### Add to wallet

With credentials set, tickets show **Add to Apple Wallet** (a signed `.pkpass` built with `passkit-generator`) and **Save to Google Wallet** (a signed save-link JWT; no API calls needed). Both carry the same QR. A transfer creates a new pass, because the serial or object id includes the QR fingerprint.

### PWA and offline

The site is installable: manifest, icons, and `start_url` set to My tickets. The service worker (`public/sw.js`, production only) caches build assets and keeps the last copy of ticket, order and scanner pages, so a ticket opened once still shows its QR without signal. Signing out clears those saved pages. Admin pages, the API (except QR images) and auth are never cached.

### Roles

`ATTENDEE` < `DOOR_STAFF` (scanner only) < `ORGANIZER` (events, orders, promos) < `SUPER_ADMIN` (settings and team). Every admin page, server action and API route checks the role itself through `requireAdmin()`, `requireRole()` or `scanGuard()`. `proxy.ts` is only an early redirect for visitors with no session.

### Caching

Cache Components is enabled. Public event data is cached with `'use cache'` and tagged; admin saves call `updateTag()`, so changes appear immediately. Live ticket availability is never cached. Session-dependent UI streams in behind `<Suspense>`.

---

## Status

**Phase 1 (MVP): done.** Public site, event pages with live availability, tiers, Paystack checkout with 10-minute holds, emailed QR tickets (plus PDF), My tickets, admin events, orders, refunds, manual comp and cash sales, resend, CSV export, door scanner with offline queue, SEO.

**Phase 2: done.** Promo codes, waitlist with automatic emails, ticket transfer and name change (with an admin-controlled window), reports, CSV export, team roles, editable email copy, Sentry hooks, funnel analytics, add to wallet.

**Phase 3: done (first versions).** Discovery (Tonight and This weekend filters, quick-filter chips, related events), add-ons with door hand-over, Wave Club points, tiers, member-only tiers and referral codes, and an installable PWA with offline tickets.

Ideas for later: spending points at checkout, waitlist priority for higher tiers, push notifications, venue pages.

### Before going live

- **Error monitoring:** set `NEXT_PUBLIC_SENTRY_DSN`. Everything is already wired: server errors, client errors and the error boundaries.
- **Wallet passes:** both are untested against real Apple and Google accounts. Test with your certificates before announcing them.
- **Offline mode:** the service worker only runs in production builds. Test it on real phones with airplane mode.
- **Rate limiting** is in-memory per server instance. Behind many instances, swap [lib/rate-limit.ts](lib/rate-limit.ts) for Upstash Redis.
- **Legal pages** (`/terms`, `/privacy`, `/refunds`) are plain-language drafts. Have them reviewed by a lawyer.
- **Database backups:** turn on your provider's automated backups or point-in-time recovery.
- Run Lighthouse on a production deploy. Posters are SVG in the seed; real JPG/WebP uploads go through `next/image`.
