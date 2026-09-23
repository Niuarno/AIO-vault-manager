import type { Metadata, Viewport } from 'next';
import './globals.css';
import OrderNotificationListener from '@/components/OrderNotificationListener';
import LiveUpdateManager from '@/components/LiveUpdateManager';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileNavBar from '@/components/mobile/MobileNavBar';

export const metadata: Metadata = {
  title: 'Boyon OMS - Order Management System & Live Stock',
  description: 'Multi-Channel Order Management, Live Inventory Control & Sales Rewards for Boyon Store',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#090D16',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
        <MobileHeader />
        <OrderNotificationListener />
        <LiveUpdateManager />
        <main className="pb-16 md:pb-0 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
        <MobileNavBar />
      </body>
    </html>
  );
}
