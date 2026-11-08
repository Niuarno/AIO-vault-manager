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
  isCreateOrderOpen?: boolean;
}

export default function Navbar({
  currentProfile,
  activeTab,
  onTabChange,
  tabBadges = {},
  isOnline,
  onCreateOrder,
  isCreateOrderOpen,
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

  // Mobile 5-Tab Navigation Destinations (Dedicated 5-column ergonomics)
  const mobileNavItems = React.useMemo(() => {
    if (role === 'admin') {
      return [
        { key: 'orders', label: 'Orders', icon: ShoppingBag, href: '/admin' },
        { key: 'inventory', label: 'Stock', icon: Boxes, href: '/admin?tab=inventory' },
        { key: 'create', label: 'Create', icon: Plus, isCreateAction: true },
        { key: 'analytics', label: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
        { key: 'payouts', label: 'Payouts', icon: DollarSign, href: '/admin?tab=payouts' },
      ];
    }
    if (role === 'packing') {
      return [
        { key: 'queue', label: 'Queue', icon: Package, href: '/packing' },
        { key: 'daily-products', label: 'Products', icon: Calendar, href: '/packing/daily-products' },
        { key: 'create', label: 'Create', icon: Plus, isCreateAction: true },
        { key: 'inventory', label: 'Stock', icon: Boxes, href: '/sales?tab=inventory' },
        { key: 'profile', label: 'Profile', icon: User, href: '/profile' },
      ];
    }
    // Default: Sales role
    return [
      { key: 'orders', label: 'Orders', icon: ShoppingBag, href: '/sales' },
      { key: 'inventory', label: 'Stock', icon: Boxes, href: '/sales?tab=inventory' },
      { key: 'create', label: 'Create', icon: Plus, isCreateAction: true },
      { key: 'rewards', label: 'Rewards', icon: Award, href: '/sales?tab=rewards' },
      { key: 'payouts', label: 'Payouts', icon: DollarSign, href: '/sales?tab=payouts' },
    ];
  }, [role]);

  // Track active state for Create action
  const [internalCreateActive, setInternalCreateActive] = useState(false);
  const isCreateActive = isCreateOrderOpen !== undefined ? isCreateOrderOpen : internalCreateActive;

  useEffect(() => {
    const handleOpen = () => setInternalCreateActive(true);
    const handleClose = () => setInternalCreateActive(false);
    window.addEventListener('boyon:open-create-order', handleOpen);
    window.addEventListener('boyon:close-create-order', handleClose);
    return () => {
      window.removeEventListener('boyon:open-create-order', handleOpen);
      window.removeEventListener('boyon:close-create-order', handleClose);
    };
  }, []);

  // Compute active mobile tab index (0 to 4)
  const activeIndex = React.useMemo(() => {
    if (isCreateActive) return 2; // Center "Create" slot is index 2

    // Check explicit activeTab
    if (activeTab !== undefined) {
      const idx = mobileNavItems.findIndex((item) => item.key === activeTab);
      if (idx !== -1) return idx;
    }

    // Check pathname match
    const pathIdx = mobileNavItems.findIndex(
      (item) => item.href && (pathname === item.href || pathname.startsWith(item.href + '?'))
    );
    if (pathIdx !== -1) return pathIdx;

    return 0; // Default to first tab (Orders)
  }, [isCreateActive, activeTab, mobileNavItems, pathname]);

  const activeMobileItem = mobileNavItems[activeIndex] || mobileNavItems[0];
  const ActiveBubbleIcon = activeMobileItem.icon;

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

      {/* Mobile Bottom Navigation Bar (Curved Floating Bubble Dock) */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper-2 border-t border-rule shadow-lg pb-[env(safe-area-inset-bottom)] overflow-visible"
      >
        <div className="relative max-w-lg mx-auto h-16 overflow-visible">
          {/* Fluid Sliding Curved Hill & Elevated Bubble Indicator */}
          <div
            className="absolute top-0 left-0 w-1/5 h-full pointer-events-none nav-bubble-spring"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            {/* Organic Curved Hill Arch (Welds seamlessly into the bar's top border) */}
            <div className="absolute -top-[25px] left-1/2 -translate-x-1/2 w-[82px] h-[28px] overflow-visible pointer-events-none">
              <svg
                viewBox="0 0 100 32"
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {/* Solid white fill overlapping the top edge of the bar */}
                <path
                  d="M 0,26 C 20,26 32,4 50,4 C 68,4 80,26 100,26 L 100,34 L 0,34 Z"
                  className="fill-paper-2"
                />
                {/* Curved top stroke connecting tangentially to the bar's top border */}
                <path
                  d="M 0,26 C 20,26 32,4 50,4 C 68,4 80,26 100,26"
                  className="stroke-rule"
                  strokeWidth="1.2"
                  fill="none"
                />
              </svg>
            </div>

            {/* Elevated Circular Bubble with Colored Ring & Soft Tinted Icon */}
            <button
              type="button"
              onClick={() => {
                if (activeMobileItem.isCreateAction) {
                  handleOpenCreateOrder();
                } else if (onTabChange && (role === 'sales' || role === 'admin') && activeMobileItem.key) {
                  onTabChange(activeMobileItem.key);
                } else if (activeMobileItem.href) {
                  router.push(activeMobileItem.href);
                }
              }}
              className="absolute -top-[28px] left-1/2 -translate-x-1/2 w-[52px] h-[52px] rounded-full border-[3.5px] border-orange-500 bg-paper-2 shadow-md shadow-orange-950/15 flex items-center justify-center pointer-events-auto transition-transform active:scale-90 motion-reduce:transition-none z-20 cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={`Active: ${activeMobileItem.label}`}
            >
              <div className="w-full h-full rounded-full bg-orange-50/90 flex items-center justify-center text-orange-600">
                <ActiveBubbleIcon
                  className="w-6 h-6 stroke-[2.2] text-orange-600 transition-transform duration-200 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </div>
            </button>
          </div>

          {/* 5-Column Navigation Grid */}
          <div className="grid grid-cols-5 h-16 w-full relative z-10" role="tablist">
            {mobileNavItems.map((item, index) => {
              const Icon = item.icon;
              const isCurrentActive = index === activeIndex;
              const badgeCount = tabBadges[item.key];

              const handleClick = () => {
                if (item.isCreateAction) {
                  setInternalCreateActive(true);
                  handleOpenCreateOrder();
                  return;
                }

                setInternalCreateActive(false);

                if (
                  onTabChange &&
                  (pathname === '/admin' || pathname === '/sales') &&
                  item.href !== '/admin/analytics' &&
                  item.href !== '/admin/daily-products' &&
                  item.href !== '/packing/daily-products'
                ) {
                  onTabChange(item.key);
                } else if (item.href) {
                  router.push(item.href);
                }
              };

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={handleClick}
                  className="flex flex-col items-center justify-end h-full pb-2 pt-1 relative transition-transform active:scale-95 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-accent min-w-0 select-none group"
                  aria-label={item.label}
                  role="tab"
                  aria-selected={isCurrentActive}
                >
                  {/* Inactive Icon: Faded out when active since elevated bubble holds the active icon */}
                  <div
                    className={`relative mb-1 transition-[transform,opacity] duration-200 motion-reduce:transition-none flex items-center justify-center ${
                      isCurrentActive ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                    }`}
                  >
                    <Icon
                      className="w-5 h-5 text-slate-400 group-hover:text-slate-600 stroke-[1.8] transition-colors duration-150 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                    {badgeCount !== undefined && badgeCount !== 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 bg-orange-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center tabular-nums leading-none shadow-2xs">
                        {badgeCount}
                      </span>
                    )}
                  </div>

                  {/* Label: Bold text-ink when active, muted slate when inactive */}
                  <span
                    className={`text-center tracking-tight truncate max-w-[62px] transition-colors duration-150 motion-reduce:transition-none ${
                      isCurrentActive
                        ? 'text-[11px] font-bold text-ink'
                        : 'text-[10px] font-medium text-slate-500 group-hover:text-slate-700'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
