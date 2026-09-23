'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingBag, User } from 'lucide-react';

export default function MobileNavBar() {
  const pathname = usePathname();

  // Don't show bottom navigation on login or onboarding screens
  if (pathname === '/login' || pathname === '/onboarding') {
    return null;
  }

  const navItems = [
    {
      label: 'Home',
      href: '/admin',
      icon: LayoutDashboard,
      isActive: pathname === '/admin' || pathname === '/',
    },
    {
      label: 'Packing',
      href: '/packing',
      icon: Package,
      isActive: pathname.startsWith('/packing'),
    },
    {
      label: 'Sales',
      href: '/sales',
      icon: ShoppingBag,
      isActive: pathname === '/sales',
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: User,
      isActive: pathname.startsWith('/profile') || pathname.startsWith('/sales/profile'),
    },
  ];

  const handleNavClick = () => {
    if (typeof window !== 'undefined' && (window as any).Android) {
      (window as any).Android.triggerHaptic('click');
    }
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1 md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-150 active:scale-90 ${
                item.isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`relative p-1 rounded-xl transition-all ${
                  item.isActive
                    ? 'bg-emerald-500/15 shadow-sm shadow-emerald-500/20'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${item.isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </div>
              <span className="text-[11px] tracking-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
