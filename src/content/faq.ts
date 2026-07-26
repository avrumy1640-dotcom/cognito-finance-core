// Static help-centre copy. This is editorial content, not data — it is
// deliberately a plain module rather than pretending to come from a database.

export interface FaqItem { q: string; a: string }
export interface FaqSection { category: string; items: FaqItem[] }

export const FAQ_SECTIONS: FaqSection[] = [
  {
    category: "Account",
    items: [
      { q: "How do I open an account?", a: "Create a Glass Bank login, then complete the guided onboarding and identity verification. You'll need a valid government ID, your tax identification number, and a residential address." },
      { q: "What do I need to verify my identity?", a: "A government-issued photo ID (driver's licence, passport, or national ID), your tax/SSN number, and a selfie so we can match you to the document." },
      { q: "How long does approval take?", a: "Verification is reviewed by our banking partner. Most decisions land within one business day; you'll see the live status on your identity screen and get a notification when it changes." },
      { q: "Why is some of the app locked?", a: "Money movement stays disabled until identity verification is approved. That's a regulatory requirement, not a soft nudge." },
    ],
  },
  {
    category: "Login & Security",
    items: [
      { q: "How do I reset my password?", a: "Tap 'Forgot password' on the sign-in screen. We'll email a secure reset link to your registered address." },
      { q: "How do I enable biometric unlock?", a: "Profile → Security Center → Biometric unlock. It uses your device's built-in authenticator (Face ID, Touch ID, Windows Hello). If your device doesn't support it, the option is hidden rather than shown as a dead switch." },
      { q: "What is the app passcode?", a: "An optional 4–8 digit code that locks the app on this device. It's stored as a salted hash on your account, never in plain text." },
      { q: "How do I turn on two-factor authentication?", a: "Security Center → Two-Factor Authentication. Scan the QR code with an authenticator app and confirm the six-digit code." },
    ],
  },
  {
    category: "Receiving money",
    items: [
      { q: "Where do I find my account details?", a: "Receive → your live account number and IBAN are shown exactly as returned by our banking partner. Share those with the sender." },
      { q: "How do incoming transfers arrive?", a: "SEPA and wire credits post to your account and appear in Activity once settled. You'll get a notification the moment one lands." },
      { q: "Can I pull funds from another bank?", a: "Not yet. ACH debit pulls aren't supported by our banking partner, so we don't offer a button that pretends to do it." },
    ],
  },
  {
    category: "Transfers & Payments",
    items: [
      { q: "What transfer types are supported?", a: "Transfers between your own accounts, ACH transfers, SWIFT/wire transfers, and bill payments." },
      { q: "How long do transfers take?", a: "Internal transfers settle immediately. ACH typically takes 1–3 business days. Wires are same-day when submitted before the cut-off." },
      { q: "Can I schedule a transfer?", a: "Yes. Move Money → Scheduled transfers. Recurring schedules run automatically and show you the real result of every run, including failures." },
      { q: "Is peer-to-peer sending available?", a: "Not currently. Our banking partner doesn't expose a P2P rail, so the option is disabled instead of faked." },
    ],
  },
  {
    category: "Cards",
    items: [
      { q: "How do I get a card?", a: "Cards → Issue card, once identity verification is approved. Virtual cards are provisioned immediately." },
      { q: "Can I freeze my card in the app?", a: "Not yet. Card lock, PIN management and spend controls aren't exposed by our card issuer's API, so those controls are disabled. Contact support to change card status." },
      { q: "How do disputes work?", a: "Open a support ticket from the transaction and our team will raise the dispute with the issuer." },
    ],
  },
  {
    category: "Statements & Documents",
    items: [
      { q: "Where are my statements?", a: "Profile → Documents. Statements are generated from your posted transactions for the period you select." },
      { q: "Do you provide tax documents?", a: "Year-end summaries are available in Documents once a full tax year of activity exists on the account." },
    ],
  },
];
