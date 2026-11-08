import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Boyon OMS - Order Management System & Live Stock',
  description: 'Multi-Channel Order Management, Live Inventory Control & Sales Rewards for Boyon Store',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-clip">
      <body className="min-h-screen bg-paper text-ink antialiased selection:bg-accent-2 selection:text-ink overflow-x-clip">
        {children}
      </body>
    </html>
  );
}
