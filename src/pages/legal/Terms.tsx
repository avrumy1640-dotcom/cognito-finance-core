import LegalPage, { LegalSection } from "./LegalPage";

const Terms = () => (
  <LegalPage
    title="Terms of Service"
    description="The terms that govern your use of the Glass Bank application."
    updated="August 2026"
  >
    <LegalSection title="1. Glass Bank is not a bank">
      <p>
        Glass Bank provides the software you are using. Deposit accounts, payments and card services
        are provided by Column N.A., Member FDIC. Your deposit relationship is with the bank, and the
        bank's own deposit account agreement governs it. Where these terms and the bank's agreement
        conflict on a banking matter, the bank's agreement controls.
      </p>
    </LegalSection>

    <LegalSection title="2. Eligibility and verification">
      <p>
        You must be at least 18 years old and able to enter a binding contract. Before you can move
        money, we are required to verify your identity, and for business accounts the identity of
        beneficial owners and a control person. We may refuse, limit or close an account if we cannot
        complete verification.
      </p>
    </LegalSection>

    <LegalSection title="3. Your account and security">
      <ul>
        <li>Keep your credentials confidential and enable the available security controls.</li>
        <li>Tell us immediately if you suspect unauthorised access.</li>
        <li>You are responsible for instructions submitted from your authenticated session, subject to your rights under Regulation E for consumer accounts.</li>
      </ul>
    </LegalSection>

    <LegalSection title="4. Moving money">
      <p>
        Transfers are subject to available balance, per-transaction and rolling limits, cut-off times
        and the partner bank's processing schedule. ACH transfers may be returned after they appear
        to settle. Wires are generally irrevocable once sent. Where your organisation has configured
        an approval threshold, payments above it will not execute until approved.
      </p>
    </LegalSection>

    <LegalSection title="5. Business accounts and team access">
      <p>
        If you invite teammates, you are responsible for the roles you grant. Admins can initiate
        payments subject to your approval settings; viewers cannot move money. Removing a teammate
        revokes their access but does not reverse actions already taken.
      </p>
    </LegalSection>

    <LegalSection title="6. Prohibited use">
      <p>
        You may not use Glass Bank for unlawful activity, to evade sanctions, for money laundering, or
        for any business category prohibited by the partner bank. We may suspend access and file
        reports where required by law, and we may be prohibited from telling you that we did.
      </p>
    </LegalSection>

    <LegalSection title="7. Simulated features">
      <p>
        Some features in this application — including card issuance, rewards and credit — are
        demonstrations only and are labelled as such in the interface. They do not create real card,
        rewards or credit products, and no real value is issued through them.
      </p>
    </LegalSection>

    <LegalSection title="8. Closing your account">
      <p>
        You may close your account at any time from the Privacy Center once your balance is zero. We
        may close or restrict an account for legal, risk or compliance reasons. Certain records are
        retained after closure as described in the Privacy Policy.
      </p>
    </LegalSection>

    <LegalSection title="9. Disclaimers and limits">
      <p>
        The application is provided on an "as is" basis to the extent permitted by law. Nothing here
        limits rights you have under consumer financial protection law, including error-resolution
        rights under Regulation E.
      </p>
    </LegalSection>

    <LegalSection title="10. Changes">
      <p>
        We will give notice of material changes to these terms in the app before they take effect.
        Continuing to use Glass Bank after that date means you accept the updated terms.
      </p>
    </LegalSection>
  </LegalPage>
);

export default Terms;
