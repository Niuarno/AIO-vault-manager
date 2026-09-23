'use client';

import React, { useEffect, useState } from 'react';
import { CURRENT_APP_VERSION, AppVersionInfo } from '@/lib/version';
import { Sparkles, RefreshCw, X, ArrowUpRight } from 'lucide-react';

export default function LiveUpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState<AppVersionInfo | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkVersion = async () => {
    try {
      const res = await fetch(`/api/system/version?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const remoteInfo: AppVersionInfo = await res.json();

      // Check if build number or version is newer
      const isNewer =
        remoteInfo.buildNumber > CURRENT_APP_VERSION.buildNumber ||
        (remoteInfo.version !== CURRENT_APP_VERSION.version &&
          remoteInfo.buildNumber >= CURRENT_APP_VERSION.buildNumber);

      if (isNewer) {
        setUpdateAvailable(remoteInfo);
      }
    } catch {
      // Offline or network error - ignore gracefully
    }
  };

  useEffect(() => {
    // Check on mount
    checkVersion();

    // Check when user resumes app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Poll every 90 seconds
    const interval = setInterval(checkVersion, 90000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const handleApplyUpdate = async () => {
    setIsApplying(true);

    try {
      // 1. Invalidate browser cache storage
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      // 2. Clear native Android app cache if running inside wrapper
      const android = (window as any).Android;
      if (android) {
        if (typeof android.clearAppCache === 'function') {
          android.clearAppCache();
        }
        if (typeof android.triggerHaptic === 'function') {
          android.triggerHaptic('heavy');
        }
        if (typeof android.showToast === 'function') {
          android.showToast(`Updated to v${updateAvailable?.version || 'new'}!`);
        }
        if (typeof android.reloadApp === 'function') {
          android.reloadApp();
          return;
        }
      }

      // 3. Fallback browser hot-reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch {
      window.location.reload();
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl shadow-emerald-950/50 p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shrink-0 shadow-lg shadow-emerald-500/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                OTA Live Update
              </span>
              <span className="text-xs text-slate-400">v{updateAvailable.version}</span>
            </div>
            <h4 className="text-sm font-bold text-white mt-1">
              New Version Available
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
              {updateAvailable.releaseNotes?.[0] || 'Bug fixes and performance upgrades'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${isApplying ? 'animate-spin text-emerald-400' : ''}`} />
            {isApplying ? 'Updating in background...' : 'Instant reload • No reinstall needed'}
          </span>

          <button
            type="button"
            onClick={handleApplyUpdate}
            disabled={isApplying}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
          >
            <span>{isApplying ? 'Applying...' : 'Update Now'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
