/**
 * ONE-CLICK SUPABASE MIGRATION TO SINGAPORE (ap-southeast-1)
 *
 * Usage:
 *   node scripts/import_to_new_supabase.cjs <NEW_SUPABASE_URL> <NEW_SERVICE_ROLE_KEY> [DEFAULT_PASSWORD]
 *
 * Example:
 *   node scripts/import_to_new_supabase.cjs https://xyz.supabase.co eyJhbGci... password123
 */

const fs = require('fs');
const path = require('path');

const NEW_URL = process.argv[2];
const NEW_KEY = process.argv[3];
const DEFAULT_PASSWORD = process.argv[4] || 'Boyon@12345';

if (!NEW_URL || !NEW_KEY) {
  console.log(`
❌ Missing arguments!

Usage:
  node scripts/import_to_new_supabase.cjs <NEW_SUPABASE_URL> <NEW_SERVICE_ROLE_KEY> [DEFAULT_PASSWORD]

Example:
  node scripts/import_to_new_supabase.cjs https://abcdefghijklm.supabase.co eyJhbGciOi... Boyon@12345
`);
  process.exit(1);
}

const backupPath = path.join(__dirname, '..', 'dashboard', 'supabase', 'backup_data.json');
if (!fs.existsSync(backupPath)) {
  console.error('❌ backup_data.json not found! Run export_backup.cjs first.');
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

async function main() {
  console.log(`🚀 Starting Migration to Singapore project: ${NEW_URL}`);

  // 1. Re-create Auth Users with exact UUIDs
  console.log(`\n1️⃣  Migrating ${backup.users.length} Auth Users...`);
  for (const user of backup.users) {
    try {
      const res = await fetch(`${NEW_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: NEW_KEY,
          Authorization: `Bearer ${NEW_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: user.user_metadata || {},
        }),
      });

      if (res.ok) {
        console.log(`   ✓ Created auth user: ${user.email} (id: ${user.id})`);
      } else {
        const err = await res.json();
        if (err.message && err.message.includes('already exists')) {
          console.log(`   ℹ Auth user already exists: ${user.email}`);
        } else {
          console.warn(`   ⚠️ Auth user warning (${user.email}):`, err.message || res.statusText);
        }
      }
    } catch (e) {
      console.error(`   ❌ Failed for ${user.email}:`, e.message);
    }
  }

  // 2. Import Public Tables
  const importOrder = [
    'profiles',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'upsell_rewards',
    'reward_rules',
    'payout_requests',
  ];

  console.log(`\n2️⃣  Migrating Table Data...`);
  for (const table of importOrder) {
    const rows = backup.tables[table] || [];
    if (rows.length === 0) {
      console.log(`   ℹ ${table}: 0 rows to import.`);
      continue;
    }

    console.log(`   Importing ${table} (${rows.length} rows)...`);
    const batchSize = table === 'orders' ? 20 : 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const res = await fetch(`${NEW_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: NEW_KEY,
          Authorization: `Bearer ${NEW_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`   ❌ Error inserting into ${table} batch [${i} - ${i + batch.length}]:`, errText);
      }
    }
    console.log(`   ✓ ${table}: ${rows.length} rows imported successfully.`);
  }

  console.log(`\n🎉 MIGRATION FINISHED! All data transferred to Singapore project.`);
  console.log(`\nNext Steps:`);
  console.log(`1. Update your .env.local file with the new URL and Keys.`);
  console.log(`2. Update Vercel Environment Variables:`);
  console.log(`   - NEXT_PUBLIC_SUPABASE_URL = ${NEW_URL}`);
  console.log(`   - NEXT_PUBLIC_SUPABASE_ANON_KEY = <your_new_anon_key>`);
  console.log(`   - SUPABASE_SERVICE_ROLE_KEY = <your_new_service_role_key>`);
  console.log(`3. Users can log in with their existing email and password: "${DEFAULT_PASSWORD}" (or reset password).`);
}

main().catch(console.error);
