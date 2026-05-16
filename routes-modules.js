const express = require('express');
const router = express.Router();
let pool = null, USE_MOCK = true;
router.setPool = (p, m) => { pool = p; USE_MOCK = m; };
const q = async (text, params) => USE_MOCK ? null : pool.query(text, params);

let mock = { customers: [], products: [], cph: [], vsh: [], issues: [], itx: [], wal: [], maint: [], mcharges: [], timeline: [], categories: ['Welding Machine','Power Tools','Welding Rods','Welding Cables','Accessories'], brands: ['Esab','Ador','D&H Secheron','Bosch','Makita','Stanley'], nid: { c:1, p:1, h:1, v:1, i:1, t:1, w:1, m:1, mc:1, tl:1 } };

// CUSTOMERS
router.get('/customers', async (req, res) => {
  const { search } = req.query;
  if (!USE_MOCK) {
    try {
      const s = search ? `%${search}%` : '%';
      const r1 = await q(`SELECT c.id, c.name, c.phone, c.created_at, c.updated_at, 'Product Purchase' as entry_type, h.id as cph_id, NULL as maint_id, p.name as product_name, p.category, p.brand, h.quantity, h.selling_price_per_qty, h.total_amount, h.amount_paid, h.balance_amount, h.paid_via, h.purchased_on as entry_date, h.warranty_available, h.warranty_end_date, h.payment_status, h.notes, NULL as issue_status, NULL as issue_description
        FROM customers c JOIN customer_product_history h ON h.customer_id=c.id LEFT JOIN products p ON p.id=h.product_id
        WHERE c.deleted_at IS NULL AND (c.name ILIKE $1 OR c.phone ILIKE $1)`, [s]);
      let r2 = { rows: [] };
      try { r2 = await q(`SELECT c.id, c.name, c.phone, c.created_at, c.updated_at, 'Maintenance Only' as entry_type, NULL as cph_id, m.id as maint_id, m.product_name, m.category, NULL as brand, NULL as quantity, NULL as selling_price_per_qty, m.total_charges as total_amount, m.amount_paid, m.balance_amount, m.paid_via, m.issue_datetime as entry_date, false as warranty_available, NULL as warranty_end_date, m.payment_status, m.notes, m.issue_status, m.issue_description
        FROM customers c JOIN customer_maintenance m ON m.customer_id=c.id
        WHERE c.deleted_at IS NULL AND (c.name ILIKE $1 OR c.phone ILIKE $1)`, [s]); } catch(e) {}
      const combined = [...r1.rows, ...r2.rows].sort((a,b) => new Date(b.entry_date||b.created_at) - new Date(a.entry_date||a.created_at));
      return res.json(combined);
    } catch(e) { return res.status(500).json({ message: e.message }); }
  }
  let list = mock.customers.filter(c => !c.deleted_at);
  if (search) { const s = search.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s)); }
  const result = [];
  for (const c of list) {
    const recs = mock.cph.filter(h => h.customer_id === c.id);
    const maints = mock.maint.filter(m => m.customer_id === c.id);
    if (!recs.length && !maints.length) result.push({ ...c, entry_type: '-', product_name: '-', quantity: 0, entry_date: null, warranty_end_date: null, payment_status: '-', total_amount: 0, amount_paid: 0, balance_amount: 0, issue_status: null });
    recs.forEach(r => { const p = mock.products.find(x => x.id === r.product_id); result.push({ ...c, entry_type: 'Product Purchase', cph_id: r.id, maint_id: null, product_name: p ? p.name : '-', category: p ? p.category : '', brand: p ? p.brand : '', quantity: r.quantity, selling_price_per_qty: r.selling_price_per_qty, total_amount: r.total_amount, amount_paid: r.amount_paid, balance_amount: r.balance_amount, paid_via: r.paid_via, entry_date: r.purchased_on, warranty_available: r.warranty_available, warranty_end_date: r.warranty_end_date, payment_status: r.payment_status, notes: r.notes, issue_status: null }); });
    maints.forEach(m => { result.push({ ...c, entry_type: 'Maintenance Only', cph_id: null, maint_id: m.id, product_name: m.product_name, category: m.category, brand: null, quantity: null, selling_price_per_qty: null, total_amount: m.total_charges, amount_paid: m.amount_paid, balance_amount: m.balance_amount, paid_via: m.paid_via, entry_date: m.issue_datetime, warranty_available: false, warranty_end_date: null, payment_status: m.payment_status, notes: m.notes, issue_status: m.issue_status, issue_description: m.issue_description }); });
  }
  result.sort((a,b) => new Date(b.entry_date||b.created_at) - new Date(a.entry_date||a.created_at));
  res.json(result);
});

router.get('/customers/:id', async (req, res) => {
  if (!USE_MOCK) { const r = await q('SELECT * FROM customers WHERE id=$1 AND deleted_at IS NULL', [req.params.id]); return res.json(r.rows[0] || {}); }
  const c = mock.customers.find(x => x.id === +req.params.id && !x.deleted_at);
  res.json(c || {});
});

router.post('/customers', async (req, res) => {
  const { name, phone, product_id, quantity, purchased_on, warranty_available, warranty_start_date, warranty_end_date, selling_price_per_qty, total_amount, amount_paid, balance_amount, paid_via, payment_status, notes } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Customer name required' });

  if (!USE_MOCK) {
    let custId;
    if (phone && phone.length >= 10) {
      let cr = await q('SELECT id FROM customers WHERE phone=$1 AND deleted_at IS NULL', [phone]);
      if (cr.rows.length) { custId = cr.rows[0].id; await q('UPDATE customers SET name=$1, updated_at=NOW() WHERE id=$2', [name.trim(), custId]); }
      else { const ins = await q('INSERT INTO customers(name,phone) VALUES($1,$2) RETURNING id', [name.trim(), phone]); custId = ins.rows[0].id; }
    } else {
      const ins = await q('INSERT INTO customers(name,phone) VALUES($1,$2) RETURNING id', [name.trim(), phone||'']);
      custId = ins.rows[0].id;
    }
    if (product_id) {
      // Prevent duplicate: same customer + product + same purchased_on timestamp
      const purchaseTime = purchased_on || new Date().toISOString().slice(0,16);
      const dup = await q('SELECT id FROM customer_product_history WHERE customer_id=$1 AND product_id=$2 AND purchased_on=$3', [custId, product_id, purchaseTime]);
      if (dup.rows.length) return res.status(400).json({ message: 'This purchase record already exists' });

      const pr = await q('SELECT current_quantity, selling_price FROM products WHERE id=$1 AND deleted_at IS NULL', [product_id]);
      if (!pr.rows.length) return res.status(400).json({ message: 'Product not found' });
      const qty = +quantity || 1;
      if (qty > pr.rows[0].current_quantity) return res.status(400).json({ message: 'Stock not available. Available: ' + pr.rows[0].current_quantity });
      const sp = +selling_price_per_qty || +pr.rows[0].selling_price || 0;
      const total = +total_amount || sp * qty;
      const paid = +amount_paid || 0;
      if (paid > total) return res.status(400).json({ message: 'Amount paid cannot exceed total amount' });
      const balance = total - paid;
      const status = paid >= total ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Pending';
      await q(`INSERT INTO customer_product_history(customer_id,product_id,quantity,purchased_on,warranty_available,warranty_start_date,warranty_end_date,selling_price_per_qty,total_amount,amount_paid,balance_amount,paid_via,payment_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [custId, product_id, qty, purchaseTime, !!warranty_available, warranty_start_date||null, warranty_end_date||null, sp, total, paid, balance, paid_via||'', status, notes||'']);
      const newQty = pr.rows[0].current_quantity - qty;
      await q('UPDATE products SET current_quantity=$1, updated_at=NOW() WHERE id=$2', [newQty, product_id]);
      await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_out,balance_after,reference_type,notes) VALUES($1,'Customer Product Given/Sold',$2,$3,'customer_product_history',$4)`, [product_id, qty, newQty, 'Sold to '+name.trim()]);
      await q('INSERT INTO customer_timeline(customer_id,entry_type,reference_id,reference_type,event_type,event_description) VALUES($1,$2,currval(pg_get_serial_sequence($$customer_product_history$$,$$id$$)),$3,$4,$5)', [custId, 'Product Purchase', 'customer_product_history', 'purchase_created', 'Product purchased: qty '+qty]);
    }
    return res.json({ message: 'Customer record saved', customer: { id: custId, name: name.trim(), phone: phone||'' } });
  }
  // Mock
  let customer = phone ? mock.customers.find(c => c.phone === phone && !c.deleted_at) : null;
  if (!customer) { customer = { id: mock.nid.c++, name: name.trim(), phone: phone||'', created_at: new Date(), updated_at: new Date(), deleted_at: null }; mock.customers.push(customer); }
  else { customer.name = name.trim(); customer.updated_at = new Date(); }
  if (product_id) {
    const product = mock.products.find(p => p.id === +product_id && !p.deleted_at);
    if (!product) return res.status(400).json({ message: 'Product not found' });
    const qty = +quantity || 1;
    if (qty > product.current_quantity) return res.status(400).json({ message: 'Stock not available. Available: ' + product.current_quantity });
    const purchaseTime = purchased_on||new Date().toISOString().slice(0,16);
    // Prevent duplicate in mock
    const dup = mock.cph.find(h => h.customer_id===customer.id && h.product_id===+product_id && h.purchased_on===purchaseTime);
    if (dup) return res.status(400).json({ message: 'This purchase record already exists' });
    const sp = +selling_price_per_qty || product.selling_price || 0;
    const total = +total_amount || sp * qty;
    const paid = +amount_paid || 0;
    if (paid > total) return res.status(400).json({ message: 'Amount paid cannot exceed total amount' });
    const balance = total - paid;
    const status = paid >= total ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Pending';
    mock.cph.push({ id: mock.nid.h++, customer_id: customer.id, product_id: +product_id, quantity: qty, purchased_on: purchaseTime, warranty_available: !!warranty_available, warranty_start_date: warranty_start_date||null, warranty_end_date: warranty_end_date||null, warranty_extended: false, extended_warranty_end_date: null, selling_price_per_qty: sp, total_amount: total, amount_paid: paid, balance_amount: balance, paid_via: paid_via||'', payment_status: status, notes: notes||'', created_at: new Date(), updated_at: new Date() });
    product.current_quantity -= qty;
    mock.itx.push({ id: mock.nid.t++, product_id: +product_id, transaction_type: 'Customer Product Given/Sold', quantity_in: 0, quantity_out: qty, balance_after: product.current_quantity, reference_type: 'customer_product_history', notes: 'Sold to '+name.trim(), created_at: new Date() });
    mock.timeline.push({ id: mock.nid.tl++, customer_id: customer.id, entry_type: 'Product Purchase', reference_id: mock.nid.h-1, reference_type: 'customer_product_history', event_type: 'purchase_created', event_description: 'Product purchased: '+(mock.products.find(x=>x.id===+product_id)||{}).name+' (Qty: '+qty+')', created_at: new Date() });
  }
  res.json({ message: 'Customer record saved', customer });
});

router.put('/customers/:id', async (req, res) => {
  const { name, phone } = req.body;
  if (!USE_MOCK) { await q('UPDATE customers SET name=COALESCE($1,name), phone=COALESCE($2,phone), updated_at=NOW() WHERE id=$3', [name, phone, req.params.id]); return res.json({ message: 'Updated' }); }
  const c = mock.customers.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!c) return res.status(404).json({ message: 'Not found' });
  if (name) c.name = name; if (phone) c.phone = phone; c.updated_at = new Date();
  res.json({ message: 'Updated', customer: c });
});

router.delete('/customers/:id', async (req, res) => {
  if (!USE_MOCK) {
    await q('DELETE FROM maintenance_charges WHERE maintenance_id IN (SELECT id FROM customer_maintenance WHERE customer_id=$1)', [req.params.id]).catch(()=>{});
    await q('DELETE FROM customer_maintenance WHERE customer_id=$1', [req.params.id]).catch(()=>{});
    await q('DELETE FROM product_issues WHERE customer_product_history_id IN (SELECT id FROM customer_product_history WHERE customer_id=$1)', [req.params.id]).catch(()=>{});
    await q('DELETE FROM customer_product_history WHERE customer_id=$1', [req.params.id]).catch(()=>{});
    await q('DELETE FROM customer_timeline WHERE customer_id=$1', [req.params.id]).catch(()=>{});
    await q('UPDATE customers SET deleted_at=NOW() WHERE id=$1', [req.params.id]);
    return res.json({ message: 'Deleted' });
  }
  const id = +req.params.id;
  mock.mcharges = mock.mcharges.filter(x => !mock.maint.find(m => m.id === x.maintenance_id && m.customer_id === id));
  mock.maint = mock.maint.filter(x => x.customer_id !== id);
  mock.issues = mock.issues.filter(x => !mock.cph.find(h => h.id === x.customer_product_history_id && h.customer_id === id));
  mock.cph = mock.cph.filter(x => x.customer_id !== id);
  mock.timeline = mock.timeline.filter(x => x.customer_id !== id);
  const c = mock.customers.find(x => x.id === id); if (c) c.deleted_at = new Date();
  res.json({ message: 'Deleted' });
});

router.get('/customers/:id/history', async (req, res) => {
  if (!USE_MOCK) {
    const r = await q(`SELECT h.*, p.name as product_name, (SELECT COUNT(*) FROM product_issues pi WHERE pi.customer_product_history_id=h.id) as issue_count,
      (SELECT COALESCE(SUM(charge_amount),0) FROM product_issues pi WHERE pi.customer_product_history_id=h.id) as total_charges
      FROM customer_product_history h JOIN products p ON p.id=h.product_id WHERE h.customer_id=$1 ORDER BY h.purchased_on DESC`, [req.params.id]);
    const rows = r.rows.map(row => { const end = row.extended_warranty_end_date || row.warranty_end_date; row.warranty_status = end && new Date(end) >= new Date() ? 'Under Warranty' : 'Warranty Expired'; return row; });
    return res.json(rows);
  }
  const recs = mock.cph.filter(h => h.customer_id === +req.params.id);
  res.json(recs.map(r => { const p = mock.products.find(x => x.id === r.product_id); const issues = mock.issues.filter(i => i.customer_product_history_id === r.id); const end = r.extended_warranty_end_date || r.warranty_end_date; return { ...r, product_name: p?p.name:'-', issue_count: issues.length, total_charges: issues.reduce((s,i)=>s+(+i.charge_amount||0),0), warranty_status: end && new Date(end)>=new Date() ? 'Under Warranty' : 'Warranty Expired' }; }));
});


// CATEGORY & BRAND MASTERS
router.get('/categories', async (req, res) => {
  if (!USE_MOCK) {
    const r = await q('SELECT name FROM category_master WHERE deleted_at IS NULL ORDER BY name');
    return res.json(r.rows.map(r => r.name));
  }
  res.json(mock.categories);
});

router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Category name required' });
  const n = name.trim();
  if (!USE_MOCK) {
    const exists = await q('SELECT id FROM category_master WHERE LOWER(name)=LOWER($1) AND deleted_at IS NULL', [n]);
    if (exists.rows.length) return res.json({ message: 'Already exists' });
    await q('INSERT INTO category_master(name) VALUES($1)', [n]);
    return res.json({ message: 'Category added' });
  }
  if (!mock.categories.find(c => c.toLowerCase() === n.toLowerCase())) mock.categories.push(n);
  res.json({ message: 'Category added' });
});

router.get('/brands', async (req, res) => {
  if (!USE_MOCK) {
    const r = await q('SELECT name FROM brand_master WHERE deleted_at IS NULL ORDER BY name');
    return res.json(r.rows.map(r => r.name));
  }
  res.json(mock.brands);
});

router.post('/brands', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Brand name required' });
  const n = name.trim();
  if (!USE_MOCK) {
    const exists = await q('SELECT id FROM brand_master WHERE LOWER(name)=LOWER($1) AND deleted_at IS NULL', [n]);
    if (exists.rows.length) return res.json({ message: 'Already exists' });
    await q('INSERT INTO brand_master(name) VALUES($1)', [n]);
    return res.json({ message: 'Brand added' });
  }
  if (!mock.brands.find(b => b.toLowerCase() === n.toLowerCase())) mock.brands.push(n);
  res.json({ message: 'Brand added' });
});


// PRODUCTS
router.get('/products', async (req, res) => {
  const { search } = req.query;
  if (!USE_MOCK) { const s = search ? `%${search}%` : '%'; const r = await q(`SELECT * FROM products WHERE deleted_at IS NULL AND (name ILIKE $1 OR category ILIKE $1 OR brand ILIKE $1) ORDER BY created_at DESC`, [s]); return res.json(r.rows); }
  let list = mock.products.filter(p => !p.deleted_at);
  if (search) { const s = search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(s) || (p.category||'').toLowerCase().includes(s) || (p.brand||'').toLowerCase().includes(s)); }
  res.json(list);
});

router.get('/products/:id', async (req, res) => {
  if (!USE_MOCK) { const r = await q('SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL', [req.params.id]); return res.json(r.rows[0]||{}); }
  res.json(mock.products.find(x => x.id === +req.params.id && !x.deleted_at) || {});
});

router.post('/products', async (req, res) => {
  const { name, category, brand, purchase_price_per_qty, total_quantity, selling_price_per_qty, warranty_available, warranty_period, low_stock_quantity, notes } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Product name required' });
  const qty = +total_quantity || 0;
  const ppq = +purchase_price_per_qty || 0;
  const spq = +selling_price_per_qty || 0;
  const totalPurchase = ppq * qty;
  if (qty <= 0) return res.status(400).json({ message: 'Quantity must be greater than 0' });
  if (ppq <= 0) return res.status(400).json({ message: 'Purchase price must be greater than 0' });
  if (spq <= 0) return res.status(400).json({ message: 'Selling price must be greater than 0' });
  if (warranty_available && !warranty_period) return res.status(400).json({ message: 'Warranty period required when warranty is available' });

  if (!USE_MOCK) {
    const r = await q(`INSERT INTO products(name,category,brand,current_quantity,purchase_price,selling_price,warranty_available,warranty_period,low_stock_quantity,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name.trim(), category||'', brand||'', qty, ppq, spq, !!warranty_available, warranty_period||'', +low_stock_quantity||5, notes||'']);
    await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_in,balance_after,reference_type,notes,purchase_price_per_qty,selling_price_per_qty,total_amount) VALUES($1,'New Product Created',$2,$2,'product','Initial stock entry',$3,$4,$5)`,
      [r.rows[0].id, qty, ppq, spq, totalPurchase]);
    return res.json({ message: 'Product added', product: r.rows[0] });
  }
  const product = { id: mock.nid.p++, name: name.trim(), category:category||'', brand:brand||'', current_quantity:qty, purchase_price:ppq, selling_price:spq, warranty_available:!!warranty_available, warranty_period:warranty_period||'', low_stock_quantity:+low_stock_quantity||5, notes:notes||'', created_at:new Date(), updated_at:new Date(), deleted_at:null };
  mock.products.push(product);
  mock.itx.push({ id:mock.nid.t++, product_id:product.id, transaction_type:'New Product Created', quantity_in:qty, quantity_out:0, balance_after:qty, reference_type:'product', notes:'Initial stock entry', purchase_price_per_qty:ppq, selling_price_per_qty:spq, total_amount:totalPurchase, created_at:new Date() });
  res.json({ message: 'Product added', product });
});

router.post('/products/:id/add-inventory', async (req, res) => {
  const { purchase_price_per_qty, total_quantity, selling_price_per_qty, notes } = req.body;
  const qty = +total_quantity || 0;
  const ppq = +purchase_price_per_qty || 0;
  const spq = +selling_price_per_qty || 0;
  if (qty <= 0) return res.status(400).json({ message: 'Quantity must be greater than 0' });
  if (ppq <= 0) return res.status(400).json({ message: 'Purchase price must be greater than 0' });
  if (spq <= 0) return res.status(400).json({ message: 'Selling price must be greater than 0' });
  const totalPurchase = ppq * qty;

  if (!USE_MOCK) {
    const pr = await q('SELECT current_quantity FROM products WHERE id=$1 AND deleted_at IS NULL', [req.params.id]);
    if (!pr.rows.length) return res.status(404).json({ message: 'Product not found' });
    const newQty = pr.rows[0].current_quantity + qty;
    await q('UPDATE products SET current_quantity=$1, purchase_price=$2, selling_price=$3, updated_at=NOW() WHERE id=$4', [newQty, ppq, spq, req.params.id]);
    await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_in,balance_after,reference_type,notes,purchase_price_per_qty,selling_price_per_qty,total_amount) VALUES($1,'Inventory Added',$2,$3,'add_inventory',$4,$5,$6,$7)`,
      [req.params.id, qty, newQty, notes||'Added more inventory', ppq, spq, totalPurchase]);
    return res.json({ message: 'Inventory added', new_quantity: newQty });
  }
  const product = mock.products.find(p => p.id === +req.params.id && !p.deleted_at);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.current_quantity += qty;
  product.purchase_price = ppq;
  product.selling_price = spq;
  product.updated_at = new Date();
  mock.itx.push({ id:mock.nid.t++, product_id:product.id, transaction_type:'Inventory Added', quantity_in:qty, quantity_out:0, balance_after:product.current_quantity, reference_type:'add_inventory', notes:notes||'Added more inventory', purchase_price_per_qty:ppq, selling_price_per_qty:spq, total_amount:totalPurchase, created_at:new Date() });
  res.json({ message: 'Inventory added', new_quantity: product.current_quantity });
});

router.put('/products/:id', async (req, res) => {
  const { name, category, brand, selling_price, warranty_available, warranty_period, low_stock_quantity, notes } = req.body;
  if (warranty_available && !warranty_period) return res.status(400).json({ message: 'Warranty period required when warranty is available' });
  if (!USE_MOCK) {
    await q(`UPDATE products SET name=COALESCE($1,name),category=COALESCE($2,category),brand=COALESCE($3,brand),selling_price=COALESCE($4,selling_price),warranty_available=COALESCE($5,warranty_available),warranty_period=COALESCE($6,warranty_period),low_stock_quantity=COALESCE($7,low_stock_quantity),notes=COALESCE($8,notes),updated_at=NOW() WHERE id=$9`,
      [name||null,category||null,brand||null,selling_price?+selling_price:null,warranty_available!=null?!!warranty_available:null,warranty_period||null,low_stock_quantity?+low_stock_quantity:null,notes!=null?notes:null,req.params.id]);
    await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_in,quantity_out,balance_after,reference_type,notes) VALUES($1,'Product Edited',0,0,(SELECT current_quantity FROM products WHERE id=$1),'edit',$2)`, [req.params.id, 'Product details updated']);
    return res.json({ message:'Updated' });
  }
  const p = mock.products.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!p) return res.status(404).json({ message: 'Not found' });
  if (name) p.name=name; if (category!==undefined) p.category=category; if (brand!==undefined) p.brand=brand;
  if (selling_price!==undefined) p.selling_price=+selling_price;
  if (warranty_available!==undefined) p.warranty_available=!!warranty_available; if (warranty_period!==undefined) p.warranty_period=warranty_period;
  if (low_stock_quantity!==undefined) p.low_stock_quantity=+low_stock_quantity; if (notes!==undefined) p.notes=notes;
  p.updated_at=new Date();
  mock.itx.push({ id:mock.nid.t++, product_id:p.id, transaction_type:'Product Edited', quantity_in:0, quantity_out:0, balance_after:p.current_quantity, reference_type:'edit', notes:'Product details updated', created_at:new Date() });
  res.json({ message:'Updated', product:p });
});

router.delete('/products/:id', async (req, res) => {
  if (!USE_MOCK) { await q('UPDATE products SET deleted_at=NOW() WHERE id=$1', [req.params.id]); return res.json({ message:'Deleted' }); }
  const p = mock.products.find(x => x.id === +req.params.id); if (p) p.deleted_at = new Date();
  res.json({ message:'Deleted' });
});

router.get('/products/:id/history', async (req, res) => {
  if (!USE_MOCK) { const r = await q('SELECT * FROM inventory_transactions WHERE product_id=$1 ORDER BY created_at DESC', [req.params.id]); return res.json(r.rows); }
  res.json(mock.itx.filter(t => t.product_id === +req.params.id).sort((a,b) => new Date(b.created_at)-new Date(a.created_at)));
});

router.post('/products/:id/stock-adjust', async (req, res) => {
  const { adjustment_qty, reason } = req.body;
  const adj = +adjustment_qty;
  if (!adj || adj === 0) return res.status(400).json({ message: 'Adjustment quantity required (positive to add, negative to reduce)' });
  if (!reason || !reason.trim()) return res.status(400).json({ message: 'Reason required for stock adjustment' });

  if (!USE_MOCK) {
    const pr = await q('SELECT current_quantity FROM products WHERE id=$1 AND deleted_at IS NULL', [req.params.id]);
    if (!pr.rows.length) return res.status(404).json({ message: 'Product not found' });
    const newQty = pr.rows[0].current_quantity + adj;
    if (newQty < 0) return res.status(400).json({ message: 'Cannot reduce below 0. Current stock: ' + pr.rows[0].current_quantity });
    await q('UPDATE products SET current_quantity=$1, updated_at=NOW() WHERE id=$2', [newQty, req.params.id]);
    await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_in,quantity_out,balance_after,reference_type,notes) VALUES($1,'Stock Adjustment',$2,$3,$4,'adjustment',$5)`,
      [req.params.id, adj > 0 ? adj : 0, adj < 0 ? Math.abs(adj) : 0, newQty, reason.trim()]);
    return res.json({ message: 'Stock adjusted', new_quantity: newQty });
  }
  const product = mock.products.find(p => p.id === +req.params.id && !p.deleted_at);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const newQty = product.current_quantity + adj;
  if (newQty < 0) return res.status(400).json({ message: 'Cannot reduce below 0. Current stock: ' + product.current_quantity });
  product.current_quantity = newQty;
  product.updated_at = new Date();
  mock.itx.push({ id:mock.nid.t++, product_id:product.id, transaction_type:'Stock Adjustment', quantity_in: adj > 0 ? adj : 0, quantity_out: adj < 0 ? Math.abs(adj) : 0, balance_after:newQty, reference_type:'adjustment', notes:reason.trim(), created_at:new Date() });
  res.json({ message: 'Stock adjusted', new_quantity: newQty });
});


// VENDOR STOCK
router.get('/vendor-stock', async (req, res) => {
  const { product_id } = req.query;
  if (!USE_MOCK) { const r = product_id ? await q('SELECT v.*, p.name as product_name FROM vendor_stock_history v JOIN products p ON p.id=v.product_id WHERE v.product_id=$1 ORDER BY v.bought_on DESC', [product_id]) : await q('SELECT v.*, p.name as product_name FROM vendor_stock_history v JOIN products p ON p.id=v.product_id ORDER BY v.bought_on DESC'); return res.json(r.rows); }
  let list = mock.vsh; if (product_id) list = list.filter(v => v.product_id === +product_id);
  res.json(list.map(v => ({ ...v, product_name: (mock.products.find(p=>p.id===v.product_id)||{}).name||'-' })).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
});

router.post('/vendor-stock', async (req, res) => {
  const { product_id, vendor_name, quantity_bought, bought_on, purchase_price_per_unit, total_amount, notes } = req.body;
  if (!product_id || !vendor_name || !quantity_bought) return res.status(400).json({ message: 'Product, vendor, quantity required' });
  const qty = +quantity_bought;
  if (!USE_MOCK) {
    const pr = await q('SELECT current_quantity FROM products WHERE id=$1 AND deleted_at IS NULL', [product_id]);
    if (!pr.rows.length) return res.status(400).json({ message: 'Product not found' });
    await q('INSERT INTO vendor_stock_history(product_id,vendor_name,quantity_bought,bought_on,purchase_price_per_unit,total_amount,notes) VALUES($1,$2,$3,$4,$5,$6,$7)', [product_id, vendor_name, qty, bought_on||new Date(), +purchase_price_per_unit||0, +total_amount||0, notes||'']);
    const newQty = pr.rows[0].current_quantity + qty;
    await q('UPDATE products SET current_quantity=$1, updated_at=NOW() WHERE id=$2', [newQty, product_id]);
    await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_in,balance_after,reference_type,notes) VALUES($1,'Vendor Stock Added',$2,$3,'vendor_stock_history',$4)`, [product_id, qty, newQty, 'From '+vendor_name]);
    return res.json({ message: 'Vendor stock added' });
  }
  const product = mock.products.find(p => p.id === +product_id && !p.deleted_at);
  if (!product) return res.status(400).json({ message: 'Product not found' });
  mock.vsh.push({ id:mock.nid.v++, product_id:+product_id, vendor_name, quantity_bought:qty, bought_on:bought_on||new Date().toISOString().split('T')[0], purchase_price_per_unit:+purchase_price_per_unit||0, total_amount:+total_amount||0, notes:notes||'', created_at:new Date() });
  product.current_quantity += qty;
  mock.itx.push({ id:mock.nid.t++, product_id:+product_id, transaction_type:'Vendor Stock Added', quantity_in:qty, quantity_out:0, balance_after:product.current_quantity, reference_type:'vendor_stock_history', notes:'From '+vendor_name, created_at:new Date() });
  res.json({ message: 'Vendor stock added' });
});


// ISSUES
router.get('/issues', async (req, res) => {
  const { customer_product_history_id, status } = req.query;
  if (!USE_MOCK) {
    let sql = `SELECT i.id, i.issue_date, i.issue_description, i.issue_status, i.warranty_status_at_issue, i.charge_amount, i.amount_paid, i.balance_amount, i.payment_mode, i.fixed_datetime, i.fix_done_details, i.customer_product_history_id, 'product_issue' as source_type, c.name as customer_name, c.phone as customer_phone, p.name as product_name FROM product_issues i JOIN customer_product_history h ON h.id=i.customer_product_history_id JOIN customers c ON c.id=h.customer_id JOIN products p ON p.id=h.product_id WHERE 1=1`;
    const params = [];
    if (customer_product_history_id) { params.push(customer_product_history_id); sql += ` AND i.customer_product_history_id=$${params.length}`; }
    if (status) { params.push(status); sql += ` AND i.issue_status=$${params.length}`; }
    sql += ' ORDER BY i.issue_date DESC';
    const r = await q(sql, params);
    // Also get maintenance records
    let mSql = `SELECT m.id, m.issue_datetime as issue_date, m.issue_description, m.issue_status, 'N/A' as warranty_status_at_issue, m.total_charges as charge_amount, m.amount_paid, m.balance_amount, m.paid_via as payment_mode, m.fixed_datetime, m.fix_done_details, NULL as customer_product_history_id, 'maintenance' as source_type, c.name as customer_name, c.phone as customer_phone, m.product_name FROM customer_maintenance m JOIN customers c ON c.id=m.customer_id WHERE 1=1`;
    const mParams = [];
    if (status) { mParams.push(status); mSql += ` AND m.issue_status=$${mParams.length}`; }
    mSql += ' ORDER BY m.issue_datetime DESC';
    let mr = { rows: [] };
    try { mr = await q(mSql, mParams); } catch(e) {}
    const combined = [...r.rows, ...mr.rows].sort((a,b) => new Date(b.issue_date||0) - new Date(a.issue_date||0));
    return res.json(combined);
  }
  let list = mock.issues;
  if (customer_product_history_id) list = list.filter(i => i.customer_product_history_id === +customer_product_history_id);
  if (status) list = list.filter(i => i.issue_status === status);
  const productIssues = list.map(i => { const h = mock.cph.find(x=>x.id===i.customer_product_history_id); const c = h?mock.customers.find(x=>x.id===h.customer_id):null; const p = h?mock.products.find(x=>x.id===h.product_id):null; return { ...i, source_type:'product_issue', customer_name:c?c.name:'-', customer_phone:c?c.phone:'-', product_name:p?p.name:'-' }; });
  let maintList = mock.maint;
  if (status) maintList = maintList.filter(m => m.issue_status === status);
  const maintIssues = maintList.map(m => { const c = mock.customers.find(x=>x.id===m.customer_id); return { id: m.id, issue_date: m.issue_datetime, issue_description: m.issue_description, issue_status: m.issue_status, warranty_status_at_issue: 'N/A', charge_amount: m.total_charges, amount_paid: m.amount_paid, balance_amount: m.balance_amount, payment_mode: m.paid_via, fixed_datetime: m.fixed_datetime, fix_done_details: m.fix_done_details, customer_product_history_id: null, source_type: 'maintenance', customer_name: c?c.name:'-', customer_phone: c?c.phone:'-', product_name: m.product_name }; });
  const combined = [...productIssues, ...maintIssues].sort((a,b) => new Date(b.issue_date||0) - new Date(a.issue_date||0));
  res.json(combined);
});

router.post('/issues', async (req, res) => {
  const { customer_product_history_id, issue_date, issue_description, warranty_status_at_issue, issue_status, charges_applicable, charge_reason, charge_amount, amount_paid, balance_amount, payment_mode, notes } = req.body;
  if (!customer_product_history_id || !issue_description) return res.status(400).json({ message: 'Customer product and description required' });
  if (!USE_MOCK) {
    const h = await q('SELECT warranty_end_date, extended_warranty_end_date FROM customer_product_history WHERE id=$1', [customer_product_history_id]);
    if (!h.rows.length) return res.status(400).json({ message: 'Record not found' });
    const end = h.rows[0].extended_warranty_end_date || h.rows[0].warranty_end_date;
    const autoStatus = end && new Date(end) >= new Date(issue_date||new Date()) ? 'Under Warranty' : 'Warranty Expired';
    await q(`INSERT INTO product_issues(customer_product_history_id,issue_date,issue_description,warranty_status_at_issue,issue_status,charges_applicable,charge_reason,charge_amount,amount_paid,balance_amount,payment_mode,final_notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [customer_product_history_id, issue_date||new Date(), issue_description, warranty_status_at_issue||autoStatus, issue_status||'Reported', !!charges_applicable, charge_reason||'', +charge_amount||0, +amount_paid||0, +balance_amount||0, payment_mode||'', notes||'']);
    return res.json({ message: 'Issue added' });
  }
  const cph = mock.cph.find(h => h.id === +customer_product_history_id);
  if (!cph) return res.status(400).json({ message: 'Record not found' });
  const end = cph.extended_warranty_end_date || cph.warranty_end_date;
  const autoStatus = end && new Date(end) >= new Date(issue_date||new Date()) ? 'Under Warranty' : 'Warranty Expired';
  mock.issues.push({ id:mock.nid.i++, customer_product_history_id:+customer_product_history_id, issue_date:issue_date||new Date().toISOString().split('T')[0], issue_description, warranty_status_at_issue:warranty_status_at_issue||autoStatus, issue_status:issue_status||'Reported', fixed_datetime:null, fix_done_details:null, parts_replaced:null, charges_applicable:!!charges_applicable, charge_reason:charge_reason||'', charge_amount:+charge_amount||0, amount_paid:+amount_paid||0, balance_amount:+balance_amount||0, payment_mode:payment_mode||'', payment_date:null, returned_to_customer:false, returned_datetime:null, final_notes:notes||'', created_at:new Date(), updated_at:new Date() });
  res.json({ message: 'Issue added' });
});

router.put('/issues/:id/fix', async (req, res) => {
  const { fixed_datetime, fix_done_details, parts_replaced, charges_applicable, charge_amount, amount_paid, balance_amount, payment_mode, returned_to_customer, returned_datetime, final_notes } = req.body;
  if (!USE_MOCK) {
    await q(`UPDATE product_issues SET issue_status='Fixed', fixed_datetime=$1, fix_done_details=$2, parts_replaced=$3, charges_applicable=$4, charge_amount=$5, amount_paid=$6, balance_amount=$7, payment_mode=$8, returned_to_customer=$9, returned_datetime=$10, final_notes=$11, payment_date=NOW(), updated_at=NOW() WHERE id=$12`,
      [fixed_datetime||new Date(), fix_done_details||'', parts_replaced||'', !!charges_applicable, +charge_amount||0, +amount_paid||0, +balance_amount||0, payment_mode||'', !!returned_to_customer, returned_datetime||null, final_notes||'', req.params.id]);
    return res.json({ message: 'Issue marked as fixed' });
  }
  const issue = mock.issues.find(i => i.id === +req.params.id);
  if (!issue) return res.status(404).json({ message: 'Not found' });
  Object.assign(issue, { issue_status:'Fixed', fixed_datetime:fixed_datetime||new Date().toISOString(), fix_done_details:fix_done_details||'', parts_replaced:parts_replaced||'', charges_applicable:!!charges_applicable, charge_amount:+charge_amount||issue.charge_amount, amount_paid:+amount_paid||issue.amount_paid, balance_amount:+balance_amount||issue.balance_amount, payment_mode:payment_mode||issue.payment_mode, returned_to_customer:!!returned_to_customer, returned_datetime:returned_datetime||null, final_notes:final_notes||'', payment_date:new Date().toISOString().split('T')[0], updated_at:new Date() });
  res.json({ message: 'Issue marked as fixed', issue });
});

router.put('/issues/:id/payment', async (req, res) => {
  const { amount_paid, paid_via } = req.body;
  const paid = +amount_paid;
  if (paid <= 0) return res.status(400).json({ message: 'Amount must be greater than 0' });
  if (!paid_via) return res.status(400).json({ message: 'Paid Via required' });
  if (!USE_MOCK) {
    const i = await q('SELECT charge_amount, amount_paid FROM product_issues WHERE id=$1', [req.params.id]);
    if (!i.rows.length) return res.status(404).json({ message: 'Not found' });
    const newPaid = (+i.rows[0].amount_paid||0) + paid;
    if (newPaid > (+i.rows[0].charge_amount||0)) return res.status(400).json({ message: 'Total paid cannot exceed charge amount' });
    await q('UPDATE product_issues SET amount_paid=$1, balance_amount=$2, payment_mode=$3, payment_date=NOW(), updated_at=NOW() WHERE id=$4', [newPaid, (+i.rows[0].charge_amount||0)-newPaid, paid_via, req.params.id]);
    return res.json({ message: 'Payment updated' });
  }
  const issue = mock.issues.find(i => i.id === +req.params.id);
  if (!issue) return res.status(404).json({ message: 'Not found' });
  const newPaid = (+issue.amount_paid||0) + paid;
  if (newPaid > (+issue.charge_amount||0)) return res.status(400).json({ message: 'Total paid cannot exceed charge amount' });
  issue.amount_paid = newPaid; issue.balance_amount = (+issue.charge_amount||0) - newPaid; issue.payment_mode = paid_via; issue.updated_at = new Date();
  res.json({ message: 'Payment updated' });
});

router.put('/issues/:id', async (req, res) => {
  const { issue_status, issue_description, charges_applicable, charge_reason, charge_amount, amount_paid, balance_amount, payment_mode, final_notes } = req.body;
  if (!USE_MOCK) { await q(`UPDATE product_issues SET issue_status=COALESCE($1,issue_status), issue_description=COALESCE($2,issue_description), charge_amount=COALESCE($3,charge_amount), amount_paid=COALESCE($4,amount_paid), balance_amount=COALESCE($5,balance_amount), payment_mode=COALESCE($6,payment_mode), updated_at=NOW() WHERE id=$7`, [issue_status, issue_description, charge_amount!=null?+charge_amount:null, amount_paid!=null?+amount_paid:null, balance_amount!=null?+balance_amount:null, payment_mode||null, req.params.id]); return res.json({ message:'Updated' }); }
  const issue = mock.issues.find(i => i.id === +req.params.id);
  if (!issue) return res.status(404).json({ message: 'Not found' });
  if (issue_status) issue.issue_status=issue_status; if (issue_description) issue.issue_description=issue_description;
  if (charge_amount!==undefined) issue.charge_amount=+charge_amount; if (amount_paid!==undefined) issue.amount_paid=+amount_paid;
  if (balance_amount!==undefined) issue.balance_amount=+balance_amount; if (payment_mode) issue.payment_mode=payment_mode; issue.updated_at=new Date();
  res.json({ message:'Updated', issue });
});


// WARRANTY EDIT
router.put('/customer-product/:id/warranty', async (req, res) => {
  const { warranty_available, warranty_start_date, warranty_end_date, warranty_extended, extended_warranty_end_date, warranty_extension_reason } = req.body;
  if (!USE_MOCK) {
    const old = await q('SELECT warranty_end_date, extended_warranty_end_date FROM customer_product_history WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ message: 'Not found' });
    await q('INSERT INTO warranty_audit_logs(customer_product_history_id,old_warranty_end,new_warranty_end,reason) VALUES($1,$2,$3,$4)', [req.params.id, old.rows[0].extended_warranty_end_date||old.rows[0].warranty_end_date, extended_warranty_end_date||warranty_end_date, warranty_extension_reason||'Updated']);
    await q(`UPDATE customer_product_history SET warranty_available=COALESCE($1,warranty_available), warranty_start_date=COALESCE($2,warranty_start_date), warranty_end_date=COALESCE($3,warranty_end_date), warranty_extended=COALESCE($4,warranty_extended), extended_warranty_end_date=COALESCE($5,extended_warranty_end_date), warranty_extension_reason=COALESCE($6,warranty_extension_reason), updated_at=NOW() WHERE id=$7`,
      [warranty_available!=null?!!warranty_available:null, warranty_start_date||null, warranty_end_date||null, warranty_extended!=null?!!warranty_extended:null, extended_warranty_end_date||null, warranty_extension_reason||null, req.params.id]);
    return res.json({ message: 'Warranty updated' });
  }
  const cph = mock.cph.find(h => h.id === +req.params.id);
  if (!cph) return res.status(404).json({ message: 'Not found' });
  mock.wal.push({ id:mock.nid.w++, customer_product_history_id:cph.id, old_warranty_end:cph.extended_warranty_end_date||cph.warranty_end_date, new_warranty_end:extended_warranty_end_date||warranty_end_date||cph.warranty_end_date, reason:warranty_extension_reason||'Updated', created_at:new Date() });
  if (warranty_available!==undefined) cph.warranty_available=!!warranty_available;
  if (warranty_start_date) cph.warranty_start_date=warranty_start_date;
  if (warranty_end_date) cph.warranty_end_date=warranty_end_date;
  if (warranty_extended!==undefined) cph.warranty_extended=!!warranty_extended;
  if (extended_warranty_end_date) cph.extended_warranty_end_date=extended_warranty_end_date;
  if (warranty_extension_reason) cph.warranty_extension_reason=warranty_extension_reason;
  cph.updated_at=new Date();
  res.json({ message: 'Warranty updated', record: cph });
});

// CUSTOMER PRODUCT DETAIL
router.get('/customer-product/:id', async (req, res) => {
  if (!USE_MOCK) {
    const r = await q(`SELECT h.*, c.name as customer_name, c.phone as customer_phone, p.name as product_name FROM customer_product_history h JOIN customers c ON c.id=h.customer_id JOIN products p ON p.id=h.product_id WHERE h.id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Not found' });
    const issues = await q('SELECT * FROM product_issues WHERE customer_product_history_id=$1 ORDER BY issue_date', [req.params.id]);
    const row = r.rows[0]; const end = row.extended_warranty_end_date || row.warranty_end_date;
    row.warranty_status = end && new Date(end) >= new Date() ? 'Under Warranty' : 'Warranty Expired';
    row.issues = issues.rows; row.issue_count = issues.rows.length;
    row.total_charges = issues.rows.reduce((s,i)=>s+(+i.charge_amount||0),0);
    row.total_paid = issues.rows.reduce((s,i)=>s+(+i.amount_paid||0),0);
    row.total_balance = issues.rows.reduce((s,i)=>s+(+i.balance_amount||0),0);
    row.last_issue_date = issues.rows.length ? issues.rows[issues.rows.length-1].issue_date : null;
    return res.json(row);
  }
  const cph = mock.cph.find(h => h.id === +req.params.id);
  if (!cph) return res.status(404).json({ message: 'Not found' });
  const customer = mock.customers.find(c => c.id === cph.customer_id);
  const product = mock.products.find(p => p.id === cph.product_id);
  const issues = mock.issues.filter(i => i.customer_product_history_id === cph.id);
  const end = cph.extended_warranty_end_date || cph.warranty_end_date;
  res.json({ ...cph, customer_name:customer?customer.name:'-', customer_phone:customer?customer.phone:'-', product_name:product?product.name:'-', warranty_status: end&&new Date(end)>=new Date()?'Under Warranty':'Warranty Expired', issues, issue_count:issues.length, total_charges:issues.reduce((s,i)=>s+(+i.charge_amount||0),0), total_paid:issues.reduce((s,i)=>s+(+i.amount_paid||0),0), total_balance:issues.reduce((s,i)=>s+(+i.balance_amount||0),0), last_issue_date:issues.length?issues.sort((a,b)=>new Date(b.issue_date)-new Date(a.issue_date))[0].issue_date:null });
});

router.put('/customer-product/:id', async (req, res) => {
  const { quantity, purchased_on, payment_status, amount_paid, notes } = req.body;
  if (!USE_MOCK) { await q('UPDATE customer_product_history SET quantity=COALESCE($1,quantity), purchased_on=COALESCE($2,purchased_on), payment_status=COALESCE($3,payment_status), amount_paid=COALESCE($4,amount_paid), notes=COALESCE($5,notes), updated_at=NOW() WHERE id=$6', [quantity?+quantity:null, purchased_on||null, payment_status||null, amount_paid?+amount_paid:null, notes||null, req.params.id]); return res.json({ message:'Updated' }); }
  const cph = mock.cph.find(h => h.id === +req.params.id);
  if (!cph) return res.status(404).json({ message: 'Not found' });
  if (quantity) cph.quantity=+quantity; if (purchased_on) cph.purchased_on=purchased_on;
  if (payment_status) cph.payment_status=payment_status; if (amount_paid) cph.amount_paid=+amount_paid;
  if (notes) cph.notes=notes; cph.updated_at=new Date();
  res.json({ message:'Updated', record:cph });
});

// MAINTENANCE ONLY RECORDS
router.post('/maintenance', async (req, res) => {
  const { name, phone, category, product_name, issue_description, issue_datetime, issue_status, notes, charges_applicable, charges, amount_paid, paid_via, fixed_datetime, fix_done_details } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Customer name required' });
  if (/^\d+$/.test(name.trim())) return res.status(400).json({ message: 'Customer name cannot be only numbers' });
  if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ message: 'Phone number must be 10 digits' });
  if (!category) return res.status(400).json({ message: 'Category required' });
  if (!product_name || !product_name.trim()) return res.status(400).json({ message: 'Product name required' });
  if (!issue_description || !issue_description.trim()) return res.status(400).json({ message: 'Issue description required' });
  const status = issue_status || 'Reported';
  if (status === 'Fixed' && (!fix_done_details || !fix_done_details.trim())) return res.status(400).json({ message: 'Fix done details required when status is Fixed' });
  if (status === 'Fixed' && fixed_datetime && issue_datetime && new Date(fixed_datetime) < new Date(issue_datetime)) return res.status(400).json({ message: 'Fixed date cannot be before issue date' });

  let totalCharges = 0;
  if (charges_applicable && charges && charges.length) {
    for (const ch of charges) { if (!ch.price || +ch.price <= 0) return res.status(400).json({ message: 'Charge item price must be greater than 0' }); totalCharges += +ch.price; }
  } else if (charges_applicable) return res.status(400).json({ message: 'At least one charge row required' });

  const paid = +amount_paid || 0;
  if (paid > totalCharges && totalCharges > 0) return res.status(400).json({ message: 'Amount paid cannot exceed total charges' });
  if (paid > 0 && !paid_via) return res.status(400).json({ message: 'Paid Via required when amount paid > 0' });
  const balance = totalCharges - paid;
  const payStatus = totalCharges === 0 ? 'N/A' : paid >= totalCharges ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Pending';

  if (!USE_MOCK) {
    let custId;
    const cr = await q('SELECT id FROM customers WHERE phone=$1 AND deleted_at IS NULL', [phone]);
    if (cr.rows.length) { custId = cr.rows[0].id; await q('UPDATE customers SET name=$1, updated_at=NOW() WHERE id=$2', [name.trim(), custId]); }
    else { const ins = await q('INSERT INTO customers(name,phone) VALUES($1,$2) RETURNING id', [name.trim(), phone]); custId = ins.rows[0].id; }
    const mr = await q(`INSERT INTO customer_maintenance(customer_id,category,product_name,issue_description,issue_datetime,issue_status,fixed_datetime,fix_done_details,charges_applicable,total_charges,amount_paid,balance_amount,paid_via,payment_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [custId, category, product_name.trim(), issue_description.trim(), issue_datetime||new Date(), status, status==='Fixed'?(fixed_datetime||new Date()):null, fix_done_details||'', !!charges_applicable, totalCharges, paid, balance, paid_via||'', payStatus, notes||'']);
    if (charges_applicable && charges && charges.length) {
      for (const ch of charges) await q('INSERT INTO maintenance_charges(maintenance_id,part_service_name,description,price) VALUES($1,$2,$3,$4)', [mr.rows[0].id, ch.name, ch.description||'', +ch.price]);
    }
    await q('INSERT INTO customer_timeline(customer_id,entry_type,reference_id,reference_type,event_type,event_description) VALUES($1,$2,$3,$4,$5,$6)', [custId, 'Maintenance Only', mr.rows[0].id, 'customer_maintenance', 'maintenance_created', 'Maintenance record created for '+product_name.trim()]);
    return res.json({ message: 'Maintenance record saved', id: mr.rows[0].id });
  }
  // Mock
  let customer = mock.customers.find(c => c.phone === phone && !c.deleted_at);
  if (!customer) { customer = { id: mock.nid.c++, name: name.trim(), phone, created_at: new Date(), updated_at: new Date(), deleted_at: null }; mock.customers.push(customer); }
  else { customer.name = name.trim(); customer.updated_at = new Date(); }
  const maint = { id: mock.nid.m++, customer_id: customer.id, category, product_name: product_name.trim(), issue_description: issue_description.trim(), issue_datetime: issue_datetime||new Date().toISOString(), issue_status: status, fixed_datetime: status==='Fixed'?(fixed_datetime||new Date().toISOString()):null, fix_done_details: fix_done_details||'', charges_applicable: !!charges_applicable, total_charges: totalCharges, amount_paid: paid, balance_amount: balance, paid_via: paid_via||'', payment_status: payStatus, notes: notes||'', created_at: new Date(), updated_at: new Date() };
  mock.maint.push(maint);
  if (charges_applicable && charges && charges.length) {
    charges.forEach(ch => mock.mcharges.push({ id: mock.nid.mc++, maintenance_id: maint.id, part_service_name: ch.name, description: ch.description||'', price: +ch.price, created_at: new Date() }));
  }
  mock.timeline.push({ id: mock.nid.tl++, customer_id: customer.id, entry_type: 'Maintenance Only', reference_id: maint.id, reference_type: 'customer_maintenance', event_type: 'maintenance_created', event_description: 'Maintenance record created for '+product_name.trim(), created_at: new Date() });
  res.json({ message: 'Maintenance record saved', id: maint.id });
});

router.get('/maintenance/:id', async (req, res) => {
  if (!USE_MOCK) {
    const r = await q('SELECT m.*, c.name as customer_name, c.phone as customer_phone FROM customer_maintenance m JOIN customers c ON c.id=m.customer_id WHERE m.id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Not found' });
    const charges = await q('SELECT * FROM maintenance_charges WHERE maintenance_id=$1', [req.params.id]);
    r.rows[0].charges = charges.rows;
    return res.json(r.rows[0]);
  }
  const m = mock.maint.find(x => x.id === +req.params.id);
  if (!m) return res.status(404).json({ message: 'Not found' });
  const c = mock.customers.find(x => x.id === m.customer_id);
  const charges = mock.mcharges.filter(x => x.maintenance_id === m.id);
  res.json({ ...m, customer_name: c?c.name:'-', customer_phone: c?c.phone:'-', charges });
});

router.put('/maintenance/:id/fix', async (req, res) => {
  const { fixed_datetime, fix_done_details, issue_datetime } = req.body;
  if (!fix_done_details || !fix_done_details.trim()) return res.status(400).json({ message: 'Fix done details required' });
  if (fixed_datetime && issue_datetime && new Date(fixed_datetime) < new Date(issue_datetime)) return res.status(400).json({ message: 'Fixed date cannot be before issue date' });
  if (!USE_MOCK) {
    await q(`UPDATE customer_maintenance SET issue_status='Fixed', fixed_datetime=$1, fix_done_details=$2, updated_at=NOW() WHERE id=$3`, [fixed_datetime||new Date(), fix_done_details.trim(), req.params.id]);
    const m = await q('SELECT customer_id, product_name FROM customer_maintenance WHERE id=$1', [req.params.id]);
    if (m.rows.length) await q('INSERT INTO customer_timeline(customer_id,entry_type,reference_id,reference_type,event_type,event_description) VALUES($1,$2,$3,$4,$5,$6)', [m.rows[0].customer_id, 'Maintenance Only', +req.params.id, 'customer_maintenance', 'issue_fixed', 'Issue fixed for '+m.rows[0].product_name]);
    return res.json({ message: 'Marked as fixed' });
  }
  const m = mock.maint.find(x => x.id === +req.params.id);
  if (!m) return res.status(404).json({ message: 'Not found' });
  m.issue_status = 'Fixed'; m.fixed_datetime = fixed_datetime||new Date().toISOString(); m.fix_done_details = fix_done_details.trim(); m.updated_at = new Date();
  mock.timeline.push({ id: mock.nid.tl++, customer_id: m.customer_id, entry_type: 'Maintenance Only', reference_id: m.id, reference_type: 'customer_maintenance', event_type: 'issue_fixed', event_description: 'Issue fixed for '+m.product_name, created_at: new Date() });
  res.json({ message: 'Marked as fixed' });
});

router.put('/maintenance/:id/payment', async (req, res) => {
  const { amount_paid, paid_via } = req.body;
  const paid = +amount_paid;
  if (paid < 0) return res.status(400).json({ message: 'Amount cannot be negative' });
  if (paid > 0 && !paid_via) return res.status(400).json({ message: 'Paid Via required when amount > 0' });
  if (!USE_MOCK) {
    const m = await q('SELECT total_charges, amount_paid, customer_id, product_name FROM customer_maintenance WHERE id=$1', [req.params.id]);
    if (!m.rows.length) return res.status(404).json({ message: 'Not found' });
    const newPaid = +m.rows[0].amount_paid + paid;
    if (newPaid > +m.rows[0].total_charges) return res.status(400).json({ message: 'Total paid cannot exceed total charges' });
    const balance = +m.rows[0].total_charges - newPaid;
    const status = newPaid >= +m.rows[0].total_charges ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Pending';
    await q('UPDATE customer_maintenance SET amount_paid=$1, balance_amount=$2, paid_via=$3, payment_status=$4, updated_at=NOW() WHERE id=$5', [newPaid, balance, paid_via||'', status, req.params.id]);
    await q('INSERT INTO customer_timeline(customer_id,entry_type,reference_id,reference_type,event_type,event_description) VALUES($1,$2,$3,$4,$5,$6)', [m.rows[0].customer_id, 'Maintenance Only', +req.params.id, 'customer_maintenance', 'payment_updated', 'Payment updated: ₹'+paid+' via '+(paid_via||'N/A')]);
    return res.json({ message: 'Payment updated' });
  }
  const m = mock.maint.find(x => x.id === +req.params.id);
  if (!m) return res.status(404).json({ message: 'Not found' });
  const newPaid = m.amount_paid + paid;
  if (newPaid > m.total_charges) return res.status(400).json({ message: 'Total paid cannot exceed total charges' });
  m.amount_paid = newPaid; m.balance_amount = m.total_charges - newPaid; m.paid_via = paid_via||m.paid_via;
  m.payment_status = newPaid >= m.total_charges ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Pending'; m.updated_at = new Date();
  mock.timeline.push({ id: mock.nid.tl++, customer_id: m.customer_id, entry_type: 'Maintenance Only', reference_id: m.id, reference_type: 'customer_maintenance', event_type: 'payment_updated', event_description: 'Payment updated: ₹'+paid+' via '+(paid_via||'N/A'), created_at: new Date() });
  res.json({ message: 'Payment updated' });
});

router.delete('/maintenance/:id', async (req, res) => {
  if (!USE_MOCK) { await q('DELETE FROM maintenance_charges WHERE maintenance_id=$1', [req.params.id]); await q('DELETE FROM customer_maintenance WHERE id=$1', [req.params.id]); return res.json({ message: 'Deleted' }); }
  mock.mcharges = mock.mcharges.filter(x => x.maintenance_id !== +req.params.id);
  mock.maint = mock.maint.filter(x => x.id !== +req.params.id);
  res.json({ message: 'Deleted' });
});

// CUSTOMER PAYMENT UPDATE (for product purchase)
router.put('/customer-product/:id/payment', async (req, res) => {
  const { amount_paid, paid_via } = req.body;
  const paid = +amount_paid;
  if (paid < 0) return res.status(400).json({ message: 'Amount cannot be negative' });
  if (paid > 0 && !paid_via) return res.status(400).json({ message: 'Paid Via required when amount > 0' });
  if (!USE_MOCK) {
    const h = await q('SELECT total_amount, amount_paid, customer_id FROM customer_product_history WHERE id=$1', [req.params.id]);
    if (!h.rows.length) return res.status(404).json({ message: 'Not found' });
    const newPaid = +h.rows[0].amount_paid + paid;
    if (newPaid > +h.rows[0].total_amount) return res.status(400).json({ message: 'Total paid cannot exceed total amount' });
    const balance = +h.rows[0].total_amount - newPaid;
    const status = newPaid >= +h.rows[0].total_amount ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Pending';
    await q('UPDATE customer_product_history SET amount_paid=$1, balance_amount=$2, paid_via=$3, payment_status=$4, updated_at=NOW() WHERE id=$5', [newPaid, balance, paid_via||'', status, req.params.id]);
    await q('INSERT INTO customer_timeline(customer_id,entry_type,reference_id,reference_type,event_type,event_description) VALUES($1,$2,$3,$4,$5,$6)', [h.rows[0].customer_id, 'Product Purchase', +req.params.id, 'customer_product_history', 'payment_updated', 'Payment updated: ₹'+paid+' via '+(paid_via||'N/A')]);
    return res.json({ message: 'Payment updated' });
  }
  const h = mock.cph.find(x => x.id === +req.params.id);
  if (!h) return res.status(404).json({ message: 'Not found' });
  const newPaid = h.amount_paid + paid;
  if (newPaid > h.total_amount) return res.status(400).json({ message: 'Total paid cannot exceed total amount' });
  h.amount_paid = newPaid; h.balance_amount = h.total_amount - newPaid; h.paid_via = paid_via||h.paid_via;
  h.payment_status = newPaid >= h.total_amount ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Pending'; h.updated_at = new Date();
  mock.timeline.push({ id: mock.nid.tl++, customer_id: h.customer_id, entry_type: 'Product Purchase', reference_id: h.id, reference_type: 'customer_product_history', event_type: 'payment_updated', event_description: 'Payment updated: ₹'+paid+' via '+(paid_via||'N/A'), created_at: new Date() });
  res.json({ message: 'Payment updated' });
});

// CUSTOMER TIMELINE
router.get('/customers/:id/timeline', async (req, res) => {
  if (!USE_MOCK) {
    const r = await q('SELECT * FROM customer_timeline WHERE customer_id=$1 ORDER BY created_at DESC', [req.params.id]);
    return res.json(r.rows);
  }
  res.json(mock.timeline.filter(t => t.customer_id === +req.params.id).sort((a,b) => new Date(b.created_at)-new Date(a.created_at)));
});

module.exports = router;
