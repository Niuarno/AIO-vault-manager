const NEW_URL = 'https://eipwyovlaebwvxglaooi.supabase.co/rest/v1';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpcHd5b3ZsYWVid3Z4Z2xhb29pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzcyNzU2MiwiZXhwIjoyMTA5MzAzNTYyfQ.MoJaloG1Zd-pbjpP8IRG-3HMCeuiEsqq7VIdnvZR284';

async function verify() {
  const tables = [
    'profiles',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'upsell_rewards',
    'reward_rules',
    'payout_requests',
  ];
  console.log('--- SINGAPORE DATABASE VERIFICATION ---');
  for (const t of tables) {
    const res = await fetch(`${NEW_URL}/${t}?select=*`, {
      method: 'HEAD',
      headers: {
        apikey: NEW_KEY,
        Authorization: `Bearer ${NEW_KEY}`,
        Prefer: 'count=exact',
      },
    });
    console.log(`${t.padEnd(20)}: ${res.headers.get('content-range') || res.status}`);
  }
}
verify();
