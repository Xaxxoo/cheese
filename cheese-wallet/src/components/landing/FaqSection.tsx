// Server component — no 'use client', no animations.
// Every word here is rendered as plain HTML by Next.js and indexed by Google
// and AI crawlers on the first request with zero JavaScript required.

const FAQS = [
  {
    q: 'What is Cheese Pay?',
    a: 'Cheese Pay is a digital dollar wallet for users across Nigeria, Kenya, Rwanda, Ghana, and Ethiopia. You hold your money as USDC or USDT and access local payment rails through a mobile web app with no download required.',
  },
  {
    q: 'How does Cheese Pay protect my money from fiat devaluation?',
    a: 'When you hold money in fiat in a traditional bank, it loses value every time the exchange rate rises. Cheese Pay lets you hold your balance in USDC, which tracks the US dollar. Local currencies across Africa have lost significant value against the dollar — money held in USDC would have maintained its purchasing power.',
  },
  {
    q: 'Do I need to know about crypto to use Cheese Pay?',
    a: 'No crypto knowledge is needed. You sign up like a normal app, top up your wallet, and send money using the same bank-transfer flow you already know — bank name, account number, amount. Cheese Pay handles everything else invisibly.',
  },
  {
    q: 'Does the recipient need a Cheese Pay account?',
    a: 'No. Recipients do not need a Cheese Pay account or any crypto wallet. They receive local currency through supported payment rails in Nigeria, Kenya, Rwanda, Ghana, and Ethiopia.',
  },
  {
    q: 'Which payment rails does Cheese Pay support?',
    a: 'Cheese Pay is building local payment access across Nigeria, Kenya, Rwanda, Ghana, and Ethiopia. Supported banks, mobile-money providers, and payment rails vary by market and are shown in the app.',
  },
  {
    q: 'How do I make a local payment from USDC?',
    a: 'Tap Send, select the available local payment rail, enter the recipient details and amount, confirm with your PIN, and send. The recipient receives local currency through the supported rail.',
  },
  {
    q: 'What are the fees on Cheese Pay?',
    a: 'Cheese Pay charges a small conversion fee when you send to a bank account. The exact rate is shown before you confirm any transfer — there are no hidden charges. Cheese Gold and Black tier members receive reduced or zero conversion fees.',
  },
  {
    q: 'What are the Cheese Pay tier levels?',
    a: 'Cheese Pay has three tiers. Silver is the default tier for all users. Gold requires identity verification (selfie match) and unlocks higher transfer limits and reduced fees. Black is the premium tier requiring document verification and admin approval — it includes zero fees, a metal card, and priority support.',
  },
  {
    q: 'How does Cheese Pay handle identity verification (KYC)?',
    a: 'Cheese Pay uses a tiered KYC system. Silver tier requires basic signup. Gold tier requires BVN or NIN verification plus a selfie face-match. Black tier additionally requires document verification and is approved by the Cheese Pay team.',
  },
  {
    q: 'Is Cheese Pay safe?',
    a: 'Yes. Cheese Pay uses cryptographic device keys so only your registered device can authorise transfers — not just a password. USDC is held on the Stellar blockchain. Every transaction is recorded with a blockchain hash you can verify independently.',
  },
  {
    q: 'What currencies does Cheese Pay support?',
    a: 'Cheese Pay supports USDC and USDT (US dollar-pegged stablecoins). Outgoing transfers are settled in the local currency supported by the selected market and payment rail.',
  },
  {
    q: 'Where is Cheese Pay available?',
    a: 'Cheese Pay covers Nigeria, Kenya, Rwanda, Ghana, and Ethiopia, with local payment-rail availability varying by market as coverage expands.',
  },
]

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-label="Frequently asked questions about Cheese Pay"
      style={{ background: '#050505', padding: '96px 24px' }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Section label */}
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#D4AF37', marginBottom: 16, textAlign: 'center' }}>
          FAQ
        </p>

        <h2 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 8, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Frequently asked questions
        </h2>
        <p style={{ color: '#666', textAlign: 'center', fontSize: 15, marginBottom: 64, lineHeight: 1.6 }}>
          Everything you need to know about holding dollars and making local payments across Africa.
        </p>

        {/* FAQ items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{
                borderTop: i === 0 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '22px 0',
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0', marginBottom: 10, lineHeight: 1.4 }}>
                {faq.q}
              </h3>
              <p style={{ fontSize: 14, color: '#888', lineHeight: 1.75, margin: 0 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
