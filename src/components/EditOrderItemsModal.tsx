'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Package,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  History,
  FileText,
  Clock,
  User,
} from 'lucide-react';
import { Order, OrderItem, ProductVariant } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface EditableLineItem {
  id?: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  quantity: number;
  price: number;
  is_upsell: boolean;
}

interface EditOrderItemsModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedOrder: Order) => void;
}

export default function EditOrderItemsModal({
  order,
  isOpen,
  onClose,
  onUpdated,
}: EditOrderItemsModalProps) {
  const supabase = createClient();

  const [items, setItems] = useState<EditableLineItem[]>([]);
  const [catalogVariants, setCatalogVariants] = useState<ProductVariant[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mandatory Editing Reason
  const [editReason, setEditReason] = useState('');
  const [currentUserLabel, setCurrentUserLabel] = useState('Staff Member');

  // History tab toggle
  const [showHistoryView, setShowHistoryView] = useState(false);

  // New item addition selection
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemIsUpsell, setNewItemIsUpsell] = useState(false);

  // Load user name
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUserLabel(profile.full_name || profile.email || 'Staff Member');
        }
      }
    }
    loadUser();
  }, []);

  // Initialize modal items when order changes
  useEffect(() => {
    if (order && order.order_items) {
      setItems(
        order.order_items.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          title: item.title,
          variant_title: item.variant_title,
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          is_upsell: Boolean(item.is_upsell),
        }))
      );
      setEditReason('');
      setShowHistoryView(false);
    }
  }, [order]);

  // Load catalog variants for adding new products
  useEffect(() => {
    async function loadCatalog() {
      if (!isOpen) return;
      setLoadingCatalog(true);
      const { data, error } = await supabase
        .from('product_variants')
        .select('*, product:products(*)')
        .order('title', { ascending: true });

      if (!error && data) {
        setCatalogVariants(data as ProductVariant[]);
      }
      setLoadingCatalog(false);
    }

    loadCatalog();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuantityChange = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const newQty = Math.max(1, copy[index].quantity + delta);
      copy[index] = { ...copy[index], quantity: newQty };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMsg('An order must have at least one product.');
      return;
    }
    setErrorMsg(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleUpsell = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], is_upsell: !copy[index].is_upsell };
      return copy;
    });
  };

  // Add Variant - Note: checks both variant_id AND is_upsell so identical items stay separate if upsell!
  const handleAddVariantToOrder = () => {
    if (!selectedVariantId) return;

    const variant = catalogVariants.find((v) => v.id === selectedVariantId);
    if (!variant) return;

    // Check if variant already exists with the SAME upsell status
    const existingIndex = items.findIndex(
      (i) => i.variant_id === variant.id && i.is_upsell === newItemIsUpsell
    );

    if (existingIndex >= 0) {
      handleQuantityChange(existingIndex, newItemQty);
    } else {
      const title = variant.product?.title || variant.title;
      const variantTitle = variant.product ? variant.title : null;
      setItems((prev) => [
        ...prev,
        {
          product_id: variant.product_id,
          variant_id: variant.id,
          title,
          variant_title: variantTitle,
          quantity: newItemQty,
          price: Number(variant.price) || 0,
          is_upsell: newItemIsUpsell,
        },
      ]);
    }

    // Reset inputs
    setSelectedVariantId('');
    setNewItemQty(1);
    setNewItemIsUpsell(false);
    setErrorMsg(null);
  };

  const mainItems = items.filter((i) => !i.is_upsell);
  const upsellItems = items.filter((i) => i.is_upsell);

  const currentTotal = items.reduce(
    (sum, item) => sum + (item.quantity || 1) * (item.price || 0),
    0
  );

  const handleSaveOrderItems = async () => {
    if (items.length === 0) {
      setErrorMsg('Cannot save an empty order.');
      return;
    }

    if (!editReason.trim() || editReason.trim().length < 3) {
      setErrorMsg('Please enter a valid reason for this modification.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          reason: editReason.trim(),
          edited_by: currentUserLabel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order items.');
      }

      onUpdated(data.order);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating order items.');
    } finally {
      setSaving(false);
    }
  };

  const editHistoryList = (order as any).edit_history || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header with History toggle */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-black text-slate-900">
                Edit Products: {order.order_number}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: <span className="font-semibold text-slate-700">{order.customer_name}</span>{' '}
              ({order.customer_phone})
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowHistoryView(!showHistoryView)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                showHistoryView
                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {editHistoryList.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {editHistoryList.length}
                </span>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW A: HISTORY DRAWER VIEW */}
          {showHistoryView ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center space-x-1.5">
                  <History className="w-4 h-4 text-purple-600" />
                  <span>Order Audit Trail & Original Record</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryView(false)}
                  className="text-xs text-brand-600 font-bold hover:underline"
                >
                  ← Back to Product Editor
                </button>
              </div>

              {/* Original Order Snapshot */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Original Order as Placed:</span>
                  <span className="text-slate-400 font-normal">({formatDate(order.created_at)})</span>
                </div>
                {order.order_items && (
                  <div className="space-y-1 pl-6">
                    {order.order_items.map((it, i) => (
                      <div key={i} className="text-slate-600 flex justify-between">
                        <span>
                          <b>{it.quantity}×</b> {it.title} {it.variant_title ? `(${it.variant_title})` : ''}
                          {it.is_upsell && (
                            <span className="ml-1 text-[9px] font-bold bg-purple-100 text-purple-700 px-1 rounded">
                              UPSELL
                            </span>
                          )}
                        </span>
                        <span className="font-mono">{formatCurrency(it.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit History Timeline */}
              {editHistoryList.length === 0 && !order.note ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No prior modifications recorded for this order.
                </div>
              ) : (
                <div className="space-y-3">
                  {editHistoryList.map((entry: any, index: number) => (
                    <div key={index} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{entry.edited_by}</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(entry.timestamp)}
                        </span>
                      </div>

                      <div className="bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200 text-xs font-medium">
                        <span className="font-bold">Reason:</span> &ldquo;{entry.reason}&rdquo;
                      </div>

                      <div className="text-[11px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-100 font-mono">
                        <span>
                          Total changed: {formatCurrency(entry.previous_total)} ➔ {formatCurrency(entry.new_total)}
                        </span>
                        <span>{entry.new_items?.length || 0} items updated</span>
                      </div>
                    </div>
                  ))}

                  {/* Note string fallback history */}
                  {order.note && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="font-bold text-slate-700 block mb-1">Order Notes & History:</span>
                      <pre className="whitespace-pre-wrap font-sans text-slate-600 text-[11px] leading-relaxed">
                        {order.note}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* VIEW B: PRODUCT EDITOR */}
              {/* SECTION 1: MAIN BASE PRODUCTS */}
              <div>
                <div className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 flex items-center justify-between">
                  <span>Main Order Products ({mainItems.length})</span>
                  <span className="text-[11px] text-slate-400 font-normal">Standard order items</span>
                </div>

                {mainItems.length === 0 ? (
                  <div className="p-3 text-center bg-slate-50 rounded-xl text-slate-400 text-xs border border-dashed border-slate-200">
                    No main items. (Add one below)
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      if (item.is_upsell) return null;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {item.title}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              {item.variant_title && (
                                <span className="text-xs text-slate-500 font-medium">
                                  {item.variant_title}
                                </span>
                              )}
                              <span className="text-xs text-brand-600 font-semibold font-mono">
                                {formatCurrency(item.price)} each
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end space-x-2.5">
                            <button
                              type="button"
                              onClick={() => handleToggleUpsell(idx)}
                              className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-700 transition-colors"
                              title="Mark as Upsell Item"
                            >
                              Make Upsell
                            </button>

                            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(idx, -1)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-l-lg"
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-7 text-center text-xs font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(idx, 1)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-r-lg"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="text-right min-w-[70px] font-mono text-xs font-bold text-slate-900">
                              {formatCurrency(item.price * item.quantity)}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: UPSELL PRODUCTS (SHOWN SEPARATELY) */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase text-purple-700 tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Upsell Items & Add-Ons ({upsellItems.length})</span>
                  </span>
                  <span className="text-[11px] text-purple-600 font-semibold lowercase">
                    Commission eligible
                  </span>
                </div>

                {upsellItems.length === 0 ? (
                  <div className="p-3 text-center bg-purple-50/40 rounded-xl text-purple-600/70 text-xs border border-dashed border-purple-200">
                    No upsell items attached yet. (Add an item with "Upsell" checked below)
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      if (!item.is_upsell) return null;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-purple-200 bg-purple-50/50 hover:border-purple-300 transition-colors shadow-2xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-sm font-bold text-purple-950 truncate">
                                {item.title}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-200 text-purple-800">
                                UPSELL
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              {item.variant_title && (
                                <span className="text-xs text-purple-700 font-medium">
                                  {item.variant_title}
                                </span>
                              )}
                              <span className="text-xs text-purple-800 font-bold font-mono">
                                {formatCurrency(item.price)} each
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end space-x-2.5">
                            <button
                              type="button"
                              onClick={() => handleToggleUpsell(idx)}
                              className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white border border-purple-200 text-purple-700 hover:bg-slate-100 transition-colors"
                              title="Convert to regular item"
                            >
                              Make Regular
                            </button>

                            <div className="flex items-center border border-purple-200 rounded-lg bg-white">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(idx, -1)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-l-lg"
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-7 text-center text-xs font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(idx, 1)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-r-lg"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="text-right min-w-[70px] font-mono text-xs font-bold text-purple-950">
                              {formatCurrency(item.price * item.quantity)}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-purple-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                              title="Remove upsell"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ADD ANOTHER PRODUCT OR UPSELL */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center justify-between">
                  <span>Add Product To Order</span>
                  <span className="text-[11px] text-slate-400 font-normal">Stock adjusts automatically</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <div className="sm:col-span-6">
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                    >
                      <option value="">-- Select product variant to add --</option>
                      {catalogVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.product?.title || variant.title}{' '}
                          {variant.product ? `(${variant.title})` : ''} — {formatCurrency(variant.price)} (Stock: {variant.stock_quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-center font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="Qty"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center space-x-1.5 text-xs text-purple-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newItemIsUpsell}
                        onChange={(e) => setNewItemIsUpsell(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-[11px]">As Upsell?</span>
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddVariantToOrder}
                      disabled={!selectedVariantId}
                      className="w-full flex items-center justify-center space-x-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* MANDATORY EDITING REASONING BOX */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Editing Reasoning <span className="text-rose-600">* Required</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Customer called to add 1 more vase, or requested color change over WhatsApp..."
                  className="w-full px-3.5 py-2 text-xs rounded-lg bg-white border border-amber-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <p className="text-[11px] text-amber-800/80">
                  This explanation is saved into the order history log to keep team members informed.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span>New Order Total: </span>
            <span className="font-mono text-base font-black text-slate-900">
              {formatCurrency(currentTotal)}
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveOrderItems}
              disabled={saving || !editReason.trim()}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm shadow-brand-200 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Saving changes...' : 'Save Changes & Sync Stock'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
