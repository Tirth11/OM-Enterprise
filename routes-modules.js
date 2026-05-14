const express = require('express');
const router = express.Router();

// Mock data store
let mockData = {
  customers: [],
  products: [],
  customerProductHistory: [],
  vendorStockHistory: [],
  productIssues: [],
  inventoryTransactions: [],
  warrantyAuditLogs: [],
  nextId: { customers: 1, products: 1, cph: 1, vsh: 1, issues: 1, itx: 1, wal: 1 }
};

// ============================================================================
// CUSTOMERS
// ============================================================================

// List customers (with search)
router.get('/customers', (req, res) => {
  const { search } = req.query;
  let list = mockData.customers.filter(c => !c.deleted_at);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
  }
  // Attach product info
  const result = [];
  for (const c of list) {
    const records = mockData.customerProductHistory.filter(h => h.customer_id === c.id);
    if (records.length === 0) {
      result.push({ ...c, product_name: '-', quantity: 0, purchased_on: null, warranty_end_date: null, payment_status: '-' });
    } else {
      for (const r of records) {
        const prod = mockData.products.find(p => p.id === r.product_id);
        result.push({ ...c, cph_id: r.id, product_name: prod ? prod.name : '-', quantity: r.quantity, purchased_on: r.purchased_on, warranty_end_date: r.warranty_end_date, payment_status: r.payment_status });
      }
    }
  }
  res.json(result);
});

// Get single customer
router.get('/customers/:id', (req, res) => {
  const c = mockData.customers.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!c) return res.status(404).json({ message: 'Not found' });
  res.json(c);
});

// Create customer + product record
router.post('/customers', (req, res) => {
  const { name, phone, product_id, quantity, purchased_on, warranty_available, warranty_start_date, warranty_end_date, payment_status, amount_paid, notes } = req.body;
  if (!name || !phone) return res.status(400).json({ message: 'Name and phone required' });

  // Find or create customer
  let customer = mockData.customers.find(c => c.phone === phone && !c.deleted_at);
  if (!customer) {
    customer = { id: mockData.nextId.customers++, name, phone, created_at: new Date(), updated_at: new Date(), deleted_at: null };
    mockData.customers.push(customer);
  } else {
    customer.name = name;
    customer.updated_at = new Date();
  }

  // If product selected, create customer_product_history
  if (product_id) {
    const product = mockData.products.find(p => p.id === +product_id && !p.deleted_at);
    if (!product) return res.status(400).json({ message: 'Product not found' });
    const qty = +quantity || 1;
    if (qty > product.current_quantity) return res.status(400).json({ message: 'Stock not available. Available: ' + product.current_quantity });

    const cph = {
      id: mockData.nextId.cph++, customer_id: customer.id, product_id: +product_id, quantity: qty,
      purchased_on: purchased_on || new Date().toISOString().split('T')[0],
      warranty_available: !!warranty_available, warranty_start_date: warranty_start_date || null, warranty_end_date: warranty_end_date || null,
      warranty_extended: false, extended_warranty_end_date: null, warranty_extension_reason: null,
      payment_status: payment_status || 'Pending', amount_paid: +amount_paid || 0, notes: notes || '',
      created_at: new Date(), updated_at: new Date()
    };
    mockData.customerProductHistory.push(cph);

    // Reduce stock
    product.current_quantity -= qty;
    product.updated_at = new Date();

    // Inventory transaction
    mockData.inventoryTransactions.push({
      id: mockData.nextId.itx++, product_id: +product_id, transaction_type: 'Customer Product Given/Sold',
      quantity_in: 0, quantity_out: qty, balance_after: product.current_quantity,
      reference_type: 'customer_product_history', reference_id: cph.id, notes: `Sold to ${customer.name}`, created_at: new Date()
    });
  }

  res.json({ message: 'Customer record saved', customer });
});

// Update customer
router.put('/customers/:id', (req, res) => {
  const c = mockData.customers.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!c) return res.status(404).json({ message: 'Not found' });
  const { name, phone } = req.body;
  if (name) c.name = name;
  if (phone) c.phone = phone;
  c.updated_at = new Date();
  res.json({ message: 'Updated', customer: c });
});

// Delete customer (soft)
router.delete('/customers/:id', (req, res) => {
  const c = mockData.customers.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!c) return res.status(404).json({ message: 'Not found' });
  c.deleted_at = new Date();
  res.json({ message: 'Deleted' });
});

// Customer history (all products for a customer)
router.get('/customers/:id/history', (req, res) => {
  const records = mockData.customerProductHistory.filter(h => h.customer_id === +req.params.id);
  const result = records.map(r => {
    const prod = mockData.products.find(p => p.id === r.product_id);
    const issues = mockData.productIssues.filter(i => i.customer_product_history_id === r.id);
    const totalCharges = issues.reduce((s, i) => s + (+i.charge_amount || 0), 0);
    const effectiveWarrantyEnd = r.extended_warranty_end_date || r.warranty_end_date;
    const warrantyStatus = effectiveWarrantyEnd && new Date(effectiveWarrantyEnd) >= new Date() ? 'Under Warranty' : 'Warranty Expired';
    return { ...r, product_name: prod ? prod.name : '-', issue_count: issues.length, total_charges: totalCharges, warranty_status: warrantyStatus };
  });
  res.json(result);
});

// ============================================================================
// PRODUCTS / INVENTORY
// ============================================================================

router.get('/products', (req, res) => {
  const { search } = req.query;
  let list = mockData.products.filter(p => !p.deleted_at);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(s) || (p.category || '').toLowerCase().includes(s) || (p.brand || '').toLowerCase().includes(s));
  }
  res.json(list);
});

router.get('/products/:id', (req, res) => {
  const p = mockData.products.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!p) return res.status(404).json({ message: 'Not found' });
  res.json(p);
});

router.post('/products', (req, res) => {
  const { name, category, brand, current_quantity, purchase_price, selling_price, warranty_available, warranty_period, low_stock_quantity, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'Product name required' });
  const qty = +current_quantity || 0;
  const product = {
    id: mockData.nextId.products++, name, category: category || '', brand: brand || '',
    current_quantity: qty, purchase_price: +purchase_price || 0, selling_price: +selling_price || 0,
    warranty_available: !!warranty_available, warranty_period: warranty_period || '', low_stock_quantity: +low_stock_quantity || 5,
    notes: notes || '', created_at: new Date(), updated_at: new Date(), deleted_at: null
  };
  mockData.products.push(product);

  // Opening stock transaction
  if (qty > 0) {
    mockData.inventoryTransactions.push({
      id: mockData.nextId.itx++, product_id: product.id, transaction_type: 'Opening Stock',
      quantity_in: qty, quantity_out: 0, balance_after: qty,
      reference_type: 'product', reference_id: product.id, notes: 'Opening stock', created_at: new Date()
    });
  }
  res.json({ message: 'Product added', product });
});

router.put('/products/:id', (req, res) => {
  const p = mockData.products.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!p) return res.status(404).json({ message: 'Not found' });
  const fields = ['name', 'category', 'brand', 'purchase_price', 'selling_price', 'warranty_available', 'warranty_period', 'low_stock_quantity', 'notes'];
  fields.forEach(f => { if (req.body[f] !== undefined) p[f] = req.body[f]; });
  if (req.body.purchase_price !== undefined) p.purchase_price = +req.body.purchase_price;
  if (req.body.selling_price !== undefined) p.selling_price = +req.body.selling_price;
  if (req.body.low_stock_quantity !== undefined) p.low_stock_quantity = +req.body.low_stock_quantity;
  p.updated_at = new Date();
  res.json({ message: 'Updated', product: p });
});

router.delete('/products/:id', (req, res) => {
  const p = mockData.products.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!p) return res.status(404).json({ message: 'Not found' });
  p.deleted_at = new Date();
  res.json({ message: 'Deleted' });
});

// Product history (all transactions)
router.get('/products/:id/history', (req, res) => {
  const txns = mockData.inventoryTransactions.filter(t => t.product_id === +req.params.id);
  res.json(txns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

// ============================================================================
// VENDOR STOCK
// ============================================================================

router.get('/vendor-stock', (req, res) => {
  const { product_id } = req.query;
  let list = mockData.vendorStockHistory;
  if (product_id) list = list.filter(v => v.product_id === +product_id);
  const result = list.map(v => {
    const prod = mockData.products.find(p => p.id === v.product_id);
    return { ...v, product_name: prod ? prod.name : '-' };
  });
  res.json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

router.post('/vendor-stock', (req, res) => {
  const { product_id, vendor_name, quantity_bought, bought_on, purchase_price_per_unit, total_amount, notes } = req.body;
  if (!product_id || !vendor_name || !quantity_bought) return res.status(400).json({ message: 'Product, vendor name, and quantity required' });

  const product = mockData.products.find(p => p.id === +product_id && !p.deleted_at);
  if (!product) return res.status(400).json({ message: 'Product not found' });

  const qty = +quantity_bought;
  const entry = {
    id: mockData.nextId.vsh++, product_id: +product_id, vendor_name, quantity_bought: qty,
    bought_on: bought_on || new Date().toISOString().split('T')[0],
    purchase_price_per_unit: +purchase_price_per_unit || 0, total_amount: +total_amount || 0,
    notes: notes || '', created_at: new Date()
  };
  mockData.vendorStockHistory.push(entry);

  // Increase stock
  product.current_quantity += qty;
  product.updated_at = new Date();

  // Inventory transaction
  mockData.inventoryTransactions.push({
    id: mockData.nextId.itx++, product_id: +product_id, transaction_type: 'Vendor Stock Added',
    quantity_in: qty, quantity_out: 0, balance_after: product.current_quantity,
    reference_type: 'vendor_stock_history', reference_id: entry.id, notes: `From ${vendor_name}`, created_at: new Date()
  });

  res.json({ message: 'Vendor stock added', entry });
});

// ============================================================================
// PRODUCT ISSUES (Warranty/Repair)
// ============================================================================

router.get('/issues', (req, res) => {
  const { customer_product_history_id, status } = req.query;
  let list = mockData.productIssues;
  if (customer_product_history_id) list = list.filter(i => i.customer_product_history_id === +customer_product_history_id);
  if (status) list = list.filter(i => i.issue_status === status);

  const result = list.map(i => {
    const cph = mockData.customerProductHistory.find(h => h.id === i.customer_product_history_id);
    const customer = cph ? mockData.customers.find(c => c.id === cph.customer_id) : null;
    const product = cph ? mockData.products.find(p => p.id === cph.product_id) : null;
    return { ...i, customer_name: customer ? customer.name : '-', customer_phone: customer ? customer.phone : '-', product_name: product ? product.name : '-' };
  });
  res.json(result.sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date)));
});

router.post('/issues', (req, res) => {
  const { customer_product_history_id, issue_date, issue_description, warranty_status_at_issue, issue_status, charges_applicable, charge_reason, charge_amount, amount_paid, balance_amount, payment_mode, notes } = req.body;
  if (!customer_product_history_id || !issue_description) return res.status(400).json({ message: 'Customer product and issue description required' });

  const cph = mockData.customerProductHistory.find(h => h.id === +customer_product_history_id);
  if (!cph) return res.status(400).json({ message: 'Customer product record not found' });

  // Auto-detect warranty status
  const effectiveEnd = cph.extended_warranty_end_date || cph.warranty_end_date;
  const autoWarrantyStatus = effectiveEnd && new Date(effectiveEnd) >= new Date(issue_date || new Date()) ? 'Under Warranty' : 'Warranty Expired';

  const issue = {
    id: mockData.nextId.issues++, customer_product_history_id: +customer_product_history_id,
    issue_date: issue_date || new Date().toISOString().split('T')[0],
    issue_description, warranty_status_at_issue: warranty_status_at_issue || autoWarrantyStatus,
    issue_status: issue_status || 'Reported', fixed_datetime: null, fix_done_details: null, parts_replaced: null,
    charges_applicable: !!charges_applicable, charge_reason: charge_reason || '', charge_amount: +charge_amount || 0,
    amount_paid: +amount_paid || 0, balance_amount: +balance_amount || 0, payment_mode: payment_mode || '',
    payment_date: null, returned_to_customer: false, returned_datetime: null, final_notes: notes || '',
    created_at: new Date(), updated_at: new Date()
  };
  mockData.productIssues.push(issue);
  res.json({ message: 'Issue added', issue });
});

// Mark issue as fixed
router.put('/issues/:id/fix', (req, res) => {
  const issue = mockData.productIssues.find(i => i.id === +req.params.id);
  if (!issue) return res.status(404).json({ message: 'Issue not found' });

  const { fixed_datetime, fix_done_details, parts_replaced, charges_applicable, charge_amount, amount_paid, balance_amount, payment_mode, returned_to_customer, returned_datetime, final_notes } = req.body;
  issue.issue_status = 'Fixed';
  issue.fixed_datetime = fixed_datetime || new Date().toISOString();
  issue.fix_done_details = fix_done_details || '';
  issue.parts_replaced = parts_replaced || '';
  if (charges_applicable !== undefined) issue.charges_applicable = !!charges_applicable;
  if (charge_amount !== undefined) issue.charge_amount = +charge_amount;
  if (amount_paid !== undefined) issue.amount_paid = +amount_paid;
  if (balance_amount !== undefined) issue.balance_amount = +balance_amount;
  if (payment_mode) issue.payment_mode = payment_mode;
  issue.payment_date = new Date().toISOString().split('T')[0];
  if (returned_to_customer !== undefined) issue.returned_to_customer = !!returned_to_customer;
  if (returned_datetime) issue.returned_datetime = returned_datetime;
  if (final_notes) issue.final_notes = final_notes;
  issue.updated_at = new Date();
  res.json({ message: 'Issue marked as fixed', issue });
});

// Update issue status
router.put('/issues/:id', (req, res) => {
  const issue = mockData.productIssues.find(i => i.id === +req.params.id);
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  const fields = ['issue_status', 'issue_description', 'charges_applicable', 'charge_reason', 'charge_amount', 'amount_paid', 'balance_amount', 'payment_mode', 'final_notes'];
  fields.forEach(f => { if (req.body[f] !== undefined) issue[f] = req.body[f]; });
  issue.updated_at = new Date();
  res.json({ message: 'Issue updated', issue });
});

// ============================================================================
// WARRANTY EDIT
// ============================================================================

router.put('/customer-product/:id/warranty', (req, res) => {
  const cph = mockData.customerProductHistory.find(h => h.id === +req.params.id);
  if (!cph) return res.status(404).json({ message: 'Record not found' });

  const { warranty_available, warranty_start_date, warranty_end_date, warranty_extended, extended_warranty_end_date, warranty_extension_reason } = req.body;

  // Audit log
  mockData.warrantyAuditLogs.push({
    id: mockData.nextId.wal++, customer_product_history_id: cph.id,
    old_warranty_end: cph.extended_warranty_end_date || cph.warranty_end_date,
    new_warranty_end: extended_warranty_end_date || warranty_end_date || cph.warranty_end_date,
    reason: warranty_extension_reason || 'Warranty updated', created_at: new Date()
  });

  if (warranty_available !== undefined) cph.warranty_available = !!warranty_available;
  if (warranty_start_date) cph.warranty_start_date = warranty_start_date;
  if (warranty_end_date) cph.warranty_end_date = warranty_end_date;
  if (warranty_extended !== undefined) cph.warranty_extended = !!warranty_extended;
  if (extended_warranty_end_date) cph.extended_warranty_end_date = extended_warranty_end_date;
  if (warranty_extension_reason) cph.warranty_extension_reason = warranty_extension_reason;
  cph.updated_at = new Date();
  res.json({ message: 'Warranty updated', record: cph });
});

// Get customer product detail with issues
router.get('/customer-product/:id', (req, res) => {
  const cph = mockData.customerProductHistory.find(h => h.id === +req.params.id);
  if (!cph) return res.status(404).json({ message: 'Not found' });
  const customer = mockData.customers.find(c => c.id === cph.customer_id);
  const product = mockData.products.find(p => p.id === cph.product_id);
  const issues = mockData.productIssues.filter(i => i.customer_product_history_id === cph.id);
  const effectiveEnd = cph.extended_warranty_end_date || cph.warranty_end_date;
  const warrantyStatus = effectiveEnd && new Date(effectiveEnd) >= new Date() ? 'Under Warranty' : 'Warranty Expired';
  const totalCharges = issues.reduce((s, i) => s + (+i.charge_amount || 0), 0);
  const totalPaid = issues.reduce((s, i) => s + (+i.amount_paid || 0), 0);
  const totalBalance = issues.reduce((s, i) => s + (+i.balance_amount || 0), 0);

  res.json({
    ...cph, customer_name: customer ? customer.name : '-', customer_phone: customer ? customer.phone : '-',
    product_name: product ? product.name : '-', warranty_status: warrantyStatus,
    issues, issue_count: issues.length, total_charges: totalCharges, total_paid: totalPaid, total_balance: totalBalance,
    last_issue_date: issues.length ? issues.sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date))[0].issue_date : null
  });
});

// Update customer product history record
router.put('/customer-product/:id', (req, res) => {
  const cph = mockData.customerProductHistory.find(h => h.id === +req.params.id);
  if (!cph) return res.status(404).json({ message: 'Not found' });
  const fields = ['quantity', 'purchased_on', 'payment_status', 'amount_paid', 'notes'];
  fields.forEach(f => { if (req.body[f] !== undefined) cph[f] = req.body[f]; });
  cph.updated_at = new Date();
  res.json({ message: 'Updated', record: cph });
});

module.exports = router;
