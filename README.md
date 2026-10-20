# OrderJe

QR ordering and POS for kedai makan, by Rubix Technology (M) Sdn Bhd. Multi-tenant SaaS: one deployment, many kedai, each with its own menu, staff, customers and data.

## What it does

**Customer (phone, no app)**
- Scans the QR on their table (or the takeaway QR), browses the menu, picks add-ons (ais, kurang manis, telur mata), and sends the order.
- Watches the order move through Received → Cooking → Ready → Served on a live page.
- Pays online by FPX (ToyyibPay), by DuitNow QR (cashier confirms), or at the counter.
- Gets a receipt link they can save or share by WhatsApp.

**Kitchen**
- Live ticket board (New / Cooking / Ready), polling every 4 s, with optional sound for new orders and full-screen mode for a wall tablet.

**Counter (cashier)**
- Unpaid bills by table, customer QR payments waiting for confirmation, and a quick order builder for walk-ins, takeaway and delivery (Grab/Foodpanda).
- Customer type at payment: **Walk-in, Member, Staff, Corporate**. Member and staff discounts apply automatically; corporate bills go on the company's credit account with a limit, settled later.
- Payment methods: **Cash** (BNM 5-sen rounding, quick tender buttons, change shown), **DuitNow QR** (bank reference required), **Corporate credit**, plus **online FPX** from the customer's phone.
- Printable 80 mm thermal receipt.

**Owner**
- Dashboard: sales, average bill, money in hand vs credit, discounts, cancellations, sales by hour/day, by payment method, customer type, order type, QR vs counter, best sellers, SST and service charge collected.
- **End-of-day recon**: system totals for cash, DuitNow QR and online vs what's in the drawer, bank app and ToyyibPay, with short/over per channel, a tick-off list of every QR/FPX payment with its reference, and a closing history. A day can't close with unpaid bills, and payments are blocked once it's closed (owner can reopen).
- Menu with categories, add-on groups (required / optional, max picks, extra price), sold-out toggle.
- Tables with printable QR codes; regenerate a QR if a sticker is copied.
- Staff logins with roles: owner, cashier, kitchen.
- Settings: SST, service charge (dine-in only), member/staff discount, DuitNow QR image, ToyyibPay keys.

**Rubix (super admin)** at `/admin`: every kedai, 30-day order count, suspend / reactivate.

## Clickable demo

`demo/orderje-demo.html` is a standalone front-end demo with sample data from Ayam Gepuk Netizen (no database, no server). It covers the customer QR menu, kitchen, counter (pay at counter: cash, DuitNow QR, corporate credit), dashboard, recon, brand profile and the menu editor. Open it directly in a browser.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Cloud Firestore (Firebase Admin SDK) · Vercel · JWT session cookies (jose) · bcrypt.

All data access happens on the server through the Admin SDK; `firestore.rules` denies every direct client read and write. Money is stored as integer sen; rates as basis points. Timestamps are Firestore timestamps (UTC); business dates are Malaysia time. The data model is documented at the top of `src/db/schema.ts`. Every query filters on a single field, so no composite indexes are needed.

## Run locally

Needs Node 20+, Java 11+ (for the Firestore emulator) and the Firebase CLI (`npm i -g firebase-tools`).

```bash
cp .env.example .env.local        # points at the emulator; set AUTH_SECRET
npm install
npm run emulators                 # terminal 1: Firestore emulator on :8080 (data is lost when it stops)
npm run dev                       # terminal 2: http://localhost:3000
```

Sign up at `/signup` (tick "Start with a sample mamak menu" for demo data). The emails in `SUPERADMIN_EMAILS` can open `/admin`.

### Environment

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | 32+ random characters (`openssl rand -base64 48`) |
| `APP_URL` | Public URL. Used in table QR codes and ToyyibPay return/callback URLs, so set it before printing QRs |
| `SUPERADMIN_EMAILS` | Comma-separated Rubix emails allowed into `/admin` |
| `ALLOW_SIGNUP` | `false` to close public signup and onboard kedai manually |
| `FIRESTORE_EMULATOR_HOST` | Local only: `127.0.0.1:8080` to use the emulator |
| `FIREBASE_PROJECT_ID` | Firebase project ID (`demo-orderje` for the emulator) |
| `FIREBASE_SERVICE_ACCOUNT` | Service-account JSON (raw or base64) for the real project. Required on Vercel |

## Deploy: Vercel + Firestore

**Firestore (Firebase console)**
1. Create a **Cloud Firestore** database in the project: location `asia-southeast1` (Singapore), production mode. The free Spark plan is enough to start.
2. **Rules** tab: paste `firestore.rules` and publish (or `npm run deploy:rules` after `firebase use --add`). It blocks all browser access; the app only talks to Firestore from the server.
3. Project settings → **Service accounts** → *Generate new private key*. This JSON file is the app's database password: never commit it.

**Vercel**
1. Import the GitHub repo as a Next.js project. `vercel.json` pins the functions to `sin1` (Singapore), next to the database; without it every query would cross the Pacific.
2. Environment variables (Production):

   | Variable | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | The service-account JSON, base64-encoded: `node -e "console.log(require('fs').readFileSync('key.json').toString('base64'))"` |
   | `FIREBASE_PROJECT_ID` | Firebase project ID |
   | `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
   | `APP_URL` | Final URL, e.g. `https://orderje.vercel.app` or your domain |
   | `SUPERADMIN_EMAILS` | `info@rubix.com.my` |
   | `ALLOW_SIGNUP` | `true` or `false` |

   Do **not** set `FIRESTORE_EMULATOR_HOST` on Vercel.
3. Deploy. Set `APP_URL` to the final domain before printing the table QR codes from **Tables & QR** (changing it later means reprinting).

### ToyyibPay

Each kedai enters its own User Secret Key and Category Code in Settings, so FPX money settles directly to the kedai's ToyyibPay account. Sandbox mode is on by default. The callback URL (`/api/pay/toyyibpay/callback`) is sent with each bill automatically, and every callback is re-verified against ToyyibPay's `getBillTransactions` API before an order is marked paid.

## Tests

`tests/e2e.py` drives the whole flow in a real browser against a running build: signup, settings, customers, staff, QR order on a phone viewport, kitchen, QR confirmation, member discount with cash rounding and change, corporate credit, cashier role limits, cancel, dashboard, recon with a 10-sen variance, post-close lock, and tenant isolation. It checks what was written with `tests/fsdump.mjs`.

```bash
pip install playwright && playwright install chromium
npm run emulators                       # terminal 1
npm run build && npm start              # terminal 2
python3 tests/e2e.py                    # WIPES the emulator first; refuses to touch a real project
```

## Data changes

Firestore is schemaless: edit the types in `src/db/schema.ts` and the code that writes them. When a new field is added, give it a default where it's read (old documents won't have it), or backfill existing documents with a one-off Admin SDK script.

## Not built yet

- Billplz / iPay88 as alternative gateways (ToyyibPay only for now).
- e-Invoice (LHDN MyInvois) submission.
- Splitting one bill across several payment methods.
- Menu photo upload (items take an https image link for now).
- Direct ESC/POS printing (receipts print through the browser's print dialog).
