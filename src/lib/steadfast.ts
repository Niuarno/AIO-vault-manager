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

const STEADFAST_BASE_URL =
  process.env.STEADFAST_BASE_URL || 'https://portal.steadfast.com.bd/api/v1';

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
      message: 'Consignment created (Simulated - configure STEADFAST_API_KEY in .env for live API)',
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

  const cleanPhone = payload.recipient_phone.replace(/\D/g, '').slice(-11);

  const res = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Secret-Key': secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      invoice: payload.invoice,
      recipient_name: payload.recipient_name,
      recipient_phone: cleanPhone || payload.recipient_phone,
      recipient_address: payload.recipient_address,
      cod_amount: Math.round(Number(payload.cod_amount) || 0),
      note: payload.note || '',
    }),
  });

  const data = await res.json();
  return data;
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

  const res = await fetch(
    `${STEADFAST_BASE_URL}/status_by_invoice/${encodeURIComponent(invoice)}`,
    {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await res.json();
  return data;
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

  const res = await fetch(
    `${STEADFAST_BASE_URL}/status_by_cid/${encodeURIComponent(String(cid))}`,
    {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await res.json();
  return data;
}
