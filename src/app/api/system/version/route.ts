import { NextResponse } from 'next/server';
import { CURRENT_APP_VERSION } from '@/lib/version';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(CURRENT_APP_VERSION, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
