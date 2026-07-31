# Dog & Handler — Dog Training Class Registration PWA

Built for your existing **Supabase + Vercel + GitHub** stack. Customers
browse open classes, register, and pay via **Vipps MobilePay**. A class
automatically stops accepting registrations the moment it hits its
participant cap — capacity checks are done atomically in Postgres, so it's
safe even with concurrent requests across multiple serverless invocations.

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
2. Grab your **Project URL** and **service role key** from
   Project Settings → API. The service role key is a secret — it bypasses
   Row Level Security, so it's only ever used inside the serverless
   functions, never sent to the browser.

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
   from `.env.example` with real values (Supabase service role key,
   MobilePay production keys, your own `ADMIN_KEY`).
3. Deploy. Visit `https://your-app.vercel.app` for the customer app and
   `/admin.html` to create classes (paste your `ADMIN_KEY` into the page
   first — it's kept only in that browser tab's session storage).

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

- **Admin auth**: the admin page only checks a shared key header. Fine
  for a single trusted person; if more people will manage classes,
  switch to Supabase Auth (you already have the project for it) and gate
  `/admin.html` and the admin API routes behind a real login.
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
  supabase.js                 Supabase client (service role key)
  mobilepay.js                MobilePay ePayment API client
  http.js                     small admin-auth / base-url helpers
supabase/
  schema.sql                   run once in the Supabase SQL editor
index.html, admin.html, payment-return.html   pages
app.js, admin.js                                page logic
styles.css, manifest.json, sw.js                shared styling + PWA files
```
