'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Search,
  CheckCircle2,
  Package,
  AlertCircle,
  ShoppingBag,
  Plus,
  Loader2,
  ArrowRight,
  Boxes,
} from 'lucide-react';

export interface ShopifyVariantItem {
  id?: number | string;
  title: string;
  price: number;
  sku?: string | null;
  stock_quantity?: number;
}

export interface ShopifyMissingProduct {
  id: number | string;
  title: string;
  handle?: string | null;
  description?: string | null;
  image_url?: string | null;
  price: number;
  variants: ShopifyVariantItem[];
}

interface ShopifySyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductAdded: () => void;
}

export default function ShopifySyncModal({
  isOpen,
  onClose,
  onProductAdded,
}: ShopifySyncModalProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [missingProducts, setMissingProducts] = useState<ShopifyMissingProduct[]>([]);
  const [totalShopify, setTotalShopify] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-product entered quantities (defaults to '10' or '0')
  const [quantities, setQuantities] = useState<Record<string | number, string>>({});
  // Loading state per item while "Add in" is executing
  const [addingMap, setAddingMap] = useState<Record<string | number, boolean>>({});
  // Success flash map
  const [successMap, setSuccessMap] = useState<Record<string | number, boolean>>({});

  // Global bulk quantity value to quickly set all
  const [bulkQtyValue, setBulkQtyValue] = useState<string>('');

  // Fetch missing products from API
  const fetchMissingProducts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/shopify/sync', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to scan Shopify catalog.');
      }

      const products: ShopifyMissingProduct[] = data.missing_products || [];
      setMissingProducts(products);
      setTotalShopify(data.total_shopify || 0);
      setSyncedCount(data.synced_count || 0);

      // Initialize quantities map for missing items with default 0
      setQuantities((prev) => {
        const next = { ...prev };
        products.forEach((p) => {
          if (next[p.id] === undefined) {
            next[p.id] = '0';
          }
        });
        return next;
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with Shopify sync service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMissingProducts();
    }
  }, [isOpen, fetchMissingProducts]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle quantity changes for a specific product card
  const handleQuantityChange = (productId: string | number, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setQuantities((prev) => ({
      ...prev,
      [productId]: cleaned,
    }));
  };

  const handleStepQuantity = (productId: string | number, delta: number) => {
    setQuantities((prev) => {
      const current = parseInt(prev[productId] || '0', 10) || 0;
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        [productId]: String(next),
      };
    });
  };

  // Apply bulk quantity across all remaining missing products
  const handleApplyBulkQty = () => {
    const qty = bulkQtyValue.replace(/[^0-9]/g, '');
    if (!qty) return;
    setQuantities((prev) => {
      const next = { ...prev };
      missingProducts.forEach((p) => {
        next[p.id] = qty;
      });
      return next;
    });
  };

  // Handle "Add in" button click
  const handleAddProduct = async (product: ShopifyMissingProduct) => {
    const prodId = product.id;
    if (addingMap[prodId]) return;

    setAddingMap((prev) => ({ ...prev, [prodId]: true }));
    setErrorMsg(null);

    const enteredQty = parseInt(quantities[prodId] || '0', 10) || 0;

    try {
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            title: product.title,
            handle: product.handle,
            description: product.description,
            image_url: product.image_url,
            price: product.price,
            variants: product.variants.map((v) => ({
              title: v.title,
              price: v.price,
              sku: v.sku,
              stock_quantity: enteredQty,
            })),
          },
          quantity: enteredQty,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add product to catalog.');
      }

      // Show success animation on the card
      setSuccessMap((prev) => ({ ...prev, [prodId]: true }));

      // Refresh admin inventory in the background
      onProductAdded();

      // Remove from missing list after brief visual feedback
      setTimeout(() => {
        setMissingProducts((prev) => prev.filter((p) => p.id !== prodId));
        setSyncedCount((prev) => prev + 1);
        setAddingMap((prev) => {
          const next = { ...prev };
          delete next[prodId];
          return next;
        });
        setSuccessMap((prev) => {
          const next = { ...prev };
          delete next[prodId];
          return next;
        });
      }, 500);
    } catch (err: any) {
      setErrorMsg(`Failed to add "${product.title}": ${err.message}`);
      setAddingMap((prev) => ({ ...prev, [prodId]: false }));
    }
  };

  // Filter missing products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return missingProducts;
    const q = searchQuery.toLowerCase().trim();
    return missingProducts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.handle && p.handle.toLowerCase().includes(q)) ||
        p.variants.some((v) => v.sku && v.sku.toLowerCase().includes(q))
    );
  }, [missingProducts, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopify-sync-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="shopify-sync-title" className="text-base font-black text-slate-900">
                  Sync with Shopify
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Shopify Catalog
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Import missing products from Shopify into Boyon OMS without pulling Shopify stock.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={fetchMissingProducts}
              disabled={loading}
              title="Rescan Shopify catalog"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Summary Pills */}
        <div className="px-5 py-3 bg-slate-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-medium shadow-2xs">
              <Boxes className="w-3.5 h-3.5 text-slate-400" />
              <span>Shopify Store:</span>
              <strong className="text-slate-900 font-mono">{totalShopify}</strong>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>In App Catalog:</span>
              <strong className="text-emerald-900 font-mono">{syncedCount}</strong>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200/80 text-xs text-orange-800 font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
              <span>Missing in App:</span>
              <strong className="text-orange-950 font-mono">{missingProducts.length}</strong>
            </div>
          </div>

          {/* Quick Bulk Qty Input */}
          {missingProducts.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Set all qty:</span>
              <input
                type="text"
                placeholder="10"
                value={bulkQtyValue}
                onChange={(e) => setBulkQtyValue(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-14 px-2 py-1 text-xs text-center font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={handleApplyBulkQty}
                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="px-5 py-2.5 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search missing Shopify products…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-semibold p-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <div>
                <p className="text-sm font-bold text-slate-800">Scanning Shopify Catalog…</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparing active Shopify products against your local database inventory
                </p>
              </div>
            </div>
          ) : missingProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-emerald-50/40 border border-emerald-100 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">All Products In Sync!</h4>
                <p className="text-xs text-slate-600 max-w-md mt-1">
                  All {totalShopify} products from your Shopify store are currently present in your Boyon OMS catalog.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                Done
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold">No products match &ldquo;{searchQuery}&rdquo;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-orange-600 hover:underline font-medium"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredProducts.map((product) => {
                const prodId = product.id;
                const isAdding = addingMap[prodId] || false;
                const isSuccess = successMap[prodId] || false;
                const qtyVal = quantities[prodId] ?? '0';

                return (
                  <div
                    key={prodId}
                    className={`bg-white border rounded-2xl p-3 sm:p-3.5 transition-colors shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isSuccess
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Product Thumbnail & Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-200/80 shrink-0 bg-slate-50"
                        />
                      ) : (
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                          {product.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-emerald-700 font-mono">
                            ৳{product.price > 0 ? product.price.toLocaleString() : '0.00'}
                          </span>
                          <span className="text-slate-300">&middot;</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {product.variants.length > 1
                              ? `${product.variants.length} variants`
                              : (product.variants[0]?.title && product.variants[0]?.title !== 'Default Title'
                                  ? product.variants[0].title
                                  : 'Single variant')}
                          </span>
                          {product.variants[0]?.sku && (
                            <>
                              <span className="text-slate-300">&middot;</span>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                SKU: {product.variants[0].sku}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quantity Box and "Add in" Button */}
                    <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Quantity input box */}
                      <div className="flex items-center gap-1.5">
                        <label
                          htmlFor={`qty-${prodId}`}
                          className="text-[11px] font-semibold text-slate-500"
                        >
                          Stock:
                        </label>
                        <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20">
                          <button
                            type="button"
                            onClick={() => handleStepQuantity(prodId, -5)}
                            disabled={isAdding || isSuccess}
                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold transition-colors disabled:opacity-50"
                            title="Decrease by 5"
                          >
                            -
                          </button>
                          <input
                            id={`qty-${prodId}`}
                            type="text"
                            inputMode="numeric"
                            value={qtyVal}
                            disabled={isAdding || isSuccess}
                            onChange={(e) => handleQuantityChange(prodId, e.target.value)}
                            className="w-12 py-1.5 text-center text-xs font-mono font-bold text-slate-900 bg-white border-x border-slate-200 focus:outline-none"
                            placeholder="0"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepQuantity(prodId, 5)}
                            disabled={isAdding || isSuccess}
                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold transition-colors disabled:opacity-50"
                            title="Increase by 5"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Add in Button */}
                      <button
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        disabled={isAdding || isSuccess}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-2xs min-w-[85px] active:scale-95 disabled:opacity-50 ${
                          isSuccess
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Adding…</span>
                          </>
                        ) : isSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Added!</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add in</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Stock quantities set here remain strictly local to Boyon OMS.</span>
          </p>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
