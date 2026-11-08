'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Mail,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  Truck,
  Clock,
  ShieldAlert,
  Save,
} from 'lucide-react';
import { Order, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { isHandedOverToSteadfast, getStatusBadgeInfo } from '@/lib/utils';

interface EditCustomerDetailsModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedOrder: Order) => void;
  currentProfile?: Profile | null;
}

export default function EditCustomerDetailsModal({
  order,
  isOpen,
  onClose,
  onUpdated,
  currentProfile,
}: EditCustomerDetailsModalProps) {
  const supabase = createClient();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if parcel has already been handed over to Steadfast Courier
  const isLockedBySteadfast = isHandedOverToSteadfast(order);

  // Populate form whenever order changes or modal opens
  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name || '');
      setCustomerPhone(order.customer_phone || '');
      setShippingAddress(order.shipping_address || '');
      setCustomerEmail(order.customer_email || '');
      setNote(order.note || '');
      setReason('');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [order, isOpen]);

  if (!isOpen) return null;

  const statusBadge = getStatusBadgeInfo(order.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedBySteadfast) {
      setErrorMsg(
        'Cannot save: This parcel has already been handed over to Steadfast Courier and customer details are locked.'
      );
      return;
    }

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    const cleanAddress = shippingAddress.trim();

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter a valid customer name (at least 2 characters).');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 6) {
      setErrorMsg('Please enter a valid customer phone number (at least 6 digits).');
      return;
    }

    if (!cleanAddress || cleanAddress.length < 3) {
      setErrorMsg('Please enter a valid shipping/delivery address (at least 3 characters).');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/orders/${order.id}/customer`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          customer_name: cleanName,
          customer_phone: cleanPhone,
          shipping_address: cleanAddress,
          customer_email: customerEmail.trim() || null,
          note: note.trim() || null,
          reason: reason.trim() || undefined,
          edited_by: currentProfile?.full_name || currentProfile?.email || 'Sales Staff',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update customer details.');
      }

      setSuccessMsg('Customer details updated successfully!');
      setTimeout(() => {
        onUpdated(data.order);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating customer details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-xs">
              <User className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Edit Customer Details</h3>
                <span className="font-mono text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {order.order_number}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                  <span>{statusBadge.label}</span>
                </span>
                <span className="text-xs text-slate-400 capitalize">Source: {order.source}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Locked Notice if Handed Over to Steadfast Courier */}
          {isLockedBySteadfast && (
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start space-x-3 shadow-xs">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <span>Locked: Parcel Handed Over to Steadfast</span>
                  {order.consignment_id && (
                    <span className="font-mono text-[11px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                      CID: #{order.consignment_id}
                    </span>
                  )}
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  This parcel has already been registered and handed over to Steadfast Courier (Stage:{' '}
                  <strong className="capitalize">{order.status.replace(/_/g, ' ')}</strong>). For delivery security,
                  customer name, phone, and delivery address can no longer be edited.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Customer / Recipient Name <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                disabled={isLockedBySteadfast || saving}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Tanvir Hasan"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Customer Phone */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Phone Number <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                disabled={isLockedBySteadfast || saving}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 01712345678"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Used by courier delivery personnel to contact recipient upon arrival.
            </p>
          </div>

          {/* Shipping / Delivery Address */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Delivery Address <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <textarea
                required
                rows={3}
                disabled={isLockedBySteadfast || saving}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="House, Road, Area, Thana/Upazila, District…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Email (Optional) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Customer Email <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled={isLockedBySteadfast || saving}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="e.g. customer@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Note / Special Instructions */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Order Notes / Delivery Instructions <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <textarea
                rows={2}
                disabled={isLockedBySteadfast || saving}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Call before delivery, deliver after 3pm…"
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Modification Reason */}
          {!isLockedBySteadfast && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 tracking-wide">
                Reason for Change <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                disabled={saving}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer called to correct delivery phone or address…"
                className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Saved into the order history log to keep the team updated on why the customer details changed.
              </p>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isLockedBySteadfast ? 'Close' : 'Cancel'}
            </button>

            {!isLockedBySteadfast && (
              <button
                type="submit"
                disabled={saving || !customerName.trim() || !customerPhone.trim() || !shippingAddress.trim()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving…' : 'Save Customer Details'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
