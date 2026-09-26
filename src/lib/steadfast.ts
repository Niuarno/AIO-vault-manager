export interface SteadfastCreateOrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  recipient_email?: string;
  alternative_phone?: string;
  item_description?: string;
  total_lot?: number; // default 1
  delivery_type?: number; // 0 = home delivery, 1 = hub pickup
}

export interface SteadfastConsignmentResponse {
  status: number;
  message: string;
  consignment?: {
    id: number | string;
    consignment_id?: number | string;
    invoice: string;
    tracking_code: string;
    status: string;
    recipient_name?: string;
    recipient_phone?: string;
    recipient_address?: string;
    cod_amount?: number;
    created_at?: string;
  };
  errors?: Record<string, string[]>;
}

export interface SteadfastStatusResponse {
  status: number;
  delivery_status?: string;
  consignment_id?: number | string;
  invoice?: string;
  tracking_code?: string;
  message?: string;
}

export interface SteadfastBalanceResponse {
  status: number;
  current_balance?: number;
  message?: string;
}

/**
 * Normalizes any Bangladeshi phone number to exact 11 digits: '01XXXXXXXXX'
 */
export function normalizeBdPhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  // e.g. 88017... -> 017...
  if (digits.startsWith('880')) {
    digits = digits.slice(2);
  }
  // e.g. 17... (10 digits) -> 017...
  if (digits.length === 10 && digits.startsWith('1')) {
    digits = '0' + digits;
  }
  // If > 11 digits, extract the last 11 digits
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }
  return digits;
}

/**
 * Generates public tracking link for Steadfast Courier
 */
export function getSteadfastTrackingUrl(trackingCode?: string | null): string | null {
  if (!trackingCode) return null;
  const cleanCode = trackingCode.trim();
  if (!cleanCode) return null;
  return `https://steadfast.com.bd/t/${encodeURIComponent(cleanCode)}`;
}

/**
 * Classifies a Steadfast delivery status into state category and display label
 */
export function parseSteadfastStatus(rawStatus?: string | null): {
  key: string;
  label: string;
  isDeliveredFinal: boolean;
  isCancelledFinal: boolean;
  isApprovalPending: boolean;
  badgeClass: string;
} {
  const s = String(rawStatus || '').toLowerCase().trim();
  switch (s) {
    case 'delivered':
      return {
        key: 'delivered',
        label: 'Delivered',
        isDeliveredFinal: true,
        isCancelledFinal: false,
        isApprovalPending: false,
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    case 'delivered_approval_pending':
      return {
        key: 'delivered_approval_pending',
        label: 'Delivered (Awaiting Approval)',
        isDeliveredFinal: false,
        isCancelledFinal: false,
        isApprovalPending: true,
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
      };
    case 'partial_delivered':
      return {
        key: 'partial_delivered',
        label: 'Partially Delivered',
        isDeliveredFinal: true,
        isCancelledFinal: false,
        isApprovalPending: false,
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      };
    case 'partial_delivered_approval_pending':
      return {
        key: 'partial_delivered_approval_pending',
        label: 'Partial Delivery (Awaiting Approval)',
        isDeliveredFinal: false,
        isCancelledFinal: false,
        isApprovalPending: true,
        badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      };
    case 'cancelled':
      return {
        key: 'cancelled',
        label: 'Cancelled / Returned',
        isDeliveredFinal: false,
        isCancelledFinal: true,
        isApprovalPending: false,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      };
    case 'cancelled_approval_pending':
      return {
        key: 'cancelled_approval_pending',
        label: 'Return (Awaiting Approval)',
        isDeliveredFinal: false,
        isCancelledFinal: false,
        isApprovalPending: true,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'hold':
      return {
        key: 'hold',
        label: 'On Hold',
        isDeliveredFinal: false,
        isCancelledFinal: false,
        isApprovalPending: false,
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      };
    case 'in_review':
      return {
        key: 'in_review',
        label: 'In Review',
        isDeliveredFinal: false,
        isCancelledFinal: false,
        isApprovalPending: false,
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      };
    case 'pending':
    default:
      return {
        key: s || 'pending',
        label: s ? s.replace(/_/g, ' ') : 'In Transit',
        isDeliveredFinal: false,
        isCancelledFinal: false,
        isApprovalPending: false,
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      };
  }
}

/**
 * Steadfast Courier API base URL.
 * Official production gateway is hosted on portal.packzy.com.
 */
export function getSteadfastBaseUrl(): string {
  let url = process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';
  if (url.includes('portal.steadfast.com.bd')) {
    url = url.replace('portal.steadfast.com.bd', 'portal.packzy.com');
  }
  return url.replace(/\/+$/, '');
}

/**
 * Get credentials from environment variables, accommodating possible spaces or underscores.
 */
export function getSteadfastCredentials(): { apiKey: string; secretKey: string } {
  const env = process.env as Record<string, string | undefined>;
  const apiKey =
    env.STEADFAST_API_KEY ||
    env['STEADFAST API KEY'] ||
    env.STEADFAST_APIKEY ||
    '';
  const secretKey =
    env.STEADFAST_SECRET_KEY ||
    env['STEADFAST SECRET KEY'] ||
    env.STEADFAST_SECRETKEY ||
    '';
  return { apiKey: apiKey.trim(), secretKey: secretKey.trim() };
}

export function isSteadfastConfigured(): boolean {
  const { apiKey, secretKey } = getSteadfastCredentials();
  return Boolean(apiKey && secretKey);
}

/**
 * Creates a consignment in Steadfast Courier.
 */
export async function createSteadfastConsignment(
  payload: SteadfastCreateOrderPayload
): Promise<SteadfastConsignmentResponse> {
  const { apiKey, secretKey } = getSteadfastCredentials();

  if (!apiKey || !secretKey) {
    return {
      status: 400,
      message:
        'Steadfast credentials missing in environment: Please check STEADFAST_API_KEY and STEADFAST_SECRET_KEY in Vercel.',
    };
  }

  // Sanitize invoice: Steadfast only permits letters, numbers, hyphens, and underscores (no '#' or special characters)
  const cleanInvoice =
    payload.invoice.replace(/^[#\s]+/, '').replace(/[^a-zA-Z0-9_-]/g, '') ||
    `ORD-${Date.now()}`;

  // Sanitize phone: ensure only 11 digits starting with 01
  const cleanPhone = normalizeBdPhoneNumber(payload.recipient_phone);

  // Sanitize note: Steadfast strictly enforces max 400 characters
  let cleanNote = (payload.note || '').trim();
  cleanNote = cleanNote.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  if (cleanNote.length > 350) {
    cleanNote = cleanNote.slice(0, 350);
  }

  const baseUrl = getSteadfastBaseUrl();

  const requestBody: Record<string, any> = {
    invoice: cleanInvoice,
    recipient_name: (payload.recipient_name || 'Customer').trim(),
    recipient_phone: cleanPhone || payload.recipient_phone,
    recipient_address: (payload.recipient_address || 'Address not specified').trim(),
    cod_amount: Math.max(0, Math.round(Number(payload.cod_amount) || 0)),
    note: cleanNote,
    total_lot: payload.total_lot || 1,
    delivery_type: payload.delivery_type ?? 0,
  };

  if (payload.recipient_email?.trim()) {
    requestBody.recipient_email = payload.recipient_email.trim();
  }
  if (payload.alternative_phone?.trim()) {
    requestBody.alternative_phone = normalizeBdPhoneNumber(payload.alternative_phone);
  }
  if (payload.item_description?.trim()) {
    let cleanDesc = payload.item_description.trim();
    if (cleanDesc.length > 255) {
      let truncated = cleanDesc.slice(0, 252).trim();
      if (truncated.endsWith(',')) {
        truncated = truncated.slice(0, -1).trim();
      }
      cleanDesc = truncated + '...';
    }
    requestBody.item_description = cleanDesc;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${baseUrl}/create_order`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.toLowerCase().includes('unauthorized')) {
        return {
          status: 401,
          message:
            'Steadfast Authentication Failed: Invalid Api-Key or Secret-Key. Please verify credentials in your Steadfast merchant dashboard.',
        };
      }
      return {
        status: res.status,
        message: `Steadfast server responded with status ${res.status}: ${text.slice(0, 150)}`,
      };
    }

    return data;
  } catch (err: any) {
    console.error('[Steadfast API Error]', err);
    return {
      status: 502,
      message:
        err.name === 'AbortError'
          ? 'Steadfast Courier API request timed out (15s).'
          : `Failed to connect to Steadfast Courier API (${baseUrl}): ${err.message}`,
    };
  }
}

/**
 * Check delivery status from Steadfast by Invoice / Order Number
 */
export async function checkSteadfastStatusByInvoice(
  invoice: string
): Promise<SteadfastStatusResponse> {
  const { apiKey, secretKey } = getSteadfastCredentials();

  if (!apiKey || !secretKey) {
    return {
      status: 400,
      invoice,
      delivery_status: 'pending',
      message: 'Steadfast keys not configured in environment',
    };
  }

  const cleanInvoice = invoice.replace(/^[#\s]+/, '').replace(/[^a-zA-Z0-9_-]/g, '');
  const baseUrl = getSteadfastBaseUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${baseUrl}/status_by_invoice/${encodeURIComponent(cleanInvoice)}`,
      {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.toLowerCase().includes('unauthorized')) {
        return {
          status: 401,
          message: 'Steadfast Authentication Failed: Invalid Api-Key or Secret-Key.',
        };
      }
      return {
        status: res.status,
        message: `Steadfast status response (${res.status}): ${text.slice(0, 120)}`,
      };
    }

    return data;
  } catch (err: any) {
    console.error('[Steadfast Status by Invoice Error]', err);
    return {
      status: 502,
      message: `Failed to query Steadfast status: ${err.message}`,
    };
  }
}

/**
 * Check delivery status from Steadfast by Consignment ID (CID)
 */
export async function checkSteadfastStatusByCid(
  cid: string | number
): Promise<SteadfastStatusResponse> {
  const { apiKey, secretKey } = getSteadfastCredentials();

  if (!apiKey || !secretKey) {
    return {
      status: 400,
      consignment_id: cid,
      delivery_status: 'pending',
      message: 'Steadfast keys not configured in environment',
    };
  }

  const baseUrl = getSteadfastBaseUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${baseUrl}/status_by_cid/${encodeURIComponent(String(cid))}`,
      {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.toLowerCase().includes('unauthorized')) {
        return {
          status: 401,
          message: 'Steadfast Authentication Failed: Invalid Api-Key or Secret-Key.',
        };
      }
      return {
        status: res.status,
        message: `Steadfast status response (${res.status}): ${text.slice(0, 120)}`,
      };
    }

    return data;
  } catch (err: any) {
    console.error('[Steadfast Status by CID Error]', err);
    return {
      status: 502,
      message: `Failed to query Steadfast status: ${err.message}`,
    };
  }
}

/**
 * Check delivery status from Steadfast by Tracking Code
 */
export async function checkSteadfastStatusByTrackingCode(
  trackingCode: string
): Promise<SteadfastStatusResponse> {
  const { apiKey, secretKey } = getSteadfastCredentials();

  if (!apiKey || !secretKey) {
    return {
      status: 400,
      tracking_code: trackingCode,
      delivery_status: 'pending',
      message: 'Steadfast keys not configured in environment',
    };
  }

  const baseUrl = getSteadfastBaseUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${baseUrl}/status_by_trackingcode/${encodeURIComponent(trackingCode.trim())}`,
      {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.toLowerCase().includes('unauthorized')) {
        return {
          status: 401,
          message: 'Steadfast Authentication Failed: Invalid Api-Key or Secret-Key.',
        };
      }
      return {
        status: res.status,
        message: `Steadfast status response (${res.status}): ${text.slice(0, 120)}`,
      };
    }

    return data;
  } catch (err: any) {
    console.error('[Steadfast Status by Tracking Code Error]', err);
    return {
      status: 502,
      message: `Failed to query Steadfast status: ${err.message}`,
    };
  }
}

/**
 * Get account balance from Steadfast Courier
 */
export async function getSteadfastBalance(): Promise<SteadfastBalanceResponse> {
  const { apiKey, secretKey } = getSteadfastCredentials();

  if (!apiKey || !secretKey) {
    return {
      status: 400,
      message: 'Steadfast credentials not configured in environment',
    };
  }

  const baseUrl = getSteadfastBaseUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${baseUrl}/get_balance`, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        status: res.status,
        message: `Steadfast balance response (${res.status}): ${text.slice(0, 120)}`,
      };
    }

    return data;
  } catch (err: any) {
    console.error('[Steadfast Balance Error]', err);
    return {
      status: 502,
      message: `Failed to query Steadfast balance: ${err.message}`,
    };
  }
}
