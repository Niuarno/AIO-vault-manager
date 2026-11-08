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
  BarChart3,
  Calendar,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types/database';
import Noticeboard from '@/components/Noticeboard';

interface NavbarProps {
  currentProfile?: Profile | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabBadges?: Record<string, number | string | undefined>;
  isOnline?: boolean;
  onCreateOrder?: () => void;
}

export default function Navbar({
  currentProfile,
  activeTab,
  onTabChange,
  tabBadges = {},
  isOnline,
  onCreateOrder,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const userIsOnline = isOnline !== undefined ? isOnline : currentProfile?.is_online ?? true;

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
          classes: 'bg-paper-3 text-ink border-rule',
          icon: ShieldCheck,
        };
      case 'sales':
        return {
          label: 'Sales',
          classes: 'bg-orange-50 text-orange-900 border-orange-200',
          icon: TrendingUp,
        };
      case 'packing':
        return {
          label: 'Warehouse',
          classes: 'bg-amber-50 text-amber-900 border-amber-200',
          icon: Truck,
        };
    }
  };

  const badge = getRoleBadge(role);
  const BadgeIcon = badge.icon;

  // Admin Navigation Items
  const adminNavItems = [
    { key: 'orders', label: 'Orders', icon: ShoppingBag, href: '/admin' },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
    { key: 'daily-products', label: 'Products by date', icon: Calendar, href: '/admin/daily-products' },
    { key: 'inventory', label: 'Inventory & stock', icon: Boxes, href: '/admin?tab=inventory' },
    { key: 'team', label: 'Staff & performance', icon: Users, href: '/admin?tab=team' },
    { key: 'payouts', label: 'Payout requests', icon: DollarSign, href: '/admin?tab=payouts' },
    { key: 'rewards', label: 'Commission rules', icon: Award, href: '/admin?tab=rewards' },
  ];

  // Packing / Warehouse Navigation Items
  const packingNavItems = [
    { key: 'queue', label: 'Fulfillment queue', icon: Package, href: '/packing' },
    { key: 'daily-products', label: 'Products by date', icon: Calendar, href: '/packing/daily-products' },
  ];

  // Sales Navigation Items
  const salesNavItems = [
    { key: 'orders', label: 'Orders queue', icon: ShoppingBag, href: '/sales' },
    { key: 'inventory', label: 'Stock lookup', icon: Boxes, href: '/sales?tab=inventory' },
    { key: 'rewards', label: 'My commissions', icon: Award, href: '/sales?tab=rewards' },
    { key: 'payouts', label: 'Payout history', icon: DollarSign, href: '/sales?tab=payouts' },
  ];

  const navItems = role === 'admin' ? adminNavItems : role === 'packing' ? packingNavItems : salesNavItems;

  const handleOpenCreateOrder = () => {
    if (onCreateOrder) {
      onCreateOrder();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('boyon:open-create-order'));
      if (pathname !== '/sales') {
        router.push('/sales?create=1');
      }
    }
  };

  const leftNavItems =
    role === 'sales'
      ? salesNavItems.slice(0, 2)
      : role === 'packing'
      ? packingNavItems.slice(0, 1)
      : adminNavItems.slice(0, 2);

  const rightNavItems =
    role === 'sales'
      ? salesNavItems.slice(2, 4)
      : role === 'packing'
      ? packingNavItems.slice(1, 2)
      : [adminNavItems[2], adminNavItems[5]];

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper-2 border-b border-rule no-print shadow-xs">
        {/* Continuous Moving Headline Noticeboard */}
        <Noticeboard currentProfile={currentProfile} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            {/* Left: Brand & Nav */}
            <div className="flex items-center space-x-3 sm:space-x-6">
              {/* Mobile hamburger button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 rounded-sm text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
              </button>

              {/* Orange Boyon OMS Brand */}
              <Link href="/" className="flex items-center space-x-2 group focus-visible:outline-2 focus-visible:outline-accent">
                <span className="w-7 h-7 rounded-sm bg-orange-600 text-white font-black text-sm flex items-center justify-center font-display shadow-xs transition-transform motion-reduce:transition-none group-hover:scale-105">
                  B
                </span>
                <span className="text-lg font-bold tracking-tight text-ink font-display">
                  Boyon <span className="text-orange-600">OMS</span>
                </span>
              </Link>

              {/* Role Indicator Pill */}
              <div
                className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border ${badge.classes}`}
              >
                <BadgeIcon className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                {badge.label}
              </div>

              {/* Desktop Tabs */}
              <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrentActive =
                    activeTab !== undefined
                      ? activeTab === item.key
                      : pathname === item.href || pathname.startsWith(`${item.href}?`);
                  const badgeCount = tabBadges[item.key];

                  return onTabChange &&
                    (pathname === '/admin' || pathname === '/sales') &&
                    item.href !== '/admin/analytics' &&
                    item.href !== '/admin/daily-products' &&
                    item.href !== '/packing/daily-products' ? (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onTabChange(item.key)}
                      className={`flex items-center px-3 py-1.5 rounded-sm text-xs font-medium transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-accent ${
                        isCurrentActive
                          ? 'bg-orange-600 text-white font-semibold shadow-xs'
                          : 'text-ink-muted hover:text-ink hover:bg-paper-3'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 mr-1.5 ${isCurrentActive ? 'text-white' : 'text-ink-muted'}`} aria-hidden="true" />
                      <span>{item.label}</span>
                      {badgeCount !== undefined && badgeCount !== 0 && (
                        <span
                          className={`ml-1.5 px-1.5 py-0.2 rounded-full text-xs font-semibold tabular-nums ${
                            isCurrentActive
                              ? 'bg-white/20 text-white'
                              : 'bg-paper-3 text-ink-muted border border-rule'
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
                      className={`flex items-center px-3 py-1.5 rounded-sm text-xs font-medium transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-accent ${
                        isCurrentActive
                          ? 'bg-orange-600 text-white font-semibold shadow-xs'
                          : 'text-ink-muted hover:text-ink hover:bg-paper-3'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 mr-1.5 ${isCurrentActive ? 'text-white' : 'text-ink-muted'}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Warehouse Packing Link for Admin */}
                {role === 'admin' && (
                  <Link
                    href="/packing"
                    className={`flex items-center px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-accent ${
                      pathname === '/packing'
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                    <span>Packing queue</span>
                  </Link>
                )}
              </nav>
            </div>

            {/* Right: User Profile & Actions */}
            <div className="flex items-center space-x-2">
              {currentProfile && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center space-x-2 p-1 rounded-sm hover:bg-paper-3 transition-colors text-left active:scale-95 focus-visible:outline-2 focus-visible:outline-accent"
                    aria-expanded={profileDropdownOpen}
                    aria-label="User profile menu"
                  >
                    <div className="relative">
                      <div className="w-7 h-7 rounded-sm overflow-hidden bg-paper-3 border border-rule flex items-center justify-center">
                        {currentProfile.avatar_url ? (
                          <img
                            src={currentProfile.avatar_url}
                            alt={currentProfile.full_name || 'Avatar'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-paper-3 flex items-center justify-center text-ink font-semibold text-xs">
                            {(currentProfile.full_name || currentProfile.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-paper ${
                          userIsOnline ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                        title={userIsOnline ? 'Online' : 'Away'}
                      />
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-xs font-semibold text-ink leading-tight">
                        {currentProfile.full_name || 'Staff User'}
                      </div>
                      <div className="text-xs text-ink-muted truncate max-w-[120px]">
                        {currentProfile.email}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-ink-muted hidden sm:block" aria-hidden="true" />
                  </button>

                  {/* Desktop Dropdown */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-56 bg-paper-2 border border-rule rounded-sm shadow-md py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-2 border-b border-rule flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink truncate">
                            {currentProfile.full_name || 'Staff User'}
                          </p>
                          <p className="text-xs text-ink-muted truncate">
                            {currentProfile.email}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-sm border shrink-0 ${
                            userIsOnline
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              userIsOnline ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            aria-hidden="true"
                          />
                          {userIsOnline ? 'Online' : 'Away'}
                        </span>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-3 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <User className="w-3.5 h-3.5 mr-2 text-ink-muted" aria-hidden="true" />
                          Profile, avatars & banking
                        </Link>
                      </div>

                      <div className="pt-1 border-t border-rule">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex items-center w-full px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <LogOut className="w-3.5 h-3.5 mr-2" aria-hidden="true" />
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

      {/* Mobile Drawer (Left) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-ink/75 flex justify-start animate-in fade-in duration-150">
          <div className="w-68 bg-paper-2 h-full border-r border-rule p-4 flex flex-col justify-between shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-rule">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-sm bg-orange-600 text-white font-black text-sm flex items-center justify-center font-display">
                    B
                  </span>
                  <span className="text-base font-bold text-ink font-display">Boyon OMS</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-sm text-ink-muted hover:text-ink hover:bg-paper-3 focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
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
                        if (
                          onTabChange &&
                          item.href !== '/admin/analytics' &&
                          item.href !== '/admin/daily-products' &&
                          item.href !== '/packing/daily-products'
                        ) {
                          onTabChange(item.key);
                        } else {
                          router.push(item.href);
                        }
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center w-full px-3 py-2.5 rounded-sm text-xs font-medium transition-colors active:scale-98 focus-visible:outline-2 focus-visible:outline-accent ${
                        isCurrentActive
                          ? 'bg-orange-600 text-white font-semibold shadow-xs'
                          : 'text-ink hover:bg-paper-3'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mr-2.5 ${isCurrentActive ? 'text-white' : 'text-ink-muted'}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {role === 'admin' && (
                  <Link
                    href="/packing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2.5 rounded-sm text-xs font-medium text-amber-900 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Truck className="w-4 h-4 mr-2.5 text-amber-700" aria-hidden="true" />
                    <span>Packing queue</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-rule space-y-1">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-3 py-2 rounded-sm text-xs font-medium text-ink hover:bg-paper-3 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <User className="w-4 h-4 mr-2 text-ink-muted" aria-hidden="true" />
                Profile settings
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center w-full px-3 py-2 rounded-sm text-xs font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Native App Dock with Center Create Action) */}
      <nav
        aria-label="Mobile Bottom App Bar"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper-2 border-t border-rule shadow-lg pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-around h-16 px-1.5 relative max-w-lg mx-auto">
          {/* Left Navigation Items */}
          {leftNavItems.map((item) => {
            const Icon = item.icon;
            const isCurrentActive =
              activeTab !== undefined
                ? activeTab === item.key
                : pathname === item.href || pathname.startsWith(`${item.href}?`);

            return onTabChange &&
              (pathname === '/admin' || pathname === '/sales') &&
              item.href !== '/admin/analytics' &&
              item.href !== '/admin/daily-products' &&
              item.href !== '/packing/daily-products' ? (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-transform motion-reduce:transition-none active:scale-95 focus-visible:outline-2 focus-visible:outline-accent min-w-0 ${
                  isCurrentActive ? 'text-orange-600 font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {tabBadges[item.key] ? (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-orange-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                      {tabBadges[item.key]}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[62px]">
                  {item.label}
                </span>
              </button>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-transform motion-reduce:transition-none active:scale-95 focus-visible:outline-2 focus-visible:outline-accent min-w-0 ${
                  isCurrentActive ? 'text-orange-600 font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[62px]">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Center Elevated Create Order Action Button */}
          <div className="flex flex-col items-center justify-center -mt-6 px-1 shrink-0 z-10">
            <button
              type="button"
              onClick={handleOpenCreateOrder}
              className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-lg shadow-orange-600/35 ring-4 ring-paper-2 flex items-center justify-center transition-transform active:scale-90 motion-reduce:transition-none cursor-pointer group"
              title="Create New Order"
              aria-label="Create New Order"
            >
              <Plus className="w-7 h-7 stroke-[2.75] transition-transform duration-200 group-hover:rotate-90 motion-reduce:transition-none" />
            </button>
            <span className="text-[10px] font-bold text-orange-600 mt-0.5 tracking-tight">
              Create
            </span>
          </div>

          {/* Right Navigation Items */}
          {rightNavItems.map((item) => {
            const Icon = item.icon;
            const isCurrentActive =
              activeTab !== undefined
                ? activeTab === item.key
                : pathname === item.href || pathname.startsWith(`${item.href}?`);

            return onTabChange &&
              (pathname === '/admin' || pathname === '/sales') &&
              item.href !== '/admin/analytics' &&
              item.href !== '/admin/daily-products' &&
              item.href !== '/packing/daily-products' ? (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-transform motion-reduce:transition-none active:scale-95 focus-visible:outline-2 focus-visible:outline-accent min-w-0 ${
                  isCurrentActive ? 'text-orange-600 font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {tabBadges[item.key] ? (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-orange-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                      {tabBadges[item.key]}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[62px]">
                  {item.label}
                </span>
              </button>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-transform motion-reduce:transition-none active:scale-95 focus-visible:outline-2 focus-visible:outline-accent min-w-0 ${
                  isCurrentActive ? 'text-orange-600 font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[62px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
