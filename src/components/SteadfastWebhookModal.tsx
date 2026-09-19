'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Play,
  CheckCircle2,
  Truck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface SteadfastWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentOrders?: Array<{ id: string; order_number: string; customer_name: string; status: string }>;
  onOrderUpdated?: () => void;
}

export default function SteadfastWebhookModal({
  isOpen,
  onClose,
  recentOrders = [],
  onOrderUpdated,
}: SteadfastWebhookModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [origin, setOrigin] = useState('');
  const [bearerToken, setBearerToken] = useState('steadfast_wh_secret_token');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState(
    recentOrders[0]?.order_number || ''
  );
  const [simType, setSimType] = useState<'delivered' | 'in_transit' | 'cancelled'>('delivered');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
    if (recentOrders.length > 0 && !selectedInvoice) {
      setSelectedInvoice(recentOrders[0].order_number);
    }
  }, [recentOrders, selectedInvoice]);

  if (!isOpen) return null;

  const callbackUrl = `${origin}/api/webhooks/steadfast`;

  const copyToClipboard = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleSimulate = async () => {
    if (!selectedInvoice) {
      alert('Please select or type an order number (invoice).');
      return;
    }

    setSimulating(true);
    setSimResult(null);

    try {
      const payload: Record<string, any> = {
        notification_type: 'delivery_status',
        consignment_id: Math.floor(100000 + Math.random() * 900000),
        invoice: selectedInvoice,
        cod_amount: 1200.0,
        delivery_charge: 100.0,
        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      if (simType === 'delivered') {
        payload.status = 'delivered';
        payload.tracking_message = 'Your package has been delivered successfully by Steadfast Courier.';
      } else if (simType === 'in_transit') {
        payload.status = 'pending';
        payload.notification_type = 'tracking_update';
        payload.tracking_message = 'Package arrived at Dhaka Sorting Hub and dispatched to delivery agent.';
      } else if (simType === 'cancelled') {
        payload.status = 'cancelled';
        payload.tracking_message = 'Delivery cancelled per customer request or unreachable.';
      }

      const res = await fetch('/api/webhooks/steadfast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setSimResult({
          success: true,
          message: `Event processed! Order #${selectedInvoice} updated to match Steadfast ${simType.replace('_', ' ')}.`,
        });
        if (onOrderUpdated) {
          onOrderUpdated();
        }
      } else {
        setSimResult({
          success: false,
          message: data.message || 'Webhook rejected by server.',
        });
      }
    } catch (err: any) {
      setSimResult({
        success: false,
        message: err.message || 'Network error during simulation',
      });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Steadfast Webhook Integration</h2>
              <p className="text-xs text-slate-500">
                Automate real-time order status updates directly from Steadfast Courier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Setup Guide Banner */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs leading-relaxed">
            <span className="font-bold">Instructions:</span> Open your{' '}
            <span className="font-semibold">Steadfast Merchant Dashboard &rarr; Webhook Integration</span>{' '}
            (as shown in your Steadfast panel). Copy and paste the two fields below, then click{' '}
            <span className="font-bold">SAVE</span>.
          </div>

          {/* Configuration Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Callback URL (Endpoint)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={callbackUrl}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 select-all outline-none"
                />
                <button
                  onClick={() => copyToClipboard(callbackUrl, 'url')}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all"
                >
                  {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Auth Token (Bearer)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Optional secret token"
                />
                <button
                  onClick={() => copyToClipboard(bearerToken, 'token')}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs transition-all"
                >
                  {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Matches the <code className="text-slate-600">STEADFAST_WEBHOOK_BEARER_TOKEN</code> env variable.
              </p>
            </div>
          </div>

          {/* Webhook Behavior Reference */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Automatic Progression Mapping
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="font-bold text-blue-700">Stage 2 &rarr; Stage 3</div>
                <div className="text-slate-600 mt-1 text-[11px]">
                  When Steadfast registers parcel or sends <span className="font-semibold">pending/in_review</span>, order advances to <span className="font-semibold text-indigo-700">With Courier</span>.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="font-bold text-emerald-800">Stage 3 &rarr; Stage 4</div>
                <div className="text-slate-600 mt-1 text-[11px]">
                  When Steadfast sends <span className="font-semibold text-emerald-700">delivered</span>, order automatically shifts to <span className="font-semibold text-emerald-800">Shipped / Fulfilled</span> & marks paid.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
                <div className="font-bold text-rose-800">Cancellations</div>
                <div className="text-slate-600 mt-1 text-[11px]">
                  When Steadfast sends <span className="font-semibold text-rose-700">cancelled</span>, order status updates to <span className="font-semibold text-rose-800">Canceled</span> automatically.
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Webhook Simulator */}
          <div className="border-t border-slate-100 pt-4 bg-slate-50/60 -mx-6 -mb-6 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Play className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Test Webhook Event Simulator
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Verify realtime live updates immediately</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Target Order / Invoice Number
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={selectedInvoice}
                    onChange={(e) => setSelectedInvoice(e.target.value)}
                    placeholder="e.g. #B1223"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-mono outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {recentOrders.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setSelectedInvoice(e.target.value);
                      }}
                      className="text-xs px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer outline-none"
                    >
                      <option value="" disabled>
                        Pick
                      </option>
                      {recentOrders.map((ord) => (
                        <option key={ord.id} value={ord.order_number}>
                          {ord.order_number} ({ord.customer_name})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Simulated Event
                </label>
                <select
                  value={simType}
                  onChange={(e) => setSimType(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium outline-none cursor-pointer"
                >
                  <option value="delivered">Delivered (Stage 4)</option>
                  <option value="in_transit">In Transit (Stage 3)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <button
                  onClick={handleSimulate}
                  disabled={simulating}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                  <span>{simulating ? 'Simulating...' : 'Fire Webhook'}</span>
                </button>
              </div>
            </div>

            {simResult && (
              <div
                className={`mt-3 p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                  simResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {simResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{simResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
