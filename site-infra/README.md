# site-infra

Stand up a new site's domain — DNS, CDN, SSL, and email forwarding — from a small
JSON file instead of clicking through Cloudflare and Railway every time. No Terraform,
no dependencies — just Node 18+ and `fetch`.

Built for the workflow: **Hostinger domain → Cloudflare (DNS + CDN + SSL + email) →
Railway (origin) ← GitHub (deploys)**. It handles the apex (`@`) *and* `www` records
for you, so you never have to remember which one is which again.

## Prerequisites

- **Node 18+** — uses built-in `fetch` and `crypto`; there is no `npm install`.
- A **Cloudflare** account with an API token (exact permissions are in `.env.example`).
- A **Railway** account with an *Account* API token, and your app deployed as a service.
- Your domain registered somewhere you can change **nameservers** (e.g. Hostinger).
- *(Email/GA4 are optional.)* GA4 also needs a **Google** account with Analytics
  access — set up once via OAuth (the tested path; see step 6).

## Cheat sheet (for a brand-new domain)

```bash
node list-railway.mjs                          # 1. get your project/service IDs
cp sites/example.com.json sites/NEW.json       # 2. edit domain + IDs + forward inbox
node setup-site.mjs sites/NEW.json             # 3. zone + SSL + Railway domains (DNS-only)
#    → set the printed nameservers at Hostinger (one-time per domain)
node enable-cdn.mjs sites/NEW.json --watch     # 4. waits for cert, then flips proxy on
node setup-email.mjs sites/NEW.json            # 5. hello@ -> your inbox (optional)
node auth-google.mjs                           #    GA4 one-time OAuth login (first run only)
node setup-analytics.mjs sites/NEW.json        # 6. GA4 property + Measurement ID (optional)
```

That's the whole lifecycle. Everything is idempotent — safe to re-run.

## Why it's phased (setup-site → wait → enable-cdn)

Railway can't verify your domain or issue its TLS certificate while Cloudflare's
orange-cloud proxy is on — the proxy hides the real DNS target. So:

1. **`setup-site`** creates everything **DNS-only** (grey cloud). Railway sees the
   real records, verifies ownership (via a `_railway-verify` TXT), and issues its cert.
2. **`enable-cdn`** (run once the cert is live) flips the records to **proxied**
   (orange cloud), turning on the Cloudflare CDN and edge SSL.

This is exactly the "let everything come up, *then* the Cloudflare SSL kicks in"
flow. Cloudflare is always set to **Full (strict)** so it's encrypted end-to-end.

---

## One-time setup (per machine)

1. `cp .env.example .env` and fill it in — **Cloudflare + Railway tokens** (required),
   plus the **Google/GA fields** (optional, for `setup-analytics`). The file lists the
   exact Cloudflare token permissions and the Google setup.
2. That's it. No `npm install` — there are no dependencies.

## Per site (the repeatable part)

### 1. Find your Railway IDs

```bash
node list-railway.mjs
```

Copy the `projectId`, `environmentId`, and `serviceId` for the service you're deploying.

### 2. Make a config

Copy the template and rename it to your domain:

```bash
cp sites/example.com.json sites/mycoolsite.com.json
```

Edit it:

```json
{
  "domain": "mycoolsite.com",
  "subdomains": ["@", "www"],
  "railway": {
    "projectId": "...",
    "environmentId": "...",
    "serviceId": "...",
    "targetPort": null
  }
}
```

- `subdomains`: `"@"` = the apex (`mycoolsite.com`), `"www"` = `www.mycoolsite.com`.
  Add more (e.g. `"app"`) if you want; each becomes its own Railway custom domain.
- `targetPort`: leave `null` unless your Railway service needs a specific port.
- `email` (optional): forwarding rules, e.g. `hello@` → your inbox. See step 5.

### 3. Run it

```bash
node setup-site.mjs sites/mycoolsite.com.json
```

This creates the Cloudflare zone (if new), sets SSL to Full (strict), registers the
Railway custom domains, and mirrors the exact DNS records Railway asks for into
Cloudflare — DNS-only for now.

**If the zone was just created**, it prints your Cloudflare nameservers. Set those at
Hostinger once (Domains → your domain → DNS / Nameservers → custom nameservers). This
is the only manual, one-time-per-domain step.

### 4. Wait for Railway's cert, then turn on the CDN

Easiest — let it wait for you, then flip the proxy automatically:

```bash
node enable-cdn.mjs sites/mycoolsite.com.json --watch
```

Or do it manually: `node status.mjs sites/mycoolsite.com.json` to check, then
`node enable-cdn.mjs sites/mycoolsite.com.json` once issued. Without `--watch`,
`enable-cdn` refuses to run until the cert is issued (override with `--force`).

### 5. (Optional) Email forwarding — `hello@yourdomain` → your inbox

Add an `email` section to the site config:

```json
"email": {
  "forward": { "hello": "you@your-inbox.com" },
  "catchAll": "you@your-inbox.com"
}
```

Then:

```bash
node setup-email.mjs sites/mycoolsite.com.json
```

This enables Cloudflare Email Routing (adds the MX + SPF records), registers your
forward-to address, and creates the rules. **The forward-to address must be verified
once** — Cloudflare emails it a link; click it, then re-run the script to confirm.
A given inbox only needs verifying once across your whole account, so future sites
skip that step.

### 6. (Optional) GA4 analytics — auto-create property + Measurement ID

Add an `analytics` section to the site config (all fields optional):

```json
"analytics": { "timeZone": "Etc/UTC", "currency": "USD", "envVar": "NEXT_PUBLIC_GA_ID" }
```

Then:

```bash
node setup-analytics.mjs sites/mycoolsite.com.json
```

This creates a GA4 property + web data stream, grabs the **Measurement ID
(`G-XXXX`)**, and writes it to your Railway service as `NEXT_PUBLIC_GA_ID`. Your app
renders the tag from that env var (see below). Requires the one-time Google setup:

#### GA4 one-time setup (per Google account, once)

GA4 doesn't take a simple token — pick one auth method.

**Option A — OAuth (recommended).** Uses *your own* Google account, which already has
GA access, so there's no service-account-in-GA grant to wait on.

1. **Google Cloud Console** → pick a project → **APIs & Services → Library** → enable
   **Google Analytics Admin API**.
2. **APIs & Services → OAuth consent screen** → User type **External** → fill the
   basics → under **Test users**, add your own Google email (the one with GA access).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   application type **Desktop app** → download the JSON → save as
   `site-infra/google-oauth-client.json` (git-ignored).
4. Run `node auth-google.mjs`, open the printed URL, approve (click *Advanced → Go to
   … (unsafe)* — normal for a personal testing app). A refresh token is saved.
5. Put `GA_ACCOUNT_ID` (GA → Admin → Account Settings → numeric Account ID) in `.env`.

**Option B — Service account.** Same as A step 1, then **IAM & Admin → Service
Accounts** → create → **Keys → Add key → JSON** → save as `site-infra/google-sa.json`.
Then add its email as **Editor** in **GA → Admin → Account access management**.

> **Gotcha (service accounts only) — "this email doesn't match a Google Account":**
> GA's UI often rejects a *brand-new* service account until its identity propagates
> (~30–60 min). OAuth (Option A) avoids this entirely.

**Manual mode (no service account needed):** create the GA4 property in the GA UI,
then pass the Measurement ID directly — the script just pushes it to Railway:

```bash
node setup-analytics.mjs sites/X.json --id=G-XXXXXXX
# or put "measurementId": "G-XXXXXXX" inside the config's "analytics" section
```

#### Rendering the tag in the app (one-time per app codebase)

`setup-analytics` only stores the Measurement ID — the app still has to render the GA
tag from `NEXT_PUBLIC_GA_ID`. Either use `@next/third-parties`
(`<GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />`, needs the dep), or drop
this dependency-free `next/script` component into the app (e.g. `components/GoogleAnalytics.tsx`)
and render it in the root layout:

```tsx
import Script from "next/script";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId || gaId.includes("XXXX")) return null; // no-op on the placeholder
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}</Script>
    </>
  );
}
```

> **Important — `NEXT_PUBLIC_*` is inlined at *build* time, not runtime.** Setting the
> Railway var alone does nothing to an already-built image: the var must be present
> **when Railway builds**. So after wiring the component, push the code and let Railway
> rebuild *with the var set* (it is, via `setup-analytics`). A redeploy that doesn't
> rebuild won't pick it up.

---

## Commands

| Command | What it does |
| --- | --- |
| `node list-railway.mjs` | List projects + service/environment IDs. |
| `node setup-site.mjs sites/X.json` | Phase 1: zone + SSL + Railway domains + DNS-only records. |
| `node status.mjs sites/X.json` | Show Railway cert status + Cloudflare proxy state. |
| `node enable-cdn.mjs sites/X.json` | Phase 2: flip records to proxied (CDN on). Add `--watch` to wait for the cert first, `--force` to skip the check. |
| `node setup-email.mjs sites/X.json` | Email Routing: enable + forward `hello@` etc. to your inbox. |
| `node auth-google.mjs` | One-time OAuth login for GA4 (saves a refresh token). |
| `node setup-analytics.mjs sites/X.json` | GA4: create property + data stream, push Measurement ID to Railway. Add `--id=G-XXXX` for manual mode. |
| `node teardown-site.mjs sites/X.json` | Remove Railway domains + Cloudflare records (keeps the zone). |

All commands are **idempotent** — safe to re-run. Re-running `setup-site` after a
failed step just fills in what's missing.

---

## Copying this into another project

The whole folder is self-contained. Copy `site-infra/` anywhere, copy your `.env`
into it (or recreate it), and you're ready. Nothing here is tied to this repo.

## Notes / gotchas

- **Nameservers at Hostinger** are the one manual step. Hostinger's API can change
  them too, but it's genuinely once-per-domain, so it isn't automated here.
- **Apex on Cloudflare** uses CNAME flattening automatically — pointing `@` at a
  Railway `*.up.railway.app` target just works.
- **Never use SSL mode "Flexible."** With Railway forcing HTTPS it causes redirect
  loops. This tool always sets Full (strict).
- **Railway ownership TXT** lives at `_railway-verify.<host>` (NOT the bare host), with
  value `railway-verify=…`. Without it the domain stays stuck on `VALIDATING_OWNERSHIP`
  forever. `setup-site` creates it automatically — this was the single biggest
  time-sink to discover by hand.
- **Apex CNAME may show `REQUIRES_UPDATE` in Railway forever** because Cloudflare
  flattens the apex CNAME to A records. That's cosmetic — as long as the apex A
  matches the Railway target's IP, the cert still issues via the TXT.
- **Email forward addresses need a one-time verification click** (Cloudflare emails a
  link to the forward-to inbox). An inbox only needs verifying once per account.
- Tokens live only in `.env`, which is git-ignored. Railway/Cloudflare IDs are not
  secret, so site JSON files are safe to commit (handy as a record of what you run).
