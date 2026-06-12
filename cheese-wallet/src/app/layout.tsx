// import type { Metadata } from 'next'
// import { QueryProvider } from '@/providers/QueryProvider'
// import { ThemeProvider } from '@/providers/ThemeProvider'

// export const metadata: Metadata = {
//   title: 'Cheese Wallet — Dollar Wallet for Smart Nigerians',
//   description: 'Hold your money in US dollars. Send and receive Naira instantly. Built for Nigeria.',
//   openGraph: {
//     type: 'website',
//     title: 'Cheese Wallet',
//     description: 'Dollar wallet for smart Nigerians',
//     siteName: 'Cheese Wallet',
//   },
//   icons: { icon: '/icons/icon-192.png' },
// }

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <head>
//         <link rel="preconnect" href="https://fonts.googleapis.com" />
//         <link
//           href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Mono:wght@300;400&family=Syne:wght@400;500;700;800&display=swap"
//           rel="stylesheet"
//         />
//       </head>
//       <body style={{ margin: 0, padding: 0 }}>
//         <QueryProvider>
//           <ThemeProvider>
//             {children}
//           </ThemeProvider>
//         </QueryProvider>
//       </body>
//     </html>
//   )
// }
import { Toaster } from 'react-hot-toast';
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { QueryProvider } from '@/providers/QueryProvider'
import { Providers } from '@/lib/providers';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

export const viewport: Viewport = {
  themeColor: '#0a0904',
}

export const metadata: Metadata = {
  applicationName: 'Cheese Pay',
  title: 'Cheese Pay — Hold Dollars, Send Naira',
  description: 'Hold your money in USDC to protect against naira inflation. Send instantly to any Nigerian bank account in Naira — no crypto knowledge needed.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://cheesepay.xyz'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Cheese',
  },
  openGraph: {
    title: 'Cheese Pay — Hold Dollars, Send Naira',
    description: 'Hold your money in USDC to protect against naira inflation. Send instantly to any Nigerian bank account in Naira — no crypto knowledge needed.',
    images: ['/og-image.png'],
    url: 'https://cheesepay.xyz',
    siteName: 'Cheese Pay',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cheese Pay — Hold Dollars, Send Naira',
    description: 'Hold your money in USDC to protect against naira inflation. Send instantly to any Nigerian bank account in Naira — no crypto knowledge needed.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/logo.png',
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Cheese Pay",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web, iOS, Android",
      "url": "https://cheesepay.xyz",
"description": "Cheese Pay lets Nigerians hold money in USDC and send directly to any Nigerian bank account number in Naira. Protect your savings from naira devaluation without losing the ability to transact locally.",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to join. Cheese Gold and Black tiers available."
      },
      "creator": {
        "@type": "Organization",
        "name": "Cheese Pay",
        "url": "https://cheesepay.xyz"
      }
    })
  }}
/>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                { "@type": "Question", "name": "What is Cheese Pay?", "acceptedAnswer": { "@type": "Answer", "text": "Cheese Pay is a Nigerian digital dollar wallet. You hold your money as USDC — a US dollar-pegged stablecoin — and send directly to any Nigerian bank account in Naira. It is available as a mobile web app with no download required." } },
                { "@type": "Question", "name": "How does Cheese Pay protect my money from naira devaluation?", "acceptedAnswer": { "@type": "Answer", "text": "Cheese Pay lets you hold your balance in USDC, which tracks the US dollar. Since 2020, the naira has lost over 70% of its value against the dollar — money held in USDC maintains its purchasing power." } },
                { "@type": "Question", "name": "Does the recipient need a Cheese Pay account?", "acceptedAnswer": { "@type": "Answer", "text": "No. Recipients do not need a Cheese Pay account or any crypto wallet. They receive plain Naira in their regular Nigerian bank account — GTBank, Zenith, Access, Opay, Kuda, or any other bank." } },
                { "@type": "Question", "name": "Which Nigerian banks does Cheese Pay support?", "acceptedAnswer": { "@type": "Answer", "text": "Cheese Pay supports all major Nigerian banks including GTBank, Zenith Bank, Access Bank, First Bank, UBA, Kuda, Opay, Moniepoint, Palmpay, and more — any bank reachable on the Nigerian interbank settlement system." } },
                { "@type": "Question", "name": "Do I need to know about crypto to use Cheese Pay?", "acceptedAnswer": { "@type": "Answer", "text": "No. You sign up like a normal app, top up your wallet, and send money using the same bank-transfer flow you already know. Cheese Pay handles everything invisibly." } },
                { "@type": "Question", "name": "What are the fees on Cheese Pay?", "acceptedAnswer": { "@type": "Answer", "text": "Cheese Pay charges a small conversion fee when you send to a Nigerian bank account. The exact rate is shown before you confirm any transfer. Cheese Gold and Black tier members receive reduced or zero conversion fees." } },
                { "@type": "Question", "name": "What are the Cheese Pay tier levels?", "acceptedAnswer": { "@type": "Answer", "text": "Silver is the default tier. Gold requires identity verification and unlocks higher limits and reduced fees. Black is the premium tier with zero fees, a metal card, and priority support." } },
                { "@type": "Question", "name": "Is Cheese Pay safe?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Cheese Pay uses cryptographic device keys so only your registered device can authorise transfers. USDC is held on the Stellar blockchain and every transaction is recorded with a verifiable blockchain hash." } }
              ]
            })
          }}
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster position="top-center" />
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
