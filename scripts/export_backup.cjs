const fs = require('fs');
const path = require('path');

const OLD_URL = 'https://izqyqvmakdlwflryzspn.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cXlxdm1ha2Rsd2Zscnl6c3BuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTcyNTg4MiwiZXhwIjoyMTA1MzAxODgyfQ.4-29OApCi9m-yOVK5rdHvp2YkEdYrnAWgI4VsZVzshQ';

async function main() {
  console.log('🚀 Starting Full Database Export from Sydney (izqyqvmakdlwflryzspn)...');

  // 1. Fetch Auth Users
  console.log('Fetching auth users...');
  const usersRes = await fetch(`${OLD_URL}/auth/v1/admin/users`, {
    headers: {
      apikey: OLD_KEY,
      Authorization: `Bearer ${OLD_KEY}`,
    },
  });
  const usersData = await usersRes.json();
  const users = usersData.users || [];
  console.log(`✓ Fetched ${users.length} auth users.`);

  // 2. Fetch Public Tables
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

  const backupData = {
    exported_at: new Date().toISOString(),
    source_project: OLD_URL,
    users,
    tables: {},
  };

  for (const table of tables) {
    console.log(`Fetching table: ${table}...`);
    const res = await fetch(`${OLD_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: OLD_KEY,
        Authorization: `Bearer ${OLD_KEY}`,
        'Range-Unit': 'items',
        Range: '0-10000',
      },
    });
    if (!res.ok) {
      console.error(`Failed to fetch ${table}:`, res.status, res.statusText);
      backupData.tables[table] = [];
      continue;
    }
    const rows = await res.json();
    backupData.tables[table] = rows;
    console.log(`✓ ${table}: ${rows.length} rows`);
  }

  // Save JSON backup
  const jsonPath = path.join(__dirname, '..', 'dashboard', 'supabase', 'backup_data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2));
  console.log(`\n💾 Full JSON backup saved to: ${jsonPath}`);

  // 3. Generate Complete Migration SQL file (Schema + Data)
  const schemaPath = path.join(__dirname, '..', 'dashboard', 'supabase', 'schema.sql');
  let baseSchema = '';
  if (fs.existsSync(schemaPath)) {
    baseSchema = fs.readFileSync(schemaPath, 'utf8');
  }

  // Helper to format values for SQL INSERT
  function sqlVal(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return v;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  let sql = `-- ==============================================================================
-- COMPLETE SUPABASE MIGRATION (SINGAPORE ap-southeast-1)
-- Generated on: ${new Date().toISOString()}
-- Source: ${OLD_URL} (Oceania Sydney) -> Target: Singapore
-- ==============================================================================

-- STEP 1: Enable Necessary Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

${baseSchema}

-- STEP 2: Restore Migrations (Extra columns and triggers)
DO $$
BEGIN
  -- add_delivery_charge
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_charge') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_charge NUMERIC(10, 2) DEFAULT 0.00;
  END IF;

  -- add_steadfast_courier_fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='courier_name') THEN
    ALTER TABLE public.orders ADD COLUMN courier_name TEXT DEFAULT 'Steadfast';
    ALTER TABLE public.orders ADD COLUMN consignment_id TEXT;
    ALTER TABLE public.orders ADD COLUMN tracking_code TEXT;
    ALTER TABLE public.orders ADD COLUMN tracking_message TEXT;
    ALTER TABLE public.orders ADD COLUMN courier_status TEXT;
    ALTER TABLE public.orders ADD COLUMN courier_updated_at TIMESTAMPTZ;
  END IF;

  -- add_order_discount_advance_noticeboard
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='discount_amount') THEN
    ALTER TABLE public.orders ADD COLUMN discount_amount NUMERIC(10, 2) DEFAULT 0.00;
    ALTER TABLE public.orders ADD COLUMN advance_payment NUMERIC(10, 2) DEFAULT 0.00;
  END IF;

  -- add_staff_online_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_online') THEN
    ALTER TABLE public.profiles ADD COLUMN is_online BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT now();
  END IF;

  -- add is_disabled to products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_disabled') THEN
    ALTER TABLE public.products ADD COLUMN is_disabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- STEP 3: Insert Live Data
-- Temporarily disable FK constraints for fast, safe import
SET session_replication_role = 'replica';

`;

  // Insert Auth Users placeholder if needed or direct profile inserts
  for (const table of tables) {
    const rows = backupData.tables[table] || [];
    if (rows.length === 0) continue;

    sql += `\n-- -----------------------------------------------------------------------------\n`;
    sql += `-- Table: ${table} (${rows.length} rows)\n`;
    sql += `-- -----------------------------------------------------------------------------\n`;

    // Process rows in batches of 50
    const colNames = Object.keys(rows[0]);
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const valuesList = batch
        .map((r) => `(${colNames.map((c) => sqlVal(r[c])).join(', ')})`)
        .join(',\n  ');

      sql += `INSERT INTO public.${table} (${colNames.map((c) => `"${c}"`).join(', ')})\nVALUES\n  ${valuesList}\nON CONFLICT DO NOTHING;\n`;
    }
  }

  sql += `\n-- Re-enable constraints\nSET session_replication_role = 'origin';\n\n-- MIGRATION COMPLETE!\n`;

  const sqlPath = path.join(__dirname, '..', 'dashboard', 'supabase', 'complete_migration_singapore.sql');
  fs.writeFileSync(sqlPath, sql);
  console.log(`📄 Complete Migration SQL file generated at: ${sqlPath}`);
  console.log('\n✅ All data and schema successfully prepared for Singapore migration!');
}

main().catch(console.error);
