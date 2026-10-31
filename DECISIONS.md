# Architectural Decisions Record (Loopbook)

This document tracks all decisions, tradeoffs, and resolutions made during the design and build of Loopbook, strictly aligned with the PRD Section 2.

## Section 2: Baseline Decisions

| # | Topic | Ambiguity Resolved | Implementation Detail |
|---|---|---|---|
| **D1** | Password Policy | "Password must be more than eight characters" | Minimum 9 characters (> 8), >= 1 uppercase, >= 1 lowercase, >= 1 special character. Shared validator between client and server (`src/lib/auth.ts`). |
| **D2** | Unique Email | "Each email can belong to only one account" | Normalized via `email.trim().toLowerCase()` with a DB unique constraint (`email_norm`) on the `users` table. |
| **D3** | User vs Customer | Customer vs user account structure | `User` = login identity and credentials. `Customer` = billing entity (company, billing address, tax ID). A customer user is linked to exactly one Customer. Staff/admin users have no Customer. |
| **D4** | Public Signup Role | Public registration role | Public signup always creates a `customer` role and Customer shell. There is no UI or API path for self-assigning staff or admin. Only admin can create staff via the invite flow. |
| **D5** | Subscription States | Draft -> Quotation -> Confirmed -> Active -> Closed | Exactly 5 stored lifecycle states. "Paused" is handled via orthogonal flags (`paused_from`, `paused_until`), keeping reporting clean. |
| **D6** | Confirmed to Active | Activation timing | Automatically transitions when `start_date <= today` (checked upon confirmation and during daily runs). |
| **D7** | Invoice States | Draft -> Confirmed -> Paid (+ cancel) | Stored states are `draft`, `confirmed`, `paid`, and `cancelled`. **Overdue** and **Partially paid** are purely derived labels computed dynamically from balance and due date. |
| **D8** | Billing Timing | Advance vs arrears | Billed in advance: an invoice covers the period starting on its billing date. |
| **D9** | Billing Anchor Day | Date arithmetic for monthly/yearly | Anchored to original start day (`billing_anchor_day`). E.g., Jan 31 + 1 month = Feb 28/29, then next month returns to Mar 31 without drift. |
| **D10** | Discount Usage Limit | Limit on usage count | One redemption = one application on one confirmed invoice. `used_count` increments atomically upon confirmation and decrements upon cancellation. |
| **D11** | Discount Scope | Product vs subscription scope | Scoped either to specific products or whole subscription. Evaluated before tax. |
| **D12** | Discount Stacking | Non-stackable default | Best value (largest absolute saving in paise) wins by default. Supports stackable flag. Never pushes lines below zero. |
| **D13** | Discount Permissions | Staff vs Admin roles | Only Admin creates discount rules (returns 403 for staff). Staff can read and attach existing eligible discounts. |
| **D14** | Plan Lifecycle Flags | Flag enforcement | Plans configure `auto_close_on_end`, `allow_early_close`, `allow_pause`, `allow_renew`. Enforced both by API guards and UI. |
| **D15** | Price Snapshotting | Plan changes vs existing subscriptions | Subscription lines snapshot unit prices and taxes at creation time. Plan price modifications only affect new subscriptions. |
| **D16** | Currency & Arithmetic | Single currency: INR | All amounts stored in integer minor units (paise: 1 INR = 100 paise). Formatted with Indian digit grouping (`1,25,000.00`). |
| **D17** | Tax Model | Rules-based taxes | Taxes stored with basis points (`rate_bp`: 1800 = 18%). Supports price-included and price-exclusive formulas and CGST/SGST/IGST breakdown. |
| **D18** | Timezone | Asia/Kolkata | All timestamps stored in UTC; all business dates (billing date, due date, expiry) operate in `Asia/Kolkata`. Virtual clock controls business dates. |
| **D19** | Numbering | Gapless sequences | Sequence numbers assigned atomically via `number_sequences` table. `INV/YYYY/000000` assigned at confirmation; `SUB/YYYY/000000` on subscription creation. |

## Additional Engineering Decisions

1. **Virtual Clock as a First-Class Citizen (`src/lib/clock.ts`)**:
   - Central `businessDate()` function used throughout billing, subscriptions, invoices, and reports.
   - Enables instant time travel (`+1 Day`, `+1 Month`, `Reset`) to demo renewals, invoice aging, and discount expiries in seconds.

2. **Database Partial Unique Index (`uq_invoice_period`)**:
   - `CREATE UNIQUE INDEX uq_invoice_period ON invoices (subscription_id, period_start, period_end) WHERE status <> 'cancelled' AND invoice_type = 'recurring'`
   - Guarantees zero double-billing at the PostgreSQL engine level.

3. **Strict IDOR Protection (PRD Section 9)**:
   - When a customer user queries an invoice or subscription ID belonging to another customer, the API returns `404 Not Found` rather than `403 Forbidden`, preventing resource enumeration.
