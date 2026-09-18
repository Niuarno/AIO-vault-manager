'use client';

import React, { useState, useEffect } from 'react';
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
  ShieldCheck,
  Truck,
  User,
  Menu,
  X,
  ChevronDown,
  DollarSign,
  Layers,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types/database';

interface NavbarProps {
  currentProfile?: Profile | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabBadges?: Record<string, number | string | undefined>;
}

export default function Navbar({
  currentProfile,
  activeTab,
  onTabChange,
  tabBadges = {},
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  }, [pathname]);

  // Mandatory Onboarding Guard
  useEffect(() => {
    if (
      currentProfile &&
      (!currentProfile.full_name?.trim() ||
        !currentProfile.phone?.trim() ||
        currentProfile.phone.trim().length < 8) &&
      pathname !== '/onboarding' &&
      !pathname.startsWith('/login')
    ) {
      router.push('/onboarding');
    }
  }, [currentProfile, pathname, router]);

  const role = currentProfile?.role || 'sales';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case 'admin':
        return {
          label: 'Admin',
          classes: 'bg-slate-100 text-slate-800 border-slate-200/80',
          icon: ShieldCheck,
        };
      case 'sales':
        return {
          label: 'Sales',
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
          icon: TrendingUp,
        };
      case 'packing':
        return {
          label: 'Warehouse',
          classes: 'bg-amber-50 text-amber-800 border-amber-200/80',
          icon: Truck,
        };
    }
  };

  const badge = getRoleBadge(role);
  const BadgeIcon = badge.icon;

  // Admin Navigation Items
  const adminNavItems = [
    { key: 'orders', label: 'Orders', icon: ShoppingBag, href: '/admin' },
    { key: 'inventory', label: 'Inventory & Stock', icon: Boxes, href: '/admin?tab=inventory' },
    { key: 'team', label: 'Staff & Performance', icon: Users, href: '/admin?tab=team' },
    { key: 'payouts', label: 'Payout Requests', icon: DollarSign, href: '/admin?tab=payouts' },
    { key: 'rewards', label: 'Commission Rules', icon: Award, href: '/admin?tab=rewards' },
  ];

  // Sales Navigation Items
  const salesNavItems = [
    { key: 'orders', label: 'Orders Queue', icon: ShoppingBag, href: '/sales' },
    { key: 'inventory', label: 'Stock Lookup', icon: Boxes, href: '/sales?tab=inventory' },
    { key: 'rewards', label: 'My Commissions', icon: Award, href: '/sales?tab=rewards' },
    { key: 'payouts', label: 'Payout History', icon: DollarSign, href: '/sales?tab=payouts' },
  ];

  const navItems = role === 'admin' ? adminNavItems : salesNavItems;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs no-print transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Left: Brand & Nav */}
            <div className="flex items-center space-x-4 sm:space-x-8">
              {/* Mobile hamburger button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Minimal Brand */}
              <Link href="/" className="flex items-center space-x-2 group">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Boyon
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  OMS
                </span>
              </Link>

              {/* Role Indicator Pill */}
              <div
                className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${badge.classes}`}
              >
                <BadgeIcon className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {badge.label}
              </div>

              {/* Desktop Tabs (Unified & Clean) */}
              <nav className="hidden lg:flex items-center space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrentActive =
                    activeTab !== undefined
                      ? activeTab === item.key
                      : pathname === item.href || pathname.startsWith(`${item.href}?`);
                  const badgeCount = tabBadges[item.key];

                  return onTabChange && (pathname === '/admin' || pathname === '/sales') ? (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onTabChange(item.key)}
                      className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isCurrentActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 mr-1.5 ${isCurrentActive ? 'text-white' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                      {badgeCount !== undefined && badgeCount !== 0 && (
                        <span
                          className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            isCurrentActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  ) : (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isCurrentActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 mr-1.5 ${isCurrentActive ? 'text-white' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Warehouse Packing Link for Admin */}
                {role === 'admin' && (
                  <Link
                    href="/packing"
                    className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      pathname === '/packing'
                        ? 'bg-amber-100 text-amber-900 font-bold'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                    <span>Packing Queue</span>
                  </Link>
                )}
              </nav>
            </div>

            {/* Right: User Profile & Actions */}
            <div className="flex items-center space-x-3">
              {currentProfile && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center space-x-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                        {currentProfile.avatar_url ? (
                          <img
                            src={currentProfile.avatar_url}
                            alt={currentProfile.full_name || 'Avatar'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                            {(currentProfile.full_name || currentProfile.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span
                        className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                        title="Online"
                      />
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        {currentProfile.full_name || 'Staff User'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                        {currentProfile.email}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                  </button>

                  {/* Desktop Dropdown */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {currentProfile.full_name || 'Staff User'}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {currentProfile.email}
                        </p>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
                          Profile, Avatars & Banking
                        </Link>
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex items-center w-full px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5 mr-2" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex justify-start">
          <div className="w-64 bg-white h-full shadow-2xl p-5 flex flex-col justify-between animate-in slide-in-from-left">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-lg font-black text-slate-900">Boyon OMS</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrentActive =
                    activeTab !== undefined ? activeTab === item.key : pathname === item.href;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (onTabChange) {
                          onTabChange(item.key);
                        } else {
                          router.push(item.href);
                        }
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isCurrentActive
                          ? 'bg-slate-900 text-white font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2.5 text-slate-500" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {role === 'admin' && (
                  <Link
                    href="/packing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-800 hover:bg-amber-50"
                  >
                    <Truck className="w-4 h-4 mr-2.5 text-amber-600" />
                    <span>Packing Queue</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <User className="w-4 h-4 mr-2 text-slate-400" />
                Profile Settings
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
