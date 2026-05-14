const express = require('express');
const router = express.Router();
let pool = null, USE_MOCK = true;
router.setPool = (p, m) => { pool = p; USE_MOCK = m; };
const q = async (text, params) => USE_MOCK ? null : pool.query(text, params);

let mock = { customers: [], products: [], cph: [], vsh: [], issues: [], itx: [], wal: [], nid: { c:1, p:1, h:1, v:1, i:1, t:1, w:1 } };

// CUSTOMERS
router.get('/customers', async (req, res) => {
  const { search } = req.query;
  if (!USE_MOCK) {
    const s = search ? `%${search}%` : '%';
    const r = await q(`SELECT c.id, c.name, c.phone, h.id as cph_id, p.name as product_name, h.quantity, h.purchased_on, h.warranty_end_date, h.payment_status
      FROM customers c LEFT JOIN customer_product_history h ON h.customer_id=c.id LEFT JOIN products p ON p.id=h.product_id
      WHERE c.deleted_at IS NULL AND (c.name ILIKE $1 OR c.phone ILIKE $1) ORDER BY c.created_at DESC`, [s]);
    return res.json(r.rows);
  }
  let list = mock.customers.filter(c => !c.deleted_at);
  if (search) { const s = search.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s)); }
  const result = [];
  for (const c of list) {
    const recs = mock.cph.filter(h => h.customer_id === c.id);
    if (!recs.length) result.push({ ...c, product_name: '-', quantity: 0, purchased_on: null, warranty_end_date: null, payment_status: '-' });
    else recs.forEach(r => { const p = mock.products.find(x => x.id === r.product_id); result.push({ ...c, cph_id: r.id, product_name: p ? p.name : '-', quantity: r.quantity, purchased_on: r.purchased_on, warranty_end_date: r.warranty_end_date, payment_status: r.payment_status }); });
  }
  res.json(result);
});

router.get('/customers/:id', async (req, res) => {
  if (!USE_MOCK) { const r = await q('SELECT * FROM customers WHERE id=$1 AND deleted_at IS NULL', [req.params.id]); return res.json(r.rows[0] || {}); }
  const c = mock.customers.find(x => x.id === +req.params.id && !x.deleted_at);
  res.json(c || {});
});

router.post('/customers', async (req, res) => {
  const { name, phone, product_id, quantity, purchased_on, warranty_available, warranty_start_date, warranty_end_date, payment_status, amount_paid, notes } = req.body;
  if (!name || !phone) return res.status(400).json({ message: 'Name and phone required' });

  if (!USE_MOCK) {
    let cr = await q('SELECT id FROM customers WHERE phone=$1 AND deleted_at IS NULL', [phone]);
    let custId;
    if (cr.rows.length) { custId = cr.rows[0].id; await q('UPDATE customers SET name=$1, updated_at=NOW() WHERE id=$2', [name, custId]); }
    else { const ins = await q('INSERT INTO customers(name,phone) VALUES($1,$2) RETURNING id', [name, phone]); custId = ins.rows[0].id; }
    if (product_id) {
      const pr = await q('SELECT current_quantity FROM products WHERE id=$1 AND deleted_at IS NULL', [product_id]);
      if (!pr.rows.length) return res.status(400).json({ message: 'Product not found' });
      const qty = +quantity || 1;
      if (qty > pr.rows[0].current_quantity) return res.status(400).json({ message: 'Stock not available. Available: ' + pr.rows[0].current_quantity });
      await q(`INSERT INTO customer_product_history(customer_id,product_id,quantity,purchased_on,warranty_available,warranty_start_date,warranty_end_date,payment_status,amount_paid,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [custId, product_id, qty, purchased_on, !!warranty_available, warranty_start_date||null, warranty_end_date||null, payment_status||'Pending', +amount_paid||0, notes||'']);
      const newQty = pr.rows[0].current_quantity - qty;
      await q('UPDATE products SET current_quantity=$1, updated_at=NOW() WHERE id=$2', [newQty, product_id]);
      await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_out,balance_after,reference_type,notes) VALUES($1,'Customer Product Given/Sold',$2,$3,'customer_product_history',$4)`, [product_id, qty, newQty, 'Sold to '+name]);
    }
    return res.json({ message: 'Customer record saved', customer: { id: custId, name, phone } });
  }
  // Mock
  let customer = mock.customers.find(c => c.phone === phone && !c.deleted_at);
  if (!customer) { customer = { id: mock.nid.c++, name, phone, created_at: new Date(), updated_at: new Date(), deleted_at: null }; mock.customers.push(customer); }
  else { customer.name = name; customer.updated_at = new Date(); }
  if (product_id) {
    const product = mock.products.find(p => p.id === +product_id && !p.deleted_at);
    if (!product) return res.status(400).json({ message: 'Product not found' });
    const qty = +quantity || 1;
    if (qty > product.current_quantity) return res.status(400).json({ message: 'Stock not available. Available: ' + product.current_quantity });
    mock.cph.push({ id: mock.nid.h++, customer_id: customer.id, product_id: +product_id, quantity: qty, purchased_on: purchased_on||new Date().toISOString().split('T')[0], warranty_available: !!warranty_available, warranty_start_date: warranty_start_date||null, warranty_end_date: warranty_end_date||null, warranty_extended: false, extended_warranty_end_date: null, warranty_extension_reason: null, payment_status: payment_status||'Pending', amount_paid: +amount_paid||0, notes: notes||'', created_at: new Date(), updated_at: new Date() });
    product.current_quantity -= qty;
    mock.itx.push({ id: mock.nid.t++, product_id: +product_id, transaction_type: 'Customer Product Given/Sold', quantity_in: 0, quantity_out: qty, balance_after: product.current_quantity, reference_type: 'customer_product_history', notes: 'Sold to '+name, created_at: new Date() });
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
  if (!USE_MOCK) { await q('UPDATE customers SET deleted_at=NOW() WHERE id=$1', [req.params.id]); return res.json({ message: 'Deleted' }); }
  const c = mock.customers.find(x => x.id === +req.params.id); if (c) c.deleted_at = new Date();
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


// PRODUCTS
router.get('/products', async (req, res) => {
  const { search } = req.query;
  if (!USE_MOCK) { const s = search ? `%${search}%` : '%'; const r = await q(`SELECT * FROM products WHERE deleted_at IS NULL AND (name ILIKE $1 OR category ILIKE $1 OR brand ILIKE $1) ORDER BY name`, [s]); return res.json(r.rows); }
  let list = mock.products.filter(p => !p.deleted_at);
  if (search) { const s = search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(s) || (p.category||'').toLowerCase().includes(s) || (p.brand||'').toLowerCase().includes(s)); }
  res.json(list);
});

router.get('/products/:id', async (req, res) => {
  if (!USE_MOCK) { const r = await q('SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL', [req.params.id]); return res.json(r.rows[0]||{}); }
  res.json(mock.products.find(x => x.id === +req.params.id && !x.deleted_at) || {});
});

router.post('/products', async (req, res) => {
  const { name, category, brand, current_quantity, purchase_price, selling_price, warranty_available, warranty_period, low_stock_quantity, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'Product name required' });
  const qty = +current_quantity || 0;
  if (!USE_MOCK) {
    const r = await q(`INSERT INTO products(name,category,brand,current_quantity,purchase_price,selling_price,warranty_available,warranty_period,low_stock_quantity,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category||'', brand||'', qty, +purchase_price||0, +selling_price||0, !!warranty_available, warranty_period||'', +low_stock_quantity||5, notes||'']);
    if (qty > 0) await q(`INSERT INTO inventory_transactions(product_id,transaction_type,quantity_in,balance_after,reference_type,notes) VALUES($1,'Opening Stock',$2,$2,'product','Opening stock')`, [r.rows[0].id, qty]);
    return res.json({ message: 'Product added', product: r.rows[0] });
  }
  const product = { id: mock.nid.p++, name, category:category||'', brand:brand||'', current_quantity:qty, purchase_price:+purchase_price||0, selling_price:+selling_price||0, warranty_available:!!warranty_available, warranty_period:warranty_period||'', low_stock_quantity:+low_stock_quantity||5, notes:notes||'', created_at:new Date(), updated_at:new Date(), deleted_at:null };
  mock.products.push(product);
  if (qty > 0) mock.itx.push({ id:mock.nid.t++, product_id:product.id, transaction_type:'Opening Stock', quantity_in:qty, quantity_out:0, balance_after:qty, reference_type:'product', notes:'Opening stock', created_at:new Date() });
  res.json({ message: 'Product added', product });
});

router.put('/products/:id', async (req, res) => {
  const { name, category, brand, purchase_price, selling_price, warranty_available, warranty_period, low_stock_quantity, notes } = req.body;
  if (!USE_MOCK) { await q(`UPDATE products SET name=COALESCE($1,name),category=COALESCE($2,category),brand=COALESCE($3,brand),purchase_price=COALESCE($4,purchase_price),selling_price=COALESCE($5,selling_price),warranty_available=COALESCE($6,warranty_available),warranty_period=COALESCE($7,warranty_period),low_stock_quantity=COALESCE($8,low_stock_quantity),notes=COALESCE($9,notes),updated_at=NOW() WHERE id=$10`,
    [name,category,brand,purchase_price?+purchase_price:null,selling_price?+selling_price:null,warranty_available!=null?!!warranty_available:null,warranty_period,low_stock_quantity?+low_stock_quantity:null,notes,req.params.id]); return res.json({ message:'Updated' }); }
  const p = mock.products.find(x => x.id === +req.params.id && !x.deleted_at);
  if (!p) return res.status(404).json({ message: 'Not found' });
  if (name) p.name=name; if (category!==undefined) p.category=category; if (brand!==undefined) p.brand=brand;
  if (purchase_price!==undefined) p.purchase_price=+purchase_price; if (selling_price!==undefined) p.selling_price=+selling_price;
  if (warranty_available!==undefined) p.warranty_available=!!warranty_available; if (warranty_period!==undefined) p.warranty_period=warranty_period;
  if (low_stock_quantity!==undefined) p.low_stock_quantity=+low_stock_quantity; if (notes!==undefined) p.notes=notes;
  p.updated_at=new Date();
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
    let sql = `SELECT i.*, c.name as customer_name, c.phone as customer_phone, p.name as product_name FROM product_issues i JOIN customer_product_history h ON h.id=i.customer_product_history_id JOIN customers c ON c.id=h.customer_id JOIN products p ON p.id=h.product_id WHERE 1=1`;
    const params = [];
    if (customer_product_history_id) { params.push(customer_product_history_id); sql += ` AND i.customer_product_history_id=$${params.length}`; }
    if (status) { params.push(status); sql += ` AND i.issue_status=$${params.length}`; }
    sql += ' ORDER BY i.issue_date DESC';
    const r = await q(sql, params); return res.json(r.rows);
  }
  let list = mock.issues;
  if (customer_product_history_id) list = list.filter(i => i.customer_product_history_id === +customer_product_history_id);
  if (status) list = list.filter(i => i.issue_status === status);
  res.json(list.map(i => { const h = mock.cph.find(x=>x.id===i.customer_product_history_id); const c = h?mock.customers.find(x=>x.id===h.customer_id):null; const p = h?mock.products.find(x=>x.id===h.product_id):null; return { ...i, customer_name:c?c.name:'-', customer_phone:c?c.phone:'-', product_name:p?p.name:'-' }; }).sort((a,b)=>new Date(b.issue_date)-new Date(a.issue_date)));
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

router.put('/issues/:id', async (req, res) => {
  const { issue_status, issue_description, charges_applicable, charge_reason, charge_amount, amount_paid, balance_amount, payment_mode, final_notes } = req.body;
  if (!USE_MOCK) { await q(`UPDATE product_issues SET issue_status=COALESCE($1,issue_status), issue_description=COALESCE($2,issue_description), charge_amount=COALESCE($3,charge_amount), amount_paid=COALESCE($4,amount_paid), balance_amount=COALESCE($5,balance_amount), updated_at=NOW() WHERE id=$6`, [issue_status, issue_description, charge_amount?+charge_amount:null, amount_paid?+amount_paid:null, balance_amount?+balance_amount:null, req.params.id]); return res.json({ message:'Updated' }); }
  const issue = mock.issues.find(i => i.id === +req.params.id);
  if (!issue) return res.status(404).json({ message: 'Not found' });
  if (issue_status) issue.issue_status=issue_status; if (issue_description) issue.issue_description=issue_description;
  if (charge_amount!==undefined) issue.charge_amount=+charge_amount; if (amount_paid!==undefined) issue.amount_paid=+amount_paid;
  if (balance_amount!==undefined) issue.balance_amount=+balance_amount; issue.updated_at=new Date();
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

module.exports = router;
