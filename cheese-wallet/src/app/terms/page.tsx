import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Cheese Pay',
  description: 'The terms that apply when you use Cheese Pay services.',
}

const sections = [
  {
    title: '1. About these terms',
    body: (
      <p>
        These Terms of Service govern your access to and use of Cheese Pay, including our
        digital-dollar wallet, stablecoin services, payment features, and related websites
        and applications. By creating an account or using the service, you agree to these
        terms and our <a className="text-[#d4a843] hover:underline" href="/privacy">Privacy Policy</a>.
      </p>
    ),
  },
  {
    title: '2. Eligibility and account information',
    body: (
      <>
        <p>
          You must be legally able to enter into these terms and provide accurate, complete,
          and current information. You may not create or use an account on behalf of another
          person without authority. We may require identity, address, bank-account, BVN, NIN,
          or other verification information before enabling certain features.
        </p>
        <p className="mt-3">
          You are responsible for keeping your login credentials, recovery information, and
          registered devices secure. Tell us promptly if you suspect unauthorised access or a
          compromised device.
        </p>
      </>
    ),
  },
  {
    title: '3. What Cheese Pay provides',
    body: (
      <p>
        Cheese Pay provides software and financial-technology services that may allow you to
        hold, receive, send, or convert supported digital assets and request settlement to
        supported bank accounts or payment channels. Available features, assets, countries,
        limits, fees, and payment partners may change. A recipient may receive local currency
        through a payment partner without needing a Cheese Pay account.
      </p>
    ),
  },
  {
    title: '4. Stablecoin and technology risks',
    body: (
      <>
        <p>
          USDC, USDT, and other digital assets are not the same as bank deposits and are not
          guaranteed by Cheese Pay, a deposit-insurance scheme, or any government. Digital-asset
          values, availability, blockchain networks, issuers, and third-party services may be
          affected by technical failures, network congestion, fraud, regulation, market events,
          or loss of access credentials.
        </p>
        <p className="mt-3">
          Blockchain transactions may be irreversible. Always check the address, network, asset,
          and amount before confirming a transaction. We are not responsible for assets sent to
          an incorrect address or unsupported network, except where liability cannot lawfully be
          excluded.
        </p>
      </>
    ),
  },
  {
    title: '5. Deposits, transfers, and payouts',
    body: (
      <p>
        You authorise us and relevant partners to process instructions you submit through the
        service. A transaction may remain pending while we perform verification, wait for
        blockchain confirmations, or receive a response from a bank or payment provider. We may
        delay, reject, reverse, or restrict a transaction where required for security, compliance,
        fraud prevention, liquidity, technical, or legal reasons. We will show the applicable
        exchange rate, fees, and estimated amount before you confirm where reasonably possible.
      </p>
    ),
  },
  {
    title: '6. Fees, rates, and limits',
    body: (
      <p>
        Fees, exchange rates, network charges, payout charges, and account limits are displayed
        in the service or communicated before confirmation where applicable. Rates may change
        quickly. You authorise us to deduct disclosed fees from the relevant transaction or
        balance. We may apply additional limits or verification requirements based on your tier,
        activity, location, or applicable law.
      </p>
    ),
  },
  {
    title: '7. Acceptable use',
    body: (
      <>
        <p>You must not use Cheese Pay to:</p>
        <ul>
          <li>Break the law, evade sanctions, launder money, finance terrorism, or facilitate fraud.</li>
          <li>Buy or sell prohibited goods, services, or financial products.</li>
          <li>Impersonate another person, provide false information, or use another person’s account.</li>
          <li>Interfere with the service, bypass security controls, or introduce malicious code.</li>
          <li>Exploit errors, manipulate rates or limits, or conduct abusive or suspicious activity.</li>
        </ul>
        <p>
          We may report suspected unlawful activity to competent authorities and cooperate with
          lawful investigations.
        </p>
      </>
    ),
  },
  {
    title: '8. Suspension and closure',
    body: (
      <p>
        We may suspend, restrict, or close an account where we reasonably believe there is a
        security, fraud, compliance, legal, operational, or terms-related concern, or where a
        payment partner requires us to do so. We may ask for additional information before
        restoring access. Subject to applicable law and outstanding obligations, we will provide
        instructions for any eligible remaining balance when an account is closed.
      </p>
    ),
  },
  {
    title: '9. Third-party services',
    body: (
      <p>
        Banking partners, identity-verification providers, blockchain networks, stablecoin
        issuers, cloud providers, and other third parties may be involved in delivering the
        service. Their own terms, fees, availability, and privacy practices may apply. We do not
        control third-party networks and cannot guarantee their uninterrupted operation.
      </p>
    ),
  },
  {
    title: '10. Intellectual property',
    body: (
      <p>
        Cheese Pay and its licensors own the service, software, branding, content, and related
        intellectual-property rights. We give you a limited, personal, non-exclusive,
        non-transferable, revocable licence to use the service in accordance with these terms.
        You may not copy, modify, reverse engineer, distribute, or commercially exploit the
        service except where applicable law permits it.
      </p>
    ),
  },
  {
    title: '11. Disclaimers and liability',
    body: (
      <p>
        The service is provided on an “as available” basis. To the extent permitted by law, we
        do not guarantee that it will always be uninterrupted, error-free, or suitable for every
        purpose. Nothing in these terms excludes liability that cannot lawfully be excluded,
        including liability for fraud or death or personal injury caused by negligence. To the
        extent permitted by law, Cheese Pay is not liable for indirect, consequential, or purely
        economic losses arising from events outside our reasonable control.
      </p>
    ),
  },
  {
    title: '12. Changes and contact',
    body: (
      <p>
        We may update these terms when the service, partners, or legal requirements change. We
        will post the updated version on this page and revise the effective date. If you have a
        question or complaint, contact{' '}
        <a className="text-[#d4a843] hover:underline" href="mailto:support@cheesepay.xyz">
          support@cheesepay.xyz
        </a>. These terms are intended to be interpreted under the laws applicable to the
        Cheese Pay service in Nigeria, subject to any mandatory rights you may have under the
        laws that apply to you.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#080808] text-[#f5eed8]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
        <a href="/" className="mb-12 inline-flex items-center gap-2 text-sm text-[#d4a843] hover:underline">
          <img src="/logo.png" alt="" className="h-6 w-6 rounded-md object-contain" />
          Cheese Pay
        </a>

        <div className="mb-12 border-b border-white/10 pb-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#d4a843]">Legal</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-5 text-sm leading-7 text-white/50">
            The terms that apply when you use Cheese Pay.
          </p>
          <p className="mt-3 text-xs text-white/35">Effective date: 2 August 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-7 text-white/65 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:my-3 [&_ul]:space-y-2">
          <p>
            These terms are written to explain the service clearly. They should be reviewed by
            qualified Nigerian counsel before being treated as the final legal terms for launch.
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
