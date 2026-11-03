/**
 * Import Order Items to Singapore Supabase
 */
const fs = require('fs');
const path = require('path');

const NEW_URL = 'https://eipwyovlaebwvxglaooi.supabase.co';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpcHd5b3ZsYWVid3Z4Z2xhb29pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzcyNzU2MiwiZXhwIjoyMTA5MzAzNTYyfQ.MoJaloG1Zd-pbjpP8IRG-3HMCeuiEsqq7VIdnvZR284';

const backupPath = path.join(__dirname, '..', 'dashboard', 'supabase', 'backup_data.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

async function importOrderItems() {
  const items = backup.tables.order_items || [];
  console.log(`🚀 Importing ${items.length} order items...`);

  const batchSize = 50;
  let successCount = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const res = await fetch(`${NEW_URL}/rest/v1/order_items`, {
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
      console.error(`❌ Batch [${i} - ${i + batch.length}]:`, errText);
      return;
    } else {
      successCount += batch.length;
      console.log(`✓ Imported ${successCount} / ${items.length} items`);
    }
  }

  console.log(`\n🎉 ALL ${successCount} ORDER ITEMS IMPORTED SUCCESSFULLY!`);
}

importOrderItems().catch(console.error);
