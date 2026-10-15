'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Order } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

interface DeleteOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (orderId: string) => void;
}

export default function DeleteOrderModal({
  order,
  isOpen,
  onClose,
  onDeleted,
}: DeleteOrderModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete order.');
      }
      onDeleted(order.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-900">
              Delete Order {order.order_number}?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Customer: <b className="text-slate-700">{order.customer_name}</b> &middot; Total:{' '}
              <b className="font-mono text-slate-700">{formatCurrency(order.total_amount)}</b>
            </p>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-left text-xs text-rose-800 space-y-1">
            <div className="font-bold flex items-center space-x-1.5 text-rose-900">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Permanent Action Warning</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This will permanently delete this order and all associated line items, inventory deduction logs, and staff upsell commission records.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-100 text-rose-800 rounded-lg text-xs text-left">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center space-x-3 pt-2">
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