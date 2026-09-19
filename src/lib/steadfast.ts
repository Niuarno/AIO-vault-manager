export interface SteadfastCreateOrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  alternative_phone?: string;
  item_description?: string;
}

export interface SteadfastConsignmentResponse {
  status: number;
  message: string;
  consignment?: {
    id: number | string;
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

/**
 * Steadfast Courier API base URL.
 * Official production gateway is hosted on portal.packzy.com.
 */
export function getSteadfastBaseUrl(): string {
  let url = process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';
  // If set to the legacy/non-existent portal.steadfast.com.bd domain, automatically resolve to portal.packzy.com
  if (url.includes('portal.steadfast.com.bd')) {
    url = url.replace('portal.steadfast.com.bd', 'portal.packzy.com');
  }
  return url.replace(/\/+$/, '');
}

export function isSteadfastConfigured(): boolean {
  return Boolean(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY);
}

/**
 * Creates a consignment in Steadfast Courier.
 * If credentials are not configured, provides a simulated success for staging/testing.
 */
export async function createSteadfastConsignment(
  payload: SteadfastCreateOrderPayload
): Promise<SteadfastConsignmentResponse> {
  const apiKey = process.env.STEADFAST_API_KEY;
  const secretKey = process.env.STEADFAST_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.warn(
      '[Steadfast] STEADFAST_API_KEY or STEADFAST_SECRET_KEY not found in environment. Generating local demo tracking code.'
    );
    const mockCid = Math.floor(100000 + Math.random() * 900000);
    const mockTracking = `STF${mockCid}`;
    return {
      status: 200,
      message: 'Consignment created (Simulated - set STEADFAST_API_KEY and STEADFAST_SECRET_KEY in Vercel for live Steadfast dispatch)',
      consignment: {
        id: mockCid,
        invoice: payload.invoice,
        tracking_code: mockTracking,
        status: 'in_review',
        recipient_name: payload.recipient_name,
        recipient_phone: payload.recipient_phone,
        recipient_address: payload.recipient_address,
        cod_amount: payload.cod_amount,
        created_at: new Date().toISOString(),
      },
    };
  }

  // Sanitize invoice: Steadfast only permits letters, numbers, hyphens, and underscores (no '#' or special characters)
  const cleanInvoice =
    payload.invoice.replace(/^[#\s]+/, '').replace(/[^a-zA-Z0-9_-]/g, '') ||
    `ORD-${Date.now()}`;

  // Sanitize phone: ensure only 11 digits
  const digits = payload.recipient_phone.replace(/\D/g, '');
  const cleanPhone = digits.length >= 11 ? digits.slice(-11) : digits;

  // Sanitize note: Steadfast strictly enforces max 400 characters and prefers clean delivery instructions
  let cleanNote = (payload.note || '').trim();
  // Strip internal audit tags like [Reachout Sale by ...] or [Steadfast ...] to keep note concise for delivery agents
  cleanNote = cleanNote.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  if (cleanNote.length > 350) {
    cleanNote = cleanNote.slice(0, 350);
  }

  const baseUrl = getSteadfastBaseUrl();

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
      body: JSON.stringify({
        invoice: cleanInvoice,
        recipient_name: payload.recipient_name || 'Customer',
        recipient_phone: cleanPhone || payload.recipient_phone,
        recipient_address: payload.recipient_address || 'Address not specified',
        cod_amount: Math.max(0, Math.round(Number(payload.cod_amount) || 0)),
        note: cleanNote,
      }),
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
  const apiKey = process.env.STEADFAST_API_KEY;
  const secretKey = process.env.STEADFAST_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return {
      status: 200,
      invoice,
      delivery_status: 'pending',
      message: 'Steadfast keys not configured in environment',
    };
  }

  const baseUrl = getSteadfastBaseUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${baseUrl}/status_by_invoice/${encodeURIComponent(invoice)}`,
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

    const data = await res.json();
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
  const apiKey = process.env.STEADFAST_API_KEY;
  const secretKey = process.env.STEADFAST_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return {
      status: 200,
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

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[Steadfast Status by CID Error]', err);
    return {
      status: 502,
      message: `Failed to query Steadfast status: ${err.message}`,
    };
  }
}
