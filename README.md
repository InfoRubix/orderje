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

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Drizzle ORM · MySQL 8 / Aurora MySQL / MariaDB 10.6+ · JWT session cookies (jose) · bcrypt.

Money is stored as integer sen; rates as basis points. All timestamps are UTC (each DB connection sets `time_zone = '+00:00'`); business dates are Malaysia time.

## Run locally

```bash
cp .env.example .env.local        # fill in DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate                # creates tables
npm run dev                       # http://localhost:3000
```

Sign up at `/signup` (tick "Start with a sample mamak menu" for demo data). The emails in `SUPERADMIN_EMAILS` can open `/admin`.

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/orderje` |
| `AUTH_SECRET` | 32+ random characters (`openssl rand -base64 48`) |
| `APP_URL` | Public URL. Used in table QR codes and ToyyibPay return/callback URLs, so set it before printing QRs |
| `SUPERADMIN_EMAILS` | Comma-separated Rubix emails allowed into `/admin` |
| `ALLOW_SIGNUP` | `false` to close public signup and onboard kedai manually |
| `DB_SSL` | `rds` for Amazon RDS/Aurora (bundled RDS CA), `true` for other TLS MySQL |

## Deploy on AWS Amplify + RDS

1. Create a MySQL 8 database on RDS (or Aurora MySQL) and a database named `orderje`.
2. Connect this repo in Amplify Hosting. `amplify.yml` is included: it writes the server env vars into `.env.production` (Amplify only exposes them at build time), runs migrations, then builds.
3. Set the env vars above in Amplify (with `DB_SSL=rds`).
4. Make sure Amplify's build and runtime can reach the database. Amplify Hosting compute does not run inside your VPC, so the RDS instance needs to accept connections from it (publicly accessible with a strong password, TLS and a tight security group), or host the app on a VPC-attached service such as App Runner, ECS or EC2 instead.
5. Set `APP_URL` to the final domain, then print the table QR codes from **Tables & QR**.

### ToyyibPay

Each kedai enters its own User Secret Key and Category Code in Settings, so FPX money settles directly to the kedai's ToyyibPay account. Sandbox mode is on by default. The callback URL (`/api/pay/toyyibpay/callback`) is sent with each bill automatically, and every callback is re-verified against ToyyibPay's `getBillTransactions` API before an order is marked paid.

## Tests

`tests/e2e.py` drives the whole flow in a real browser against a running build: signup, settings, customers, staff, QR order on a phone viewport, kitchen, QR confirmation, member discount with cash rounding and change, corporate credit, cashier role limits, cancel, dashboard, recon with a 10-sen variance, post-close lock, and tenant isolation.

```bash
pip install playwright && playwright install chromium
npm run build && npm start
TEST_DB=orderje python3 tests/e2e.py   # WARNING: drops and recreates TEST_DB
```

## Database changes

Edit `src/db/schema.ts`, then `npm run db:generate` to create a migration in `drizzle/`, and `npm run db:migrate` to apply it.

## Not built yet

- Billplz / iPay88 as alternative gateways (ToyyibPay only for now).
- e-Invoice (LHDN MyInvois) submission.
- Splitting one bill across several payment methods.
- Menu photo upload (items take an https image link for now).
- Direct ESC/POS printing (receipts print through the browser's print dialog).
