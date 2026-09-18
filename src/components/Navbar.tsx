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
  Settings,
  Sparkles,
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
      (!currentProfile.full_name?.trim() || !currentProfile.phone?.trim() || currentProfile.phone.trim().length < 8) &&
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
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs no-print transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Left: Brand & Mobile Toggle */}
            <div className="flex items-center space-x-3 sm:space-x-6">
              {/* Mobile hamburger button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link href="/" className="flex items-center space-x-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center text-white font-black shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                  B
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">
                    Boyon <span className="text-brand-600 text-sm font-semibold">OMS</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide hidden sm:block">
                    Omni-Channel Operations
                  </span>
                </div>
              </Link>

              {/* Role indicator (Desktop) */}
              <div
                className={`hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.classes}`}
              >
                <BadgeIcon className="w-3.5 h-3.5 mr-1.5" />
                {badge.label}
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center space-x-1">
                {role === 'admin' && (
                  <>
                    <Link
                      href="/admin"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        pathname === '/admin' && !pathname.includes('tab=')
                          ? 'bg-slate-100 text-slate-900 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5 inline mr-1.5" />
                      All Orders
                    </Link>
                    <Link
                      href="/admin?tab=inventory"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    >
                      <Boxes className="w-3.5 h-3.5 inline mr-1.5" />
                      Live Stock
                    </Link>
                    <Link
                      href="/admin?tab=team"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5 inline mr-1.5" />
                      Team & Coupons
                    </Link>
                    <Link
                      href="/admin?tab=rewards"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    >
                      <Award className="w-3.5 h-3.5 inline mr-1.5" />
                      Reward Rules
                    </Link>
                    <Link
                      href="/packing"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 hover:bg-amber-50 transition-colors"
                    >
                      <Truck className="w-3.5 h-3.5 inline mr-1.5" />
                      Packing View
                    </Link>
                  </>
                )}

                {role === 'sales' && (
                  <>
                    <Link
                      href="/sales"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        pathname === '/sales'
                          ? 'bg-slate-100 text-slate-900 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5 inline mr-1.5" />
                      Sales Workspace
                    </Link>
                    <Link
                      href="/profile"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        pathname === '/profile' || pathname === '/sales/profile'
                          ? 'bg-slate-100 text-slate-900 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 inline mr-1.5" />
                      My Profile & Coupon
                    </Link>
                  </>
                )}

                {role === 'packing' && (
                  <Link
                    href="/packing"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200"
                  >
                    <Package className="w-3.5 h-3.5 inline mr-1.5 text-amber-600" />
                    Confirmed Orders Queue
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
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-2xs">
                      {currentProfile.avatar_url ? (
                        <img
                          src={currentProfile.avatar_url}
                          alt={currentProfile.full_name || 'Avatar'}
                          className="w-full h-full rounded-full object-cover bg-white"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-700 font-bold text-xs">
                          {(currentProfile.full_name || currentProfile.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
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
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <div className="text-xs font-bold text-slate-900">
                          {currentProfile.full_name || 'Staff User'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {currentProfile.email}
                        </div>
                        {currentProfile.phone && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {currentProfile.phone}
                          </div>
                        )}
                      </div>

                      <Link
                        href="/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        <span>Profile & Settings</span>
                      </Link>

                      {currentProfile.role === 'sales' && currentProfile.coupon_code && (
                        <div className="px-4 py-1.5 mx-2 my-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-mono font-bold flex items-center justify-between">
                          <span>Coupon:</span>
                          <span>{currentProfile.coupon_code}</span>
                        </div>
                      )}

                      <div className="border-t border-slate-100 my-1"></div>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          ></div>

          {/* Drawer Content */}
          <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center text-white font-black text-sm">
                  B
                </div>
                <span className="font-extrabold text-slate-900 text-sm">Boyon OMS</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card in Drawer */}
            {currentProfile && (
              <div className="p-4 border-b border-slate-100 bg-white">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 flex-shrink-0">
                    {currentProfile.avatar_url ? (
                      <img
                        src={currentProfile.avatar_url}
                        alt="Avatar"
                        className="w-full h-full rounded-full object-cover bg-white"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm">
                        {(currentProfile.full_name || currentProfile.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {currentProfile.full_name || 'Staff User'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{currentProfile.email}</div>
                    <div
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border mt-1 ${badge.classes}`}
                    >
                      <BadgeIcon className="w-3 h-3 mr-1" />
                      {badge.label}
                    </div>
                  </div>
                </div>

                {currentProfile.role === 'sales' && currentProfile.coupon_code && (
                  <div className="mt-3 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold flex justify-between items-center">
                    <span>Coupon:</span>
                    <span>{currentProfile.coupon_code}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Nav Links */}
            <div className="flex-1 p-4 space-y-1 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-3">
                Workspace Menu
              </div>

              {role === 'admin' && (
                <>
                  <Link
                    href="/admin"
                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <ShoppingBag className="w-4 h-4 text-brand-600" />
                    <span>All Orders</span>
                  </Link>
                  <Link
                    href="/admin?tab=inventory"
                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Boxes className="w-4 h-4 text-brand-600" />
                    <span>Live Stock & Restock</span>
                  </Link>
                  <Link
                    href="/admin?tab=team"
                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Users className="w-4 h-4 text-brand-600" />
                    <span>Sales Team & Coupons</span>
                  </Link>
                  <Link
                    href="/admin?tab=rewards"
                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Award className="w-4 h-4 text-brand-600" />
                    <span>Reward Rules</span>
                  </Link>
                  <Link
                    href="/packing"
                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-amber-800 hover:bg-amber-50"
                  >
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>Packing Portal</span>
                  </Link>
                </>
              )}

              {role === 'sales' && (
                <>
                  <Link
                    href="/sales"
                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <ShoppingBag className="w-4 h-4 text-brand-600" />
                    <span>Sales Workspace</span>
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <User className="w-4 h-4 text-brand-600" />
                    <span>My Profile & Coupon</span>
                  </Link>
                </>
              )}

              {role === 'packing' && (
                <Link
                  href="/packing"
                  className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200"
                >
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>Confirmed Orders Queue</span>
                </Link>
              )}

              <div className="pt-3 mt-3 border-t border-slate-100">
                <Link
                  href="/profile"
                  className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>My Account & Settings</span>
                </Link>
              </div>
            </div>

            {/* Drawer Footer / Sign Out */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
