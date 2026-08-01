# Hund & Handler Danmark — Dog Training Class Registration PWA

Built for your existing **Supabase + Vercel + GitHub** stack. Customers
browse open classes, register, and pay either via **Vipps MobilePay** or
**pay at class** (cash on arrival, useful while MobilePay isn't set up
yet). A class automatically stops accepting registrations the moment it
hits its participant cap — capacity checks are done atomically in
Postgres, so it's safe even with concurrent requests across multiple
serverless invocations.

The admin panel (`/admin.html`) is behind a real login (Supabase Auth) —
only accounts you create yourself can sign in and manage classes.

Customers can also opt in to a newsletter when they register, and the
admin panel has a simple tool to email everyone who opted in, with a
one-click unsubscribe link in every email.

**Language**: the whole site (customer pages and admin) defaults to
Danish, with a DA / EN toggle in the top-right corner of every page. The
choice is remembered per browser. This only translates the app's own
interface text — class titles/descriptions you type in as admin are
shown as-written in whatever language you enter them. Confirmation and
release-announcement emails are always sent in Danish, regardless of
which language someone was browsing in when they registered - the app
doesn't currently track a per-person email-language preference.

**Branding**: your logo is in `icons/logo.png`, used in the site header,
login page, and admin page, and the app icons (`icons/icon-192.png`,
`icons/icon-512.png`, `icons/favicon.png`) were generated from it. Swap
these files for a higher-resolution version any time.

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
   - If you already ran an older version of this schema, instead run, in
     order: `supabase/migration-2-pay-at-class.sql`,
     `supabase/migration-3-newsletter.sql`,
     `supabase/migration-4-end-date.sql`,
     `supabase/migration-5-payment-breakdown.sql`,
     `supabase/migration-6-release-admin-move.sql`,
     `supabase/migration-7-location-link.sql`, and
     `supabase/migration-8-refresh-view.sql` — each only adds new columns
     and functions, without touching existing data. Migration 8 is
     important even though it doesn't add anything new itself - it
     refreshes a view that otherwise silently hides columns added by
     migrations 6 and 7 (see the comment in that file for why).
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

## 3. Set up newsletter emails (Resend)

1. Sign up at [resend.com](https://resend.com), verify a sending domain
   you own (Resend walks you through adding a couple of DNS records).
2. Create an **API key** (Resend dashboard → API Keys).
3. You'll add `RESEND_API_KEY`, `EMAIL_FROM` (e.g.
   `Hund & Handler <news@yourdomain.com>`, using your verified domain),
   and `NEWSLETTER_UNSUBSCRIBE_SECRET` (any long random string you make
   up) to Vercel's environment variables in the next step.

If you'd rather skip this for now, that's fine — registration and the
admin panel work without it. The "Send to subscribers" button will just
fail with a clear error until these are set.

## 4. Set up scheduled release announcements

This powers "send a newsletter 10 minutes before a class's release date."
Vercel's free (Hobby) plan only allows cron jobs to run once a day, which
is too coarse for this, so a small GitHub Actions workflow
(`.github/workflows/announce-releases.yml`, already included) pings a
secured endpoint every 5 minutes instead - no extra signups, no paid plan
needed.

1. Make up a long random string and add it to Vercel's environment
   variables as `CRON_SECRET`.
2. In your GitHub repo: **Settings → Secrets and variables → Actions →
   New repository secret**. Add two secrets:
   - `CRON_SECRET` — the exact same value as in Vercel
   - `APP_URL` — your live site's URL, e.g.
     `https://hund-og-handler.vercel.app` (no trailing slash)
3. That's it — the workflow runs automatically once it's on GitHub. You
   can also trigger it manually anytime from the repo's **Actions** tab
   (find "Announce upcoming class releases" → **Run workflow**) to test it.

When creating or editing a class with a **release date** set, check
**"Send newsletter 10 min before release"**. If multiple classes share
the exact same release date/time, they're automatically bundled into a
single email instead of one each.

If you'd rather skip this for now, that's fine too — everything else
works without it; classes just won't get an automatic pre-release
announcement.

## 5. Deploy

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

## 6. Before going live, a few things worth tightening

- **Email deliverability**: for real sending volume, make sure your
  Resend domain's SPF/DKIM are verified (Resend flags this in their
  dashboard) so newsletters don't land in spam.
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
.github/workflows/
  announce-releases.yml       GitHub Actions cron: pings the release-announcement endpoint every 5 min
api/
  classes/
    index.js                GET list / POST create (admin)
    [id].js                  GET one / PATCH edit or close (admin)
    [id]/registrations.js     GET roster for a class (admin)
    [id]/participants.js       (admin) POST add participant without payment
  register/
    index.js                 POST create registration + start payment
    [id].js                   GET registration status
  webhooks/
    mobilepay.js               receive MobilePay payment confirmations
  admin/
    newsletter.js              GET subscriber count / POST send newsletter
    classes/[id]/participants.js  POST add a participant directly, no payment
    registrations/[id].js         DELETE a registration
    registrations/[id]/move.js     PATCH move a registration to another class
  cron/
    announce-releases.js       scheduled: bundles + sends "releasing soon" emails
  unsubscribe.js                one-click unsubscribe (no login needed)
lib/
  supabase.js                 Supabase client (secret/service role key)
  mobilepay.js                MobilePay ePayment API client
  email.js                     Resend email client
  registrationEmail.js          "you're confirmed" email, reused everywhere a seat is confirmed
  unsubscribe.js                signed unsubscribe link helper
  http.js                     Supabase-Auth admin check / base-url helper
supabase/
  schema.sql                   run once in the Supabase SQL editor (fresh installs)
  migration-2 .. migration-8     run these instead if you already had an
                                    older schema, in numeric order
index.html, login.html, admin.html, payment-return.html, accept-invite.html   pages
app.js, admin.js                                             page logic
supabase-config.js              Supabase URL + publishable key (safe to be public)
styles.css, manifest.json, sw.js                shared styling + PWA files
```
