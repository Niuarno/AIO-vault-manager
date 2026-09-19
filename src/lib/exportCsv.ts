import { Profile, Order, UpsellReward } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface ExportReportOptions {
  staffMember: Profile;
  periodType: 'monthly' | 'yearly';
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  orders: Order[];
  rewards: UpsellReward[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Escapes a string field for standard RFC 4180 CSV
 */
function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates and triggers download of a detailed staff performance report in CSV format
 */
export function exportStaffReportCsv({
  staffMember,
  periodType,
  year,
  month,
  orders,
  rewards,
}: ExportReportOptions) {
  const staffId = staffMember.id;
  const staffCode = staffMember.coupon_code?.trim().toUpperCase();

  // 1. Determine Date Filter Range
  let startDate: Date;
  let endDate: Date;
  let periodLabel: string;

  if (periodType === 'monthly') {
    startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0).getDate();
    endDate = new Date(year, month, lastDay, 23, 59, 59, 999);
    periodLabel = `${MONTH_NAMES[month]} ${year}`;
  } else {
    startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    periodLabel = `Full Year ${year}`;
  }

  // 2. Filter Orders for this staff member in this date range
  const filteredOrders = orders.filter((o) => {
    const orderDate = new Date(o.created_at);
    if (orderDate < startDate || orderDate > endDate) return false;

    // Must be attributed to this staff member
    const isRep = o.sales_rep_id === staffId;
    const isCoupon = staffCode && o.coupon_used?.trim().toUpperCase() === staffCode;
    return Boolean(isRep || isCoupon);
  });

  // Sort chronologically ascending
  filteredOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // 3. Map rewards by order_id
  const rewardsByOrder: Record<string, number> = {};
  rewards.forEach((r) => {
    if (r.sales_rep_id === staffId && r.order_id) {
      rewardsByOrder[r.order_id] = (rewardsByOrder[r.order_id] || 0) + Number(r.bonus_amount || 0);
    }
  });

  // Calculate Aggregates
  let totalSales = 0;
  let totalUpsellSales = 0;
  let totalCommissions = 0;
  let totalDeliveryCharges = 0;

  // 4. Build CSV Rows
  const csvLines: string[] = [];

  // Report Header Metadata
  csvLines.push(`"STAFF PERFORMANCE & ATTRIBUTION REPORT"`);
  csvLines.push(`"Staff Name:",${escapeCsvField(staffMember.full_name || 'Staff Member')}`);
  csvLines.push(`"Email:",${escapeCsvField(staffMember.email)}`);
  csvLines.push(`"Role:",${escapeCsvField(staffMember.role)}`);
  csvLines.push(`"Coupon Code:",${escapeCsvField(staffMember.coupon_code || 'N/A')}`);
  csvLines.push(`"Report Period:",${escapeCsvField(periodLabel)}`);
  csvLines.push(`"Generated On:",${escapeCsvField(new Date().toLocaleString())}`);
  csvLines.push(''); // Blank line

  // Column Headers
  const headers = [
    'Date & Time',
    'Order #',
    'Customer Name',
    'Customer Phone',
    'Delivery Address',
    'Order Source',
    'Delivery Charge (BDT)',
    'Items Subtotal (BDT)',
    'Order Grand Total (BDT)',
    'Website Upsell (BDT)',
    'Reachout Sell?',
    'Commission Earned (BDT)',
    'Order Status',
    'Payment Method',
  ];
  csvLines.push(headers.map(escapeCsvField).join(','));

  // Detail Rows
  filteredOrders.forEach((o) => {
    const orderItems = o.order_items || [];
    const deliveryFee = Number(o.delivery_charge || 0);
    const grandTotal = Number(o.total_amount || 0);
    const itemsSubtotal = Math.max(0, grandTotal - deliveryFee);

    // Calculate website upsells & reachout flag
    let upsellTotal = 0;
    let isReachout = false;
    orderItems.forEach((item: any) => {
      if (item.is_upsell && o.source === 'website') {
        upsellTotal += Number(item.price || 0) * Number(item.quantity || 1);
      }
      if (item.is_reachout) {
        isReachout = true;
      }
    });

    const commission = rewardsByOrder[o.id] || 0;

    // Accumulate
    totalSales += grandTotal;
    totalUpsellSales += upsellTotal;
    totalCommissions += commission;
    totalDeliveryCharges += deliveryFee;

    const row = [
      formatDate(o.created_at),
      o.order_number,
      o.customer_name,
      o.customer_phone,
      o.shipping_address || '',
      o.source.toUpperCase(),
      deliveryFee.toFixed(2),
      itemsSubtotal.toFixed(2),
      grandTotal.toFixed(2),
      upsellTotal.toFixed(2),
      isReachout ? 'YES' : 'NO',
      commission.toFixed(2),
      o.status.replace(/_/g, ' ').toUpperCase(),
      o.payment_method || 'COD',
    ];
    csvLines.push(row.map(escapeCsvField).join(','));
  });

  csvLines.push(''); // Blank line

  // Summary Row
  csvLines.push(`"SUMMARY TOTALS"`);
  csvLines.push(`"Total Orders Closed:",${escapeCsvField(filteredOrders.length)}`);
  csvLines.push(`"Total Sales Volume (BDT):",${escapeCsvField(totalSales.toFixed(2))}`);
  csvLines.push(`"Total Delivery Collected (BDT):",${escapeCsvField(totalDeliveryCharges.toFixed(2))}`);
  csvLines.push(`"Total Website Upsell Value (BDT):",${escapeCsvField(totalUpsellSales.toFixed(2))}`);
  csvLines.push(`"Total Staff Commission Earned (BDT):",${escapeCsvField(totalCommissions.toFixed(2))}`);

  // 5. Download via Blob with UTF-8 BOM
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanName = (staffMember.full_name || 'Staff').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Report_${cleanName}_${cleanPeriod}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
