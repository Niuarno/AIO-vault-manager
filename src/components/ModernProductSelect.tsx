'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Package, AlertCircle } from 'lucide-react';
import { ProductVariant } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

interface ModernProductSelectProps {
  variants: ProductVariant[];
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
  disabled?: boolean;
}

export default function ModernProductSelect({
  variants,
  selectedVariantId,
  onSelect,
  disabled = false,
}: ModernProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId);
  }, [variants, selectedVariantId]);

  const filteredVariants = useMemo(() => {
    if (!search.trim()) return variants;
    const q = search.toLowerCase();
    return variants.filter((v) => {
      const prodName = (v.product as any)?.name || (v.product as any)?.title || '';
      return (
        prodName.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        (v.sku && v.sku.toLowerCase().includes(q))
      );
    });
  }, [variants, search]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-sm transition-all shadow-2xs ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/10 bg-white'
            : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {selectedVariant ? (
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
              <Package className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <span className="font-semibold text-slate-800">
                {(selectedVariant.product as any)?.name || (selectedVariant.product as any)?.title || 'Product'}
              </span>
              <span className="text-slate-500 text-xs ml-1.5">
                ({selectedVariant.title})
              </span>
              <span className="font-semibold text-emerald-700 text-xs ml-2 font-mono">
                {formatCurrency(selectedVariant.price)}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-slate-400 text-sm">-- Choose item from live stock --</span>
        )}

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-600' : ''
          }`}
        />
      </button>

      {/* Modern Floating Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name, variant or SKU..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100/80 p-1">
            {filteredVariants.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching products found in stock.
              </div>
            ) : (
              filteredVariants.map((variant) => {
                const isSelected = variant.id === selectedVariantId;
                const isOutOfStock = variant.stock_quantity <= 0;
                const isLowStock = variant.stock_quantity <= 5 && !isOutOfStock;
                const prodName = (variant.product as any)?.name || (variant.product as any)?.title || 'Product';

                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => {
                      onSelect(variant.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-medium'
                        : isOutOfStock
                        ? 'opacity-40 cursor-not-allowed bg-slate-50/50'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5 truncate mr-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Package className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {prodName}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-medium text-slate-600">Variant: {variant.title}</span>
                          {variant.sku && (
                            <>
                              <span>&middot;</span>
                              <span className="font-mono text-slate-400">{variant.sku}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="font-bold text-xs text-slate-900 font-mono">
                        {formatCurrency(variant.price)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isOutOfStock
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isLowStock
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {variant.stock_quantity} in stock
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 ml-1" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
