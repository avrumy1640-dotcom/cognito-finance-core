import LegalPage, { LegalSection } from "./LegalPage";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    description="How Glass Bank collects, uses, shares and retains your personal information."
    updated="August 2026"
  >
    <LegalSection title="1. Who we are">
      <p>
        Glass Bank is a financial technology company, not a bank. Banking services and FDIC-insured
        deposit accounts are provided by our partner bank, Column N.A., Member FDIC. This policy
        describes what Glass Bank does with your information. Column maintains its own privacy
        notice covering the records it holds as the bank of record.
      </p>
    </LegalSection>

    <LegalSection title="2. Information we collect">
      <ul>
        <li><strong>Identity information</strong> you give us during onboarding: legal name, date of birth, address, government ID details and, for business accounts, entity and ownership details. We are legally required to collect this under the Customer Identification Program rules.</li>
        <li><strong>Contact information</strong>: email address and phone number.</li>
        <li><strong>Financial information</strong>: account balances, transactions, payees, invoices, bills and any receipts you upload.</li>
        <li><strong>Device and security information</strong>: browser user agent, device identifiers you have trusted, and sign-in history. We use this to detect account takeover.</li>
        <li><strong>Support information</strong>: the content of tickets and messages you send us.</li>
      </ul>
    </LegalSection>

    <LegalSection title="3. How we use it">
      <ul>
        <li>To open, operate and protect your account.</li>
        <li>To move money at your instruction and to show you your activity.</li>
        <li>To meet legal obligations: identity verification, sanctions screening, fraud monitoring and regulatory reporting.</li>
        <li>To notify you about your account. Marketing emails are opt-in and separately controllable in Settings.</li>
      </ul>
      <p>We do not sell your personal information.</p>
    </LegalSection>

    <LegalSection title="4. Who we share it with">
      <ul>
        <li><strong>Column N.A.</strong>, our partner bank, which holds the deposit accounts and processes payments.</li>
        <li><strong>Service providers</strong> that host our infrastructure, send transactional email and store uploaded documents, under contract and only for those purposes.</li>
        <li><strong>Regulators and law enforcement</strong>, where we are legally required to respond.</li>
      </ul>
    </LegalSection>

    <LegalSection title="5. How long we keep it">
      <p>
        Preferences, saved payees, trusted devices and uploaded files are kept until you delete them
        or close your account. Identity records and payment records are retained for at least five
        years after your account closes, as required by the Bank Secrecy Act (31 CFR 1010.410 and
        31 CFR 1020.220). We cannot delete those on request, and we will tell you so rather than
        promise an erasure we are not permitted to perform.
      </p>
    </LegalSection>

    <LegalSection title="6. Your rights">
      <p>
        Depending on where you live, you may have the right to access, port, correct or delete your
        personal information, and to object to certain processing. You can exercise the access,
        portability and deletion rights yourself, immediately, from the Privacy Center in the app —
        no email or waiting period required.
      </p>
      <ul>
        <li><strong>Access &amp; portability</strong>: download a complete machine-readable copy of your data.</li>
        <li><strong>Deletion</strong>: close your account and erase everything we are legally permitted to erase, with a plain list of what is retained and why.</li>
        <li><strong>Correction</strong>: update your details under Personal information.</li>
      </ul>
    </LegalSection>

    <LegalSection title="7. Security">
      <p>
        Data is encrypted in transit and at rest. Access to your records is enforced at the database
        level on a per-user basis, and privileged operations run only on our servers — never in your
        browser. Security-relevant events, including sign-ins, permission changes, money movement and
        administrative actions, are written to an audit trail.
      </p>
    </LegalSection>

    <LegalSection title="8. Contact">
      <p>
        Privacy questions and requests: use the in-app Support channel, which is routed to our
        privacy team and creates a tracked record of your request.
      </p>
    </LegalSection>
  </LegalPage>
);

export default Privacy;
