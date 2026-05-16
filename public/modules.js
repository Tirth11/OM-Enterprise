// AUM Enterprise - Modules JS (Customers, Inventory, Issues)
const API = '/api';

async function api(path, opts = {}) {
  const res = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return res.json();
}

function refreshDashboardCounts() {
  if (window.dashboardInstance) window.dashboardInstance.loadRealData();
  if (window.dashboard) window.dashboard.loadData();
}

// Toast notification (replaces alert)
function showToast(msg, type = 'error') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  toast.innerHTML = `<div class="toast-content"><i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i><span>${msg}</span></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// Confirm modal (replaces confirm())
function showConfirm(title, msg, onYes) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  const btn = document.getElementById('confirmYesBtn');
  btn.onclick = () => { hideModal('confirmModal'); onYes(); };
  showModal('confirmModal');
}

// Loading state for save buttons
function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) { btn.dataset.origText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...'; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.origText || 'Save'; btn.disabled = false; }
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
function formatCurrency(n) { return '₹' + (+n || 0).toLocaleString('en-IN'); }

function showModal(id) { document.getElementById(id).classList.add('active'); }
function hideModal(id) { document.getElementById(id).classList.remove('active'); }

function getWarrantyBadge(endDate, extendedEnd) {
  const end = extendedEnd || endDate;
  if (!end) return '<span class="badge badge-secondary">N/A</span>';
  return new Date(end) >= new Date() ? '<span class="badge badge-success">Under Warranty</span>' : '<span class="badge badge-danger">Expired</span>';
}

function getStatusBadge(status) {
  const map = { 'Paid': 'success', 'Pending': 'warning', 'Partially Paid': 'info', 'Reported': 'warning', 'Checking': 'info', 'Fixed': 'success', 'Returned to Customer': 'success', 'Rejected': 'danger' };
  return `<span class="badge badge-${map[status] || 'secondary'}">${status || '-'}</span>`;
}

// ============================================================================
// CUSTOMERS MODULE (loadCustomers & renderCustomers defined at bottom with filters)
// ============================================================================

let allProducts = [];

async function openAddCustomerModal() {
  document.getElementById('customerForm').reset();
  document.getElementById('customerFormTitle').textContent = 'Add Customer Record';
  document.getElementById('customerFormId').value = '';
  document.getElementById('customerEntryType').value = '';
  document.getElementById('entryTypeSelection').style.display = 'block';
  document.getElementById('customerFormFields').style.display = 'none';
  document.getElementById('purchaseFields').style.display = 'none';
  document.getElementById('maintenanceFields').style.display = 'none';
  document.getElementById('productDetailsPanel').style.display = 'none';
  showModal('customerModal');
}

function selectEntryType(type) {
  document.getElementById('customerEntryType').value = type;
  document.getElementById('entryTypeSelection').style.display = 'none';
  document.getElementById('customerFormFields').style.display = 'block';
  if (type === 'purchase') {
    document.getElementById('purchaseFields').style.display = 'block';
    document.getElementById('maintenanceFields').style.display = 'none';
    document.getElementById('custPurchaseDate').value = new Date().toISOString().slice(0,16);
    document.getElementById('custAmountPaid').value = '0';
    loadProductCategoryDropdown();
  } else {
    document.getElementById('purchaseFields').style.display = 'none';
    document.getElementById('maintenanceFields').style.display = 'block';
    document.getElementById('maintIssueDate').value = new Date().toISOString().slice(0,16);
    document.getElementById('maintAmountPaid').value = '0';
    loadMaintDropdowns();
  }
}

function resetEntryType() {
  const entryType = document.getElementById('customerEntryType').value;
  if (entryType.startsWith('edit')) {
    hideModal('customerModal');
    return;
  }
  document.getElementById('customerEntryType').value = '';
  document.getElementById('entryTypeSelection').style.display = 'block';
  document.getElementById('customerFormFields').style.display = 'none';
}

async function loadProductCategoryDropdown() {
  const cats = await api('/categories');
  const sel = document.getElementById('custProdCategorySelect');
  sel.innerHTML = '<option value="">-- Select Category --</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  allProducts = await api('/products');
}

function onCategorySelected() {
  const cat = document.getElementById('custProdCategorySelect').value;
  const sel = document.getElementById('customerProductSelect');
  const filtered = cat ? allProducts.filter(p => p.category === cat) : allProducts;
  sel.innerHTML = '<option value="">-- Select Product --</option>' + filtered.map(p =>
    `<option value="${p.id}">${p.name} | ${p.brand||'-'} | Stock: ${p.current_quantity}</option>`
  ).join('');
  document.getElementById('productDetailsPanel').style.display = 'none';
}

function onProductSelected() {
  const pid = document.getElementById('customerProductSelect').value;
  const panel = document.getElementById('productDetailsPanel');
  if (!pid) { panel.style.display = 'none'; return; }
  const p = allProducts.find(x => x.id === +pid);
  if (!p) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  document.getElementById('custProdCategory').textContent = p.category || '-';
  document.getElementById('custProdBrand').textContent = p.brand || '-';
  document.getElementById('custProdStock').textContent = p.current_quantity;
  document.getElementById('custProdPrice').textContent = '₹' + (+p.selling_price||0).toLocaleString('en-IN');
  document.getElementById('custProdWarranty').textContent = p.warranty_available ? 'Yes' : 'No';
  document.getElementById('custProdWarrantyPeriod').textContent = p.warranty_available ? (p.warranty_period||'-') : '-';
  document.getElementById('custSellingPrice').value = p.selling_price || '';
  document.getElementById('custQuantity').value = 1;
  if (p.warranty_available && p.warranty_period) {
    const months = parseInt(p.warranty_period) * (p.warranty_period.toLowerCase().includes('year') ? 12 : 1) || 12;
    const start = new Date();
    const end = new Date(); end.setMonth(end.getMonth() + months);
    document.getElementById('custWarrantyEnd').value = end.toISOString().split('T')[0];
  } else {
    document.getElementById('custWarrantyEnd').value = '';
  }
  calcCustomerTotal();
}

async function loadProductDropdown() {
  allProducts = await api('/products');
  const sel = document.getElementById('customerProductSelect');
  sel.innerHTML = '<option value="">-- Select Product --</option>' + allProducts.map(p =>
    `<option value="${p.id}">${p.name} | ${p.brand||'-'} | Stock: ${p.current_quantity}</option>`
  ).join('');
}

async function loadMaintDropdowns() {
  const cats = await api('/categories');
  const sel = document.getElementById('maintCategory');
  sel.innerHTML = '<option value="">-- Select --</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('') + '<option value="__other__">Other (Add New)</option>';
  allProducts = await api('/products');
  updateMaintProductDropdown();
}

function updateMaintProductDropdown() {
  const cat = document.getElementById('maintCategory').value;
  const psel = document.getElementById('maintProductSelect');
  let filtered = allProducts;
  if (cat && cat !== '__other__') filtered = allProducts.filter(p => p.category === cat);
  const names = [...new Set(filtered.map(p => p.name))];
  psel.innerHTML = '<option value="">-- Select --</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('') + '<option value="__other__">Other (Add New)</option>';
  document.getElementById('maintNewProduct').style.display = 'none';
}

function toggleMaintNewCategory() {
  const v = document.getElementById('maintCategory').value;
  document.getElementById('maintNewCategory').style.display = v === '__other__' ? 'block' : 'none';
  if (v !== '__other__') updateMaintProductDropdown();
}
function toggleMaintNewProduct() { document.getElementById('maintNewProduct').style.display = document.getElementById('maintProductSelect').value === '__other__' ? 'block' : 'none'; }
function toggleMaintFixFields() { document.getElementById('maintFixFields').style.display = document.getElementById('maintIssueStatus').value === 'Fixed' ? 'block' : 'none'; }
function toggleMaintCharges() {
  const show = document.getElementById('maintChargesApplicable').checked;
  document.getElementById('maintChargesSection').style.display = show ? 'block' : 'none';
  if (show && !document.getElementById('maintChargeRows').children.length) addMaintChargeRow();
}

function addMaintChargeRow() {
  const container = document.getElementById('maintChargeRows');
  const row = document.createElement('div');
  row.className = 'charge-row';
  row.innerHTML = `<div class="form-row" style="align-items:end">
    <div class="form-group"><label>Part/Service *</label><input type="text" class="charge-name" required placeholder="Part or service name"></div>
    <div class="form-group"><label>Description</label><input type="text" class="charge-desc" placeholder="Optional"></div>
    <div class="form-group"><label>Price (₹) *</label><input type="number" class="charge-price" step="0.01" min="0.01" required oninput="calcMaintTotal()"></div>
    <button type="button" class="btn-sm btn-danger" onclick="this.closest('.charge-row').remove();calcMaintTotal()" style="margin-bottom:0.875rem;height:32px"><i class="fas fa-times"></i></button>
  </div>`;
  container.appendChild(row);
}

function calcMaintTotal() {
  const prices = document.querySelectorAll('#maintChargeRows .charge-price');
  let total = 0;
  prices.forEach(p => total += +p.value || 0);
  document.getElementById('maintTotalCharges').value = total ? '₹' + total.toLocaleString('en-IN') : '₹0';
  calcMaintBalance();
}

function calcMaintBalance() {
  const prices = document.querySelectorAll('#maintChargeRows .charge-price');
  let total = 0;
  prices.forEach(p => total += +p.value || 0);
  const paid = +document.getElementById('maintAmountPaid').value || 0;
  const balance = total - paid;
  document.getElementById('maintBalanceDue').value = balance >= 0 ? '₹' + balance.toLocaleString('en-IN') : '₹0';
}

function calcCustomerTotal() {
  const sp = +document.getElementById('custSellingPrice').value || 0;
  const qty = +document.getElementById('custQuantity').value || 0;
  const total = sp * qty;
  document.getElementById('custTotalAmount').value = total ? '₹' + total.toLocaleString('en-IN') : '';
  // Real-time stock validation
  const pid = document.getElementById('customerProductSelect').value;
  const stockEl = document.getElementById('custProdStock');
  if (pid && stockEl) {
    const p = allProducts.find(x => x.id === +pid);
    if (p && qty > p.current_quantity) {
      stockEl.innerHTML = `<span style="color:var(--danger);font-weight:700">${p.current_quantity} ⚠️ Exceeds!</span>`;
    } else if (p) {
      stockEl.textContent = p.current_quantity;
    }
  }
  calcCustomerBalance();
}

function calcCustomerBalance() {
  const sp = +document.getElementById('custSellingPrice').value || 0;
  const qty = +document.getElementById('custQuantity').value || 0;
  const total = sp * qty;
  const paid = +document.getElementById('custAmountPaid').value || 0;
  const balance = total - paid;
  const balanceInput = document.getElementById('custBalance');
  if (balanceInput) {
    balanceInput.value = balance >= 0 ? '₹' + balance.toLocaleString('en-IN') : '₹0';
  }
}

async function saveCustomer() {
  const saveBtn = document.querySelector('#customerForm .btn-save');
  const editId = document.getElementById('customerFormId').value;
  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();

  // Common validations
  if (!name || name.length < 2) { showToast('Customer name required (min 2 chars)'); return; }
  if (/^\d+$/.test(name)) { showToast('Customer name cannot be only numbers'); return; }
  if (!phone || !/^\d{10}$/.test(phone)) { showToast('Phone number must be exactly 10 digits'); return; }

  // Edit mode
  if (editId) {
    const entryType = document.getElementById('customerEntryType').value;
    setBtnLoading(saveBtn, true);

    if (entryType === 'edit-maintenance' && editId.includes('|maint|')) {
      const [custId, , maintId] = editId.split('|');
      await api('/customers/' + custId, { method: 'PUT', body: JSON.stringify({ name, phone }) });
      // Rebuild maintenance data
      let category = document.getElementById('maintCategory').value;
      if (category === '__other__') category = document.getElementById('maintNewCategory').value.trim();
      let product_name = document.getElementById('maintProductSelect').value;
      if (product_name === '__other__') product_name = document.getElementById('maintNewProduct').value.trim();
      const issueDesc = document.getElementById('maintIssueDesc').value.trim();
      const issueStatus = document.getElementById('maintIssueStatus').value;
      const chargesApplicable = document.getElementById('maintChargesApplicable').checked;
      let charges = [];
      if (chargesApplicable) {
        document.querySelectorAll('#maintChargeRows .charge-row').forEach(row => {
          charges.push({ name: row.querySelector('.charge-name').value.trim(), description: row.querySelector('.charge-desc').value.trim(), price: +row.querySelector('.charge-price').value });
        });
      }
      const totalCharges = charges.reduce((s, c) => s + c.price, 0);
      const paid = +document.getElementById('maintAmountPaid').value || 0;
      const paidVia = document.getElementById('maintPaidVia').value;
      // Delete old and recreate
      await api('/maintenance/' + maintId, { method: 'DELETE' });
      await api('/maintenance', { method: 'POST', body: JSON.stringify({
        name, phone, category, product_name, issue_description: issueDesc,
        issue_datetime: document.getElementById('maintIssueDate').value,
        issue_status: issueStatus, notes: document.getElementById('maintNotes').value,
        charges_applicable: chargesApplicable, charges, amount_paid: paid, paid_via: paidVia,
        fixed_datetime: issueStatus === 'Fixed' ? document.getElementById('maintFixedDate').value : null,
        fix_done_details: issueStatus === 'Fixed' ? document.getElementById('maintFixDetails').value : ''
      }) });
    } else if (entryType === 'edit-purchase' && editId.includes('|purchase|')) {
      const [custId, , cphId] = editId.split('|');
      await api('/customers/' + custId, { method: 'PUT', body: JSON.stringify({ name, phone }) });
      const paid = +document.getElementById('custAmountPaid').value || 0;
      const paidVia = document.getElementById('custPaidVia').value;
      await api('/customer-product/' + cphId, { method: 'PUT', body: JSON.stringify({
        amount_paid: paid, payment_status: paid > 0 ? 'Partially Paid' : 'Pending',
        notes: document.getElementById('custNotes').value
      }) });
    } else {
      await api('/customers/' + editId, { method: 'PUT', body: JSON.stringify({ name, phone }) });
    }

    setBtnLoading(saveBtn, false);
    hideModal('customerModal');
    loadCustomers();
    showToast('Customer updated', 'success');
    return;
  }

  const entryType = document.getElementById('customerEntryType').value;

  if (entryType === 'purchase') {
    // Product Purchase validations
    const product_id = document.getElementById('customerProductSelect').value;
    if (!document.getElementById('custProdCategorySelect').value) { showToast('Please select a product category'); return; }
    if (!product_id) { showToast('Please select a product'); return; }
    const qty = +document.getElementById('custQuantity').value;
    if (!qty || qty <= 0 || qty !== Math.floor(qty)) { showToast('Quantity must be a whole number > 0'); return; }
    const p = allProducts.find(x => x.id === +product_id);
    if (p && qty > p.current_quantity) { showToast('Stock not available. Please check your inventory and add stock before creating this customer purchase.'); return; }
    const sp = +document.getElementById('custSellingPrice').value;
    if (!sp || sp <= 0) { showToast('Selling price must be > 0'); return; }
    const total = sp * qty;
    const paid = +document.getElementById('custAmountPaid').value || 0;
    if (paid < 0) { showToast('Amount paid cannot be negative'); return; }
    if (paid > total) { showToast('Amount paid cannot exceed total amount'); return; }
    const paidVia = document.getElementById('custPaidVia').value;
    if (paid > 0 && !paidVia) { showToast('Paid Via is required when amount paid > 0'); return; }
    const purchaseDate = document.getElementById('custPurchaseDate').value;
    if (!purchaseDate) { showToast('Purchase date & time is required'); return; }

    const body = {
      name, phone, product_id: +product_id, quantity: qty,
      selling_price_per_qty: sp, total_amount: total, amount_paid: paid, balance_amount: total - paid,
      paid_via: paidVia, purchased_on: purchaseDate,
      warranty_available: !!document.getElementById('custWarrantyEnd').value,
      warranty_end_date: document.getElementById('custWarrantyEnd').value || null,
      warranty_start_date: purchaseDate.split('T')[0],
      notes: document.getElementById('custNotes').value
    };
    setBtnLoading(saveBtn, true);
    const res = await api('/customers', { method: 'POST', body: JSON.stringify(body) });
    setBtnLoading(saveBtn, false);
    if (res.message && !res.customer) { showToast(res.message); return; }

  } else if (entryType === 'maintenance') {
    // Maintenance validations
    let category = document.getElementById('maintCategory').value;
    if (category === '__other__') { category = document.getElementById('maintNewCategory').value.trim(); if (!category) { showToast('Please enter new category name'); return; } await api('/categories', { method: 'POST', body: JSON.stringify({ name: category }) }); }
    if (!category) { showToast('Category required'); return; }
    let product_name = document.getElementById('maintProductSelect').value;
    if (product_name === '__other__') { product_name = document.getElementById('maintNewProduct').value.trim(); if (!product_name) { showToast('Please enter product name'); return; } }
    if (!product_name) { showToast('Product name required'); return; }
    const issueDesc = document.getElementById('maintIssueDesc').value.trim();
    if (!issueDesc) { showToast('Issue description required'); return; }
    const issueDate = document.getElementById('maintIssueDate').value;
    const issueStatus = document.getElementById('maintIssueStatus').value;
    let fixedDate = null, fixDetails = '';
    if (issueStatus === 'Fixed') {
      fixedDate = document.getElementById('maintFixedDate').value;
      fixDetails = document.getElementById('maintFixDetails').value.trim();
      if (!fixedDate) { showToast('Fixed date required when status is Fixed'); return; }
      if (!fixDetails) { showToast('Fix done details required when status is Fixed'); return; }
      if (issueDate && new Date(fixedDate) < new Date(issueDate)) { showToast('Fixed date cannot be before issue date'); return; }
    }
    const chargesApplicable = document.getElementById('maintChargesApplicable').checked;
    let charges = [];
    if (chargesApplicable) {
      const rows = document.querySelectorAll('#maintChargeRows .charge-row');
      if (!rows.length) { showToast('At least one charge row required'); return; }
      for (const row of rows) {
        const cname = row.querySelector('.charge-name').value.trim();
        const cdesc = row.querySelector('.charge-desc').value.trim();
        const cprice = +row.querySelector('.charge-price').value;
        if (!cname) { showToast('Charge item name required'); return; }
        if (!cprice || cprice <= 0) { showToast('Charge item price must be greater than 0'); return; }
        charges.push({ name: cname, description: cdesc, price: cprice });
      }
    }
    const totalCharges = charges.reduce((s, c) => s + c.price, 0);
    const paid = +document.getElementById('maintAmountPaid').value || 0;
    if (paid < 0) { showToast('Amount paid cannot be negative'); return; }
    if (paid > totalCharges && totalCharges > 0) { showToast('Amount paid cannot exceed total charges'); return; }
    const paidVia = document.getElementById('maintPaidVia').value;
    if (paid > 0 && !paidVia) { showToast('Paid Via is required when amount paid > 0'); return; }

    const body = {
      name, phone, category, product_name, issue_description: issueDesc,
      issue_datetime: issueDate, issue_status: issueStatus, notes: document.getElementById('maintNotes').value,
      charges_applicable: chargesApplicable, charges, amount_paid: paid, paid_via: paidVia,
      fixed_datetime: fixedDate, fix_done_details: fixDetails
    };
    setBtnLoading(saveBtn, true);
    const res = await api('/maintenance', { method: 'POST', body: JSON.stringify(body) });
    setBtnLoading(saveBtn, false);
    if (res.message && !res.id) { showToast(res.message); return; }
  }

  hideModal('customerModal');
  loadCustomers();
  refreshDashboardCounts();
  showToast('Customer record saved', 'success');
}

async function editCustomer(id, entryType, refId) {
  document.getElementById('customerForm').reset();
  document.getElementById('customerFormTitle').textContent = 'Edit Customer';
  document.getElementById('customerFormId').value = id;
  document.getElementById('entryTypeSelection').style.display = 'none';
  document.getElementById('customerFormFields').style.display = 'block';

  const c = await api('/customers/' + id);
  document.getElementById('custName').value = c.name;
  document.getElementById('custPhone').value = c.phone;

  if (entryType === 'Maintenance Only' && refId) {
    document.getElementById('customerEntryType').value = 'edit-maintenance';
    document.getElementById('purchaseFields').style.display = 'none';
    document.getElementById('maintenanceFields').style.display = 'block';
    const m = await api('/maintenance/' + refId);
    document.getElementById('customerFormId').value = id + '|maint|' + refId;
    await loadMaintDropdowns();
    document.getElementById('maintCategory').value = m.category || '';
    // Set product - if exists in dropdown, select it; otherwise set Other
    const psel = document.getElementById('maintProductSelect');
    const opts = [...psel.options].map(o => o.value);
    if (opts.includes(m.product_name)) { psel.value = m.product_name; }
    else { psel.value = '__other__'; document.getElementById('maintNewProduct').style.display = 'block'; document.getElementById('maintNewProduct').value = m.product_name; }
    document.getElementById('maintIssueDesc').value = m.issue_description || '';
    document.getElementById('maintIssueDate').value = m.issue_datetime ? m.issue_datetime.slice(0,16) : '';
    document.getElementById('maintIssueStatus').value = m.issue_status || 'Reported';
    toggleMaintFixFields();
    if (m.issue_status === 'Fixed') {
      document.getElementById('maintFixedDate').value = m.fixed_datetime ? m.fixed_datetime.slice(0,16) : '';
      document.getElementById('maintFixDetails').value = m.fix_done_details || '';
    }
    document.getElementById('maintNotes').value = m.notes || '';
    if (m.charges_applicable && m.charges && m.charges.length) {
      document.getElementById('maintChargesApplicable').checked = true;
      document.getElementById('maintChargesSection').style.display = 'block';
      document.getElementById('maintChargeRows').innerHTML = '';
      m.charges.forEach(ch => {
        addMaintChargeRow();
        const rows = document.querySelectorAll('#maintChargeRows .charge-row');
        const last = rows[rows.length - 1];
        last.querySelector('.charge-name').value = ch.part_service_name;
        last.querySelector('.charge-desc').value = ch.description || '';
        last.querySelector('.charge-price').value = ch.price;
      });
      calcMaintTotal();
    }
    document.getElementById('maintAmountPaid').value = m.amount_paid || 0;
    document.getElementById('maintPaidVia').value = m.paid_via || '';
    calcMaintBalance();
  } else if (entryType === 'Product Purchase' && refId) {
    document.getElementById('customerEntryType').value = 'edit-purchase';
    document.getElementById('purchaseFields').style.display = 'block';
    document.getElementById('maintenanceFields').style.display = 'none';
    document.getElementById('customerFormId').value = id + '|purchase|' + refId;
    const h = await api('/customer-product/' + refId);
    await loadProductCategoryDropdown();
    // Set category
    const catSel = document.getElementById('custProdCategorySelect');
    if (h.product_name) {
      const prod = allProducts.find(p => p.name === h.product_name);
      if (prod) { catSel.value = prod.category || ''; onCategorySelected(); document.getElementById('customerProductSelect').value = prod.id; onProductSelected(); }
    }
    document.getElementById('custQuantity').value = h.quantity || 1;
    document.getElementById('custSellingPrice').value = h.selling_price_per_qty || '';
    document.getElementById('custAmountPaid').value = h.amount_paid || 0;
    document.getElementById('custPaidVia').value = h.paid_via || '';
    document.getElementById('custPurchaseDate').value = h.purchased_on ? h.purchased_on.slice(0,16) : '';
    document.getElementById('custWarrantyEnd').value = h.warranty_end_date || '';
    document.getElementById('custNotes').value = h.notes || '';
    calcCustomerTotal();
  } else {
    // Basic edit - just name/phone
    document.getElementById('customerEntryType').value = 'edit';
    document.getElementById('purchaseFields').style.display = 'none';
    document.getElementById('maintenanceFields').style.display = 'none';
  }
  showModal('customerModal');
}

async function deleteCustomer(id) {
  showConfirm('Delete Customer?', 'This will permanently remove this customer record.', async () => {
    await api('/customers/' + id, { method: 'DELETE' });
    loadCustomers();
    refreshDashboardCounts();
    showToast('Customer deleted', 'success');
  });
}

async function viewCustomerHistory(customerId) {
  const data = await api('/customers/' + customerId + '/history');
  const customer = await api('/customers/' + customerId);
  const container = document.getElementById('customerHistoryContent');

  // Get maintenance records for this customer
  const allData = await api('/customers?search=' + encodeURIComponent(customer.phone || customer.name));
  const custRecords = allData.filter(r => +r.id === +customerId);
  const maintenances = custRecords.filter(r => r.entry_type === 'Maintenance Only');

  const totalPurchaseAmt = data.reduce((s,r) => s+(+r.total_amount||0), 0);
  const totalMaintAmt = maintenances.reduce((s,r) => s+(+r.total_amount||0), 0);
  const totalPaid = data.reduce((s,r) => s+(+r.amount_paid||0), 0) + maintenances.reduce((s,r) => s+(+r.amount_paid||0), 0);
  const totalBalance = data.reduce((s,r) => s+(+r.balance_amount||0), 0) + maintenances.reduce((s,r) => s+(+r.balance_amount||0), 0);

  let html = `<button class="btn-back" onclick="showCustomerList()"><i class="fas fa-arrow-left"></i> Back</button>
    <h2>${customer.name} <small style="color:var(--text-muted)">${customer.phone}</small></h2>
    <div class="stats-row">
      <div class="stat-card"><h4>${data.length}</h4><p>Purchases</p></div>
      <div class="stat-card"><h4>${maintenances.length}</h4><p>Maintenance</p></div>
      <div class="stat-card"><h4>${formatCurrency(totalPurchaseAmt + totalMaintAmt)}</h4><p>Total Amount</p></div>
      <div class="stat-card"><h4>${formatCurrency(totalPaid)}</h4><p>Total Paid</p></div>
      <div class="stat-card"><h4 style="color:var(--danger)">${formatCurrency(totalBalance)}</h4><p>Balance Due</p></div>
    </div>`;

  // Product Purchases with their issues
  if (data.length) {
    html += '<h3 style="margin-bottom:0.75rem"><i class="fas fa-shopping-cart"></i> Product Purchases</h3>';
    for (const r of data) {
      const issueBadge = r.issue_count > 0 ? `<span class="badge badge-warning">${r.issue_count} issue${r.issue_count>1?'s':''}</span>` : '';
      html += `<div class="timeline"><div class="timeline-item">
        <div class="timeline-date">${formatDate(r.purchased_on)}</div>
        <div class="timeline-title">${r.product_name} (Qty: ${r.quantity}) ${issueBadge}</div>
        <div class="timeline-detail">Total: ${formatCurrency(r.total_amount||0)} | Paid: ${formatCurrency(r.amount_paid)} | <span style="color:var(--danger)">Balance: ${formatCurrency(r.balance_amount||0)}</span> ${r.paid_via?'| via '+r.paid_via:''}</div>
        <div class="timeline-detail">${getWarrantyBadge(r.warranty_end_date, r.extended_warranty_end_date)}</div>
        <div class="card-actions" style="margin-top:0.5rem">
          <button class="btn-sm btn-primary" onclick="viewProductDetail(${r.id})">Details & Issues</button>
          <button class="btn-sm btn-success" onclick="addIssueFor(${r.id})">Add Issue</button>
          ${+r.balance_amount>0?`<button class="btn-sm btn-warning" onclick="openPaymentUpdate('${r.id}','purchase',${r.balance_amount})">Pay</button>`:''}
        </div>
      </div></div>`;
    }
  }

  // Maintenance Records
  if (maintenances.length) {
    html += '<h3 style="margin:1.25rem 0 0.75rem"><i class="fas fa-wrench"></i> Maintenance Records</h3>';
    maintenances.forEach(r => {
      const isFixed = r.issue_status === 'Fixed';
      html += `<div class="timeline"><div class="timeline-item ${isFixed?'fixed':''}">
        <div class="timeline-date">${formatDate(r.entry_date)}</div>
        <div class="timeline-title">${r.product_name} ${getStatusBadge(r.issue_status)}</div>
        <div class="timeline-detail"><strong>Issue:</strong> ${r.issue_description||''}</div>
        <div class="timeline-detail">Charges: ${formatCurrency(r.total_amount||0)} | Paid: ${formatCurrency(r.amount_paid)} | <span style="color:var(--danger)">Balance: ${formatCurrency(r.balance_amount||0)}</span></div>
        <div class="card-actions" style="margin-top:0.5rem">
          ${!isFixed?`<button class="btn-sm btn-success" onclick="openMarkFixed(${r.maint_id})">Mark Fixed</button>`:''}
          ${+r.balance_amount>0?`<button class="btn-sm btn-warning" onclick="openPaymentUpdate('${r.maint_id}','maintenance',${r.balance_amount})">Pay</button>`:''}
          <button class="btn-sm btn-info" onclick="editMaintIssue(${r.maint_id})">Edit</button>
        </div>
      </div></div>`;
    });
  }

  if (!data.length && !maintenances.length) {
    html += '<div class="empty-state"><p>No records found for this customer</p></div>';
  }

  container.innerHTML = html;
  document.getElementById('customersListView').style.display = 'none';
  document.getElementById('customerHistoryView').style.display = 'block';
}

function showCustomerList() {
  document.getElementById('customersListView').style.display = 'block';
  document.getElementById('customerHistoryView').style.display = 'none';
  document.getElementById('pageTitle').textContent = 'Customers';
}


// ============================================================================
// INVENTORY MODULE
// ============================================================================

// Category/Brand dropdown helpers
async function loadCategoryDropdown(selectId, selected) {
  const cats = await api('/categories');
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">-- Select --</option>' + cats.map(c => `<option value="${c}"${c===selected?' selected':''}>${c}</option>`).join('') + '<option value="__other__">Other (Add New)</option>';
}

async function loadBrandDropdown(selectId, selected) {
  const brands = await api('/brands');
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">-- Select --</option>' + brands.map(b => `<option value="${b}"${b===selected?' selected':''}>${b}</option>`).join('') + '<option value="__other__">Other (Add New)</option>';
}

function toggleNewCategory() { document.getElementById('prodNewCategory').style.display = document.getElementById('prodCategory').value === '__other__' ? 'block' : 'none'; }
function toggleNewBrand() { document.getElementById('prodNewBrand').style.display = document.getElementById('prodBrand').value === '__other__' ? 'block' : 'none'; }
function toggleEditNewCategory() { document.getElementById('editProdNewCategory').style.display = document.getElementById('editProdCategory').value === '__other__' ? 'block' : 'none'; }
function toggleEditNewBrand() { document.getElementById('editProdNewBrand').style.display = document.getElementById('editProdBrand').value === '__other__' ? 'block' : 'none'; }
function toggleWarrantyPeriod() { document.getElementById('prodWarrantyPeriodGroup').style.display = document.getElementById('prodWarrantyAvail').value === 'yes' ? '' : 'none'; }
function toggleEditWarrantyPeriod() { document.getElementById('editWarrantyPeriodGroup').style.display = document.getElementById('editProdWarranty').value === 'yes' ? '' : 'none'; }

function calcTotalPurchase() {
  const p = +document.getElementById('prodPurchasePrice').value || 0;
  const q = +document.getElementById('prodQuantity').value || 0;
  document.getElementById('prodTotalPurchase').value = p && q ? '₹' + (p * q).toLocaleString('en-IN') : '';
}

function calcAddInvTotal() {
  const p = +document.getElementById('addInvPurchasePrice').value || 0;
  const q = +document.getElementById('addInvQuantity').value || 0;
  document.getElementById('addInvTotalPurchase').value = p && q ? '₹' + (p * q).toLocaleString('en-IN') : '';
}

// INVENTORY MODULE (loadProducts & renderProducts defined at bottom with filters)

async function openAddProductModal() {
  document.getElementById('productForm').reset();
  document.getElementById('productFormTitle').textContent = 'Add Product';
  document.getElementById('productFormId').value = '';
  document.getElementById('prodTotalPurchase').value = '';
  document.getElementById('prodNewCategory').style.display = 'none';
  document.getElementById('prodWarrantyPeriodGroup').style.display = 'none';
  await loadCategoryDropdown('prodCategory');
  showModal('productModal');
}

async function saveProduct() {
  const name = document.getElementById('prodName').value.trim();
  if (!name) { showToast('Product name is required'); return; }
  if (/^\d+$/.test(name)) { showToast('Product name cannot be only numbers'); return; }

  let category = document.getElementById('prodCategory').value;
  if (category === '__other__') {
    category = document.getElementById('prodNewCategory').value.trim();
    if (!category) { showToast('Please enter new category name'); return; }
    await api('/categories', { method: 'POST', body: JSON.stringify({ name: category }) });
  }
  if (!category) { showToast('Category is required'); return; }

  let brand = document.getElementById('prodBrand').value.trim();
  if (!brand) { showToast('Brand is required'); return; }

  const ppq = +document.getElementById('prodPurchasePrice').value;
  const qty = +document.getElementById('prodQuantity').value;
  const spq = +document.getElementById('prodSellingPrice').value;
  if (!ppq || ppq <= 0) { showToast('Purchase price must be greater than 0'); return; }
  if (!qty || qty <= 0 || qty !== Math.floor(qty)) { showToast('Quantity must be a whole number greater than 0'); return; }
  if (!spq || spq <= 0) { showToast('Selling price must be greater than 0'); return; }

  const warrantyAvail = document.getElementById('prodWarrantyAvail').value === 'yes';
  const warrantyPeriod = document.getElementById('prodWarrantyPeriod').value.trim();
  if (warrantyAvail && !warrantyPeriod) { showToast('Warranty period is required when warranty is available'); return; }

  const body = { name, category, brand, purchase_price_per_qty: ppq, total_quantity: qty, selling_price_per_qty: spq, warranty_available: warrantyAvail, warranty_period: warrantyPeriod, low_stock_quantity: +document.getElementById('prodLowStock').value || 5, notes: document.getElementById('prodNotes').value };

  const saveBtn = document.querySelector('#productForm .btn-save');
  setBtnLoading(saveBtn, true);
  const res = await api('/products', { method: 'POST', body: JSON.stringify(body) });
  setBtnLoading(saveBtn, false);
  if (res.message && !res.product) { showToast(res.message); return; }
  hideModal('productModal');
  loadProducts();
  refreshDashboardCounts();
  showToast('Product added', 'success');
}

async function editProduct(id) {
  const p = await api('/products/' + id);
  document.getElementById('editProductId').value = id;
  document.getElementById('editProdName').value = p.name;
  document.getElementById('editProdSellingPrice').value = p.selling_price;
  document.getElementById('editProdLowStock').value = p.low_stock_quantity;
  document.getElementById('editProdWarranty').value = p.warranty_available ? 'yes' : 'no';
  document.getElementById('editProdWarrantyPeriod').value = p.warranty_period || '';
  document.getElementById('editProdNotes').value = p.notes || '';
  document.getElementById('editProdBrand').value = p.brand || '';
  toggleEditWarrantyPeriod();
  await loadCategoryDropdown('editProdCategory', p.category);
  showModal('editProductModal');
}

async function saveEditProduct() {
  const id = document.getElementById('editProductId').value;
  const name = document.getElementById('editProdName').value.trim();
  if (!name) { showToast('Product name is required'); return; }
  if (/^\d+$/.test(name)) { showToast('Product name cannot be only numbers'); return; }

  let category = document.getElementById('editProdCategory').value;
  if (category === '__other__') {
    category = document.getElementById('editProdNewCategory').value.trim();
    if (!category) { showToast('Please enter new category name'); return; }
    await api('/categories', { method: 'POST', body: JSON.stringify({ name: category }) });
  }

  let brand = document.getElementById('editProdBrand').value.trim();

  const spq = +document.getElementById('editProdSellingPrice').value;
  if (!spq || spq <= 0) { showToast('Selling price must be greater than 0'); return; }

  const warrantyAvail = document.getElementById('editProdWarranty').value === 'yes';
  const warrantyPeriod = document.getElementById('editProdWarrantyPeriod').value.trim();
  if (warrantyAvail && !warrantyPeriod) { showToast('Warranty period is required when warranty is available'); return; }

  const body = { name, category, brand, selling_price: spq, warranty_available: warrantyAvail, warranty_period: warrantyPeriod, low_stock_quantity: +document.getElementById('editProdLowStock').value || 5, notes: document.getElementById('editProdNotes').value };

  await api('/products/' + id, { method: 'PUT', body: JSON.stringify(body) });
  hideModal('editProductModal');
  loadProducts();
  refreshDashboardCounts();
}

async function deleteProduct(id) {
  showConfirm('Delete Product?', 'This will permanently remove this product.', async () => {
    await api('/products/' + id, { method: 'DELETE' });
    loadProducts();
    refreshDashboardCounts();
    showToast('Product deleted', 'success');
  });
}

async function openAddInventoryModal(productId) {
  const p = await api('/products/' + productId);
  document.getElementById('addInvProductId').value = productId;
  document.getElementById('addInvName').value = p.name;
  document.getElementById('addInvCategory').value = p.category || '-';
  document.getElementById('addInvBrand').value = p.brand || '-';
  document.getElementById('addInvWarranty').value = p.warranty_available ? 'Yes - ' + (p.warranty_period||'') : 'No';
  document.getElementById('addInvCurrentStock').value = p.current_quantity;
  document.getElementById('addInvPurchasePrice').value = '';
  document.getElementById('addInvQuantity').value = '';
  document.getElementById('addInvSellingPrice').value = '';
  document.getElementById('addInvTotalPurchase').value = '';
  document.getElementById('addInvNotes').value = '';
  showModal('addInventoryModal');
}

async function saveAddInventory() {
  const id = document.getElementById('addInvProductId').value;
  const ppq = +document.getElementById('addInvPurchasePrice').value;
  const qty = +document.getElementById('addInvQuantity').value;
  const spq = +document.getElementById('addInvSellingPrice').value;
  if (!ppq || ppq <= 0) { showToast('Purchase price must be greater than 0'); return; }
  if (!qty || qty <= 0 || qty !== Math.floor(qty)) { showToast('Quantity must be a whole number greater than 0'); return; }
  if (!spq || spq <= 0) { showToast('Selling price must be greater than 0'); return; }

  const body = { purchase_price_per_qty: ppq, total_quantity: qty, selling_price_per_qty: spq, notes: document.getElementById('addInvNotes').value };
  const saveBtn = document.querySelector('#addInventoryForm .btn-save');
  setBtnLoading(saveBtn, true);
  const res = await api('/products/' + id + '/add-inventory', { method: 'POST', body: JSON.stringify(body) });
  setBtnLoading(saveBtn, false);
  if (res.message && res.message.includes('must be')) { showToast(res.message); return; }
  hideModal('addInventoryModal');
  loadProducts();
  refreshDashboardCounts();
  showToast('Inventory added', 'success');
}

async function viewProductHistory(productId) {
  const product = await api('/products/' + productId);
  const txns = await api('/products/' + productId + '/history');
  const container = document.getElementById('productHistoryContent');
  const totalIn = txns.reduce((s, t) => s + (+t.quantity_in || 0), 0);
  const totalOut = txns.reduce((s, t) => s + (+t.quantity_out || 0), 0);

  let html = `<button class="btn-back" onclick="showInventoryList()"><i class="fas fa-arrow-left"></i> Back</button>
    <h2>${product.name} <small style="color:var(--text-muted)">${product.category} | ${product.brand}</small></h2>
    <div class="stats-row">
      <div class="stat-card"><h4>${product.current_quantity}</h4><p>Current Stock</p></div>
      <div class="stat-card"><h4>${totalIn}</h4><p>Total In</p></div>
      <div class="stat-card"><h4>${totalOut}</h4><p>Total Out</p></div>
      <div class="stat-card"><h4>${product.current_quantity <= product.low_stock_quantity ? '⚠️ Low' : '✓ OK'}</h4><p>Status</p></div>
    </div>`;

  if (txns.length) {
    html += `<div class="module-table-wrap"><table class="module-table"><thead><tr>
      <th>Date</th><th>Type</th><th>In</th><th>Out</th><th>Balance</th><th>Purchase ₹/Qty</th><th>Selling ₹/Qty</th><th>Total ₹</th><th>Notes</th>
    </tr></thead><tbody>` + txns.map(t => `<tr>
      <td>${formatDate(t.created_at)}</td><td>${t.transaction_type}</td>
      <td style="color:#059669">${t.quantity_in||'-'}</td><td style="color:#dc2626">${t.quantity_out||'-'}</td>
      <td>${t.balance_after}</td>
      <td>${t.purchase_price_per_qty?formatCurrency(t.purchase_price_per_qty):'-'}</td>
      <td>${t.selling_price_per_qty?formatCurrency(t.selling_price_per_qty):'-'}</td>
      <td>${t.total_amount?formatCurrency(t.total_amount):'-'}</td>
      <td>${t.notes||'-'}</td></tr>`).join('') + '</tbody></table></div>';
    html += `<div class="mobile-cards">` + txns.map(t => `<div class="mobile-card">
      <p><strong>${t.transaction_type}</strong> — ${formatDate(t.created_at)}</p>
      <p>In: ${t.quantity_in||0} | Out: ${t.quantity_out||0} | Balance: ${t.balance_after}</p>
      ${t.purchase_price_per_qty?`<p>Purchase: ${formatCurrency(t.purchase_price_per_qty)}/qty | Selling: ${formatCurrency(t.selling_price_per_qty)}/qty | Total: ${formatCurrency(t.total_amount)}</p>`:''}
      <p style="color:var(--text-muted)">${t.notes||''}</p></div>`).join('') + '</div>';
  } else {
    html += '<div class="empty-state"><p>No transactions yet</p></div>';
  }
  container.innerHTML = html;
  document.getElementById('inventoryListView').style.display = 'none';
  document.getElementById('productHistoryView').style.display = 'block';
}

function showInventoryList() {
  document.getElementById('inventoryListView').style.display = 'block';
  document.getElementById('productHistoryView').style.display = 'none';
}


// ============================================================================
// ISSUES / WARRANTY MODULE
// ============================================================================
async function loadIssues(status = '') {
  const data = await api('/issues' + (status ? '?status=' + status : ''));
  const tbody = document.getElementById('issuesTableBody');
  const cards = document.getElementById('issuesCards');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><i class="fas fa-tools"></i><p>No issues found</p></td></tr>';
    cards.innerHTML = '<div class="empty-state"><i class="fas fa-tools"></i><p>No issues</p></div>';
    return;
  }
  tbody.innerHTML = data.map(i => {
    const isMaint = i.source_type === 'maintenance';
    const balance = (+i.charge_amount||0)-(+i.amount_paid||0);
    const typeBadge = isMaint ? '<span class="badge badge-info" style="font-size:0.65rem">Maint</span>' : '';
    let actions = '';
    if (i.issue_status !== 'Fixed' && i.issue_status !== 'Returned to Customer') {
      actions += isMaint ? `<button class="btn-sm btn-success" onclick="openMarkFixed(${i.id})" title="Mark Fixed"><i class="fas fa-check"></i></button>` : `<button class="btn-sm btn-success" onclick="openFixModal(${i.id})" title="Mark Fixed"><i class="fas fa-check"></i></button>`;
    }
    if (balance > 0) {
      actions += isMaint ? `<button class="btn-sm btn-primary" onclick="openPaymentUpdate('${i.id}','maintenance',${balance})" title="Update Payment"><i class="fas fa-rupee-sign"></i></button>` : `<button class="btn-sm btn-primary" onclick="openIssuePayment(${i.id},${balance})" title="Update Payment"><i class="fas fa-rupee-sign"></i></button>`;
    }
    actions += isMaint ? `<button class="btn-sm btn-warning" onclick="editMaintIssue(${i.id})" title="Edit"><i class="fas fa-edit"></i></button>` : `<button class="btn-sm btn-warning" onclick="editIssue(${i.id})" title="Edit"><i class="fas fa-edit"></i></button>`;
    return `<tr>
    <td>${i.customer_name}<br><small style="color:var(--text-muted)">${i.customer_phone||''}</small></td>
    <td>${i.product_name} ${typeBadge}</td>
    <td>${formatDate(i.issue_date)}</td>
    <td style="max-width:200px">${i.issue_description}</td>
    <td>${getStatusBadge(i.issue_status)}</td>
    <td>${i.warranty_status_at_issue || '-'}</td>
    <td>${formatCurrency(i.charge_amount)}</td>
    <td>${formatCurrency(i.amount_paid||0)}</td>
    <td style="color:var(--danger)">${formatCurrency(balance)}</td>
    <td>${actions}</td></tr>`;
  }).join('');
  cards.innerHTML = data.map(i => {
    const isMaint = i.source_type === 'maintenance';
    const balance = (+i.charge_amount||0)-(+i.amount_paid||0);
    let actions = '';
    if (i.issue_status !== 'Fixed' && i.issue_status !== 'Returned to Customer') {
      actions += isMaint ? `<button class="btn-sm btn-success" onclick="openMarkFixed(${i.id})">Mark Fixed</button>` : `<button class="btn-sm btn-success" onclick="openFixModal(${i.id})">Mark Fixed</button>`;
    }
    if (balance > 0) {
      actions += isMaint ? `<button class="btn-sm btn-primary" onclick="openPaymentUpdate('${i.id}','maintenance',${balance})">Pay</button>` : `<button class="btn-sm btn-primary" onclick="openIssuePayment(${i.id},${balance})">Pay</button>`;
    }
    actions += isMaint ? `<button class="btn-sm btn-warning" onclick="editMaintIssue(${i.id})">Edit</button>` : `<button class="btn-sm btn-warning" onclick="editIssue(${i.id})">Edit</button>`;
    return `<div class="mobile-card">
    <h4>${i.product_name} ${getStatusBadge(i.issue_status)} ${isMaint?'<span class="badge badge-info">Maintenance</span>':''}</h4>
    <p><strong>${i.customer_name}</strong> ${i.customer_phone?'| '+i.customer_phone:''}</p>
    <p><strong>Issue:</strong> ${i.issue_description}</p>
    <p><strong>Date:</strong> ${formatDate(i.issue_date)} | <strong>Warranty:</strong> ${i.warranty_status_at_issue||'-'}</p>
    ${i.fix_done_details?`<p><strong>Fix:</strong> ${i.fix_done_details} (${formatDate(i.fixed_datetime)})</p>`:''}
    <p><strong>Charges:</strong> ${formatCurrency(i.charge_amount)} | <strong>Paid:</strong> ${formatCurrency(i.amount_paid||0)} | <span style="color:var(--danger)"><strong>Due:</strong> ${formatCurrency(balance)}</span></p>
    ${i.payment_mode?`<p><strong>Paid Via:</strong> ${i.payment_mode}</p>`:''}
    <div class="card-actions">${actions}</div></div>`;
  }).join('');
}

function openIssuePayment(issueId, balance) {
  document.getElementById('payRefId').value = issueId;
  document.getElementById('payRefType').value = 'issue';
  document.getElementById('payCurrentBalance').value = '₹' + (+balance).toLocaleString('en-IN');
  document.getElementById('payAmount').value = '';
  document.getElementById('payPaidVia').value = '';
  showModal('paymentModal');
}

async function editMaintIssue(id) {
  const m = await api('/maintenance/' + id);
  if (!m || m.message) { showToast('Record not found'); return; }
  const balance = (+m.total_charges||0) - (+m.amount_paid||0);
  const container = document.getElementById('confirmMsg');
  document.getElementById('confirmTitle').textContent = 'Edit Maintenance — ' + (m.product_name||'');
  container.innerHTML = `
    <div style="text-align:left;font-size:0.82rem;max-height:60vh;overflow-y:auto">
      <div style="background:var(--bg-tertiary);padding:0.75rem;border-radius:8px;margin-bottom:0.75rem;border:1px solid var(--border)">
        <strong>${m.customer_name}</strong> — ${m.customer_phone||''}<br>
        <strong>Product:</strong> ${m.product_name}<br>
        <strong>Issue:</strong> ${m.issue_description}<br>
        <strong>Date:</strong> ${m.issue_datetime ? new Date(m.issue_datetime).toLocaleDateString('en-IN') : '-'}
        ${m.fix_done_details ? '<br><strong>Fix:</strong> '+m.fix_done_details : ''}
        ${m.charges && m.charges.length ? '<br><strong>Charges:</strong> '+m.charges.map(c=>c.part_service_name+' ₹'+c.price).join(', ') : ''}
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Status</label>
        <select id="editMaintStatus" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem">
          ${['Reported','Checking','Repair In Progress','Fixed'].map(s => `<option value="${s}" ${s===m.issue_status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Total Charges (₹)</label>
        <input type="text" value="₹${(+m.total_charges||0).toLocaleString('en-IN')}" readonly style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem;background:var(--bg-tertiary)">
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Amount Paid (₹)</label>
        <input type="number" id="editMaintPaid" value="${m.amount_paid||0}" step="0.01" min="0" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem" oninput="document.getElementById('editMaintBalance').value='₹'+((${m.total_charges||0})-(+this.value||0)).toLocaleString('en-IN')">
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500;color:var(--danger)">Balance Due (₹)</label>
        <input type="text" id="editMaintBalance" value="₹${balance.toLocaleString('en-IN')}" readonly style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem;background:var(--bg-tertiary);font-weight:600;color:var(--danger)">
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Paid Via</label>
        <select id="editMaintPaidVia" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem">
          <option value="">-- Select --</option><option>Cash</option><option>UPI</option><option>PhonePe</option><option>Google Pay</option><option>Paytm</option><option>Card</option><option>Bank Transfer</option><option>Other</option>
        </select>
      </div>
    </div>`;
  if (m.paid_via) document.getElementById('editMaintPaidVia').value = m.paid_via;
  document.getElementById('confirmYesBtn').textContent = 'Update';
  document.getElementById('confirmYesBtn').style.background = 'var(--primary)';
  document.getElementById('confirmYesBtn').onclick = async () => {
    const status = document.getElementById('editMaintStatus').value;
    const paid = +document.getElementById('editMaintPaid').value || 0;
    const paidVia = document.getElementById('editMaintPaidVia').value;
    if (paid > (+m.total_charges||0)) { showToast('Paid cannot exceed total charges'); return; }
    hideModal('confirmModal');
    // Update status
    if (status === 'Fixed' && m.issue_status !== 'Fixed') {
      await api('/maintenance/' + id + '/fix', { method: 'PUT', body: JSON.stringify({ fixed_datetime: new Date().toISOString(), fix_done_details: 'Marked fixed from issues tab' }) });
    } else if (status !== m.issue_status) {
      // For non-fixed status changes, we update via a general endpoint - use delete+recreate approach is too heavy, just update directly
      await api('/maintenance/' + id + '/fix', { method: 'PUT', body: JSON.stringify({ fixed_datetime: null, fix_done_details: '' }) }).catch(()=>{});
    }
    // Update payment if changed
    if (paid !== (+m.amount_paid||0)) {
      const diff = paid - (+m.amount_paid||0);
      if (diff > 0) await api('/maintenance/' + id + '/payment', { method: 'PUT', body: JSON.stringify({ amount_paid: diff, paid_via: paidVia }) });
    }
    loadIssues();
    showToast('Maintenance updated', 'success');
    document.getElementById('confirmYesBtn').textContent = 'Yes, Delete';
    document.getElementById('confirmYesBtn').style.background = 'var(--danger)';
  };
  showModal('confirmModal');
}

function viewIssueCustomer(cphId) {
  // Navigate to customers page and show product detail
  document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
  document.querySelector('[data-page="customers"]').classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('customersPage').classList.add('active');
  document.getElementById('customersListView').style.display = 'none';
  document.getElementById('customerHistoryView').style.display = 'block';
  document.getElementById('pageTitle').textContent = 'Customers';
  viewProductDetail(cphId);
}

function addIssueFor(cphId) {
  document.getElementById('issueForm').reset();
  document.getElementById('issueCphId').value = cphId;
  document.getElementById('issueDate').value = new Date().toISOString().slice(0,16);
  // Load product details for context
  api('/customer-product/' + cphId).then(d => {
    const panel = document.getElementById('issueProductDetails');
    if (panel) panel.innerHTML = `<div style="background:var(--bg-tertiary);padding:0.75rem;border-radius:8px;margin-bottom:0.875rem;border:1px solid var(--border);font-size:0.8rem">
      <strong>${d.customer_name}</strong> — ${d.customer_phone}<br>
      <strong>Product:</strong> ${d.product_name} | Qty: ${d.quantity} | Purchased: ${formatDate(d.purchased_on)}<br>
      <strong>Amount:</strong> Paid: ${formatCurrency(d.amount_paid||0)} ${d.paid_via?'via '+d.paid_via:''}<br>
      <strong>Warranty:</strong> ${d.warranty_status||'-'} ${d.warranty_end_date?'(Ends: '+formatDate(d.warranty_end_date)+')':''}
    </div>`;
  });
  showModal('issueModal');
}

async function saveIssue() {
  const desc = document.getElementById('issueForm').querySelector('[name="issue_description"]').value.trim();
  if (!desc || desc.length < 5) { showToast('Issue description required (min 5 chars)'); return; }
  const status = document.getElementById('issueForm').querySelector('[name="issue_status"]').value;
  const fixDetails = document.getElementById('issueForm').querySelector('[name="fix_done_details"]');
  if (status === 'Fixed' && fixDetails && !fixDetails.value.trim()) { showToast('Fix details required when status is Fixed'); return; }

  const form = document.getElementById('issueForm');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  body.charges_applicable = document.getElementById('issueChargesApplicable').checked;
  body.customer_product_history_id = body.cph_id;
  if (body.charges_applicable && +body.amount_paid > +body.charge_amount) { showToast('Amount paid cannot exceed charge amount'); return; }
  await api('/issues', { method: 'POST', body: JSON.stringify(body) });
  hideModal('issueModal');
  loadCustomers();
  refreshDashboardCounts();
}

function toggleFixFields(status) {
  document.getElementById('fixFieldsGroup').style.display = status === 'Fixed' ? 'block' : 'none';
}

function toggleChargeFields() {
  document.getElementById('chargeFieldsGroup').style.display = document.getElementById('issueChargesApplicable').checked ? 'block' : 'none';
}

function toggleFixChargeFields() {
  document.getElementById('fixChargeFieldsGroup').style.display = document.getElementById('fixChargesApplicable').checked ? 'block' : 'none';
}

function openFixModal(issueId) {
  document.getElementById('fixForm').reset();
  document.getElementById('fixIssueId').value = issueId;
  document.getElementById('fixDatetime').value = new Date().toISOString().slice(0, 16);
  showModal('fixModal');
}

async function saveFixIssue() {
  const form = document.getElementById('fixForm');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  body.charges_applicable = document.getElementById('fixChargesApplicable').checked;
  body.returned_to_customer = document.getElementById('fixReturned').checked;
  const issueId = body.issue_id;
  delete body.issue_id;
  await api('/issues/' + issueId + '/fix', { method: 'PUT', body: JSON.stringify(body) });
  hideModal('fixModal');
  loadIssues();
  refreshDashboardCounts();
}

async function editIssue(id) {
  const issue = await api('/issues').then(list => list.find(i => i.id === +id));
  if (!issue) { showToast('Issue not found'); return; }
  const container = document.getElementById('confirmMsg');
  document.getElementById('confirmTitle').textContent = 'Edit Issue — ' + (issue.product_name||'');
  container.innerHTML = `
    <div style="text-align:left;font-size:0.82rem;max-height:60vh;overflow-y:auto">
      <div style="background:var(--bg-tertiary);padding:0.75rem;border-radius:8px;margin-bottom:0.75rem;border:1px solid var(--border)">
        <strong>${issue.customer_name}</strong> — ${issue.customer_phone||''}<br>
        <strong>Product:</strong> ${issue.product_name}<br>
        <strong>Issue:</strong> ${issue.issue_description}<br>
        <strong>Date:</strong> ${issue.issue_date ? new Date(issue.issue_date).toLocaleDateString('en-IN') : '-'}<br>
        <strong>Warranty:</strong> ${issue.warranty_status_at_issue||'-'}
        ${issue.fix_done_details ? '<br><strong>Fix:</strong> '+issue.fix_done_details : ''}
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Status</label>
        <select id="editIssueStatus" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem">
          ${['Reported','Checking','Repair In Progress','Fixed','Returned to Customer','Rejected'].map(s => `<option value="${s}" ${s===issue.issue_status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Charges (₹)</label>
        <input type="number" id="editIssueCharges" value="${issue.charge_amount||0}" step="0.01" min="0" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem">
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Amount Paid (₹)</label>
        <input type="number" id="editIssuePaid" value="${issue.amount_paid||0}" step="0.01" min="0" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem" oninput="document.getElementById('editIssueBalance').value='₹'+((+document.getElementById('editIssueCharges').value||0)-(+this.value||0)).toLocaleString('en-IN')">
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500;color:var(--danger)">Balance Due (₹)</label>
        <input type="text" id="editIssueBalance" value="₹${((+issue.charge_amount||0)-(+issue.amount_paid||0)).toLocaleString('en-IN')}" readonly style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem;background:var(--bg-tertiary);font-weight:600;color:var(--danger)">
      </div>
      <div style="margin-bottom:0.5rem"><label style="font-size:0.78rem;font-weight:500">Paid Via</label>
        <select id="editIssuePaidVia" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.82rem">
          <option value="">-- Select --</option><option>Cash</option><option>UPI</option><option>PhonePe</option><option>Google Pay</option><option>Paytm</option><option>Card</option><option>Bank Transfer</option><option>Other</option>
        </select>
      </div>
    </div>`;
  if (issue.payment_mode) document.getElementById('editIssuePaidVia').value = issue.payment_mode;
  document.getElementById('confirmYesBtn').textContent = 'Update';
  document.getElementById('confirmYesBtn').style.background = 'var(--primary)';
  document.getElementById('confirmYesBtn').onclick = async () => {
    const status = document.getElementById('editIssueStatus').value;
    const charges = +document.getElementById('editIssueCharges').value || 0;
    const paid = +document.getElementById('editIssuePaid').value || 0;
    const paidVia = document.getElementById('editIssuePaidVia').value;
    if (paid > charges) { showToast('Paid cannot exceed charges'); return; }
    hideModal('confirmModal');
    await api('/issues/' + id, { method: 'PUT', body: JSON.stringify({ issue_status: status, charge_amount: charges, amount_paid: paid, balance_amount: charges - paid, payment_mode: paidVia }) });
    loadIssues();
    showToast('Issue updated', 'success');
    document.getElementById('confirmYesBtn').textContent = 'Yes, Delete';
    document.getElementById('confirmYesBtn').style.background = 'var(--danger)';
  };
  showModal('confirmModal');
}

// Warranty Edit
async function editWarranty(cphId) {
  const detail = await api('/customer-product/' + cphId);
  document.getElementById('warrantyForm').reset();
  document.getElementById('warrantyCphId').value = cphId;
  document.getElementById('warAvail').checked = detail.warranty_available;
  document.getElementById('warStart').value = detail.warranty_start_date || '';
  document.getElementById('warEnd').value = detail.warranty_end_date || '';
  document.getElementById('warExtended').checked = detail.warranty_extended;
  document.getElementById('warExtEnd').value = detail.extended_warranty_end_date || '';
  document.getElementById('warExtReason').value = detail.warranty_extension_reason || '';
  showModal('warrantyModal');
}

async function saveWarranty() {
  const form = document.getElementById('warrantyForm');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  body.warranty_available = document.getElementById('warAvail').checked;
  body.warranty_extended = document.getElementById('warExtended').checked;
  const cphId = body.cph_id;
  delete body.cph_id;
  await api('/customer-product/' + cphId + '/warranty', { method: 'PUT', body: JSON.stringify(body) });
  hideModal('warrantyModal');
  loadCustomers();
}

// Product Detail with Timeline
async function viewProductDetail(cphId) {
  const detail = await api('/customer-product/' + cphId);
  const container = document.getElementById('customerHistoryContent');
  let html = `<button class="btn-back" onclick="viewCustomerHistory(${detail.customer_id})"><i class="fas fa-arrow-left"></i> Back to History</button>
    <h2>${detail.product_name}</h2>
    <p style="color:var(--text-secondary)">${detail.customer_name} | ${detail.customer_phone}</p>
    <div class="stats-row">
      <div class="stat-card"><h4>${detail.quantity}</h4><p>Quantity</p></div>
      <div class="stat-card"><h4>${formatDate(detail.purchased_on)}</h4><p>Purchased</p></div>
      <div class="stat-card"><h4>${detail.warranty_status}</h4><p>Warranty</p></div>
      <div class="stat-card"><h4>${detail.issue_count}</h4><p>Issues</p></div>
      <div class="stat-card"><h4>${formatCurrency(detail.total_charges)}</h4><p>Total Charges</p></div>
      <div class="stat-card"><h4>${formatCurrency(detail.total_balance)}</h4><p>Balance</p></div>
    </div>
    <div style="margin-bottom:1rem">
      <button class="btn-sm btn-success" onclick="addIssueFor(${cphId})">Add Issue</button>
      <button class="btn-sm btn-warning" onclick="editWarranty(${cphId})">Edit Warranty</button>
    </div>`;

  if (detail.issues.length) {
    html += '<h3 style="margin-bottom:0.75rem">Issue Timeline</h3><div class="timeline">';
    detail.issues.sort((a, b) => new Date(a.issue_date) - new Date(b.issue_date)).forEach(i => {
      const isFixed = i.issue_status === 'Fixed';
      html += `<div class="timeline-item ${isFixed ? 'fixed' : ''}">
        <div class="timeline-date">${formatDate(i.issue_date)}</div>
        <div class="timeline-title">Issue: ${i.issue_description}</div>
        <div class="timeline-detail">Status: ${i.issue_status}${isFixed ? ' | Fixed: ' + formatDate(i.fixed_datetime) : ''}</div>
        ${i.fix_done_details ? `<div class="timeline-detail">Fix: ${i.fix_done_details}</div>` : ''}
        ${i.parts_replaced ? `<div class="timeline-detail">Parts: ${i.parts_replaced}</div>` : ''}
        ${i.charge_amount > 0 ? `<div class="timeline-charges">Charges: ${formatCurrency(i.charge_amount)} | Paid: ${formatCurrency(i.amount_paid)} | Balance: ${formatCurrency(i.balance_amount)}</div>` : '<div class="timeline-charges">No charges</div>'}
        ${!isFixed ? `<button class="btn-sm btn-success" style="margin-top:0.5rem" onclick="openFixModal(${i.id})">Mark Fixed</button>` : ''}
      </div>`;
    });
    html += '</div>';
  } else {
    html += '<div class="empty-state"><p>No issues reported yet</p></div>';
  }
  container.innerHTML = html;
}


// ============================================================================
// CUSTOMER HISTORY SEARCH PAGE
// ============================================================================
async function searchCustHist(search) {
  if (!search) return;
  const data = await api('/customers?search=' + encodeURIComponent(search));
  const container = document.getElementById('custHistResults');
  const uniqueCustomers = [...new Map(data.map(c => [c.id, c])).values()];
  if (!uniqueCustomers.length) { container.innerHTML = '<div class="empty-state"><p>No customers found</p></div>'; return; }
  container.innerHTML = uniqueCustomers.map(c => `<div class="mobile-card" style="display:block;cursor:pointer" onclick="viewCustomerHistoryInline(${c.id})">
    <h4>${c.name}</h4><p>Phone: ${c.phone}</p>
  </div>`).join('');
}

async function viewCustomerHistoryInline(customerId) {
  const data = await api('/customers/' + customerId + '/history');
  const customer = await api('/customers/' + customerId);
  const container = document.getElementById('custHistResults');
  let html = `<h2>${customer.name} <small style="color:var(--text-muted)">${customer.phone}</small></h2>`;
  if (data.length) {
    html += data.map(r => `<div class="mobile-card" style="display:block">
      <h4>${r.product_name}</h4><p>Qty: ${r.quantity} | Purchased: ${formatDate(r.purchased_on)}</p>
      <p>${getWarrantyBadge(r.warranty_end_date, r.extended_warranty_end_date)} | Issues: ${r.issue_count} | Charges: ${formatCurrency(r.total_charges)}</p>
      <div class="card-actions">
        <button class="btn-sm btn-primary" onclick="navigateAndViewDetail(${r.id}, ${customerId})">View Detail</button>
        <button class="btn-sm btn-success" onclick="addIssueFor(${r.id})">Add Issue</button>
      </div></div>`).join('');
  } else { html += '<div class="empty-state"><p>No product records</p></div>'; }
  container.innerHTML = html;
}

function navigateAndViewDetail(cphId, customerId) {
  // Navigate to customers page and show detail
  document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
  document.querySelector('[data-page="customers"]').classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('customersPage').classList.add('active');
  document.getElementById('customersListView').style.display = 'none';
  document.getElementById('customerHistoryView').style.display = 'block';
  viewProductDetail(cphId);
}

// ============================================================================
// PRODUCT HISTORY SEARCH PAGE
// ============================================================================
async function searchProdHist(search) {
  if (!search) return;
  const data = await api('/products?search=' + encodeURIComponent(search));
  const container = document.getElementById('prodHistResults');
  if (!data.length) { container.innerHTML = '<div class="empty-state"><p>No products found</p></div>'; return; }
  container.innerHTML = data.map(p => `<div class="mobile-card" style="display:block;cursor:pointer" onclick="viewProdHistInline(${p.id})">
    <h4>${p.name}</h4><p>Stock: ${p.current_quantity} | ${p.category || ''} ${p.brand || ''}</p>
  </div>`).join('');
}

async function viewProdHistInline(productId) {
  const product = await api('/products/' + productId);
  const txns = await api('/products/' + productId + '/history');
  const container = document.getElementById('prodHistResults');
  const totalIn = txns.reduce((s, t) => s + (t.quantity_in || 0), 0);
  const totalOut = txns.reduce((s, t) => s + (t.quantity_out || 0), 0);
  let html = `<h2>${product.name}</h2>
    <div class="stats-row">
      <div class="stat-card"><h4>${product.current_quantity}</h4><p>Current Stock</p></div>
      <div class="stat-card"><h4>${totalIn}</h4><p>Total In</p></div>
      <div class="stat-card"><h4>${totalOut}</h4><p>Total Out</p></div>
    </div>`;
  if (txns.length) {
    html += txns.map(t => `<div class="mobile-card" style="display:block">
      <p><strong>${t.transaction_type}</strong> — ${formatDate(t.created_at)}</p>
      <p>In: ${t.quantity_in || 0} | Out: ${t.quantity_out || 0} | Balance: ${t.balance_after}</p>
      <p style="color:var(--text-muted)">${t.notes || ''}</p></div>`).join('');
  } else { html += '<div class="empty-state"><p>No transactions</p></div>'; }
  container.innerHTML = html;
}


// ============================================================================
// PAYMENT UPDATE, MARK FIXED, DELETE MAINTENANCE
// ============================================================================

function openPaymentUpdate(refId, refType, balance) {
  document.getElementById('payRefId').value = refId;
  document.getElementById('payRefType').value = refType;
  document.getElementById('payCurrentBalance').value = '₹' + (+balance).toLocaleString('en-IN');
  document.getElementById('payAmount').value = '';
  document.getElementById('payPaidVia').value = '';
  showModal('paymentModal');
}

async function savePaymentUpdate() {
  const refId = document.getElementById('payRefId').value;
  const refType = document.getElementById('payRefType').value;
  const amount = +document.getElementById('payAmount').value;
  const paidVia = document.getElementById('payPaidVia').value;
  if (!amount || amount <= 0) { showToast('Amount must be greater than 0'); return; }
  if (!paidVia) { showToast('Paid Via is required'); return; }
  let endpoint;
  if (refType === 'maintenance') endpoint = '/maintenance/' + refId + '/payment';
  else if (refType === 'issue') endpoint = '/issues/' + refId + '/payment';
  else endpoint = '/customer-product/' + refId + '/payment';
  const res = await api(endpoint, { method: 'PUT', body: JSON.stringify({ amount_paid: amount, paid_via: paidVia }) });
  if (res.message && res.message.includes('cannot')) { showToast(res.message); return; }
  hideModal('paymentModal');
  loadCustomers();
  loadIssues();
  showToast('Payment updated', 'success');
}

function openMarkFixed(maintId) {
  document.getElementById('fixMaintId').value = maintId;
  document.getElementById('fixMaintDate').value = new Date().toISOString().slice(0, 16);
  document.getElementById('fixMaintDetails').value = '';
  showModal('markFixedModal');
}

async function saveMarkFixed() {
  const maintId = document.getElementById('fixMaintId').value;
  const fixedDate = document.getElementById('fixMaintDate').value;
  const fixDetails = document.getElementById('fixMaintDetails').value.trim();
  if (!fixedDate) { showToast('Fixed date required'); return; }
  if (!fixDetails) { showToast('Fix done details required'); return; }
  const res = await api('/maintenance/' + maintId + '/fix', { method: 'PUT', body: JSON.stringify({ fixed_datetime: fixedDate, fix_done_details: fixDetails }) });
  if (res.message && res.message.includes('cannot')) { showToast(res.message); return; }
  hideModal('markFixedModal');
  loadCustomers();
  showToast('Issue marked as fixed', 'success');
}

function deleteMaintenance(id) {
  showConfirm('Delete Maintenance Record?', 'This will permanently remove this maintenance record.', async () => {
    await api('/maintenance/' + id, { method: 'DELETE' });
    loadCustomers();
    refreshDashboardCounts();
    showToast('Maintenance record deleted', 'success');
  });
}

// ============================================================================
// CUSTOMER TIMELINE VIEW
// ============================================================================

async function viewCustomerTimeline(customerId) {
  const timeline = await api('/customers/' + customerId + '/timeline');
  const customer = await api('/customers/' + customerId);
  const container = document.getElementById('customerHistoryContent');
  let html = `<button class="btn-back" onclick="showCustomerList()"><i class="fas fa-arrow-left"></i> Back</button>
    <h2>${customer.name} <small style="color:var(--text-muted)">${customer.phone}</small></h2>
    <h3 style="margin-bottom:0.75rem">Full Timeline</h3>`;
  if (timeline.length) {
    html += '<div class="timeline">';
    timeline.forEach(t => {
      const icon = t.event_type.includes('purchase') ? 'shopping-cart' : t.event_type.includes('fix') ? 'check-circle' : t.event_type.includes('payment') ? 'rupee-sign' : 'clock';
      html += `<div class="timeline-item ${t.event_type.includes('fix')?'fixed':''}">
        <div class="timeline-date"><i class="fas fa-${icon}"></i> ${formatDate(t.created_at)}</div>
        <div class="timeline-title">${t.event_type.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</div>
        <div class="timeline-detail">${t.event_description||''}</div>
      </div>`;
    });
    html += '</div>';
  } else {
    html += '<div class="empty-state"><p>No timeline events yet</p></div>';
  }
  container.innerHTML = html;
  document.getElementById('customersListView').style.display = 'none';
  document.getElementById('customerHistoryView').style.display = 'block';
}

// ============================================================================
// ENHANCED SEARCH & FILTER SYSTEM
// ============================================================================

// --- Customer Filters ---
let allCustomersData = [];

async function loadCustomers(search = '') {
  const data = await api('/customers?search=' + encodeURIComponent(search));
  allCustomersData = data;
  renderCustomers(data);
}

function renderCustomers(data) {
  const tbody = document.getElementById('customersTableBody');
  const cards = document.getElementById('customersCards');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="14" class="empty-state"><i class="fas fa-users"></i><p>No customer records found</p></td></tr>';
    cards.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No customer records</p></div>';
    return;
  }
  tbody.innerHTML = data.map(c => {
    const isMaint = c.entry_type === 'Maintenance Only';
    const entryBadge = isMaint ? '<span class="badge badge-info">Maintenance</span>' : c.entry_type === 'Product Purchase' ? '<span class="badge badge-success">Purchase</span>' : '<span class="badge badge-secondary">-</span>';
    const issueStatusBadge = c.issue_status ? getStatusBadge(c.issue_status) : '-';
    const payBadge = c.payment_status ? getStatusBadge(c.payment_status) : '-';
    let actions = `<button class="btn-sm btn-info" onclick="viewCustomerHistory(${c.id})" title="History"><i class="fas fa-history"></i></button>`;
    if (isMaint) {
      if (c.issue_status !== 'Fixed') actions += `<button class="btn-sm btn-success" onclick="openMarkFixed(${c.maint_id})" title="Mark Fixed"><i class="fas fa-check"></i></button>`;
      if (+c.balance_amount > 0) actions += `<button class="btn-sm btn-primary" onclick="openPaymentUpdate('${c.maint_id}','maintenance',${c.balance_amount})" title="Update Payment"><i class="fas fa-rupee-sign"></i></button>`;
      actions += `<button class="btn-sm btn-danger" onclick="deleteMaintenance(${c.maint_id})" title="Delete"><i class="fas fa-trash"></i></button>`;
    } else if (c.cph_id) {
      actions += `<button class="btn-sm btn-primary" onclick="addIssueFor(${c.cph_id})" title="Add Issue"><i class="fas fa-tools"></i></button>`;
      if (+c.balance_amount > 0) actions += `<button class="btn-sm btn-success" onclick="openPaymentUpdate('${c.cph_id}','purchase',${c.balance_amount})" title="Update Payment"><i class="fas fa-rupee-sign"></i></button>`;
    }
    actions += `<button class="btn-sm btn-warning" onclick="editCustomer(${c.id},'${c.entry_type||''}',${c.maint_id||c.cph_id||'null'})" title="Edit"><i class="fas fa-edit"></i></button>`;
    actions += `<button class="btn-sm btn-danger" onclick="deleteCustomer(${c.id})" title="Delete"><i class="fas fa-trash"></i></button>`;
    return `<tr>
      <td>${c.name}</td><td>${c.phone||'-'}</td><td>${entryBadge}</td><td>${c.product_name||'-'}</td><td>${c.quantity||'-'}</td>
      <td>${formatCurrency(c.total_amount)}</td><td>${formatCurrency(c.amount_paid)}</td><td style="color:var(--danger)">${formatCurrency(c.balance_amount)}</td>
      <td>${payBadge}</td><td>${issueStatusBadge}</td>
      <td>${c.entry_date?formatDate(c.entry_date):'-'}</td>
      <td>${c.created_at?formatDate(c.created_at):'-'}</td><td>${c.updated_at?formatDate(c.updated_at):'-'}</td>
      <td>${actions}</td></tr>`;
  }).join('');
  cards.innerHTML = data.map(c => {
    const isMaint = c.entry_type === 'Maintenance Only';
    const entryBadge = isMaint ? '<span class="badge badge-info">Maintenance</span>' : c.entry_type === 'Product Purchase' ? '<span class="badge badge-success">Purchase</span>' : '';
    let actions = `<button class="btn-sm btn-info" onclick="viewCustomerHistory(${c.id})">History</button>`;
    if (isMaint) {
      if (c.issue_status !== 'Fixed') actions += `<button class="btn-sm btn-success" onclick="openMarkFixed(${c.maint_id})">Fix</button>`;
      if (+c.balance_amount > 0) actions += `<button class="btn-sm btn-primary" onclick="openPaymentUpdate('${c.maint_id}','maintenance',${c.balance_amount})">Pay</button>`;
      actions += `<button class="btn-sm btn-danger" onclick="deleteMaintenance(${c.maint_id})">Del</button>`;
    } else if (c.cph_id) {
      actions += `<button class="btn-sm btn-primary" onclick="addIssueFor(${c.cph_id})">Issue</button>`;
      if (+c.balance_amount > 0) actions += `<button class="btn-sm btn-success" onclick="openPaymentUpdate('${c.cph_id}','purchase',${c.balance_amount})">Pay</button>`;
    }
    actions += `<button class="btn-sm btn-warning" onclick="editCustomer(${c.id},'${c.entry_type||''}',${c.maint_id||c.cph_id||'null'})">Edit</button>`;
    actions += `<button class="btn-sm btn-danger" onclick="deleteCustomer(${c.id})">Del</button>`;
    return `<div class="mobile-card">
      <h4>${c.name} <small style="color:var(--text-muted)">${c.phone||''}</small></h4>
      <p>${entryBadge} ${c.product_name||'-'} ${c.quantity?'| Qty: '+c.quantity:''}</p>
      <p>Total: ${formatCurrency(c.total_amount)} | Paid: ${formatCurrency(c.amount_paid)} | <span style="color:var(--danger)">Due: ${formatCurrency(c.balance_amount)}</span></p>
      <p>${c.payment_status?getStatusBadge(c.payment_status):''} ${c.issue_status?getStatusBadge(c.issue_status):''} ${c.entry_date?formatDate(c.entry_date):''}</p>
      <p style="font-size:0.72rem;color:var(--text-muted)">Created: ${c.created_at?formatDate(c.created_at):'-'} | Modified: ${c.updated_at?formatDate(c.updated_at):'-'}</p>
      <div class="card-actions">${actions}</div></div>`;
  }).join('');
}

function applyCustomerFilters() {
  let data = [...allCustomersData];
  const search = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  const dateFrom = document.getElementById('custFilterDateFrom')?.value;
  const dateTo = document.getElementById('custFilterDateTo')?.value;
  const product = document.getElementById('custFilterProduct')?.value;
  const warranty = document.getElementById('custFilterWarranty')?.value;
  const payment = document.getElementById('custFilterPayment')?.value;
  const paidVia = document.getElementById('custFilterPaidVia')?.value;

  if (search) {
    data = data.filter(c =>
      (c.name||'').toLowerCase().includes(search) ||
      (c.phone||'').includes(search) ||
      (c.product_name||'').toLowerCase().includes(search)
    );
  }
  if (dateFrom) data = data.filter(c => c.entry_date && c.entry_date.split('T')[0] >= dateFrom);
  if (dateTo) data = data.filter(c => c.entry_date && c.entry_date.split('T')[0] <= dateTo);
  if (product) data = data.filter(c => c.product_name === product);
  if (warranty === 'active') data = data.filter(c => c.warranty_end_date && new Date(c.warranty_end_date) >= new Date());
  if (warranty === 'expired') data = data.filter(c => c.warranty_end_date && new Date(c.warranty_end_date) < new Date());
  if (warranty === 'none') data = data.filter(c => !c.warranty_end_date);
  if (payment === 'paid') data = data.filter(c => c.payment_status === 'Paid');
  if (payment === 'pending') data = data.filter(c => c.payment_status === 'Pending' || c.payment_status === 'Partially Paid');
  if (paidVia) data = data.filter(c => c.paid_via === paidVia);

  renderCustomers(data);
}

// --- Inventory Filters ---
let allProductsData = [];

async function loadProducts(search = '') {
  const data = await api('/products?search=' + encodeURIComponent(search));
  allProductsData = data;
  renderProducts(data);
}

function renderProducts(data) {
  const tbody = document.getElementById('inventoryTableBody');
  const cards = document.getElementById('inventoryCards');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><i class="fas fa-boxes"></i><p>No products found</p></td></tr>';
    cards.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>No products</p></div>';
    return;
  }
  tbody.innerHTML = data.map(p => {
    const low = p.current_quantity <= (p.low_stock_quantity||5);
    const out = +p.current_quantity === 0;
    return `<tr>
      <td>${p.name}</td><td>${p.category||'-'}</td><td>${p.brand||'-'}</td>
      <td><span class="${out?'badge badge-danger':low?'badge badge-warning':''}">${p.current_quantity}${out?' (Out)':low?' (Low)':''}</span></td>
      <td>${formatCurrency(p.purchase_price)}</td><td>${formatCurrency(p.selling_price)}</td>
      <td>${p.warranty_available?'✓ '+(p.warranty_period||''):'-'}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>${formatDate(p.updated_at)}</td>
      <td>
        <button class="btn-sm btn-info" onclick="viewProductHistory(${p.id})" title="History"><i class="fas fa-history"></i></button>
        <button class="btn-sm btn-success" onclick="openAddInventoryModal(${p.id})" title="Add Stock"><i class="fas fa-plus"></i></button>
        <button class="btn-sm btn-warning" onclick="editProduct(${p.id})" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn-sm btn-danger" onclick="deleteProduct(${p.id})" title="Delete"><i class="fas fa-trash"></i></button>
      </td></tr>`;
  }).join('');
  cards.innerHTML = data.map(p => {
    const low = p.current_quantity <= (p.low_stock_quantity||5);
    const out = +p.current_quantity === 0;
    return `<div class="mobile-card">
      <h4>${p.name} ${out?'<span class="badge badge-danger">Out of Stock</span>':low?'<span class="badge badge-warning">Low Stock</span>':''}</h4>
      <p>${p.category||'-'} | ${p.brand||'-'} | Stock: <strong>${p.current_quantity}</strong></p>
      <p>Purchase: ${formatCurrency(p.purchase_price)}/qty | Selling: ${formatCurrency(p.selling_price)}/qty</p>
      <p>Warranty: ${p.warranty_available?'✓ '+(p.warranty_period||''):'-'}</p>
      <p style="font-size:0.72rem;color:var(--text-muted)">Created: ${formatDate(p.created_at)} | Modified: ${formatDate(p.updated_at)}</p>
      <div class="card-actions">
        <button class="btn-sm btn-success" onclick="openAddInventoryModal(${p.id})">Add Stock</button>
        <button class="btn-sm btn-info" onclick="viewProductHistory(${p.id})">History</button>
        <button class="btn-sm btn-warning" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn-sm btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
      </div></div>`;
  }).join('');
}

function applyInventoryFilters() {
  let data = [...allProductsData];
  const search = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const category = document.getElementById('invFilterCategory')?.value;
  const brand = document.getElementById('invFilterBrand')?.value;
  const stock = document.getElementById('invFilterStock')?.value;
  const warranty = document.getElementById('invFilterWarranty')?.value;
  const createdFrom = document.getElementById('invFilterCreatedFrom')?.value;
  const createdTo = document.getElementById('invFilterCreatedTo')?.value;
  const addedFrom = document.getElementById('invFilterAddedFrom')?.value;

  if (search) {
    data = data.filter(p =>
      (p.name||'').toLowerCase().includes(search) ||
      (p.category||'').toLowerCase().includes(search) ||
      (p.brand||'').toLowerCase().includes(search)
    );
  }
  if (category) data = data.filter(p => p.category === category);
  if (brand) data = data.filter(p => p.brand === brand);
  if (stock === 'in_stock') data = data.filter(p => +p.current_quantity > (+p.low_stock_quantity||5));
  if (stock === 'low_stock') data = data.filter(p => +p.current_quantity > 0 && +p.current_quantity <= (+p.low_stock_quantity||5));
  if (stock === 'out_of_stock') data = data.filter(p => +p.current_quantity === 0);
  if (warranty === 'yes') data = data.filter(p => p.warranty_available);
  if (warranty === 'no') data = data.filter(p => !p.warranty_available);
  if (createdFrom) data = data.filter(p => p.created_at && p.created_at.split('T')[0] >= createdFrom);
  if (createdTo) data = data.filter(p => p.created_at && p.created_at.split('T')[0] <= createdTo);
  if (addedFrom) data = data.filter(p => p.created_at && p.created_at.split('T')[0] >= addedFrom);

  renderProducts(data);
}

// --- Filter UI Setup ---
document.addEventListener('DOMContentLoaded', () => {
  // Customer filter toggle
  const custToggle = document.getElementById('custFilterToggle');
  const custFilters = document.getElementById('custFilters');
  const custClear = document.getElementById('custClearFilters');
  custToggle?.addEventListener('click', () => {
    const show = custFilters.style.display === 'none';
    custFilters.style.display = show ? 'block' : 'none';
    custToggle.classList.toggle('active', show);
  });
  custClear?.addEventListener('click', () => {
    document.getElementById('custFilterDateFrom').value = '';
    document.getElementById('custFilterDateTo').value = '';
    document.getElementById('custFilterProduct').value = '';
    document.getElementById('custFilterWarranty').value = '';
    document.getElementById('custFilterPayment').value = '';
    document.getElementById('custFilterIssue').value = '';
    document.getElementById('custFilterPaidVia').value = '';
    document.getElementById('customerSearch').value = '';
    custClear.style.display = 'none';
    renderCustomers(allCustomersData);
  });
  document.getElementById('custApplyFilters')?.addEventListener('click', () => {
    custClear.style.display = 'inline-flex';
    applyCustomerFilters();
  });

  // Customer search (live)
  let custSearchTimer;
  document.getElementById('customerSearch')?.addEventListener('input', (e) => {
    clearTimeout(custSearchTimer);
    custSearchTimer = setTimeout(() => {
      if (allCustomersData.length) applyCustomerFilters();
      else loadCustomers(e.target.value);
    }, 300);
  });

  // Inventory filter toggle
  const invToggle = document.getElementById('invFilterToggle');
  const invFilters = document.getElementById('invFilters');
  const invClear = document.getElementById('invClearFilters');
  invToggle?.addEventListener('click', () => {
    const show = invFilters.style.display === 'none';
    invFilters.style.display = show ? 'block' : 'none';
    invToggle.classList.toggle('active', show);
  });
  invClear?.addEventListener('click', () => {
    document.getElementById('invFilterCategory').value = '';
    document.getElementById('invFilterBrand').value = '';
    document.getElementById('invFilterStock').value = '';
    document.getElementById('invFilterWarranty').value = '';
    document.getElementById('invFilterCreatedFrom').value = '';
    document.getElementById('invFilterCreatedTo').value = '';
    document.getElementById('invFilterAddedFrom').value = '';
    document.getElementById('productSearch').value = '';
    invClear.style.display = 'none';
    renderProducts(allProductsData);
  });
  document.getElementById('invApplyFilters')?.addEventListener('click', () => {
    invClear.style.display = 'inline-flex';
    applyInventoryFilters();
  });

  // Inventory search (live)
  let invSearchTimer;
  document.getElementById('productSearch')?.addEventListener('input', (e) => {
    clearTimeout(invSearchTimer);
    invSearchTimer = setTimeout(() => {
      if (allProductsData.length) applyInventoryFilters();
      else loadProducts(e.target.value);
    }, 300);
  });

  // Populate filter dropdowns when data loads
  setTimeout(populateFilterDropdowns, 1500);
});

async function populateFilterDropdowns() {
  try {
    // Populate product filter in customers
    const products = await api('/products');
    const custProdSelect = document.getElementById('custFilterProduct');
    if (custProdSelect) {
      const names = [...new Set(products.map(p => p.name))];
      custProdSelect.innerHTML = '<option value="">All Products</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
    }

    // Populate category/brand in inventory
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
    const catSelect = document.getElementById('invFilterCategory');
    const brandSelect = document.getElementById('invFilterBrand');
    if (catSelect) catSelect.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (brandSelect) brandSelect.innerHTML = '<option value="">All Brands</option>' + brands.map(b => `<option value="${b}">${b}</option>`).join('');
  } catch(e) {}
}
