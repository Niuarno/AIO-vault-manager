'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Package,
  ShoppingBag,
  TrendingUp,
  Boxes,
  Users,
  Award,
  LogOut,
  UserCheck,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types/database';

interface NavbarProps {
  currentProfile?: Profile | null;
}

export default function Navbar({ currentProfile }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const role = currentProfile?.role || 'admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Admin Director',
          classes: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: ShieldCheck,
        };
      case 'sales':
        return {
          label: 'Sales Executive',
          classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: TrendingUp,
        };
      case 'packing':
        return {
          label: 'Packing Team',
          classes: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: Truck,
        };
    }
  };

  const badge = getRoleBadge(role);
  const BadgeIcon = badge.icon;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand & Portal Selector */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-200">
                B
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Boyon <span className="text-brand-600 text-base font-medium">OMS</span>
              </span>
            </Link>

            {/* Role indicator */}
            <div className={`hidden md:flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.classes}`}>
              <BadgeIcon className="w-3.5 h-3.5 mr-1.5" />
              {badge.label}
            </div>

            {/* Navigation links based on current view/role */}
            <nav className="hidden lg:flex items-center space-x-1">
              {role === 'admin' && (
                <>
                  <Link
                    href="/admin"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/admin'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 inline mr-1.5" />
                    All Orders
                  </Link>
                  <Link
                    href="/admin?tab=inventory"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname.includes('tab=inventory')
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Boxes className="w-4 h-4 inline mr-1.5" />
                    Live Stock
                  </Link>
                  <Link
                    href="/admin?tab=team"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname.includes('tab=team')
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-1.5" />
                    Sales Team & Coupons
                  </Link>
                  <Link
                    href="/admin?tab=rewards"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname.includes('tab=rewards')
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Award className="w-4 h-4 inline mr-1.5" />
                    Reward Rules
                  </Link>
                  <Link
                    href="/packing"
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-50"
                  >
                    <Truck className="w-4 h-4 inline mr-1.5" />
                    Packing View
                  </Link>
                </>
              )}

              {role === 'sales' && (
                <>
                  <Link
                    href="/sales"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/sales'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 inline mr-1.5" />
                    Sales Workspace
                  </Link>
                  <Link
                    href="/sales/profile"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/sales/profile'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4 inline mr-1.5" />
                    My Profile & Coupon
                  </Link>
                </>
              )}

              {role === 'packing' && (
                <Link
                  href="/packing"
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-50 text-amber-900 border border-amber-200"
                >
                  <Package className="w-4 h-4 inline mr-1.5 text-amber-600" />
                  Confirmed Orders Queue
                </Link>
              )}
            </nav>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-4">
            {currentProfile && (
              <div className="flex items-center space-x-3 text-right">
                <div className="hidden sm:block">
                  <div className="text-sm font-bold text-slate-900">
                    {currentProfile.full_name || 'Staff Member'}
                  </div>
                  <div className="text-xs text-slate-500">{currentProfile.email}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold border border-slate-300">
                  {currentProfile.avatar_url ? (
                    <img
                      src={currentProfile.avatar_url}
                      alt={currentProfile.full_name || 'User'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    (currentProfile.full_name || currentProfile.email || 'U')[0].toUpperCase()
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
