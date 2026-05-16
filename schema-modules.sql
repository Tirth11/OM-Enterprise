-- AUM Enterprise - Customer & Inventory Module Schema

CREATE TABLE IF NOT EXISTS category_master (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brand_master (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Seed default categories
INSERT INTO category_master(name) VALUES ('Welding Machine'),('Power Tools'),('Welding Rods'),('Welding Cables'),('Accessories') ON CONFLICT DO NOTHING;

-- Seed default brands
INSERT INTO brand_master(name) VALUES ('Esab'),('Ador'),('D&H Secheron'),('Bosch'),('Makita'),('Stanley') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  brand VARCHAR(100),
  current_quantity INT DEFAULT 0,
  purchase_price DECIMAL(10,2),
  selling_price DECIMAL(10,2),
  warranty_available BOOLEAN DEFAULT false,
  warranty_period VARCHAR(50),
  low_stock_quantity INT DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_product_history (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  product_id INT REFERENCES products(id),
  quantity INT NOT NULL DEFAULT 1,
  purchased_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  warranty_available BOOLEAN DEFAULT false,
  warranty_start_date DATE,
  warranty_end_date DATE,
  warranty_extended BOOLEAN DEFAULT false,
  extended_warranty_end_date DATE,
  warranty_extension_reason TEXT,
  selling_price_per_qty DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) DEFAULT 0,
  paid_via VARCHAR(30) DEFAULT '',
  payment_status VARCHAR(20) DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_stock_history (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id),
  vendor_name VARCHAR(100) NOT NULL,
  quantity_bought INT NOT NULL,
  bought_on DATE NOT NULL,
  purchase_price_per_unit DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_issues (
  id SERIAL PRIMARY KEY,
  customer_product_history_id INT REFERENCES customer_product_history(id),
  issue_date DATE NOT NULL,
  issue_description TEXT NOT NULL,
  warranty_status_at_issue VARCHAR(20),
  issue_status VARCHAR(30) DEFAULT 'Reported',
  fixed_datetime TIMESTAMP,
  fix_done_details TEXT,
  parts_replaced TEXT,
  charges_applicable BOOLEAN DEFAULT false,
  charge_reason TEXT,
  charge_amount DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) DEFAULT 0,
  payment_mode VARCHAR(20),
  payment_date DATE,
  returned_to_customer BOOLEAN DEFAULT false,
  returned_datetime TIMESTAMP,
  final_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id),
  transaction_type VARCHAR(50) NOT NULL,
  quantity_in INT DEFAULT 0,
  quantity_out INT DEFAULT 0,
  balance_after INT DEFAULT 0,
  purchase_price_per_qty DECIMAL(10,2),
  selling_price_per_qty DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  reference_type VARCHAR(50),
  reference_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warranty_audit_logs (
  id SERIAL PRIMARY KEY,
  customer_product_history_id INT REFERENCES customer_product_history(id),
  old_warranty_end DATE,
  new_warranty_end DATE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance Only Records
CREATE TABLE IF NOT EXISTS customer_maintenance (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  category VARCHAR(100),
  product_name VARCHAR(200),
  issue_description TEXT NOT NULL,
  issue_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issue_status VARCHAR(30) DEFAULT 'Reported',
  fixed_datetime TIMESTAMP,
  fix_done_details TEXT,
  charges_applicable BOOLEAN DEFAULT false,
  total_charges DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) DEFAULT 0,
  paid_via VARCHAR(30) DEFAULT '',
  payment_status VARCHAR(20) DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance Charge Rows
CREATE TABLE IF NOT EXISTS maintenance_charges (
  id SERIAL PRIMARY KEY,
  maintenance_id INT REFERENCES customer_maintenance(id) ON DELETE CASCADE,
  part_service_name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unified Customer Timeline
CREATE TABLE IF NOT EXISTS customer_timeline (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  entry_type VARCHAR(50) NOT NULL,
  reference_id INT,
  reference_type VARCHAR(50),
  event_type VARCHAR(100) NOT NULL,
  event_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
