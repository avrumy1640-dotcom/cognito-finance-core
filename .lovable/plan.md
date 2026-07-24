# Glass Bank — Full Diagnostic Audit

Diagnostic only. No code changes proposed here — this is a read-only assessment across pages, backend, Iberbanco, features, and UX, followed by a prioritized gap list.

---

## 1. Frontend — Pages & Buttons

**Overall:** No true "dead buttons" or broken `navigate()` targets found. Every route referenced exists in `src/App.tsx`. A handful of pages still render from `src/data/mockData.ts` instead of live data.

### Fully functional and live-wired
- Auth: `Welcome.tsx`, `Login.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx`, `MfaChallenge.tsx`, `OAuthConsent.tsx`
- Onboarding/KYC: `Onboarding.tsx` (writes `profiles`), `VerifyIdentity.tsx` (real `iberbanco-kyc` invoke)
- Money & data: `MoveMoney.tsx`, `AccountDetail.tsx`, `TransactionDetail.tsx`, `Activity.tsx`, `ReceiveMoney.tsx`, `Cards.tsx` (partial — see below)
- Supabase-backed features: `Beneficiaries.tsx`, `PaymentRequests.tsx`, `ScheduledTransfers.tsx`, `Support.tsx`, `SupportTicket.tsx`, `PersonalInfo.tsx`, `Settings.tsx`, `SecurityCenter.tsx`, `Notifications.tsx`, `Documents.tsx`
- Admin (real Supabase reads/writes): `AdminDashboard`, `AdminCustomers`, `AdminKyc`, `AdminCards`, `AdminTransactions`, `AdminFees`, `AdminWebhooks`, `AdminAuditLogs`, `AdminTickets`, `AdminRoles`

### Still rendering from `src/data/mockData.ts`
- `Index.tsx:9-15` — `user, cashFlow, insights, savingsGoals` are static mock. Home cash-flow / insights widgets are not derived from live transactions.
- `SpendingInsights.tsx:6` — entire `monthlySpending, savingsGoals` static; category/goal/subscription taps only fire `toast.info(...)` (`:61,:97,:120,:155`). Effectively decorative.
- `Profile.tsx:6` — `user` object (name / avatar / member-since) is mocked.
- `HelpCenter.tsx:6` — `faqData` static (acceptable content).
- `Documents.tsx:8` — imports only the `Transaction` type from mockData; data is live.

### Intentional placeholders (not broken, but empty)
- `src/pages/admin/AdminSimple.tsx` — `AdminAccounts`, `AdminCrypto`, `AdminExchange` are static "coming soon" panels; routed but empty.
- `Profile.tsx:105-108` — "Rate Glass Bank" item has `path: "#"` and only fires a toast. Deliberate stub.
- `App.tsx:85-88` — `/profile/address`, `/profile/identity`, `/profile/employment`, `/profile/linked` all render the same `PersonalInfo.tsx` (no dedicated linked-accounts UI).

### Navigation dead-ends
- None found. All `navigate(...)` and `Link to=...` targets match `App.tsx`.

---

## 2. Backend / Database

Findings from migrations + policy review (no live `pg_policies` query was run; recommend confirming with `supabase--linter` and `pg_policies`).

### RLS coverage — all tables enabled, policies correct
| Table | Verdict |
|---|---|
| `profiles` | Users manage own; admin/support/compliance read-all. ✅ |
| `kyc_profiles` | Users read/insert own; UPDATE own blocked once `status = verified`; admin/compliance can review. ✅ |
| `user_roles` | Users read own; only admins can INSERT/UPDATE/DELETE — no self-escalation path. ✅ |
| `audit_logs` | Read admin-only; INSERT tightened to admin-only in `20260722221617...sql` (previously any authenticated user could self-insert). ✅ |
| `webhook_events` | Read admin-only; INSERT/UPDATE restricted to `service_role`. ✅ |
| `fee_config` | ⚠️ Final policy is **admin-only SELECT**. If any customer-facing screen expects to read fees client-side, it will now return 0 rows. Confirm no consumer UI depends on this. |
| `beneficiaries`, `scheduled_transfers`, `payment_requests`, `support_tickets`, `support_messages`, `trusted_devices`, `login_history` | Correctly scoped to `auth.uid()` with the appropriate admin overrides. ✅ |

No `anon` grants anywhere. `has_role()` was migrated from `SECURITY DEFINER` → `SECURITY INVOKER`; still works for self-checks (`has_role(auth.uid(), ...)`), but silently returns false if ever called for another user's id from a non-admin context.

### Auth flows — all real, not mocked
- Signup, login, password reset, email verification, MFA challenge all call real `supabase.auth.*` in `useAuth.tsx`, `Login.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx`, `MfaChallenge.tsx`.
- `ProtectedRoute.tsx` re-checks AAL on every protected navigation and forces `/mfa-challenge` when required.
- ⚠️ **MFA is opt-in only.** If a user never enrolls a TOTP factor via `SecurityCenter`, `getAuthenticatorAssuranceLevel` never returns `aal2`-required, so login skips MFA entirely. No DB-side rule enforces universal MFA.

### KYC — real end-to-end
`VerifyIdentity.tsx:182-226` upserts `kyc_profiles` then invokes `iberbanco-kyc` edge function. The function validates the caller JWT, POSTs a real multipart request to Iberbanco `/users/register/personal`, then writes back real `status`, `iberbanco_user_number`, `iberbanco_status_raw`, `rejection_reason`, `reviewed_at` using the service-role client. `useKyc.ts` and `KycStatusCard.tsx` reflect that real status. **Nothing simulated.**

One data-quality nit: `VerifyIdentity.tsx:187` hardcodes `ssn_last4: "0000"` — the form doesn't actually collect SSN, but the column is NOT NULL and has a format CHECK.

---

## 3. Iberbanco / BaaS Integration

### Edge functions — correctly implemented
- `iberbanco-proxy/index.ts` — real API at `https://api.iberbanco.dev/api/v2`, real `sha256(token+timestamp+username)` per-request hash (lines 67-83). Requires Supabase bearer, resolves `user_number` from `kyc_profiles` server-side (lines 196-208), forces it into every payload (`overrideUserNumber`), and validates any `account_number*` fields against the caller's own accounts (`fetchOwnedAccounts`, 122-141). Solid IDOR/ownership protection. Secrets never leak client-side.
- `iberbanco-kyc/index.ts` — same real auth scheme; multipart upload of KYC doc + selfie.
- `iberbanco-webhook/index.ts` — HMAC-SHA256 signature verify with ±300s replay guard, idempotency via `webhook_events` unique index.

### Capability status — live vs. UI-only

| Capability | Status |
|---|---|
| Account creation (KYC → `/users/register/personal`) | **LIVE** |
| Fetch balances (`/accounts`) | **LIVE** |
| Fetch transactions (`/transactions`) | **LIVE** |
| Internal transfer (`/transactions/INTERNAL`) | **LIVE**, but optimistic-mock-first |
| ACH (`/transactions/ACH`) | **LIVE**, optimistic-mock-first |
| Wire / SWIFT (`/transactions/SWIFT`) | **LIVE**, optimistic-mock-first |
| Bill pay (`/transactions/BILL_PAYMENT`) | **LIVE**, optimistic-mock-first |
| Card issuance (`/cards/create`) | **LIVE** |
| Card freeze / lock / replace / stolen / PIN / travel notice | **MOCK** — `bankStore.tsx:739-755` explicit comment: "Iberbanco does not expose card lock/unlock/reissue/controls in v2." UI presents them as if they take real effect. |
| Card daily-limit chip | **MOCK** — `Cards.tsx:84` hardcodes `dailyCap = 10_000`. |
| P2P / Send Money | **MOCK** — `bankStore.tsx:622-627` local reducer only, never calls Iberbanco. |
| Deposits / funding (check, direct-deposit, cash-at-retail) | **MOCK** — `bankStore.tsx:629-633` local-only; `MoveMoney.tsx:633-666` `AddMoneySheet` panels are toast-only stubs. There is no real ACH-pull / wire-in / card-load path. |
| Sub-accounts | **Not implemented.** |
| Crypto / exchange | **Allowlisted in proxy, but no client wrapper and no UI.** Effectively dead. |

### ⚠️ "Optimistic-mock-first" is a real correctness risk
`transfer/externalTransfer/wireTransfer/payBill` dispatch a local reducer *first* (updating balances and inserting a fake transaction row), then fire the real Iberbanco call in the background. Even if Iberbanco returns an error later, the user sees success and updated balances until the next `refreshColumn()` polling cycle. If the real API rejects, the toast can flag it but the local ledger is already wrong until reconciled.

### ⚠️ Webhook is log-only
`iberbanco-webhook` verifies + logs the event to `webhook_events` and writes an `audit_logs` row — **nothing else.** It never updates `profiles`, `kyc_profiles`, `scheduled_transfers`, balances, or transactions. `bankStore.tsx:590-601` subscribes to a Realtime channel `"iberbanco-events"` expecting webhook broadcasts, but the webhook handler never publishes to it. Live UI updates rely entirely on the polling interval + post-mutation `refreshColumn()`.

### Silent mock fallbacks
- `iberbancoClient.ts:92` swallows transaction-list errors → `[]`.
- `iberbancoClient.ts:162` swallows card-list errors → `[]`.
- `bankStore.tsx:554-568` on any `refreshColumn` failure falls back to seed mock accounts/transactions and shows "Iberbanco offline… Using cached data."
- `bankStore.tsx:758-761` — `issueCard()` silently mock-issues a card if `columnLive` is false, giving identical success UX.

---

## 4. Feature Completeness vs. Revolut/Chime bar

| Area | State |
|---|---|
| Account opening & KYC | ✅ Real |
| Funding / deposits (ACH pull, wire in, card load) | ❌ **All UI-only.** Biggest missing capability. |
| Move money — internal / ACH / wire / bill pay | ⚠️ Live but optimistic-first with no reversal on API failure |
| P2P (Send Money) | ❌ Never leaves the local reducer |
| Card issuance | ✅ Live |
| Card management (freeze, PIN, limits, replace, travel notice) | ❌ All mock; UI implies real control |
| Transaction history & receipts | ✅ Live reads; PDF/CSV export works |
| Notifications (push / email / SMS) for real account events | ❌ In-app toasts only; no push, no email, no SMS pipeline |
| Statements / documents | ✅ Generated client-side from live tx via jspdf |
| Security (MFA, device tracking, session mgmt) | ⚠️ Real MFA exists but never forced; device tracking via `trusted_devices` present |
| Support / disputes | ✅ Real tickets + messages, admin triage |
| Admin back office | ✅ Customers / KYC / tx / fees / audit / tickets / roles all live; ⚠️ Accounts / Crypto / Exchange are placeholders |
| Sub-accounts, joint accounts, savings vaults, goals | ❌ Not implemented (goals are mock in `SpendingInsights`) |
| Rewards / cashback | ❌ Not implemented |
| External account linking (Plaid-style) | ❌ Not implemented; `/profile/linked` reuses `PersonalInfo` |

---

## 5. UX / Simplicity

Honest read on the three most important flows:

- **Onboarding** — recently rebuilt as one-question-per-screen; feels close to Chime/Revolut. Still ~17 steps before KYC even begins, then KYC is another 5-step wizard. Total time-to-first-value (see a balance) is long. Consider allowing "explore in demo mode" without KYC, or deferring some profile questions until after the first successful account view.
- **Sending money** — `MoveMoney.tsx` currently exposes 9 top-level actions (Transfer / Send / Receive / Scheduled / Deposit / Bills / External / Wire / Add). That's too many primary tiles for a first-time user; competitors collapse this to 3–4 (Send, Request, Add money, More). Fees/timing cards are good and trust-building.
- **Checking balance** — Home is fast and clean, but mixes real balances with mocked cash-flow/insights widgets, which can confuse users when the numbers don't reconcile with `Activity`.

Other friction:
- No skeleton loaders on `Index.tsx` while `refreshColumn` runs; users see seed mock numbers first, then a jump to real numbers.
- Card page presents lock/PIN/travel as if effective — users will assume the network enforced it. Trust risk.

---

## Prioritized Gap List

### (a) Broken / non-functional right now
1. **Card lock / freeze / PIN / replace / stolen / travel notice** (`Cards.tsx`, `bankStore.tsx:739-755`) — UI presents controls that never leave the app. Highest trust risk.
2. **P2P "Send Money"** (`bankStore.tsx:622-627`) — always local; no Iberbanco call even when `columnLive`.
3. **Optimistic-mock-first ledger** on transfer/ACH/wire/bill (`bankStore.tsx:603-737`) — balances and tx list update before the API resolves; failed calls leave the local ledger stale until next poll.
4. **Iberbanco webhook does not update state** (`supabase/functions/iberbanco-webhook/index.ts`) — it only logs. Realtime channel `"iberbanco-events"` in `bankStore.tsx:590-601` is never published to.
5. **`fee_config` SELECT is admin-only** post-hardening — verify no consumer-facing screen still queries it (would silently return empty).
6. **`Profile.tsx` "Rate Glass Bank"** (`:105-108`) — `path:"#"`, toast only.

### (b) Mocked / fake data that needs real wiring
1. `SpendingInsights.tsx` — entire page is static mock; category/goal/subscription taps are `toast.info` stubs.
2. `Index.tsx` cash-flow / insights / savings-goals widgets (`:9-15`) — mocked, not derived from live tx.
3. `Profile.tsx` user object (`:6`) — should read from `profiles` + `auth.user`.
4. `Cards.tsx` `dailyCap = 10_000` (`:84`) — hardcoded, should come from `fee_config` or Iberbanco.
5. `AdminSimple.tsx` — `AdminAccounts`, `AdminCrypto`, `AdminExchange` are static "coming soon" panels.
6. `iberbancoClient.ts` swallows errors on tx/card lists to `[]` — masks real integration failures.
7. `bankStore.tsx` seed accounts/transactions in `initialState` (`:114-130`) show before the first live sync completes.
8. `VerifyIdentity.tsx:187` hardcodes `ssn_last4: "0000"` — fake compliance data in a real KYC row.

### (c) Missing features required for a "full-fledged" banking app
1. **Funding / deposits** — ACH-pull from external bank, wire-in instructions, debit-card load. Currently zero real inbound-money path.
2. **Real P2P** — either Iberbanco INTERNAL by counterparty lookup, or a proper Glass-Bank-internal ledger.
3. **Full card controls** — freeze at network, PIN set/change, limits, merchant-category blocks, travel notice — either upgrade to a Iberbanco API version that supports it, or swap card BaaS.
4. **Notification delivery** — push (web/mobile), email, SMS. Currently no outbound channel.
5. **Sub-accounts / savings vaults / goals** — foundational Chime/Revolut feature.
6. **External account linking** (Plaid or equivalent) for funding + balance aggregation.
7. **MFA enforcement policy** — currently opt-in; add "MFA required after N days" or org-level enforcement.
8. **Reconciliation job** — even without webhook state-writes, a scheduled function that reconciles `bankStore` transactions against Iberbanco is missing.
9. **Disputes flow** — support tickets exist but no formal "dispute this transaction" state machine tied to `transactions`.

### (d) UX friction points
1. Home mixes live balances with mock cash-flow, so numbers don't reconcile with `Activity`.
2. `MoveMoney` exposes 9 primary tiles — too many; collapse to Send / Request / Add / More.
3. Onboarding is 17 steps before KYC's 5 steps — long time-to-first-value; consider deferrable questions.
4. No skeleton loaders during initial `refreshColumn`; seed mock flashes.
5. Card controls imply real network effect — misleading trust cue.
6. Four profile sub-routes render the same `PersonalInfo` — should be dedicated screens or consolidated.
7. `SpendingInsights` category taps go nowhere useful (toast only) — either build detail views or hide until built.

---

## Open questions to confirm before fix work
1. Is keeping "Send Money" local intentional product scope, or an oversight?
2. Does a newer Iberbanco API version now expose card controls (lock/PIN/limits)? If not, is a secondary card BaaS acceptable?
3. Is the webhook intentionally receive-and-audit only pending a reconciliation feature, or is state-update the missing piece?
4. Are `AdminAccounts` / `AdminCrypto` / `AdminExchange` on the roadmap or permanently out of scope?
5. Should `fee_config` be readable by end users (needs a public RPC / edge function) or stay admin-only?
6. Should MFA be enforced universally, or remain opt-in?

Once you confirm which of the gaps above you want prioritized, I'll produce an implementation plan.
