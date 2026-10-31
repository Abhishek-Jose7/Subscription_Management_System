# PRD: Brightloop Subscription Management System ("Loopbook")

> **Audience:** an AI coding agent (and the human steering it) building this in a hackathon.
> **Read this first:** Sections 0 and 1 tell the agent how to behave. Sections 2-14 are the spec. Section 15 is the build order. Section 16 is the demo script. Everything marked **[P0]** is required by the problem statement, **[P1]** is a strong differentiator, **[P2]** is stretch.

---

## 0. Agent operating instructions

1. **Do not ask clarifying questions.** Every ambiguity in the problem statement is resolved in Section 2 ("Decisions already made"). Follow them.
2. **Build in vertical slices**, not layers. Each milestone in Section 15 must end with something demoable end to end (DB -> API -> UI), plus tests for its invariants.
3. **Money is never a float.** Store integer minor units (paise). All arithmetic in integers or a decimal library. Rounding rules are in Section 7.4.
4. **Authorization is enforced server-side, always.** Hiding a button is not security. Every query for a customer is scoped by ownership in the data layer.
5. **Write the invariant tests (Section 12) before the billing engine.** The billing engine is the heart of the system and the thing judges will probe.
6. **Seed data is part of the product.** Section 14 defines a seed script that makes the demo instantly impressive and makes perf testing honest.
7. Keep a `DECISIONS.md` and a `README.md` (setup in <=5 commands, demo credentials, how to run tests, how to run the billing job).
8. Prefer boring, proven tech. No microservices. One deployable app + Postgres + a background job runner.

---

## 1. Product thesis

**Problem in one line:** Brightloop earns money every month but runs on a spreadsheet, memory and manual typing, so renewals are missed, invoices are wrong, and nobody knows true recurring revenue.

**Thesis:** A subscription business is a *time machine for obligations*. The system's job is to know, at any moment, **what we owe the customer, what the customer owes us, and when each becomes true**, and to make the transition between them automatic, idempotent and explainable.

**Design principles (these separate this build from a generic CRUD app):**

| Principle | What it means in practice |
|---|---|
| **Idempotent by construction** | Billing the same period twice is *impossible* at the database level (unique constraint), not just unlikely in code. |
| **Explainable money** | Every invoice line can answer "why this amount?" with a price waterfall (base -> variant extra -> discount -> tax). |
| **Derived, not stored, where possible** | "Overdue" and "Partially paid" are computed from facts (due date, balance), never manually set, so they cannot go stale. |
| **Append-only history** | State changes, payments and discount redemptions leave an immutable trail. Nothing is silently edited. |
| **Time is a dependency** | A virtual clock makes renewals, expiries, dunning and billing runs testable and demoable in seconds. |
| **Fail loud, resume safe** | A billing run reports every skip and failure with a reason and can be re-run safely. |

**Non-goals:** real payment gateway integration (we simulate one), multi-currency, multi-tenant SaaS, tax filing/e-invoicing, revenue recognition accounting (ASC 606), mobile apps.

---

## 2. Decisions already made (ambiguity resolved)

| # | Ambiguity in the problem statement | Decision |
|---|---|---|
| D1 | "Password must be **more than eight** characters" | Minimum **9** characters (>8), >=1 uppercase, >=1 lowercase, >=1 special char. Same validator shared by client and server. Digits allowed, not required. |
| D2 | "Each email can belong to only one account" | Emails normalized (trim, lowercase) and enforced unique with a DB unique index on the normalized value. |
| D3 | Customer vs user account | `User` = login identity. `Customer` = billing entity (company, address, tax ID). A customer-role user is linked to exactly one Customer. Staff/admin users have no Customer. |
| D4 | Public signup role | Public signup **always** creates a `customer` role. There is no way to self-assign staff/admin. Only an admin can create staff (invite flow, Section 4). |
| D5 | Subscription states: Draft -> Quotation -> Confirmed -> Active -> Closed | These five are the **only** lifecycle states. "Paused" is an orthogonal flag (`paused_from`, `paused_until`), not a sixth state, so reporting on the five states stays clean. |
| D6 | When does Confirmed become Active? | Automatically when `start_date <= today` (daily job + on confirm if start is today/past). Optional setting: "activate only after first invoice is paid" **[P2]**. |
| D7 | Invoice states: Draft -> Confirmed -> Paid (+ cancel) | Stored states: `draft`, `confirmed`, `paid`, `cancelled`. **Overdue** and **partially paid** are *derived* labels, never stored. |
| D8 | Billing timing | **In advance**: an invoice covers the period starting on its billing date. |
| D9 | Billing "day" for monthly/yearly | Anchored to the original start day (`billing_anchor_day`). Jan 31 + 1 month = Feb 28/29, then back to Mar 31 (no drift). |
| D10 | Discount "limit on how many times it can be used" | One **redemption** = one application of the discount on one invoice. `used_count` is incremented atomically when that invoice is confirmed and decremented if it is cancelled. |
| D11 | Discount scope | A discount targets either **specific products** (applies to matching lines) or **the whole subscription** (applies to the pre-tax subtotal). Applied *before* tax. |
| D12 | Discount stacking | Default: **non-stackable**, best-value wins (largest absolute saving). A discount may be flagged `stackable` **[P1]**. Discount can never push a line below 0. |
| D13 | Who applies discounts | Only admin **creates/edits** discount rules. Staff may **attach** an existing eligible discount to a subscription. Eligibility is re-validated at every invoice. |
| D14 | Plan lifecycle flags | Per plan: `auto_close_on_end` (bool), `allow_early_close` (bool), `allow_pause` (bool), `allow_renew` (bool). The admin sets them plan by plan; the UI and API both enforce them. |
| D15 | Price changes to a plan after subscriptions exist | Existing subscription lines **snapshot** price at creation (price lock). A plan price change affects only new subscriptions unless admin explicitly runs "reprice active subscriptions" **[P2]**. |
| D16 | Currency | Single currency: INR. Display with Indian digit grouping (e.g., 1,25,000.00). Currency code stored but fixed. |
| D17 | Tax model | Rules-based: tax has a rate, type (percent/fixed), scope, and an inclusive/exclusive flag. Optional GST split (CGST+SGST vs IGST) by place of supply **[P1]**. |
| D18 | Timezone | All timestamps UTC. All *business dates* (billing date, due date, expiry) are dates in `Asia/Kolkata`. The virtual clock operates on that business date. |
| D19 | Invoice numbering | Gapless sequence assigned at **confirmation** (not at draft), per prefix, e.g. `INV/2026/000123`. Subscription numbers `SUB/2026/000045` assigned on creation. |

---

## 3. Personas and permissions

| Persona | Can do | Cannot do |
|---|---|---|
| **Admin** | Everything: products, variants, plans, taxes, discounts, templates, staff management, all subscriptions/invoices/payments, reports, settings, virtual clock, billing run controls | n/a |
| **Staff (Internal)** | Create/manage customers, build quotations from templates, move subscriptions through states, generate/confirm/send/print/cancel invoices, record payments, view reports | Create/edit/delete products, plans, taxes, discount *rules*, staff users; change system settings |
| **Customer (Portal)** | View own subscriptions & invoices, download invoice PDF, pay (simulated), change quantity, toggle add-ons, pause/cancel/renew **if the plan allows**, update profile, reset password | See anyone else's data; see cost price; see internal notes |
| **System (job)** | Billing run, activation, expiry, auto-close, renewal alerts, overdue reminders | n/a (actor recorded as `system` in audit log) |

**Hard rules**
- Cost price is **never** returned by any customer-scoped endpoint (strip at serializer level, tested).
- Permission matrix is defined once in a single `permissions` module and used by API middleware *and* UI gating.
- Every mutation writes an `audit_log` row: actor, action, entity, before/after JSON, timestamp, request id.

---

## 4. Module A: Identity, access, onboarding **[P0]**

### Signup
- Fields: name, email, password, confirm password, company (optional at signup, required before first subscription).
- Validation: D1, D2. Show live password checklist (4 criteria ticking green). Server returns field-level errors.
- On success: create `User(role=customer)` + `Customer` shell, send welcome email, auto-login.

### Login / session
- Argon2id (or bcrypt cost >=12). httpOnly, SameSite=Lax, Secure cookies. Session rotation on login.
- Rate limit: 5 failed attempts / 15 min per (email + IP) -> temporary lock with generic message.
- Role-based redirect: admin/staff -> `/app`, customer -> `/portal`.

### Forgot / reset password
- `POST /auth/forgot` **always** responds with the same generic message (no account enumeration).
- Token: 32 random bytes, stored **hashed** (SHA-256), single use, 30 min TTL, invalidated when a newer one is issued.
- Reset link delivered by email to the **registered** address only. On reset: new password re-validated, all other sessions revoked, notification email "your password was changed".
- Dev: use Mailpit (docker) so the judge can *see* the email in a browser.

### Signup email-enumeration nuance
The statement requires "one account per email", which inherently reveals existence on signup. Mitigate by rate-limiting signup per IP and returning a neutral message ("If this email can be registered, you'll receive a confirmation") **[P2]**. For hackathon default, return a clear "email already registered" error; note the tradeoff in `DECISIONS.md`.

### Staff management (admin only)
- Admin creates staff via **invite**: email + name -> one-time set-password link (same token mechanism, 72 h TTL). Staff cannot log in until they set a password.
- Admin can deactivate staff (soft delete; keeps audit trail integrity) and reset their access.
- Seed exactly one admin from env vars on first boot. No UI path creates another admin **[P0]** (admin promotion is out of scope; state this).

---

## 5. Module B: Catalog: products, variants, plans **[P0]**

### Product
Fields: `name`, `type` (enum: `software`, `addon`, `service`, `physical` or configurable list), `sales_price`, `cost_price`, `notes`, `is_active`, `tax_ids[]`.
- Computed: `margin = sales_price - cost_price` and margin % (admin/staff only).
- Soft delete only (products referenced by subscriptions can be archived, never hard-deleted).

### Variants
- Model as **attribute -> values**: Attribute `Brand` -> values `Odoo (+560)`, `Zoho (+0)`, ...
- Each value has `extra_price` (can be negative). A product may have multiple attributes; a *variant* is a combination.
- Effective unit price = `sales_price + sum(extra_price of selected values)`.
- Example to bake into seed + tests: base 1,000 + Brand=Odoo (+560) = **1,560**.
- Variant selection is captured on the subscription line and **snapshotted** (D15).
- **[P1]** Variant-level cost price override and an "unavailable combination" rule.

### Plan
Fields: `name`, `price`, `billing_period` (`daily|weekly|monthly|yearly`), `min_quantity`, `available_from`, `available_to`, plus D14 flags (`auto_close_on_end`, `allow_early_close`, `allow_pause`, `allow_renew`), `is_active`.
- A plan can include **default product lines** (used by quotation templates).
- `available_from/to`: plan cannot be selected for new subscriptions outside its window; existing subscriptions are unaffected (and closed on end only if `auto_close_on_end`).
- Enforce `min_quantity` on every line/qty change: server returns a typed error `QUANTITY_BELOW_PLAN_MINIMUM`.

### Add-ons
Add-ons are ordinary products of type `addon` attached as subscription lines. Customers can toggle them from the portal (adds/removes a line effective **next invoice** by default, or prorated immediately **[P1]**).

---

## 6. Module C: Quotations -> subscriptions **[P0]**

### Quotation template
- Name, validity in days, linked plan, product lines (product, variant, default qty).
- Using a template pre-fills a new subscription (copying lines with *current* prices) and sets `quotation_expires_at = today + validity_days`.
- Expired quotations auto-transition to a flagged "expired" badge (still `quotation` state; staff must re-issue). Do not auto-delete.

### Subscription record
Fields: `number`, `customer_id`, `plan_id`, `start_date`, `expiry_date`, `payment_term_id`, `status`, `billing_anchor_day`, `next_invoice_date`, `paused_from`, `paused_until`, `close_reason`, `template_id`, `quotation_expires_at`, `notes`.

Lines: `product_id`, `variant_selection`, `quantity`, `unit_price` (snapshot), `tax_ids` (snapshot), `discount_id?`, computed `amount`.

**Payment terms** (table): `Immediate`, `Net 15`, `Net 30`, custom days. Invoice `due_date = invoice_date + term_days`.

### State machine (guarded transitions)

```
Draft --send--> Quotation --confirm--> Confirmed --(start_date reached)--> Active --close--> Closed
  \_____________________cancel/discard (Draft only)____________________/
```

| From | To | Guard |
|---|---|---|
| Draft | Quotation | Has customer, plan, >=1 line, qty >= plan.min_quantity; sends quote email/PDF |
| Quotation | Confirmed | Quote not expired; customer complete (billing address); computes `next_invoice_date` |
| Confirmed | Active | `start_date <= today`; creates first invoice immediately if billing-in-advance |
| Active | Closed | Reason required; early close requires `plan.allow_early_close`; auto-close at expiry requires `plan.auto_close_on_end` |
| Active (flag) | Paused | Requires `plan.allow_pause`; sets `paused_from`; billing skips paused days; optional resume date |
| Closed | (renew) | `plan.allow_renew` -> creates a *new* linked subscription (`renewed_from_id`) rather than reopening, preserving history **[P0]** |

- Illegal transitions return `409 INVALID_TRANSITION` with allowed next states. UI renders a **horizontal stepper** showing the current state and a **timeline** of every transition (who, when, reason). "Anyone on the team should be able to see where it stands" is satisfied by the stepper + a status filter on the list view.

### Renewals (the "remembered by whoever notices first" fix) **[P0]**
- Renewal Radar: a list of subscriptions expiring in 7 / 30 / 60 days, grouped by owner, with one-click renew (where allowed).
- Auto-renew toggle per subscription (only if `plan.allow_renew`): at expiry, extend by one plan term and log a `renewed` event instead of closing.
- Notifications T-30, T-7, T-1 to customer + staff queue (outbox pattern, deduped).

### Pause semantics (niche, get this right)
- Pausing mid-cycle: the current paid period is honored; `next_invoice_date` shifts forward by the paused duration upon resume. No invoice is generated while paused. Pause does **not** change `expiry_date` unless "extend expiry by paused days" is enabled **[P1]** (default: it does extend, so customer is not penalized; document it).

### Quantity change mid-cycle (proration) **[P1, shows depth]**
- Increasing seats mid-period creates a prorated charge line on the next invoice: `unit_price * delta_qty * (days_remaining / days_in_period)`, rounded per 7.4. Decreasing creates a credit line (never negative total; excess carries as customer credit).

---

## 7. Module D: Billing engine **[P0] (core)**

### 7.1 Principles
1. **No manual typing.** Invoices are generated from subscriptions.
2. **Nothing billed twice.** DB-level guarantee (7.3).
3. **Nothing skipped.** A coverage check (7.6) proves every active, unpaused subscription has an invoice for every elapsed period.
4. **Resumable & observable.** Each run is logged.

### 7.2 Billing run algorithm

```
run(today = business_date()):
  open BillingRun row (id, started_at, dry_run flag, triggered_by)
  loop in batches of 200:
    SELECT id FROM subscriptions
      WHERE status='active' AND next_invoice_date <= today
        AND (paused_until IS NULL OR next_invoice_date > paused_until)
      ORDER BY next_invoice_date, id
      FOR UPDATE SKIP LOCKED  -- safe for concurrent workers
    for each subscription (own transaction):
      period = [next_invoice_date, next_invoice_date + 1 plan period) using anchor_day (D9)
      if period_start > expiry_date: skip(reason=PAST_EXPIRY)
      build lines (qty, snapshot price, proration adjustments)
      resolve discounts (7.5)
      compute taxes (7.4)
      INSERT invoice (status per setting: draft or auto-confirm) with billing_period_start/end
          -> unique(subscription_id, period_start, period_end) WHERE status <> 'cancelled'
      on unique violation: record skip(reason=ALREADY_BILLED), do not fail run
      advance next_invoice_date (same transaction)
      write invoice_events + audit
  close BillingRun with counts {created, skipped by reason, failed with error}
```

- **Catch-up:** if the system was down for 3 periods, it generates 3 invoices (one per period, each correctly dated), bounded by a configurable cap (default 12) to avoid accidents. Beyond the cap -> flagged for human review.
- **Dry run / preview [P1]:** same algorithm with `dry_run=true`, rolls back, and shows a table: customer, period, subtotal, discount, tax, total, plus "will be skipped because...". Admin hits "Run for real" only after viewing. This is demo gold.
- **Manual single invoice:** staff can "Generate invoice now" for one subscription; it uses the same code path and the same uniqueness guard.
- Trigger options: cron job (daily 02:00 IST), "Run billing now" admin button, and the virtual clock "Advance day" button.

### 7.3 Idempotency guarantee
- Partial unique index: `CREATE UNIQUE INDEX uq_invoice_period ON invoices (subscription_id, period_start, period_end) WHERE status <> 'cancelled' AND invoice_type = 'recurring';`
- Cancelling an invoice frees the period so it can be deliberately re-billed ("Regenerate"), which is an explicit, audited staff action.
- Test: fire 20 concurrent billing runs; assert exactly one invoice per due period.

### 7.4 Tax and rounding rules
- Tax master (admin only): `name`, `rate`, `type` (`percent|fixed`), `price_included` (bool), `scope` (all | product category), **[P1]** `gst_component` (`cgst|sgst|igst`).
- Product has default taxes; subscription line **snapshots** them.
- **Algorithm per line:**
  1. `line_gross = unit_price * quantity`
  2. apply line-level discount -> `line_net`
  3. tax-exclusive: `tax = round_half_up(line_net * rate)`; tax-inclusive: `tax = line_net - round_half_up(line_net / (1 + rate))`
  4. Round **per line**, then sum. Invoice totals = sum of rounded lines. (Documented so totals always reconcile to the paisa.)
- Subscription-level discount is allocated across lines **proportionally** (largest-remainder method so allocated parts sum exactly to the discount). This is a niche correctness detail that stops 1-paisa drift.
- **[P1]** Place of supply: customer state == company state -> CGST+SGST split; else IGST. Displayed on the PDF.

### 7.5 Discount engine **[P0]**

Discount rule fields (admin only): `name`, `type` (`fixed|percent`), `value`, `min_purchase_amount`, `min_quantity`, `start_date`, `end_date`, `usage_limit`, `used_count`, `scope` (`products` with `product_ids[]` | `subscription`), `stackable` **[P1]**, `is_active`.

**Eligibility (evaluated at invoice generation, never cached on the subscription):**
`active AND start <= today <= end AND used_count < usage_limit AND qty >= min_quantity AND scoped_amount >= min_purchase_amount`

- **Auto-appears on the next invoice** with zero human action once attached (satisfies "without anyone having to remember").
- **Stops itself** when expired or exhausted; the invoice line simply doesn't appear. UI shows a "discount ended" event on the subscription timeline.
- **Redemption ledger** (`discount_redemptions`): discount_id, invoice_id, amount, created_at. `used_count` increments inside the invoice-confirm transaction using `UPDATE ... SET used_count = used_count + 1 WHERE id=$1 AND used_count < usage_limit` (returns 0 rows => limit hit => skip discount, never oversell). Cancelling the invoice writes a reversal row and decrements.
- **Percent** discounts apply to the scoped pre-tax amount; **fixed** are capped at the scoped amount.
- **Explainer:** each invoice line expandable -> `Base 1,000 + Brand:Odoo 560 = 1,560 x 5 seats = 7,800 - 10% seat discount (780) = 7,020 + GST 18% (1,263.60) = 8,283.60`.
- **[P2]** Discount request workflow: staff files "customer asking for 15% for 25 seats" -> admin approves/rejects -> on approval the discount is attached. This models the real "customer asks for a better price" scene instead of pretending staff can just type a number.

### 7.6 Coverage & integrity checks **[P1 but cheap, high impact]**
A "Ledger Health" admin page runs live SQL checks and shows green/red:
1. Every active unpaused subscription has an invoice for every elapsed period (no gaps).
2. No duplicate invoice per (subscription, period).
3. `invoice.total == sum(lines) + tax` for all invoices.
4. `invoice.amount_paid == sum(active payments)`.
5. Every `paid` invoice has balance = 0; no `confirmed` invoice has balance <= 0.
6. `discount.used_count == count(non-reversed redemptions)` and <= limit.
7. Invoice numbers are gapless per sequence.

---

## 8. Module E: Invoices & payments **[P0]**

### Invoice
Fields: `number`, `subscription_id`, `customer_id`, `invoice_date`, `due_date`, `billing_period_start/end`, `status`, lines (product, description, qty, unit_price, discount, tax, amount), `subtotal`, `discount_total`, `tax_total`, `total`, `amount_paid`, `balance` (computed), `currency`, `sent_at`, `pdf_hash`.

**Actions (staff/admin):** confirm, cancel, send (email with PDF), print (PDF/print-CSS), download PDF.
**State machine:** `draft -> confirmed -> paid`; `draft|confirmed(no payments) -> cancelled`. Confirmed with payments cannot be cancelled (must void payments first, audited).
- Editing: only drafts are editable. Confirmed invoices are **immutable** (number and totals frozen); corrections go via cancel + regenerate, or credit note **[P2]**.
- Invoice PDF: Brightloop branding, line items, tax breakup, due date, payment instructions, and a **QR/UPI deeplink** placeholder **[P2]**.

### Derived labels (never stored; computed in SQL and UI)
| Label | Rule |
|---|---|
| Outstanding | status = confirmed AND balance > 0 |
| Partially paid | confirmed AND 0 < amount_paid < total |
| Overdue | confirmed AND balance > 0 AND due_date < today |
| Aging bucket | 1-7, 8-30, 31-60, 60+ days past due |

### Payments
Fields: `invoice_id`, `method` (`cash|bank_transfer|upi|card|cheque|other`), `amount`, `payment_date`, `reference` (txn id/cheque no.), `note`, `recorded_by`, `status` (`recorded|voided`), `idempotency_key`.
- Rules: amount > 0; cannot exceed balance (or **[P1]** excess auto-saved as customer credit); can't pay draft/cancelled invoices; payment date can't be in the future (relative to virtual clock).
- Invoice flips to `paid` automatically when balance hits 0; flips back to `confirmed` if a payment is voided.
- Partial payments supported and visible ("4,000 of 9,440 paid").
- **Void instead of delete:** voiding writes a reversal and keeps history.
- **Portal "Pay now" (simulated gateway)**: `idempotency_key` prevents double-click double-pay; fake gateway page with success/fail buttons. Webhook-style callback endpoint demonstrates idempotent handling **[P1]**.

### Overdue & dunning-lite **[P1]**
- Daily job queues reminder emails at overdue +1, +7, +15 days (configurable), deduped per invoice/step.
- "Revenue at risk" panel: total overdue by customer and bucket, with a one-click "send reminder" and "log call note".
- **[P2]** Grace period then auto-pause of subscription (`close_reason = non_payment` after N days), admin-configurable and off by default.

---

## 9. Module F: Customer portal **[P0]**

- **Dashboard:** active subscriptions, next billing date and amount, outstanding balance with a Pay button.
- **Subscriptions:** list/detail with stepper, lines, next invoice preview ("Your next invoice: 5 Dec, INR 8,283.60"), history.
- **Self-service (only if plan flags allow):** change quantity (respecting min qty), toggle add-ons, pause/resume, cancel at period end (soft: sets `close_at_period_end`, closes on expiry/next billing), renew.
- **Invoices:** list with derived badges (Paid / Due in 4 days / Overdue 12 days), PDF download, pay.
- **Payment history.**
- **Profile:** company, billing address, tax ID, change password.
- Strict isolation: IDOR test suite (customer A requests customer B's invoice id -> `404`, not `403`, to avoid leaking existence).

---

## 10. Module G: Reporting & finance cockpit **[P0]**

### Definitions (put these on the page as tooltips; judges notice precision)
- **Active subscriptions:** status = active (paused shown separately).
- **MRR:** sum of monthly-normalized recurring amounts of active, unpaused subscriptions, post-discount, pre-tax. Normalization: yearly / 12, weekly x 52 / 12, daily x 365 / 12.
- **ARR:** MRR x 12.
- **Revenue invoiced** (period): sum of confirmed+paid invoice subtotals post-discount, pre-tax, by invoice date.
- **Cash collected** (period): sum of non-voided payments by payment date.
- **Outstanding AR:** sum of balances on confirmed invoices.
- **Overdue AR:** subset past due, bucketed by aging.

### Views
1. **Summary cards:** Active subs, MRR, ARR, Invoiced (period), Collected (period), Outstanding, Overdue (count + amount), New vs closed this period.
2. **MRR movement waterfall [P1]:** Start MRR + New + Expansion (seat/add-on increase) - Contraction - Churn = End MRR. Computed from an append-only `mrr_events` table written on subscription state/quantity changes, not by diffing snapshots.
3. **Tables with filters:** Active subscriptions; Invoices; Payments; Overdue invoices. Filters: date range, customer, plan, product, status, payment method, aging bucket. Server-side pagination + sort + CSV export.
4. **Plan mix & top customers** (small charts).
5. **Renewal Radar** and **Revenue at risk** panels (shared with ops views).
6. **As-of date** selector (uses virtual clock/historical `mrr_events`) **[P2]**.

### Performance requirement (<2 s on every page with thousands of subscriptions) **[P0]**
- Indexes: `subscriptions(status, next_invoice_date)`, `subscriptions(customer_id)`, `invoices(status, due_date)`, `invoices(customer_id, invoice_date DESC)`, `invoices(subscription_id)`, `payments(invoice_id)`, `payments(payment_date)`, `audit_log(entity, entity_id, created_at DESC)`.
- **Keyset pagination** (cursor on `(created_at, id)`) for large lists, not `OFFSET`.
- Dashboard cards read from a `daily_metrics` rollup (updated incrementally by the billing job and payment events, rebuildable by a command) with a live fallback query for today.
- No N+1: list endpoints use joins/batched loads; assert query count in tests.
- Budget: p95 < 800 ms API, < 2 s full page load on seed dataset (Section 14). Include a `perf/` k6 or autocannon script and record results in README. Show a "page generated in 143 ms" footer in dev/demo mode **[P2]**.

---

## 11. Cross-cutting features

### Notifications (outbox pattern)
Table `notification_outbox` (type, to, payload, dedupe_key, status, attempts). A worker sends via SMTP (Mailpit in dev). Types: welcome, password reset, staff invite, quotation sent, invoice sent, payment received, renewal T-30/7/1, overdue reminders, plan-ending notice. Dedupe key prevents duplicates on job re-run. Failed sends retry with backoff.

### Audit log
Every mutation: who, what, before/after, when. Viewable per entity as a **timeline tab** (subscription, invoice, discount). Admin-wide filterable audit page.

### Virtual clock **[P1, highest demo ROI]**
- `system_clock` table holds an optional offset/pinned date. All code calls `businessDate()`, never `new Date()`/`now()` directly (lint rule + grep in CI).
- Admin "Time travel" widget: advance +1 day / +1 month / set date, then auto-trigger the daily jobs. Judges can watch renewals fire, discounts expire, invoices go overdue and the dashboard change, in seconds.
- Banner shows "Simulated date: 14 Mar 2027" when active; disabled via env in production.

### Search & navigation
Global search (Cmd/Ctrl-K): by subscription number, invoice number, customer name/email. Recent items. Saved filters **[P2]**.

### Settings (admin)
Company details (name, address, tax ID, state), invoice prefix/format, auto-confirm generated invoices (default off), billing run time, catch-up cap, reminder schedule, payment terms list, allowed payment methods.

---

## 12. Invariants & test plan (write these first)

**Property/invariant tests (must pass in CI)**
1. `sum(line.amount) - discounts + taxes == invoice.total` to the paisa for randomized baskets (include tax-inclusive, % and fixed discounts, 1-paisa rounding edge cases).
2. Concurrent billing runs (20 workers) -> exactly one invoice per (subscription, period).
3. Running billing twice the same day creates zero new invoices on the second run.
4. Month-end anchoring: start on Jan 31 monthly -> Feb 28, Mar 31, Apr 30, May 31 (and leap-year Feb 29).
5. Yearly anchored on Feb 29 -> Feb 28 on non-leap years, back to Feb 29 on leap years.
6. Discount `used_count` never exceeds `usage_limit` under 50 concurrent confirmations; cancelling an invoice releases exactly one use.
7. Expired/exhausted discounts never appear on new invoices; mid-cycle expiry handled by invoice date, not period start.
8. Payment total never exceeds invoice total; voiding re-opens the invoice; double-submit with same idempotency key creates one payment.
9. RBAC matrix: table-driven test over every route x role -> expected status. Staff cannot create discount/tax/plan/product/staff; customer cannot read others' data (IDOR) nor see `cost_price`.
10. State machine: every illegal transition rejected; every guard enforced (min qty, expired quote, plan flags).
11. Password policy: boundary tests at length 8 (fail) and 9 (pass); missing each class fails individually.
12. Reset token: single-use, expires at 30 min, old tokens invalid after a new request, no enumeration difference in response/timing (+/- tolerance).
13. Coverage check (7.6) returns zero violations after seeded multi-month simulation via the virtual clock.

**Manual QA checklist** lives in `QA.md`, mapped to the traceability table in Section 13.

---

## 13. Traceability: problem statement scenes -> features -> acceptance criteria

| Scene | Feature(s) | Acceptance criteria (Given/When/Then) |
|---|---|---|
| New customer signs up | Signup, unique email, password policy, reset, RBAC, staff-by-admin-only | Given an existing email, when signing up, then error and no account created. Given "Abcdefg1!" (9), passes; "Abcde1!" fails. Given forgot-password for a registered email, then a single-use link arrives in Mailpit and works once. Given a staff user, when POST /staff, then 403. |
| Launching a new plan | Product + variants + plan + flags | Given Brand=Odoo (+560) on base 1,000, then selecting it shows 1,560. Given plan A auto_close_on_end=true and plan B false, when both end, then only A closes. Given qty < min_quantity, then rejected with typed error. |
| Quote -> subscription | Templates, numbering, state machine | Given a template valid 15 days, when a subscription is created from it, then lines are pre-filled and quote expires in 15 days. Given Draft, when jumping to Active, then 409 with allowed next states. Stepper shows current state. |
| Billing day | Billing engine, taxes, invoice lifecycle | Given 500 due subscriptions, when billing runs, then 500 invoices exist with customer, lines, taxes, totals filled, and a run report. Run again -> 0 created, 500 skipped ALREADY_BILLED. Invoice moves draft -> confirmed -> paid; staff can confirm/cancel/send/print. |
| Customer asks for a better price | Discount rules, attach, auto-apply, limits | Given a "10% for >=10 seats, limit 3, ends 31 Dec", then it appears on the next invoice without manual action, stops after 3 uses or 31 Dec, and a staff attempt to create the rule returns 403. |
| Money comes in | Payments, partials, derived status | Given 2 payments (UPI then cash) on one invoice, then both listed with method/amount/date/note; invoice shows partially paid then Paid. Overdue list shows confirmed invoices past due with balance. |
| Finance lead | Cockpit, filters, MRR, perf | Given 10k subs / 60k invoices, then every page loads < 2 s and answers: active count, revenue, collected, outstanding, overdue list. |

---

## 14. Data model (relational; Postgres)

Types: `id` = UUID (or bigserial) | money = `BIGINT` minor units | dates = `DATE` (business date) | timestamps = `TIMESTAMPTZ`.

**Identity**
- `users`(id, email_norm UNIQUE, password_hash, role ENUM[admin,staff,customer], name, is_active, failed_attempts, locked_until, created_at)
- `password_tokens`(id, user_id, token_hash, purpose ENUM[reset,invite], expires_at, used_at)
- `customers`(id, user_id UNIQUE NULL, name, company, billing_address, state, tax_id, phone, created_at)

**Catalog**
- `products`(id, name, type, sales_price, cost_price, notes, is_active)
- `product_taxes`(product_id, tax_id)
- `attributes`(id, name) / `attribute_values`(id, attribute_id, label, extra_price)
- `product_attributes`(product_id, attribute_id)
- `taxes`(id, name, rate_bp, type, price_included, scope, gst_component NULL, is_active) (*rate in basis points to avoid floats*)
- `plans`(id, name, price, billing_period, min_quantity, available_from, available_to, auto_close_on_end, allow_early_close, allow_pause, allow_renew, is_active)
- `plan_default_lines`(plan_id, product_id, variant_json, qty)
- `payment_terms`(id, name, days)
- `quotation_templates`(id, name, validity_days, plan_id)
- `quotation_template_lines`(template_id, product_id, variant_json, qty)

**Subscriptions**
- `subscriptions`(id, number UNIQUE, customer_id, plan_id, status, start_date, expiry_date, payment_term_id, billing_anchor_day, next_invoice_date, auto_renew, paused_from, paused_until, close_at_period_end, close_reason, renewed_from_id, template_id, quotation_expires_at, notes, created_by)
- `subscription_lines`(id, subscription_id, product_id, variant_json, quantity, unit_price, tax_snapshot_json, discount_id NULL)
- `subscription_events`(id, subscription_id, type, from_status, to_status, actor, reason, payload_json, at)
- `mrr_events`(id, subscription_id, type ENUM[new,expansion,contraction,churn,reactivation], delta_mrr, at)

**Discounts**
- `discounts`(id, name, type, value, min_purchase_amount, min_quantity, start_date, end_date, usage_limit, used_count, scope, stackable, is_active)
- `discount_products`(discount_id, product_id)
- `discount_redemptions`(id, discount_id, invoice_id, amount, reversed_at NULL)

**Billing & money**
- `billing_runs`(id, started_at, finished_at, business_date, dry_run, triggered_by, created_count, skipped_json, failed_json)
- `invoices`(id, number UNIQUE NULL until confirmed, subscription_id, customer_id, invoice_type ENUM[recurring,adjustment], status, invoice_date, due_date, period_start, period_end, subtotal, discount_total, tax_total, total, amount_paid, currency, sent_at, created_by, billing_run_id) + partial unique index (7.3)
- `invoice_lines`(id, invoice_id, product_id, description, quantity, unit_price, discount_amount, tax_amount, amount, explain_json)
- `payments`(id, invoice_id, method, amount, payment_date, reference, note, status, idempotency_key UNIQUE, recorded_by, voided_at, void_reason)
- `customer_credits`(id, customer_id, amount, source_payment_id, applied_invoice_id NULL) **[P1]**
- `number_sequences`(prefix, year, last_value) (locked row increments => gapless)

**Platform**
- `audit_log`, `notification_outbox`, `system_clock`, `daily_metrics`(date, active_subs, mrr, invoiced, collected, outstanding, overdue_amount, overdue_count), `settings`

**Seed dataset (script `npm run seed` / `make seed`)**
- 1 admin, 3 staff, ~2,000 customers (realistic Indian business names), 8 products with variants (include Brand/Odoo +560), 6 plans across all four periods (with different flag combos), 5 taxes (GST 5/12/18, one inclusive, one fixed), 4 discounts (one nearly exhausted, one expiring in 3 days, one product-scoped, one subscription-scoped), 5 quotation templates, **~10,000 subscriptions across all 5 states**, ~60,000 invoices with a mix of paid/partial/overdue/cancelled, payments with varied methods.
- Flag a handful of **"story" records** by name (e.g., "Hotel Anand Bhavan - 25 seats - discount about to expire") that the demo script uses.

---

## 15. Architecture, stack and build order

### Recommended stack (swap freely; keep the shape)
- **Backend + frontend:** Next.js (App Router, TypeScript) or Django/FastAPI + React. Server-side validation with a shared schema library (zod/pydantic).
- **DB:** PostgreSQL 15+ (needed for `SKIP LOCKED`, partial unique indexes, advisory locks).
- **ORM:** Prisma/Drizzle (or Django ORM) *plus raw SQL for the billing run and reports*.
- **Jobs:** `pg-boss` / Celery / APScheduler (no Redis required).
- **Email:** SMTP -> Mailpit (docker). **PDF:** headless Chromium from HTML template or react-pdf/WeasyPrint.
- **UI:** Tailwind + shadcn/ui or equivalent. **Tests:** Vitest/Pytest + Playwright smoke.
- **Infra:** `docker-compose up` brings DB + Mailpit + app. One-command seed.

### Suggested module layout
`auth/ | catalog/ | subscriptions/ | billing/ (engine, tax, discount, proration, calendar) | payments/ | reports/ | notifications/ | audit/ | clock/ | permissions/`
Keep `billing/calendar` (anchor-day math), `billing/tax`, `billing/discount` as **pure functions with unit tests**, no DB access, so correctness is cheap to prove.

### Build order (each = demoable slice)
| # | Milestone | Done when |
|---|---|---|
| M0 | Repo, docker-compose, migrations, config, clock, audit skeleton, permissions module | `docker-compose up` works; CI runs tests |
| M1 | Auth: signup, login, reset (Mailpit), RBAC, staff invite | Section 13 row 1 passes |
| M2 | Catalog: products, variants, taxes, plans (+ flags), payment terms | Odoo +560 example works; flags enforced |
| M3 | Customers + quotation templates + subscriptions + state machine + timeline | Row 3 passes; illegal transitions rejected |
| M4 | **Billing engine** (pure calendar/tax functions first, then run, idempotency, dry-run) + invoice lifecycle + PDF/send | Row 4 passes; invariants 1-5 green |
| M5 | Discount engine + redemption ledger + explainer | Row 5 passes; invariants 6-7 green |
| M6 | Payments, partials, derived overdue, portal pay (simulated), voids | Row 6 passes; invariant 8 green |
| M7 | Reporting cockpit + rollups + indexes + seed + perf run | Row 7 passes; <2 s measured |
| M8 | Customer portal self-service (qty, add-ons, pause, cancel-at-period-end, renew) | IDOR + plan-flag tests green |
| M9 | Differentiators: virtual clock, Renewal Radar, Ledger Health, MRR waterfall, dunning-lite, proration | Demo script runs end to end |
| M10 | Polish: empty states, error states, loading skeletons, README, DECISIONS.md, QA.md | Fresh clone -> demo in 5 commands |

**Cut rule if time runs out:** never cut M0-M7. Cut order: P2 first, then M9 extras in reverse (keep virtual clock + Ledger Health last, they are the cheapest and most impressive).

---

## 16. UX and design direction (avoid the "generic SaaS template" look)

- **Tone:** a finance tool built by people who respect money. Dense but calm. No purple-gradient hero, no stock illustrations, no emoji icons.
- **Typography:** tabular numerals for all money; right-align amounts; Indian digit grouping; monospace for numbers like `INV/2026/000123`.
- **Status chips:** one consistent color grammar across the app: Draft (grey), Quotation (blue), Confirmed (indigo), Active (green), Closed (slate), Paused (amber outline), Overdue (red), Partially paid (amber fill). Color is never the only signal (include icon/text).
- **Every money figure is explainable:** hover/click to see the waterfall.
- **List views:** sticky filters, saved states in URL (shareable), keyboard navigation, bulk actions (confirm/send many invoices).
- **Empty/error/loading states** designed deliberately. Destructive actions (cancel, void, close) require a reason field.
- **Responsive:** portal is mobile-first; staff app is desktop-first but not broken on tablet.
- **Accessibility:** keyboard operable, labels, contrast AA, focus rings.

---

## 17. Edge-case catalogue (agent must handle or explicitly document)

| Area | Edge case | Behavior |
|---|---|---|
| Calendar | Anchor day 29/30/31 in short months; leap years | Clamp to last day, return to anchor next month (D9) |
| Calendar | Daily/weekly plans crossing DST (n/a in IST) | Business dates only; no clock-time math |
| Billing | Subscription expires mid-period | Do not bill past `expiry_date`; no invoice if period_start > expiry |
| Billing | Subscription confirmed late (start in the past) | Bill current period only; flag backdated start; no retro invoices unless admin opts in |
| Billing | Plan window ended but subscription still active | Continue billing (window governs *sales*, not existing subs) |
| Billing | Zero-total invoice (100% discount) | Auto-mark paid, still numbered, still counts as billed |
| Billing | Customer has no billing address / inactive | Skip with reason `CUSTOMER_INCOMPLETE`; surfaced in run report |
| Discount | Eligible at period start, expired by invoice date | Evaluated at invoice date (D11/7.5) |
| Discount | Limit reached by a concurrent invoice | Atomic UPDATE; loser invoice generates without discount, tagged |
| Discount | Percent + fixed both eligible, non-stackable | Largest absolute saving wins; tie -> earliest created |
| Discount | Discount > line amount | Cap at line amount; never negative |
| Tax | Tax-inclusive price with discount | Discount applies to gross, tax extracted from net (7.4) |
| Payment | Overpayment | Reject with message or park as customer credit **[P1]** |
| Payment | Payment recorded against cancelled invoice | Blocked |
| Payment | Void after invoice marked paid | Invoice returns to confirmed; overdue label recomputes |
| Subscription | Pause on plan without allow_pause | 403 `PLAN_DOES_NOT_ALLOW_PAUSE` |
| Subscription | Early close on plan without allow_early_close | Rejected; customer can still "cancel at period end" only if plan permits renew/close semantics, otherwise contact support message |
| Subscription | Quantity change while paused | Allowed, takes effect on resume |
| Auth | Reset requested for unknown email | Same response and timing as known email |
| Auth | Reset token reused / expired | Friendly error with "request new link" |
| Security | Customer guesses invoice id | 404 |
| Concurrency | Two staff confirm the same invoice | Row lock; second gets 409 with current state |
| Data | Product archived while on active subscriptions | Existing lines keep working; cannot be added to new ones |
| Reporting | Subscription changes plan mid-month | MRR event pair (contraction/expansion or churn/new) recorded once |

---

## 18. Risks and how the design neutralizes them

| Risk | Mitigation |
|---|---|
| Double billing | DB partial unique index + SKIP LOCKED + idempotency test |
| Rounding drift | Integer minor units, per-line rounding, largest-remainder allocation, invariant #1 |
| Slow dashboards | Rollup table + indexes + keyset pagination + seeded perf test |
| Permission leaks | Central permission matrix + row-scoped queries + table-driven RBAC/IDOR tests |
| Unexplainable numbers | `explain_json` per line + Ledger Health checks |
| Demo fragility | Virtual clock + deterministic seed + story records + Mailpit |
| Scope creep | Hard P0/P1/P2 tiers and cut rule (Section 15) |

---

## 19. Demo script (6 minutes, mirrors the problem statement)

1. **Sign up** as "Sunita, Anand Bhavan Hotels" (live password checklist; try a weak one). Show welcome + reset email in Mailpit. Log in as admin; add a staff member via invite.
2. **Launch a plan:** admin creates product with Brand variants (Odoo +560 -> 1,560), a yearly plan with `allow_pause=false`, and a monthly plan with `auto_close_on_end=true`.
3. **Quote -> subscription:** staff starts from a template, sees the stepper Draft -> Quotation -> Confirmed -> Active. Try an illegal jump (rejected with allowed states).
4. **Billing day:** open the billing **dry-run preview** for 500 due subs; run it for real; open one invoice and click **"Why this amount?"**. Re-run billing: 0 created, 500 skipped `ALREADY_BILLED`.
5. **Discount:** staff cannot create one (403); admin creates "10% for >=10 seats, 3 uses". Attach to Anand Bhavan; use **Time travel +1 month**: discount shows up on the next invoice automatically; advance until it exhausts or expires and watch it disappear.
6. **Payments:** record a partial UPI payment, then cash; invoice goes Partially paid -> Paid; void one to show it reopen. Advance time: another invoice turns Overdue and appears in **Revenue at risk**.
7. **Finance cockpit:** active subs, MRR waterfall, collected vs outstanding, overdue aging, filters; show page timings < 2 s on the 10k-subscription seed.
8. **Ledger Health:** all checks green; end on "Nothing billed twice, nothing skipped, and we can prove it."

---

## 20. Definition of done

- [ ] All **P0** items in Sections 4-10 implemented and mapped in the Section 13 table with passing tests.
- [ ] Invariant tests in Section 12 pass in CI.
- [ ] Seed script produces the Section 14 dataset in < 3 min; perf budget measured and documented.
- [ ] Fresh clone -> `docker-compose up` -> `make seed` -> login works; credentials in README.
- [ ] No floating-point money anywhere (grep check). No direct `Date.now()`/`now()` outside the clock module.
- [ ] `DECISIONS.md` lists every assumption in Section 2 and any new ones.
- [ ] Demo script (Section 19) runs end to end without manual DB edits.