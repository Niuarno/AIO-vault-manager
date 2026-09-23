'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Wallet, RefreshCw, Circle } from 'lucide-react';
import { CURRENT_APP_VERSION } from '@/lib/version';

export default function MobileHeader() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Don't show top header on login or onboarding screens
  if (pathname === '/login' || pathname === '/onboarding') {
    return null;
  }

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch('/api/shipping/steadfast/balance');
      const data = await res.json();
      if (data?.current_balance !== undefined) {
        setBalance(data.current_balance);
      }
    } catch {
      // Ignore network error gracefully
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const toggleOnlineStatus = async () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);

    if (typeof window !== 'undefined' && (window as any).Android) {
      (window as any).Android.triggerHaptic('click');
      (window as any).Android.showToast(nextStatus ? 'Status: Online 🟢' : 'Status: Away ⚪');
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ is_online: nextStatus, last_seen_at: new Date().toISOString() })
          .eq('id', user.id);
      }
    } catch {
      // Fail silently
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 py-2.5 md:hidden pt-[max(0.625rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
      {/* Brand Monogram */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black text-base shadow-md shadow-emerald-500/20">
          B
        </div>
        <div>
          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
            <span>BOYON</span>
            <span className="text-emerald-400 text-xs px-1.5 py-0.2 rounded-md bg-emerald-950/70 border border-emerald-800/50">
              OMS
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 -mt-0.5">v{CURRENT_APP_VERSION.version}</p>
        </div>
      </div>

      {/* Quick Action Badges */}
      <div className="flex items-center gap-2">
        {/* Steadfast Balance Chip */}
        {balance !== null && (
          <button
            type="button"
            onClick={fetchBalance}
            disabled={loadingBalance}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 active:scale-95 transition-all"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>৳{balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
            <RefreshCw className={`w-3 h-3 text-slate-500 ${loadingBalance ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Staff Presence Toggle */}
        <button
          type="button"
          onClick={toggleOnlineStatus}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
            isOnline
              ? 'bg-emerald-950/50 border-emerald-600/40 text-emerald-400'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          <Circle className={`w-2.5 h-2.5 fill-current ${isOnline ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
          <span>{isOnline ? 'Online' : 'Away'}</span>
        </button>
      </div>
    </header>
  );
}
