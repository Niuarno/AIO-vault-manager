'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert, CheckSquare, Square } from 'lucide-react';
import { Profile } from '@/types/database';

interface DeleteStaffModalProps {
  staff: Profile | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (staffId: string) => void;
}

export default function DeleteStaffModal({
  staff,
  isOpen,
  onClose,
  onDeleted,
}: DeleteStaffModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [deleteOrders, setDeleteOrders] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !staff) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteOrders }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to permanently delete staff member.');
      }

      onDeleted(staff.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while deleting staff member.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 space-y-4">
          {/* Top Icon & Close */}
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              disabled={deleting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Heading & Staff Info */}
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Permanently Delete Staff Member?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              You are about to delete <b className="text-slate-800">{staff.full_name || staff.email}</b>{' '}
              ({staff.role}) and wipe their associated records.
            </p>
          </div>

          {/* Staff Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
              {staff.avatar_url ? (
                <img src={staff.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                (staff.full_name || staff.email || 'U')[0].toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <div className="font-bold text-slate-900 truncate">
                {staff.full_name || 'Anonymous Staff'}
              </div>
              <div className="text-slate-500 text-[11px] truncate">{staff.email}</div>
            </div>
            {staff.coupon_code && (
              <span className="text-[10px] font-mono font-bold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 shrink-0">
                {staff.coupon_code}
              </span>
            )}
          </div>

          {/* Destructive Warning */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-rose-900">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Permanent Irreversible Action</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-700">
              This will permanently delete this staff member's login credentials, daily quota progress, upsell reward commissions, and payout history.
            </p>
          </div>

          {/* Optional Order Deletion Toggle */}
          <button
            type="button"
            onClick={() => setDeleteOrders(!deleteOrders)}
            className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
              deleteOrders
                ? 'bg-rose-50/50 border-rose-300 text-rose-900'
                : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/60'
            }`}
          >
            {deleteOrders ? (
              <CheckSquare className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <div className="font-semibold">
                Also permanently delete orders assigned to this staff member
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {deleteOrders
                  ? 'All customer and manual orders linked to this staff member will be deleted.'
                  : 'Orders will remain preserved in the system with staff assignment removed.'}
              </div>
            </div>
          </button>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl text-xs">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 transition-all disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
