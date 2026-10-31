# Loopbook — Brightloop Subscription Management System

> Built to the exact PRD specification for the Brightloop Subscription Management System ("Loopbook").

## Setup in <= 5 Commands

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Push Prisma schema to PostgreSQL (Port 5434)
npx prisma db push

# 3. Seed database with story records, admin, staff & subscriptions
npm run seed

# 4. Run automated invariant tests (All 10 tests green!)
npm test

# 5. Start the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 1-Click Demo Credentials

| Role | Email | Password | Access / Purpose |
|---|---|---|---|
| **Admin** | `admin@brightloop.in` | `Admin@123!` | Complete access: products, plans, discounts, staff invites, virtual clock |
| **Staff** | `rahul@brightloop.in` | `Staff@123!` | Operations: quotes, confirm subscriptions, billing runs, payments |
| **Customer** | `sunita@anandbhavan.com` | `Customer@123!` | Customer Portal: Hotel Anand Bhavan (25 seats, pause/resume, Pay Now) |

---

## Core Features & Differentiators

- **Idempotent by Construction:** Database partial unique index (`uq_invoice_period`) makes double billing structurally impossible.
- **Explainable Money:** Every invoice line item has a **"Why this amount?"** price waterfall modal breaking down base, variant extra, discounts, and taxes.
- **Virtual Clock & Time Travel:** Interactive time travel banner on every page (`+1 Day`, `+1 Month`, `Reset`) allowing judges to watch subscriptions renew, discounts expire, and invoices turn overdue in real time.
- **Ledger Health Dashboard:** Live SQL consistency checks verifying 0 duplicates, exact line reconciliation, and full period coverage.
- **MRR Movement Waterfall:** Real-time MRR movement (Start + New + Expansion - Contraction - Churn = End MRR) tracked via append-only `mrr_events`.
- **Renewal Radar:** Grouped overview of subscriptions expiring in 7 / 30 / 60 days with 1-click renewal.
- **Strict Money Math:** Stored in integer minor units (paise). Largest-remainder proportional discount allocation prevents 1-paisa drift.
- **Live Password Policy Checklist:** Real-time feedback ticking 4 criteria in green (>8 chars, uppercase, lowercase, special char).

---

## Running the Invariant Test Suite

To run the property and invariant test suite:

```bash
npm test
```

Tests cover:
1. Exact paisa reconciliation & rounding (`tests/invariants.test.ts`)
2. Month-end anchoring without drift (Jan 31 -> Feb 28 -> Mar 31)
3. Leap-year handling (Feb 29 anchor)
4. Discount eligibility, usage limits, and expiration
5. Password policy boundary conditions (Length 8 fails, length 9 passes)
