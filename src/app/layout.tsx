import type { Metadata } from 'next';
import './globals.css';
import OrderNotificationListener from '@/components/OrderNotificationListener';

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
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <OrderNotificationListener />
        {children}
      </body>
    </html>
  );
}
