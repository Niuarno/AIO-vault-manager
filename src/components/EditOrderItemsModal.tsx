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
} from 'lucide-react';
import { Order, OrderItem, ProductVariant } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
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

  // New item addition selection
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemIsUpsell, setNewItemIsUpsell] = useState(false);

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

  const handleAddVariantToOrder = () => {
    if (!selectedVariantId) return;

    const variant = catalogVariants.find((v) => v.id === selectedVariantId);
    if (!variant) return;

    // Check if variant already in items
    const existingIndex = items.findIndex((i) => i.variant_id === variant.id);
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

  const currentTotal = items.reduce(
    (sum, item) => sum + (item.quantity || 1) * (item.price || 0),
    0
  );

  const handleSaveOrderItems = async () => {
    if (items.length === 0) {
      setErrorMsg('Cannot save an empty order.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Edit Products for {order.order_number}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: <span className="font-semibold text-slate-700">{order.customer_name}</span>{' '}
              ({order.customer_phone})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Line Items */}
          <div>
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
              Order Items ({items.length})
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{item.title}</div>
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

                  {/* Quantity and Upsell Controls */}
                  <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {/* Upsell Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleUpsell(idx)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        item.is_upsell
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <Sparkles className="w-2.5 h-2.5 inline mr-1" />
                      {item.is_upsell ? 'Upsell' : 'Regular'}
                    </button>

                    {/* Quantity Selector */}
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, -1)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-l-lg transition-colors"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, 1)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-r-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Subtotal for this item */}
                    <div className="text-right min-w-[70px]">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                    </div>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Product Section */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center justify-between">
              <span>Add Another Product / Upsell</span>
              <span className="text-[11px] text-slate-400 font-normal lowercase">
                Inventory will update automatically
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <div className="sm:col-span-6">
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  <option value="">-- Choose variant to add --</option>
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
                  <span className="font-semibold text-[11px]">Upsell?</span>
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
              disabled={saving}
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
