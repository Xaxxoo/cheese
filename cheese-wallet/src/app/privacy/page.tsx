import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Cheese Pay',
  description: 'How Cheese Pay collects, uses, protects, and shares personal data.',
}

const sections = [
  {
    title: '1. Who we are',
    body: (
      <p>
        Cheese Pay is a digital-dollar wallet and payments service. In this notice,
        “Cheese Pay”, “we”, “us”, and “our” refer to the Cheese Pay service and its
        operating entity. For privacy questions or requests, contact us at{' '}
        <a className="text-[#d4a843] hover:underline" href="mailto:support@cheesepay.xyz">
          support@cheesepay.xyz
        </a>.
      </p>
    ),
  },
  {
    title: '2. Information we collect',
    body: (
      <>
        <p>Depending on how you use Cheese Pay, we may collect:</p>
        <ul>
          <li>Account details such as your name, email address, phone number, and username.</li>
          <li>Identity and verification information, including BVN, NIN, identity documents, and selfie checks where required.</li>
          <li>Bank and payment details, including account numbers, bank names, transaction references, and payout information.</li>
          <li>Wallet addresses, blockchain transaction hashes, balances, and transaction history.</li>
          <li>Device, security, usage, and technical information needed to protect accounts and operate the service.</li>
          <li>Messages and support information when you contact us.</li>
        </ul>
      </>
    ),
  },
  {
    title: '3. How we use information',
    body: (
      <>
        <p>We use personal data to:</p>
        <ul>
          <li>Create and manage your account and wallet.</li>
          <li>Verify identity, prevent fraud, and meet legal and financial-crime obligations.</li>
          <li>Process deposits, transfers, bank payouts, and other requested services.</li>
          <li>Secure the service, investigate suspicious activity, and resolve disputes.</li>
          <li>Send service messages, security alerts, and—where permitted—product updates.</li>
          <li>Improve reliability, performance, and user experience.</li>
        </ul>
      </>
    ),
  },
  {
    title: '4. Lawful bases',
    body: (
      <p>
        We process information where it is necessary to provide a service you request,
        comply with a legal obligation, protect users and the service, pursue legitimate
        operational interests, or where you have given consent. Where we rely on consent,
        you may withdraw it, although this will not affect processing already carried out
        lawfully.
      </p>
    ),
  },
  {
    title: '5. Sharing and service providers',
    body: (
      <p>
        We may share relevant information with identity-verification providers, banking
        and payment partners, blockchain infrastructure providers, cloud and security
        vendors, professional advisers, regulators, law-enforcement agencies, and other
        processors that help us deliver the service. We require appropriate confidentiality
        and security protections from service providers and do not sell personal data.
      </p>
    ),
  },
  {
    title: '6. International transfers',
    body: (
      <p>
        Some providers may process information outside Nigeria. Where this happens, we
        take reasonable steps to use lawful transfer arrangements and require appropriate
        protections for the information, consistent with applicable Nigerian data-protection
        requirements.
      </p>
    ),
  },
  {
    title: '7. Retention and security',
    body: (
      <p>
        We retain information only for as long as reasonably necessary for the purposes
        described here, including legal, accounting, fraud-prevention, and dispute-resolution
        requirements. We use technical and organisational safeguards such as encryption,
        access controls, device-security checks, monitoring, and secure key management.
        No online service can guarantee absolute security.
      </p>
    ),
  },
  {
    title: '8. Your rights',
    body: (
      <>
        <p>Subject to applicable law, you may have the right to:</p>
        <ul>
          <li>Ask what personal data we hold about you and request a copy.</li>
          <li>Request correction of inaccurate or incomplete information.</li>
          <li>Request deletion, restriction, or objection to certain processing.</li>
          <li>Withdraw consent where processing is based on consent.</li>
          <li>Request portability of information you provided to us where applicable.</li>
        </ul>
        <p>
          To make a request, email{' '}
          <a className="text-[#d4a843] hover:underline" href="mailto:support@cheesepay.xyz">
            support@cheesepay.xyz
          </a>. We may need to verify your identity before acting on a request, and some
          data may need to be retained where the law requires it.
        </p>
      </>
    ),
  },
  {
    title: '9. Cookies and analytics',
    body: (
      <p>
        We may use essential cookies and similar technologies to keep the service secure,
        remember preferences, understand performance, and improve the experience. You can
        manage cookies through your browser settings, although disabling essential cookies
        may affect functionality.
      </p>
    ),
  },
  {
    title: '10. Children',
    body: (
      <p>
        Cheese Pay is not intended for children who are not legally able to use financial
        services. We do not knowingly collect personal data from children for independent
        account creation.
      </p>
    ),
  },
  {
    title: '11. Changes and complaints',
    body: (
      <p>
        We may update this notice when our services, partners, or legal obligations change.
        We will post the updated version on this page and revise the effective date. If you
        have a concern, contact us first at{' '}
        <a className="text-[#d4a843] hover:underline" href="mailto:support@cheesepay.xyz">
          support@cheesepay.xyz
        </a>. You may also contact the Nigeria Data Protection Commission where you believe
        your data-protection rights have not been addressed.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#080808] text-[#f5eed8]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
        <a href="/" className="mb-12 inline-flex items-center gap-2 text-sm text-[#d4a843] hover:underline">
          <img src="/logo.png" alt="" className="h-6 w-6 rounded-md object-contain" />
          Cheese Pay
        </a>

        <div className="mb-12 border-b border-white/10 pb-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#d4a843]">Legal</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 text-sm leading-7 text-white/50">
            How Cheese Pay collects, uses, protects, and shares personal data.
          </p>
          <p className="mt-3 text-xs text-white/35">Effective date: 2 August 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-7 text-white/65 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:my-3 [&_ul]:space-y-2">
          <p>
            This Privacy Policy explains how we handle personal data when you visit Cheese Pay,
            create an account, use our wallet, make payments, or contact us. Please read it
            together with any notices shown during onboarding or when a specific feature collects
            information.
          </p>
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
