# Dog & Handler — Dog Training Class Registration PWA

Built for your existing **Supabase + Vercel + GitHub** stack. Customers
browse open classes, register, and pay either via **Vipps MobilePay** or
**pay at class** (cash on arrival, useful while MobilePay isn't set up
yet). A class automatically stops accepting registrations the moment it
hits its participant cap — capacity checks are done atomically in
Postgres, so it's safe even with concurrent requests across multiple
serverless invocations.

The admin panel (`/admin.html`) is behind a real login (Supabase Auth) —
only accounts you create yourself can sign in and manage classes.

## How it works

- **Frontend**: plain HTML/CSS/JS PWA at the project root — installable,
  with an offline app-shell service worker (API calls are never cached,
  so availability is always live).
- **API**: Vercel serverless functions in `api/` (no framework needed —
  Vercel's file-based routing turns each file into an endpoint).
- **Database**: Supabase Postgres. Two tables (`classes`, `registrations`)
  plus a `class_availability` view and two Postgres functions
  (`create_registration`, `confirm_registration`) that do the
  capacity-checking atomically with row locks — see `supabase/schema.sql`.
- **Payments**: Vipps MobilePay's **ePayment API**. Registering creates a
  payment and redirects the customer into the MobilePay app; MobilePay
  calls a webhook the instant it's approved, which is what confirms the
  seat (and closes the class if it was the last one).

## 1. Set up Supabase

1. In your Supabase project, open **SQL Editor** and run everything in
   `supabase/schema.sql`. This creates the tables, the availability view,
   and the two functions the API relies on.
   - If you already ran an older version of this schema, instead run
     `supabase/migration-2-pay-at-class.sql` — it adds the `payment_method`
     column and updates the function, without touching existing data.
2. Grab your **Project URL** and **Secret key** (Project Settings → API →
   API Keys — on newer Supabase projects this replaces the old
   `service_role` key; it works as a drop-in equivalent). This is a
   secret — it bypasses Row Level Security, so it's only ever used inside
   the serverless functions, never sent to the browser.
3. Also grab the **Publishable key** from the same page (starts with
   `sb_publishable_...`, or the legacy `anon` key on older projects).
   This one *is* meant to be public — open `supabase-config.js` in this
   project and fill in your Project URL and publishable key there. It's
   what the login page and admin panel use to talk to Supabase Auth
   directly from the browser.
4. **Create your admin account**: Authentication → Users → **Add user** →
   enter your email and a password, and toggle "Auto Confirm User" on (so
   you don't need to click an email link). This is the login you'll use
   at `/login.html`.
5. **Turn off public sign-ups** so nobody else can create their own
   account: Authentication → Sign In / Providers → Email, and disable
   "Allow new users to sign up". You (and anyone you manually add as a
   user) can still sign in.
6. Optional extra safety net: set `ADMIN_EMAILS` in your environment
   variables to a comma-separated allow-list of emails that are allowed
   to use the admin API, even if someone else somehow gets a valid
   Supabase login.

## 2. Set up MobilePay

1. Create/log into your business account at
   [portal.vippsmobilepay.com](https://portal.vippsmobilepay.com) and
   enable **online payments**.
2. Generate **API keys** (client ID, client secret, subscription key,
   merchant serial number) — use the **test/sandbox** keys first.
3. Register a **webhook** pointing at
   `https://your-app.vercel.app/api/webhooks/mobilepay` via the Webhooks
   API ([docs](https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/)).
   MobilePay gives you a signing secret when you do this — for
   production, add signature verification to
   `api/webhooks/mobilepay.js` using that secret (the code already
   re-verifies every webhook against MobilePay's API before trusting it,
   but signature checking is a worthwhile extra layer before going live).
4. Full API reference: https://developer.vippsmobilepay.com/docs/APIs/epayment-api/

## 3. Deploy

1. Push this folder to a GitHub repo, then **import it in Vercel** as a
   new project (Vercel auto-detects the `api/` functions and serves the
   root as static files — no framework preset needed, pick "Other").
2. In Vercel → Project Settings → Environment Variables, add everything
   from `.env.example` with real values (Supabase secret key, MobilePay
   production keys, optionally `ADMIN_EMAILS`).
3. Make sure `supabase-config.js` has your real Project URL and
   publishable key filled in (see step 1.3) — commit that file, it's
   meant to be public.
4. Deploy. Visit `https://your-app.vercel.app` for the customer app and
   `/admin.html` to manage classes — it'll redirect you to `/login.html`
   if you're not signed in yet.

### Local development

```bash
npm install -g vercel   # if you don't have it already
vercel link              # connect this folder to your Vercel project
vercel env pull .env.local
vercel dev
```

`vercel dev` runs both the static frontend and the `api/` functions
locally. Since MobilePay needs a public HTTPS URL for its webhook, use a
tunnel (e.g. `ngrok http 3000`) and temporarily set `PUBLIC_BASE_URL` in
`.env.local` to the tunnel URL while testing a full payment flow.

## 4. Before going live, a few things worth tightening

- **Adding more admins**: create additional users in Supabase Auth
  (Authentication → Users → Add user) and, if you're using the
  `ADMIN_EMAILS` allow-list, add their email there too.
- **Webhook signature verification**: add it (see step 2.3 above) so a
  third party can't fake a "payment approved" call.
- **Email confirmations**: the app tracks registration status but
  doesn't send emails yet. Plug a provider (Resend, Postmark, etc.) into
  `api/webhooks/mobilepay.js` where a registration becomes `confirmed`.
- **Icons**: `icons/icon-192.png` and `icon-512.png` are placeholder art —
  swap in real branding before publishing the PWA.
- **Refund handling**: if a class fills up in the rare seconds between
  two people paying at once, the losing registration is marked `failed`
  and logged for a manual refund rather than silently overbooking —
  check Vercel function logs for `confirm_registration error` or
  Supabase logs.

## Project structure

```
api/
  classes/
    index.js                GET list / POST create (admin)
    [id].js                  GET one / PATCH edit or close (admin)
    [id]/registrations.js     GET roster for a class (admin)
  register/
    index.js                 POST create registration + start payment
    [id].js                   GET registration status
  webhooks/
    mobilepay.js               receive MobilePay payment confirmations
lib/
  supabase.js                 Supabase client (secret/service role key)
  mobilepay.js                MobilePay ePayment API client
  http.js                     Supabase-Auth admin check / base-url helper
supabase/
  schema.sql                   run once in the Supabase SQL editor (fresh installs)
  migration-2-pay-at-class.sql   run instead if you already had the old schema
index.html, login.html, admin.html, payment-return.html   pages
app.js, admin.js                                             page logic
supabase-config.js              Supabase URL + publishable key (safe to be public)
styles.css, manifest.json, sw.js                shared styling + PWA files
```
