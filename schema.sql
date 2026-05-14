-- Self Weld Industries - Database Schema
-- PostgreSQL 12+

-- Create database
-- createdb self_weld_industries

-- Admin Users Table
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'ADMIN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP
);

-- OTP Codes Table
CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) DEFAULT 'ADMIN_FORGOT_PASSWORD',
  expires_at TIMESTAMP NOT NULL,
  attempt_count INT DEFAULT 0,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Sessions Table
CREATE TABLE admin_sessions (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES admins(id) ON DELETE CASCADE NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50),
  record_id VARCHAR(50),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table (Phase 2)
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  alternate_phone VARCHAR(15),
  email VARCHAR(100),
  address TEXT,
  company_name VARCHAR(100),
  gst_number VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by_admin_id INT REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Products Table (Phase 2)
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  brand VARCHAR(100),
  sku VARCHAR(50) UNIQUE,
  hsn_code VARCHAR(20),
  cost_price DECIMAL(10, 2),
  selling_price DECIMAL(10, 2),
  gst_percentage DECIMAL(5, 2) DEFAULT 18.00,
  warranty_available BOOLEAN DEFAULT false,
  warranty_period_days INT,
  current_quantity INT DEFAULT 0,
  low_stock_quantity INT DEFAULT 10,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by_admin_id INT REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Product Stock Entries Table (Phase 2)
CREATE TABLE product_stock_entries (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) NOT NULL,
  quantity_added INT NOT NULL,
  cost_price_per_quantity DECIMAL(10, 2),
  selling_price_per_quantity DECIMAL(10, 2),
  supplier_name VARCHAR(100),
  supplier_invoice_number VARCHAR(50),
  purchase_date DATE,
  notes TEXT,
  created_by_admin_id INT REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Transactions Table (Phase 2)
CREATE TABLE inventory_transactions (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) NOT NULL,
  transaction_type VARCHAR(50),
  quantity_change INT,
  previous_quantity INT,
  new_quantity INT,
  linked_sale_id INT,
  linked_stock_entry_id INT,
  notes TEXT,
  created_by_admin_id INT REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Table (Phase 3)
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT REFERENCES customers(id),
  purchase_datetime TIMESTAMP NOT NULL,
  payment_mode VARCHAR(50),
  subtotal_amount DECIMAL(12, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  gst_amount DECIMAL(10, 2),
  cgst_amount DECIMAL(10, 2),
  sgst_amount DECIMAL(10, 2),
  total_amount DECIMAL(12, 2),
  paid_amount DECIMAL(12, 2),
  balance_amount DECIMAL(12, 2),
  notes TEXT,
  receipt_token VARCHAR(255),
  created_by_admin_id INT REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Sale Items Table (Phase 3)
CREATE TABLE sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  product_id INT REFERENCES products(id),
  product_name_snapshot VARCHAR(200),
  product_description_snapshot TEXT,
  quantity INT NOT NULL,
  price_per_quantity DECIMAL(10, 2),
  cost_price_per_quantity DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  gst_percentage DECIMAL(5, 2),
  gst_amount DECIMAL(10, 2),
  cgst_amount DECIMAL(10, 2),
  sgst_amount DECIMAL(10, 2),
  total_amount DECIMAL(12, 2),
  warranty_available BOOLEAN DEFAULT false,
  warranty_start_date DATE,
  warranty_end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Issues Table (Phase 4)
CREATE TABLE product_issues (
  id SERIAL PRIMARY KEY,
  sale_item_id INT REFERENCES sale_items(id),
  customer_id INT REFERENCES customers(id),
  product_id INT REFERENCES products(id),
  issue_title VARCHAR(200) NOT NULL,
  issue_description TEXT,
  reported_date DATE NOT NULL,
  issue_started_date DATE,
  issue_completed_date DATE,
  status VARCHAR(50) DEFAULT 'REPORTED',
  warranty_applicable BOOLEAN DEFAULT false,
  warranty_approved BOOLEAN DEFAULT false,
  service_cost DECIMAL(10, 2),
  resolution_notes TEXT,
  created_by_admin_id INT REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Issue Attachments Table (Phase 4)
CREATE TABLE issue_attachments (
  id SERIAL PRIMARY KEY,
  product_issue_id INT REFERENCES product_issues(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App Settings Table
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by_admin_id INT REFERENCES admins(id)
);

-- Create Indexes for better performance
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_phone ON admins(phone);
CREATE INDEX idx_otp_phone ON otp_codes(phone);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_sales_invoice ON sales(invoice_number);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Insert default app settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
('business_name', 'Self Weld Industries'),
('business_address', 'Laxmi Road, Backside of Patel Chowk, Jamwadi, Sangli'),
('business_phone', '91XXXXXXXXXX'),
('whatsapp_number', '91XXXXXXXXXX'),
('business_hours', '09:00 AM – 09:00 PM'),
('default_gst_percentage', '18.00'),
('invoice_prefix', 'SWI'),
('low_stock_threshold', '10'),
('allow_negative_stock', 'false'),
('customer_history_retention_days', '730'),
('product_history_retention_days', '730'),
('sales_history_retention_days', '2555'),
('issue_history_retention_days', '1095');
