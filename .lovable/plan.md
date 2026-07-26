# Glass Bank — Honest Feature Inventory

Report only. No code changes proposed.

## A) FULLY WORKING (real API / real DB)

| Feature | File | Reality |
|---|---|---|
| Auth: signup, signin, reset, email confirm | `SignIn/SignUp/ResetPassword/VerifyEmail.tsx` | Real Supabase Auth |
| TOTP MFA enroll/verify/unenroll | `SecurityCenter.tsx:70-213`, `MfaChallenge.tsx` | Real `supabase.auth.mfa.*` |
| Device + login history | `trusted_devices`, `login_history` (74 rows) | Real |
| Session management / sign out all | `SecurityCenter.tsx` | Real |
| Onboarding + profile edit | `Onboarding.tsx`, `PersonalInfo.tsx` | Real `profiles` writes |
| KYC submission | `VerifyIdentity.tsx` → `iberbanco-kyc` → `POST /users/register/personal` | Real, multipart w/ docs+selfie |
| KYC gating of banking routes | `ProtectedRoute` `requireKyc`, `App.tsx` | Real |
| Balances / accounts | `bankStore.refreshColumn:423`, `GET /accounts` | Real |
| Transaction history | `GET /transactions` | Real |
| Internal transfer | `POST /transactions/INTERNAL` | Real |
| ACH out | `POST /transactions/ACH` | Real |
| SWIFT / international wire | `POST /transactions/SWIFT` | Real |
| Bill pay | `POST /transactions/BILL_PAYMENT` | Real |
| Card issuance (virtual/physical) | `POST /cards/create` | Real |
| Card list/balances | `GET /cards` | Real |
| Card/gateway deposit | `AddMoneyPanel.tsx:217`, `POST /gateway/deposit` | Real, but depends on an agent-side feature flag that may be off |
| Wire/SEPA-in details (IBAN) | `mapIberAccount` `depositDetails` | Real from Iberbanco |
| Beneficiaries CRUD | `Beneficiaries.tsx` | Real DB |
| Payment requests CRUD | `PaymentRequests.tsx` | Real DB |
| Support tickets + threaded messages | `Support.tsx`, `SupportTicket.tsx` | Real DB |
| Admin suite (12 modules) | `src/pages/admin/*` | Real DB reads/writes |
| Webhooks: HMAC verify, replay window, idempotency | `iberbanco-webhook/index.ts` | Real; updates KYC status, broadcasts realtime |
| Proxy security: JWT required, IDOR-proof `user_number` + account-ownership checks | `iberbanco-proxy/index.ts:106-237` | Real and solid |
| MCP agent server (8 user-scoped tools, OAuth) | `supabase/functions/mcp` | Real |

## B) PARTIALLY WORKING / FAKE UNDERNEATH

- **Mock fallback ledger.** `bankStore.tsx:122-138` seeds state from `src/data/mockData.ts`. If Iberbanco sync fails it logs "using mock data" (`:567`) and the dashboard keeps rendering **fake accounts, transactions, card and notifications** that look real. This is the single most misleading thing in the app.
- **Scheduled transfers.** `ScheduledTransfers.tsx` is real CRUD, but "Execute now" (`:117`) only flips a DB status. There is **no cron/edge function that ever executes them** and no Iberbanco call. Nothing recurring actually moves money.
- **Notifications.** In-memory only (`Notifications.tsx`); prefs in localStorage (`lib/alerts.ts`). No push, no email, no `notifications` table.
- **Statements / tax docs.** `Documents.tsx` + `pdfDocuments.ts` generate PDFs client-side from whatever is in the store — including mock data. Not backend-issued, not archived, not authoritative 1099s.
- **Spending analytics.** Derived client-side from transactions; category is literally `Type ${t.type}` (`iberbancoClient.ts:249`) — i.e. **no real categorization**.
- **Biometric login / app passcode.** `SecurityCenter.tsx:225` toggles are component state only; toast claims success, reload reverts. No WebAuthn.
- **HelpCenter.** FAQ hardcoded in `mockData.ts:148-199`; "Call us" is a `tel:` link, creates nothing.
- **Recipients list** in MoveMoney comes from mock seed and is decorative because Send never works.
- **fee_config** (5 rows) is admin-editable but not enforced in `txPolicy.ts`/transfer paths as far as the flows go — fees shown are app-side estimates.
- **user_roles has 0 rows** — no admin/compliance/support user exists in the DB, so the entire admin suite is currently unreachable in production.

## C) STUBBED / DEAD

- **P2P Send** — `bankStore.tsx:644` toast "coming soon", full UI exists.
- **Mobile check deposit** — `bankStore.tsx:655` same.
- **ACH pull / link external bank** — tab deliberately disabled, `AddMoneyPanel.tsx:16`.
- **Card freeze/unfreeze, spend controls, replace card, report stolen, travel notice** — all route to `cardCapabilityUnavailable()` (`bankStore.tsx:776-790`); `CARD_CONTROLS_LIVE=false` (`Cards.tsx:105`).
- **Card PIN update** — `Cards.tsx:308` validates then fake-succeeds. Sent nowhere.
- **Add to Apple Wallet** — `Cards.tsx:301` `setTimeout` + success toast. Pure theater.
- **Rename account, Overdraft preferences, Account alerts** — `AccountDetail.tsx:394-408` toast-only, no persistence.
- **Rate Glass Bank** — `Profile.tsx:29` path `#`, fake toast.
- **Budgets / Goals / Subscriptions tabs** — deliberately hidden (`SpendingInsights.tsx:13`).
- **Admin Accounts / Crypto / Exchange** — `AdminSimple.tsx` is three paragraphs of prose. No data.
- **`/crypto`, `/exchange`, `/users` proxy paths** allow-listed but never called.

## D) BLOCKED BY IBERBANCO v2

| Capability | Missing endpoint |
|---|---|
| P2P between app users | no internal-user transfer endpoint |
| Card freeze/unfreeze, status change | no `PATCH /cards/{id}` status |
| Card PIN set/reset | none |
| Card spend controls / limits | none |
| Travel notice | none |
| Card replacement / lost-stolen | none |
| Mobile check deposit | none |
| ACH debit pull from external bank | ACH is push-out only |
| Direct-deposit / routing+account for US payroll | only IBAN/special number exposed |
| Interest / APY / savings vaults | no product endpoints |
| Disputes / chargebacks | none |
| Statements as issued documents | no `/statements` |
| Debit-card deposit | `/gateway/deposit` exists but gated by agent feature flag |
| Crypto & FX | `/crypto`, `/exchange` prefixes exist but semantics unverified and unbuilt |

## E) DATABASE INVENTORY (13 tables, live row counts)

| Table | Purpose | Status |
|---|---|---|
| `profiles` (11) | user profile/onboarding | Active |
| `kyc_profiles` (2) | KYC + Iberbanco user_number | Active, critical |
| `login_history` (74) | login audit | Active (write+read) |
| `trusted_devices` (22) | device mgmt | Active |
| `fee_config` (5) | fee schedule | Admin-editable; not enforced server-side |
| `beneficiaries` (0) | saved payees | Wired, unused |
| `payment_requests` (0) | request money | Wired, unused |
| `scheduled_transfers` (0) | recurring | Wired, **no executor** |
| `support_tickets` / `support_messages` (0/0) | support | Wired, unused |
| `audit_logs` (0) | admin/webhook audit | Written only by webhook fn |
| `webhook_events` (0) | idempotency ledger | **Zero rows — no webhook has ever been received** |
| `user_roles` (0) | RBAC | **Empty — admin suite unreachable** |

No ledger table: Iberbanco is system of record (by design, `iberbanco-webhook:217`).

## F) MISSING ENTIRELY (no code at all)

Joint/shared accounts · sub-accounts/spaces · savings goals/vaults · interest/APY · direct deposit setup · early payday · standing orders · external account linking (Plaid) · disposable/single-use cards · card spend categories · real transaction categorization · receipts/attachments · budgets · subscription detection · round-ups · cashback/rewards · referral program · multi-currency wallet UX · FX conversion UI · crypto UI · ATM locator · cash deposit · overdraft · credit building · loans · insurance · disputes/chargebacks · push notifications · email notifications · account closure · data export (GDPR; CSV export of activity exists, full export does not) · KYC refresh/periodic review · sanctions/PEP screening · transaction monitoring/AML alerts · admin tooling for any of the above beyond KYC/tickets/fees/roles.

Transaction search & filtering **does** exist (`Activity.tsx`, incl. CSV export) — one of the few Revolut-parity items present.

## Bottom line

Roughly **25 features are genuinely real**, concentrated in auth, KYC, and the five money-movement endpoints Iberbanco actually exposes. The card experience, notifications, analytics, documents and scheduled transfers look like a finished neobank and are substantially hollow. The two most dangerous items are the silent mock-data fallback on the dashboard and scheduled transfers that never execute.
