'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Lock,
} from 'lucide-react';
import { Order, OrderItem, ProductVariant } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import ModernProductSelect from '@/components/ModernProductSelect';

interface EditableLineItem {
  id?: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  quantity: number;
  price: number;
  is_upsell: boolean;
  is_reachout?: boolean;
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
  const isWebsite = order.source === 'website';

  const [items, setItems] = useState<EditableLineItem[]>([]);
  const [catalogVariants, setCatalogVariants] = useState<ProductVariant[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mandatory Editing Reason
  const [editReason, setEditReason] = useState('');
  const [currentUserLabel, setCurrentUserLabel] = useState('Staff Member');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // History tab toggle
  const [showHistoryView, setShowHistoryView] = useState(false);

  // New item addition selection
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemIsUpsell, setNewItemIsUpsell] = useState(false);
  const [newItemIsReachout, setNewItemIsReachout] = useState(false);

  // Detect if order is a Reachout order
  const hasReachoutOrder = useMemo(() => {
    if (!order) return false;
    return Boolean(
      (order as any).is_reachout ||
      order.note?.toLowerCase().includes('reachout') ||
      order.order_items?.some((i: any) => i.is_reachout) ||
      (Array.isArray((order as any).original_items) && (order as any).original_items.some((i: any) => i.is_reachout))
    );
  }, [order]);

  // Rule: "when any order has already been assigned to a staff member it will only editable for that specifc staff member and admins no one else"
  const canEdit = useMemo(() => {
    if (isAdmin) return true;
    if (!order.sales_rep_id) return true;
    return order.sales_rep_id === currentUserId;
  }, [isAdmin, order.sales_rep_id, currentUserId]);

  // Load user name & id & role
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, role')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUserLabel(profile.full_name || profile.email || 'Staff Member');
          setIsAdmin(profile.role === 'admin');
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
          is_upsell: order.source === 'website' ? Boolean(item.is_upsell) : false,
          is_reachout: Boolean((item as any).is_reachout || (order.source !== 'website' && order.note?.toLowerCase().includes('reachout'))),
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
        .select('id, product_id, title, sku, price, stock_quantity, created_at, updated_at, product:products(*)')
        .order('title', { ascending: true });

      if (!error && data) {
        setCatalogVariants((data as unknown) as ProductVariant[]);
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
    const effectiveIsUpsell = isWebsite ? newItemIsUpsell : false;
    const effectiveIsReachout = !isWebsite && (newItemIsReachout || hasReachoutOrder);
    const existingIndex = items.findIndex(
      (i) => i.variant_id === variant.id && i.is_upsell === effectiveIsUpsell
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
          is_upsell: effectiveIsUpsell,
          is_reachout: effectiveIsReachout,
        },
      ]);
    }

    // Reset inputs
    setSelectedVariantId('');
    setNewItemQty(1);
    setNewItemIsUpsell(false);
    setNewItemIsReachout(false);
    setErrorMsg(null);
  };

  const mainItems = items.filter((i) => !i.is_upsell);
  const upsellItems = items.filter((i) => i.is_upsell);

  const currentTotal = items.reduce(
    (sum, item) => sum + (item.quantity || 1) * (item.price || 0),
    0
  );

  const handleSaveOrderItems = async () => {
    if (!canEdit) {
      setErrorMsg('Permission denied: This order is assigned to another staff member and can only be edited by them or an administrator.');
      return;
    }

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
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/orders/${order.id}/items`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          items,
          reason: editReason.trim(),
          edited_by: currentUserLabel,
          sales_rep_id: currentUserId || order.sales_rep_id,
          is_reachout: hasReachoutOrder || items.some((i: any) => i.is_reachout),
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
                {canEdit ? 'Edit Products' : 'View Products'}: {order.order_number}
              </h3>
              {hasReachoutOrder && (
                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200/80 font-bold text-[10px]">
                  Reachout
                </span>
              )}
              {!canEdit && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px] flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                  Read-only
                </span>
              )}
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
                  <span>Order Modification Timeline</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryView(false)}
                  className="text-xs text-brand-600 font-bold hover:underline"
                >
                  &larr; Back to Product Editor
                </button>
              </div>

              {/* Timeline Container */}
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {/* 1. EDITED ORDERS (NEWEST AT TOP, PREVIOUS BELOW) */}
                {editHistoryList.length > 0 ? (
                  [...editHistoryList].reverse().map((entry: any, index: number) => {
                    const editNumber = editHistoryList.length - index;
                    const isLatest = index === 0;

                    return (
                      <div key={entry.id || index} className="relative group">
                        {/* Timeline node icon */}
                        <div
                          className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white ${
                            isLatest
                              ? 'border-purple-600 text-purple-600 shadow-xs'
                              : 'border-slate-400 text-slate-400'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                        </div>

                        <div
                          className={`p-4 rounded-xl border bg-white space-y-2 shadow-2xs transition-all ${
                            isLatest ? 'border-purple-200 ring-1 ring-purple-100' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  isLatest
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                Edit #{editNumber} {isLatest && '(Latest)'}
                              </span>
                              <span className="font-bold text-slate-900 flex items-center space-x-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{entry.edited_by}</span>
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatDate(entry.timestamp)}
                            </span>
                          </div>

                          {/* Reasoning Box */}
                          <div className="bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200 text-xs font-medium">
                            <span className="font-bold text-amber-950">Reason:</span> &ldquo;{entry.reason}&rdquo;
                          </div>

                          {/* Item changes summary */}
                          {entry.new_items && entry.new_items.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-100 text-xs space-y-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                Items in this revision:
                              </span>
                              <div className="space-y-0.5 pl-1">
                                  {entry.new_items.map((it: any, i: number) => (
                                    <div key={i} className="text-slate-600 flex justify-between text-[11px]">
                                      <span>
                                        <b>{it.quantity}&times;</b> {it.title}{' '}
                                        {it.variant_title ? `(${it.variant_title})` : ''}
                                        {it.is_upsell && (
                                          <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1 rounded">
                                            UPSELL
                                          </span>
                                        )}
                                        {it.is_reachout && (
                                          <span className="ml-1 text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-200 px-1 rounded">
                                            REACHOUT
                                          </span>
                                        )}
                                      </span>
                                      <span className="font-mono text-slate-700">
                                        {formatCurrency(Number(it.price) * Number(it.quantity))}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          <div className="text-[11px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-100 font-mono">
                            <span>
                              Total changed: {formatCurrency(entry.previous_total)} &rarr;{' '}
                              <b className="text-slate-900">{formatCurrency(entry.new_total)}</b>
                            </span>
                            <span>{entry.new_items?.length || 0} items updated</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-slate-400 text-xs text-center border border-dashed border-slate-200">
                    No modifications made yet. Original order is active below.
                  </div>
                )}

                {/* 2. ORIGINAL ORDER AS PLACED (ANCHORED AT THE VERY BOTTOM - IMMUTABLE) */}
                <div className="relative group">
                  {/* Timeline node icon */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-emerald-600 bg-white text-emerald-600 shadow-xs">
                    <Lock className="w-2.5 h-2.5" />
                  </div>

                  <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-emerald-950 flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Original Order as Placed</span>
                        <span className="text-emerald-700/70 font-normal">
                          ({formatDate(order.created_at)})
                        </span>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Lock className="w-2.5 h-2.5 mr-1" />
                        Original &middot; Locked
                      </span>
                    </div>

                    <p className="text-[11px] text-emerald-800/80">
                      Baseline customer order as initially received. This record is permanent and cannot be modified.
                    </p>

                    {/* Original items list */}
                    <div className="space-y-1 pl-3 border-l-2 border-emerald-300 pt-1">
                      {((order as any).original_items || order.order_items || []).map((it: any, i: number) => {
                        const isReachoutItem = it.is_reachout || (!isWebsite && hasReachoutOrder);
                        return (
                          <div key={i} className="text-slate-700 flex justify-between text-[11px]">
                            <span>
                              <b>{it.quantity}&times;</b> {it.title}{' '}
                              {it.variant_title ? `(${it.variant_title})` : ''}
                              {it.is_upsell && (
                                <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1 rounded">
                                  UPSELL
                                </span>
                              )}
                              {isReachoutItem && (
                                <span className="ml-1 text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-200 px-1 rounded">
                                  REACHOUT
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-slate-800">
                              {formatCurrency(Number(it.price) * Number(it.quantity))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Note string fallback history */}
                {order.note && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 block mb-1">Legacy Order Notes & Log:</span>
                    <pre className="whitespace-pre-wrap font-sans text-slate-600 text-[11px] leading-relaxed">
                      {order.note}
                    </pre>
                  </div>
                )}
              </div>
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
                            <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                              <span>{item.title}</span>
                              {(item.is_reachout || (!isWebsite && hasReachoutOrder)) && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200/80 font-bold text-[10px]">
                                  Reachout
                                </span>
                              )}
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
                            {canEdit && isWebsite && (
                              <button
                                type="button"
                                onClick={() => handleToggleUpsell(idx)}
                                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-700 transition-colors"
                                title="Mark as Upsell Item"
                              >
                                Make Upsell
                              </button>
                            )}

                            {canEdit ? (
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
                            ) : (
                              <span className="text-xs font-bold text-slate-700 font-mono px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                                Qty: {item.quantity}
                              </span>
                            )}

                            <div className="text-right min-w-[70px] font-mono text-xs font-bold text-slate-900">
                              {formatCurrency(item.price * item.quantity)}
                            </div>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: UPSELL PRODUCTS (SHOWN ONLY FOR WEBSITE ORDERS) */}
              {isWebsite && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold uppercase text-purple-700 tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Upsell Items & Add-Ons ({upsellItems.length})</span>
                    </span>
                    <span className="text-[11px] text-purple-600 font-semibold lowercase">
                      Website quota commission eligible
                    </span>
                  </div>

                  {upsellItems.length === 0 ? (
                    <div className="p-3 text-center bg-purple-50/40 rounded-xl text-purple-600/70 text-xs border border-dashed border-purple-200">
                      No upsell items attached yet. (Add an item with "As Upsell?" checked below)
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
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleUpsell(idx)}
                                  className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white border border-purple-200 text-purple-700 hover:bg-slate-100 transition-colors"
                                  title="Convert to regular item"
                                >
                                  Make Regular
                                </button>
                              )}

                              {canEdit ? (
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
                              ) : (
                                <span className="text-xs font-bold text-purple-900 font-mono px-2.5 py-1 rounded-lg bg-purple-100 border border-purple-200">
                                  Qty: {item.quantity}
                                </span>
                              )}

                              <div className="text-right min-w-[70px] font-mono text-xs font-bold text-purple-950">
                                {formatCurrency(item.price * item.quantity)}
                              </div>

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1.5 text-purple-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                  title="Remove upsell"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {canEdit && (
                <>
                  {/* ADD ANOTHER PRODUCT OR UPSELL */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center justify-between">
                      <span>Add Product To Order</span>
                      <span className="text-[11px] text-slate-400 font-normal">Stock adjusts automatically</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className={isWebsite ? 'sm:col-span-6' : 'sm:col-span-8'}>
                        <ModernProductSelect
                          variants={catalogVariants}
                          selectedVariantId={selectedVariantId}
                          onSelect={(variantId) => setSelectedVariantId(variantId)}
                        />
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

                      {isWebsite ? (
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
                      ) : (
                        <div className="sm:col-span-2">
                          <label className="flex items-center space-x-1.5 text-xs text-sky-800 cursor-pointer select-none bg-sky-50 border border-sky-200/80 px-2 py-1.5 rounded-xl">
                            <input
                              type="checkbox"
                              checked={newItemIsReachout}
                              onChange={(e) => setNewItemIsReachout(e.target.checked)}
                              className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                            />
                            <span className="font-semibold text-[11px]">Reachout sell?</span>
                          </label>
                        </div>
                      )}

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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span>{canEdit ? 'New Order Total: ' : 'Total Amount: '}</span>
            <span className="font-mono text-base font-black text-slate-900">
              {formatCurrency(currentTotal)}
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {!canEdit ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
              >
                Close (Read-only)
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
