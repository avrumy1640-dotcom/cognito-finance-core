// Sandbox identity test data.
//
// When the app is pointed at the live sandbox ledger we must never ask anyone
// for real identity details: the upstream sandbox only recognises documented
// test values anyway. These constants are the sandbox-approved set and are
// clearly surfaced as test data in the UI.
export const SANDBOX_KYC = {
  legal_first_name: "Sandbox",
  legal_last_name: "Tester",
  date_of_birth: "1990-01-01",
  call_number: "+15555550123",
  id_type: "drivers_license" as const,
  id_number: "SANDBOX-0000",
  id_issued_date: "2020-01-01",
  id_expiration_date: "2030-01-01",
  street: "1 Market St",
  city: "San Francisco",
  region: "CA",
  postal_code: "94105",
  country: "US",
  citizenship: "US",
  employment_status: "employed" as const,
  occupation: "Software Engineer",
  income: "120000",
};

/** Sandbox outcomes selectable by last name, per the provider's test matrix. */
export const SANDBOX_OUTCOMES = [
  { label: "Approved", lastName: "Tester" },
  { label: "Pending review", lastName: "Pending" },
  { label: "Denied", lastName: "Denied" },
];
