'use client';

import React, { useState, useRef } from 'react';
import { Wallet, Upload, Camera, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';
import { PayoutRequest } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

interface ProcessPayoutModalProps {
  payout: PayoutRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onProcessed: () => void;
}

export default function ProcessPayoutModal({
  payout,
  isOpen,
  onClose,
  onProcessed,
}: ProcessPayoutModalProps) {
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !payout) return null;

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800; // Optimal resolution for proof screenshots
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setScreenshotUrl(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApprove = async () => {
    if (!screenshotUrl) {
      setErrorMsg('Please upload a proof of payment screenshot before approving.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payout.id,
          status: 'approved',
          admin_screenshot_url: screenshotUrl,
          admin_note: adminNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process payout.');
      }

      onProcessed();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing payout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Process Payout Request</h3>
              <p className="text-[11px] text-slate-500">Attach payment screenshot proof and mark as paid</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Payout Summary Box */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Staff Member:</span>
              <span className="font-bold text-slate-900">{payout.staff?.full_name || 'Staff Member'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Payout Method:</span>
              <span className="font-bold text-emerald-800 uppercase px-2 py-0.5 rounded bg-emerald-100">
                {payout.payment_method}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Account / Mobile Number:</span>
              <span className="font-mono font-bold text-slate-900">{payout.account_number}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
              <span className="text-slate-700 font-bold">Total Amount to Pay:</span>
              <span className="font-mono font-black text-base text-emerald-700">
                {formatCurrency(payout.amount)}
              </span>
            </div>
          </div>

          {/* Screenshot Upload Zone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Proof of Payment Screenshot *
            </label>

            {screenshotUrl ? (
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                <img src={screenshotUrl} alt="Payment Proof" className="w-full h-48 object-contain bg-slate-950/5" />
                <button
                  type="button"
                  onClick={() => setScreenshotUrl('')}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-white text-[10px] font-bold hover:bg-black"
                >
                  Change Screenshot
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20"
              >
                <Camera className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                <span className="text-xs font-bold text-slate-700 block">
                  Click to upload payment screenshot (bKash/Bank receipt)
                </span>
                <span className="text-[10px] text-slate-400">Supported: JPG, PNG, Screenshots</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleScreenshotFileChange}
                />
              </div>
            )}
          </div>

          {/* Transaction Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Admin Transaction ID / Notes (Optional)
            </label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. bKash TrxID: 9XF89D32 / Sent via City Bank"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all disabled:opacity-50 flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Approving...' : 'Approve & Mark Paid'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}