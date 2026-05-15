// Run: node migrate.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  // Category & Brand masters
  `CREATE TABLE IF NOT EXISTS category_master (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS brand_master (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
  `INSERT INTO category_master(name) VALUES ('Welding Machine'),('Power Tools'),('Welding Rods'),('Welding Cables'),('Accessories') ON CONFLICT DO NOTHING`,
  `INSERT INTO brand_master(name) VALUES ('Esab'),('Ador'),('D&H Secheron'),('Bosch'),('Makita'),('Stanley') ON CONFLICT DO NOTHING`,

  // Add new columns to customer_product_history
  `ALTER TABLE customer_product_history ADD COLUMN IF NOT EXISTS selling_price_per_qty DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE customer_product_history ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE customer_product_history ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE customer_product_history ADD COLUMN IF NOT EXISTS paid_via VARCHAR(30) DEFAULT ''`,

  // Add new columns to inventory_transactions
  `ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS purchase_price_per_qty DECIMAL(10,2)`,
  `ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS selling_price_per_qty DECIMAL(10,2)`,
  `ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2)`,

  // Change purchased_on to TIMESTAMP if it's DATE
  `ALTER TABLE customer_product_history ALTER COLUMN purchased_on TYPE TIMESTAMP USING purchased_on::TIMESTAMP`,
];

async function run() {
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log('✅', sql.substring(0, 60) + '...');
    } catch (e) {
      if (e.code === '42701') console.log('⏭️  Column already exists, skipping...');
      else console.log('⚠️', e.message);
    }
  }
  console.log('\n✅ Migration complete!');
  await pool.end();
}

run();
