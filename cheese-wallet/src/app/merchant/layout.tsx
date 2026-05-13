import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';

const merchantSans = Manrope({
  subsets: ['latin'],
  variable: '--merchant-font-sans',
});

const merchantDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--merchant-font-display',
});

export const metadata: Metadata = {
  title: 'CheesePay Merchant',
  description:
    'Accept digital dollar payments and settle instantly to fiat from a merchant-grade CheesePay dashboard.',
};

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${merchantSans.variable} ${merchantDisplay.variable}`}>
      {children}
    </div>
  );
}
