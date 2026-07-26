// Canonical shape of a transaction as rendered by the app. Every field here is
// derived from data the backend actually returned — there is no seed/demo
// source for this type anywhere in the production code path.
export type Transaction = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  status: "posted" | "pending";
  type: "debit" | "credit";
  paymentMethod: string;
  icon: string;
  account: string;
};
