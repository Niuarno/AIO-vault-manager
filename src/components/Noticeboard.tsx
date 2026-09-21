'use client';

import React, { useState, useEffect } from 'react';
import { Megaphone, Edit3, X, Check, Loader2 } from 'lucide-react';
import { Profile } from '@/types/database';

interface NoticeboardProps {
  currentProfile?: Profile | null;
}

export default function Noticeboard({ currentProfile }: NoticeboardProps) {
  const [headline, setHeadline] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [draftHeadline, setDraftHeadline] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAdmin = currentProfile?.role === 'admin';

  const fetchHeadline = async () => {
    try {
      const res = await fetch('/api/noticeboard');
      const data = await res.json();
      if (data?.headline) {
        setHeadline(data.headline);
        setDraftHeadline(data.headline);
      }
    } catch (err) {
      console.error('Failed to load noticeboard headline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeadline();
  }, []);

  const handleSaveHeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftHeadline.trim()) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/noticeboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: draftHeadline.trim() }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update headline');
      }

      setHeadline(draftHeadline.trim());
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditOpen(false);
      }, 1000);
    } catch (err: any) {
      setSaveError(err.message || 'Error saving headline');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !headline) {
    return null;
  }

  return (
    <>
      <div className="relative bg-slate-950 text-slate-100 border-b border-slate-800 text-xs overflow-hidden select-none z-30">
        <div className="flex items-center h-8 px-3">
          {/* Static Left Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold tracking-wide uppercase text-[10px] shrink-0 z-10 border border-amber-500/30">
            <Megaphone className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Noticeboard</span>
          </div>

          {/* Marquee Scroller Container */}
          <div className="flex-1 overflow-hidden relative mx-3 group cursor-default">
            <div className="whitespace-nowrap inline-block animate-[noticeboard-scroll_35s_linear_infinite] group-hover:[animation-play-state:paused]">
              <span className="font-medium text-slate-200 tracking-wide inline-block pr-16">
                {headline}
              </span>
              <span className="font-medium text-slate-200 tracking-wide inline-block pr-16">
                {headline}
              </span>
            </div>
          </div>

          {/* Admin Edit Trigger */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setDraftHeadline(headline);
                setIsEditOpen(true);
              }}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 transition-colors shrink-0 z-10"
              title="Edit noticeboard announcement"
            >
              <Edit3 className="w-3 h-3 text-slate-400" />
              <span className="hidden md:inline">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Headline Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Update Noticeboard Headline</h3>
                  <p className="text-xs text-slate-500">
                    This moving announcement will appear at the header across all staff screens.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHeadline} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Announcement Text
                </label>
                <textarea
                  rows={3}
                  value={draftHeadline}
                  onChange={(e) => setDraftHeadline(e.target.value)}
                  placeholder="Enter noticeboard announcement..."
                  className="w-full text-xs rounded-xl border border-slate-200 p-3 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  required
                />
              </div>

              {saveError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 font-medium">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Noticeboard announcement updated successfully.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !draftHeadline.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scroller Animation Keyframe */}
      <style jsx global>{`
        @keyframes noticeboard-scroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </>
  );
}
