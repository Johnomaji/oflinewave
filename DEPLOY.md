# Deploying Oflinewave

There are two ways, depending on your host:

- **A. The host builds the app for you**: Hostinger's Node.js apps, Vercel, a VPS. You upload the source code and the host runs `npm install` and `npm run build`. **Use this one if your host's log shows "Running npm install".**
- **B. The host only runs a finished app**: cPanel's *Setup Node.js App*. You build on your computer and upload the result.

Both need a **PostgreSQL** database. Most shared hosting only has MySQL, which won't work. Use a free one from [Neon](https://neon.tech) (recommended) or [Supabase](https://supabase.com), and copy its connection string. It looks like `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`.

---

## A. Host builds it (Hostinger Node.js app)

### 1. Make the zip

```bash
npm run zip:source
```

This creates `dist/oflinewave-source-YYYY-MM-DD.zip`, about 1 MB. It's your code without `node_modules`, build files or your `.env` secrets. The script checks this, and stops if a secret file would be included.

### 2. Add the environment variables first

In the app's settings on your host, add the variables from [the table below](#environment-variables) **before** you deploy. Two of them are needed during the build itself:

- `DATABASE_URL`: the build creates the database tables and reads your events to pre-render pages.
- `APP_URL`: it's baked into share links and the sitemap.

### 3. Upload and deploy

Upload the zip and start the deployment. The build will:

1. install packages,
2. create or update the database tables (`prisma migrate deploy`),
3. build the site.

The start command is `npm start`. Most hosts detect it automatically.

### Updating later

Run `npm run zip:source` again, upload, and redeploy. New database changes are applied automatically during the build.

---

## B. cPanel "Setup Node.js App" (host can't build)

1. Create `.env.production.local` next to `.env` on your computer, with the live `DATABASE_URL` and `APP_URL="https://oflinewave.com"` (plus any `NEXT_PUBLIC_…` values). It stays on your computer.
2. Run `npm run package`. This creates the tables in the live database, builds, and makes `dist/oflinewave-YYYY-MM-DD.zip` (about 30 MB). It refuses to run while those values still point at your computer.
3. *Setup Node.js App → Create Application*: Node **20.9 or newer**, application root `oflinewave_app` (**not** inside `public_html`), startup file `server.js`. Create it, then **Stop App**.
4. *File Manager*: upload the zip into `oflinewave_app` and extract it. `server.js` must sit directly in that folder. Delete the zip. If the extract complains about an existing `node_modules` link, delete that link and extract again. **Don't** click "Run NPM Install".
5. Add the environment variables below, then **Start App**.

To update: run `npm run package`, then stop the app, empty the folder, upload and extract the new zip, and start it again.

**Hostinger Node.js app (or any host that insists on building):** upload the same zip. The built app sits in `server/`, and the top-level `package.json` has nothing to install and a build step that does nothing, so the host's `npm install` and `npm run build` pass without touching it. Set the start command to `npm start` (or entry file `server.js`) and add the environment variables below.

If `npm run package` stops with **"Timed out trying to acquire a postgres advisory lock"**, an old database connection is still holding the migration lock. In the Neon console, restart the compute (Branches → your branch → Computes → Restart) and run it again. Setting `DATABASE_URL_UNPOOLED` (Neon's direct connection) for builds prevents it.

---

## Environment variables

Set these in the host's control panel. Never upload a `.env` file.

| Name | Value |
|---|---|
| `DATABASE_URL` | the live Postgres connection string |
| `APP_URL` | `https://oflinewave.com` (no trailing slash) |
| `AUTH_SECRET` | a new random value: run `npx auth secret` |
| `TICKET_SIGNING_SECRET` | a new random value, 32+ characters. **Never change it later**, or every issued ticket stops scanning |
| `SUPER_ADMIN_EMAIL` | your email; you become admin the first time you sign in. For several admins, comma-separate them: `you@example.com,partner@example.com` |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` while testing, `sk_live_…` for real sales |
| `RESEND_API_KEY` | from Resend, after verifying your domain there |
| `EMAIL_FROM` | `Oflinewave <tickets@oflinewave.com>` |
| `UPLOAD_DIR` | a folder **outside** the app folder for poster uploads, e.g. `/home/YOUR_USER/oflinewave_uploads`, so updates don't delete them |
| `NODE_ENV` | `production` (only if the host doesn't set it) |

Optional ones (Google sign-in, Sentry, wallet passes, Plausible) are listed in `.env.example`.

**Never run `npm run db:seed` against the live database.** The seed deletes everything first, and it refuses non-local databases.

## After it's up

- **SSL:** the site must be on `https`. Paystack and the door scanner's camera need it.
- **Paystack:** Dashboard → Settings → API Keys & Webhooks → Webhook URL:
  `https://oflinewave.com/api/payments/paystack/webhook`
- **Resend:** add the DNS records it gives you in your domain's DNS settings, and wait for *Verified*.
- **Google sign-in (optional):** authorised redirect URI `https://oflinewave.com/api/auth/callback/google`.
- **First admin:** sign in at `/login` with `SUPER_ADMIN_EMAIL`, then create your events in `/admin`.

## If something goes wrong

- **`Connection url is empty` during the build:** `DATABASE_URL` isn't set in the host's settings, or it was added after the build started. Add it and redeploy.
- **`Can't reach database server`:** check the connection string, and that it ends with `?sslmode=require` for Neon or Supabase.
- **503 or "incomplete response":** open the app's runtime log. The first error line usually names the missing variable.
- **Sign-in emails don't arrive:** check `RESEND_API_KEY` and that the domain is verified in Resend.
- **Payments stay "pending":** the Paystack webhook URL is wrong or the site isn't on `https`.
- **The app restarts under heavy load:** shared plans cap memory. That's fine for normal traffic, but a big ticket drop may need a VPS.
