import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OrderStatus, OrderSource } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined, currency = 'BDT') {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || '0');
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusBadgeInfo(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-400',
      };
    case 'confirmed':
      return {
        label: 'Confirmed',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'ready_to_ship':
      return {
        label: 'Ready to Ship',
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dot: 'bg-indigo-500',
      };
    case 'on_the_way':
      return {
        label: 'On the Way',
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        dot: 'bg-purple-500',
      };
    case 'shipped':
    case 'delivered':
      return {
        label: 'Shipped',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'canceled':
      return {
        label: 'Canceled',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

export function getSourceBadge(source: OrderSource) {
  switch (source) {
    case 'website':
      return { label: 'Shopify Web', color: 'bg-emerald-100 text-emerald-800' };
    case 'messenger':
      return { label: 'Messenger', color: 'bg-blue-100 text-blue-800' };
    case 'whatsapp':
      return { label: 'WhatsApp', color: 'bg-green-100 text-green-800' };
    case 'phone':
      return { label: 'Phone Call', color: 'bg-orange-100 text-orange-800' };
    case 'manual':
      return { label: 'Manual/Walk-in', color: 'bg-gray-100 text-gray-800' };
  }
}
