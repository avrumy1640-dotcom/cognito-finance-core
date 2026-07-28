import { AdminHeader, AdminPage } from "./AdminShell";

export const AdminAccounts = () => (
  <AdminPage>
    <AdminHeader
      title="Accounts"
      subtitle="Bank accounts across all customers, sourced from the core ledger."
    />
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Account-level data is fetched on demand from the core ledger. Use the Customers tab to drill
      into a specific user's accounts, or the Transactions tab to review recent activity.
    </div>
  </AdminPage>
);

export const AdminCrypto = () => (
  <AdminPage>
    <AdminHeader title="Crypto" subtitle="Wallets and crypto transactions." />
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Crypto wallets are provisioned once the customer opts in. This surface will
      list wallet balances, deposits, and withdrawals as they occur.
    </div>
  </AdminPage>
);

export const AdminExchange = () => (
  <AdminPage>
    <AdminHeader title="Exchange" subtitle="FX orders and live spreads." />
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Live FX rates come from the FX rate service. Customer orders will appear here
      once currency exchange is enabled on the customer app.
    </div>
  </AdminPage>
);
