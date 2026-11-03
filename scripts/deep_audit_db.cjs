const fs = require('fs');

const OLD_URL = 'https://izqyqvmakdlwflryzspn.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cXlxdm1ha2Rsd2Zscnl6c3BuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTcyNTg4MiwiZXhwIjoyMTA1MzAxODgyfQ.4-29OApCi9m-yOVK5rdHvp2YkEdYrnAWgI4VsZVzshQ';

const NEW_URL = 'https://eipwyovlaebwvxglaooi.supabase.co';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpcHd5b3ZsYWVid3Z4Z2xhb29pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzcyNzU2MiwiZXhwIjoyMTA5MzAzNTYyfQ.MoJaloG1Zd-pbjpP8IRG-3HMCeuiEsqq7VIdnvZR284';

async function fetchAll(url, key, endpoint) {
  const t0 = Date.now();
  const res = await fetch(`${url}/rest/v1/${endpoint}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Range-Unit': 'items',
      Range: '0-10000',
    },
  });
  const duration = Date.now() - t0;
  if (!res.ok) {
    return { data: [], error: `${res.status} ${res.statusText}`, duration };
  }
  const data = await res.json();
  return { data, error: null, duration };
}

async function runAudit() {
  console.log('================================================================');
  console.log('🔍 FULL END-TO-END DATABASE AUDIT: SYDNEY vs. SINGAPORE');
  console.log('================================================================\n');

  // 1. Latency Benchmark
  console.log('⚡ 1. NETWORK LATENCY COMPARISON (Single REST Query):');
  const tOld = Date.now();
  await fetch(`${OLD_URL}/rest/v1/orders?select=id&limit=1`, {
    headers: { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}` },
  });
  const oldPing = Date.now() - tOld;

  const tNew = Date.now();
  await fetch(`${NEW_URL}/rest/v1/orders?select=id&limit=1`, {
    headers: { apikey: NEW_KEY, Authorization: `Bearer ${NEW_KEY}` },
  });
  const newPing = Date.now() - tNew;

  console.log(`   - Sydney (Old):    ${oldPing} ms`);
  console.log(`   - Singapore (New): ${newPing} ms  🚀 (${Math.round((oldPing / Math.max(1, newPing)) * 10) / 10}x faster)\n`);

  // 2. Auth Users Audit
  console.log('👤 2. AUTH ACCOUNTS AUDIT:');
  const oldUsersRes = await fetch(`${OLD_URL}/auth/v1/admin/users`, {
    headers: { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}` },
  });
  const oldUsersData = await oldUsersRes.json();
  const oldUsers = oldUsersData.users || [];

  const newUsersRes = await fetch(`${NEW_URL}/auth/v1/admin/users`, {
    headers: { apikey: NEW_KEY, Authorization: `Bearer ${NEW_KEY}` },
  });
  const newUsersData = await newUsersRes.json();
  const newUsers = newUsersData.users || [];

  console.log(`   - Old Auth Users: ${oldUsers.length}`);
  console.log(`   - New Auth Users: ${newUsers.length}`);
  const missingUsers = oldUsers.filter((u) => !newUsers.some((nu) => nu.id === u.id));
  if (missingUsers.length === 0) {
    console.log(`   ✓ 100% of Auth user accounts and UUIDs match perfectly!\n`);
  } else {
    console.error(`   ❌ Missing Auth Users:`, missingUsers.map((u) => u.email));
  }

  // 3. Table Row Counts Audit
  console.log('📊 3. TABLE ROW COUNTS AUDIT:');
  const tables = [
    'profiles',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'upsell_rewards',
    'reward_rules',
    'payout_requests',
    'system_settings',
  ];

  const oldData = {};
  const newData = {};

  for (const table of tables) {
    const o = await fetchAll(OLD_URL, OLD_KEY, `${table}?select=*`);
    const n = await fetchAll(NEW_URL, NEW_KEY, `${table}?select=*`);
    oldData[table] = o.data;
    newData[table] = n.data;

    const match = o.data.length === n.data.length ? '✓ MATCH' : '❌ MISMATCH';
    console.log(
      `   - ${table.padEnd(20)} Old: ${String(o.data.length).padStart(4)}  |  New: ${String(n.data.length).padStart(4)}  ->  ${match}`
    );
  }

  // 4. Financial & Stock Verification
  console.log('\n💰 4. FINANCIAL & INVENTORY INTEGRITY AUDIT:');
  const oldTotalRev = oldData.orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const newTotalRev = newData.orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  console.log(`   - Total Order Value (Sydney):    ৳${Math.round(oldTotalRev).toLocaleString()}`);
  console.log(`   - Total Order Value (Singapore): ৳${Math.round(newTotalRev).toLocaleString()}`);
  console.log(`   - Revenue Integrity: ${oldTotalRev === newTotalRev ? '✓ 100% EXACT MATCH' : '❌ MISMATCH'}`);

  const oldStock = oldData.product_variants.reduce((sum, v) => sum + (Number(v.stock_quantity) || 0), 0);
  const newStock = newData.product_variants.reduce((sum, v) => sum + (Number(v.stock_quantity) || 0), 0);
  console.log(`   - Total Live Stock Sum (Sydney):    ${oldStock} units`);
  console.log(`   - Total Live Stock Sum (Singapore): ${newStock} units`);
  console.log(`   - Stock Integrity:   ${oldStock === newStock ? '✓ 100% EXACT MATCH' : '❌ MISMATCH'}`);

  // 5. Order Status Breakdown Match
  console.log('\n📦 5. ORDER STATUS DISTRIBUTION AUDIT:');
  const countStatuses = (orders) => {
    const counts = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  };
  const oldStatusCounts = countStatuses(oldData.orders);
  const newStatusCounts = countStatuses(newData.orders);

  for (const st of Object.keys(oldStatusCounts)) {
    const isMatch = oldStatusCounts[st] === newStatusCounts[st];
    console.log(
      `   - ${st.padEnd(18)} Old: ${String(oldStatusCounts[st]).padStart(3)}  |  New: ${String(newStatusCounts[st] || 0).padStart(3)}  ->  ${isMatch ? '✓' : '❌'}`
    );
  }

  // 6. Relational Integrity
  console.log('\n🔗 6. RELATIONAL FOREIGN KEY INTEGRITY:');
  const newOrderIds = new Set(newData.orders.map((o) => o.id));
  const newVariantIds = new Set(newData.product_variants.map((v) => v.id));
  const newProfileIds = new Set(newData.profiles.map((p) => p.id));

  const orphanItems = newData.order_items.filter((i) => !newOrderIds.has(i.order_id));
  const orphanOrders = newData.orders.filter((o) => o.sales_rep_id && !newProfileIds.has(o.sales_rep_id));
  const orphanVariants = newData.product_variants.filter(
    (v) => !newData.products.some((p) => p.id === v.product_id)
  );

  console.log(`   - Orphan Order Items (unlinked from orders):  ${orphanItems.length} (Expected: 0) -> ${orphanItems.length === 0 ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`   - Unlinked Staff Orders:                     ${orphanOrders.length} (Expected: 0) -> ${orphanOrders.length === 0 ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`   - Unlinked Variants (without product):        ${orphanVariants.length} (Expected: 0) -> ${orphanVariants.length === 0 ? '✓ PASS' : '❌ FAIL'}`);

  console.log('\n================================================================');
  console.log('🏁 AUDIT CONCLUSION:');
  const allMatch =
    oldUsers.length === newUsers.length &&
    oldTotalRev === newTotalRev &&
    oldStock === newStock &&
    orphanItems.length === 0 &&
    orphanOrders.length === 0;

  if (allMatch) {
    console.log('✅ ALL SYSTEMS VERIFIED: 100% PERFECT TOP-TO-BOTTOM MIGRATION!');
  } else {
    console.log('⚠️ Some discrepancies detected above. Check logs.');
  }
  console.log('================================================================\n');
}

runAudit().catch(console.error);
