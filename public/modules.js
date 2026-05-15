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
  document.getElementById('productDetailsPanel').style.display = 'none';
  document.getElementById('custTotalAmount').value = '';
  const balanceInput = document.getElementById('custBalance');
  if (balanceInput) balanceInput.value = '';
  document.getElementById('custPurchaseDate').value = new Date().toISOString().slice(0,16);
  await loadProductDropdown();
  showModal('customerModal');
}

async function loadProductDropdown() {
  allProducts = await api('/products');
  const sel = document.getElementById('customerProductSelect');
  sel.innerHTML = '<option value="">-- Select Product --</option>' + allProducts.map(p =>
    `<option value="${p.id}">${p.name} | ${p.brand||'-'} | Stock: ${p.current_quantity} | Warranty: ${p.warranty_available?'Yes':'No'}</option>`
  ).join('');
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
  document.getElementById('custProdWarranty').textContent = p.warranty_available ? 'Yes — ' + (p.warranty_period||'') : 'No';
  document.getElementById('custSellingPrice').value = p.selling_price || '';
  document.getElementById('custQuantity').value = 1;
  if (p.warranty_available && p.warranty_period) {
    const months = parseInt(p.warranty_period) * (p.warranty_period.toLowerCase().includes('year') ? 12 : 1) || 12;
    const end = new Date(); end.setMonth(end.getMonth() + months);
    document.getElementById('custWarrantyEnd').value = end.toISOString().split('T')[0];
  } else {
    document.getElementById('custWarrantyEnd').value = '';
  }
  calcCustomerTotal();
}

function calcCustomerTotal() {
  const sp = +document.getElementById('custSellingPrice').value || 0;
  const qty = +document.getElementById('custQuantity').value || 0;
  const total = sp * qty;
  document.getElementById('custTotalAmount').value = total ? '₹' + total.toLocaleString('en-IN') : '';
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
    balanceInput.value = balance >= 0 ? '₹' + balance.toLocaleString('en-IN') : '';
  }
}

async function saveCustomer() {
  const saveBtn = document.querySelector('#customerForm .btn-save');
  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  if (!name || name.length < 2) { showToast('Customer name required (min 2 chars)'); return; }
  if (/^\d+$/.test(name)) { showToast('Customer name cannot be only numbers'); return; }
  if (phone && !/^\d{10,}$/.test(phone)) { showToast('Phone number must be 10+ digits if provided'); return; }

  const editId = document.getElementById('customerFormId').value;
  if (editId) {
    setBtnLoading(saveBtn, true);
    await api('/customers/' + editId, { method: 'PUT', body: JSON.stringify({ name, phone }) });
    setBtnLoading(saveBtn, false);
    hideModal('customerModal');
    loadCustomers();
    showToast('Customer updated', 'success');
    return;
  }

  const product_id = document.getElementById('customerProductSelect').value;
  if (!product_id) { showToast('Please select a product'); return; }
  const qty = +document.getElementById('custQuantity').value;
  if (!qty || qty <= 0 || qty !== Math.floor(qty)) { showToast('Quantity must be a whole number > 0'); return; }
  const p = allProducts.find(x => x.id === +product_id);
  if (p && qty > p.current_quantity) { showToast('Quantity exceeds available stock (' + p.current_quantity + ')'); return; }

  const sp = +document.getElementById('custSellingPrice').value;
  if (!sp || sp <= 0) { showToast('Selling price must be > 0'); return; }
  const total = sp * qty;
  const paid = +document.getElementById('custAmountPaid').value || 0;
  if (paid < 0) { showToast('Amount paid cannot be negative'); return; }
  if (paid > total) { showToast('Amount paid (₹'+paid+') cannot exceed total (₹'+total+')'); return; }

  const paidVia = document.getElementById('custPaidVia').value;
  if (!paidVia) { showToast('Please select payment method'); return; }

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
  hideModal('customerModal');
  loadCustomers();
  refreshDashboardCounts();
  showToast('Customer record saved', 'success');
}

async function editCustomer(id) {
  const c = await api('/customers/' + id);
  document.getElementById('customerFormTitle').textContent = 'Edit Customer';
  document.getElementById('customerFormId').value = id;
  document.getElementById('custName').value = c.name;
  document.getElementById('custPhone').value = c.phone;
  document.getElementById('productDetailsPanel').style.display = 'none';
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
  const totalPaid = data.reduce((s, r) => s + (+r.amount_paid || 0), 0);
  const totalBalance = data.reduce((s, r) => s + (+r.balance_amount || 0), 0);

  let html = `<button class="btn-back" onclick="showCustomerList()"><i class="fas fa-arrow-left"></i> Back</button>
    <h2>${customer.name} <small style="color:var(--text-muted)">${customer.phone}</small></h2>
    <div class="stats-row">
      <div class="stat-card"><h4>${data.length}</h4><p>Products</p></div>
      <div class="stat-card"><h4>${data.reduce((s,r)=>s+(+r.quantity||0),0)}</h4><p>Total Qty</p></div>
      <div class="stat-card"><h4>${formatCurrency(totalPaid)}</h4><p>Total Paid</p></div>
      <div class="stat-card"><h4>${formatCurrency(totalBalance)}</h4><p>Balance Due</p></div>
      <div class="stat-card"><h4>${data.reduce((s,r)=>s+(+r.issue_count||0),0)}</h4><p>Issues</p></div>
    </div>`;

  if (data.length) {
    html += '<h3 style="margin-bottom:0.75rem">Purchase & Issue Timeline</h3><div class="timeline">';
    data.forEach(r => {
      html += `<div class="timeline-item">
        <div class="timeline-date">${formatDate(r.purchased_on)} — Purchase</div>
        <div class="timeline-title">${r.product_name} (Qty: ${r.quantity})</div>
        <div class="timeline-detail">Total: ${formatCurrency(r.total_amount||0)} | Paid: ${formatCurrency(r.amount_paid)} | Balance: ${formatCurrency(r.balance_amount||0)} ${r.paid_via?'| via '+r.paid_via:''}</div>
        <div class="timeline-detail">${getWarrantyBadge(r.warranty_end_date, r.extended_warranty_end_date)}</div>
        <div class="card-actions" style="margin-top:0.5rem">
          <button class="btn-sm btn-primary" onclick="viewProductDetail(${r.id})">Full Detail</button>
          <button class="btn-sm btn-success" onclick="addIssueFor(${r.id})">Add Issue</button>
        </div>
      </div>`;
    });
    html += '</div>';
    html += `<div class="mobile-cards">` + data.map(r => `<div class="mobile-card">
      <h4>${r.product_name}</h4><p>Qty: ${r.quantity} | ${formatDate(r.purchased_on)}</p>
      <p>Total: ${formatCurrency(r.total_amount||0)} | Paid: ${formatCurrency(r.amount_paid)} | Balance: ${formatCurrency(r.balance_amount||0)}</p>
      <p>${getWarrantyBadge(r.warranty_end_date, r.extended_warranty_end_date)} Issues: ${r.issue_count||0}</p>
      <div class="card-actions">
        <button class="btn-sm btn-primary" onclick="viewProductDetail(${r.id})">Detail</button>
        <button class="btn-sm btn-success" onclick="addIssueFor(${r.id})">Issue</button>
      </div></div>`).join('') + '</div>';
  } else {
    html += '<div class="empty-state"><p>No purchase records</p></div>';
  }
  container.innerHTML = html;
  document.getElementById('customersListView').style.display = 'none';
  document.getElementById('customerHistoryView').style.display = 'block';
}

function showCustomerList() {
  document.getElementById('customersListView').style.display = 'block';
  document.getElementById('customerHistoryView').style.display = 'none';
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
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-tools"></i><p>No issues found</p></td></tr>';
    cards.innerHTML = '<div class="empty-state"><i class="fas fa-tools"></i><p>No issues</p></div>';
    return;
  }
  tbody.innerHTML = data.map(i => `<tr>
    <td>${i.customer_name}</td><td>${i.product_name}</td><td>${formatDate(i.issue_date)}</td>
    <td>${i.issue_description.substring(0, 40)}${i.issue_description.length > 40 ? '...' : ''}</td>
    <td>${getStatusBadge(i.issue_status)}</td><td>${i.warranty_status_at_issue || '-'}</td>
    <td>${formatCurrency(i.charge_amount)}</td>
    <td>
      ${i.issue_status !== 'Fixed' ? `<button class="btn-sm btn-success" onclick="openFixModal(${i.id})">Fix</button>` : ''}
      <button class="btn-sm btn-warning" onclick="editIssue(${i.id})">Edit</button>
    </td></tr>`).join('');
  cards.innerHTML = data.map(i => `<div class="mobile-card">
    <h4>${i.product_name}</h4><p>Customer: ${i.customer_name}</p>
    <p>Issue: ${i.issue_description.substring(0, 50)}</p>
    <p>${formatDate(i.issue_date)} | ${getStatusBadge(i.issue_status)} | ${formatCurrency(i.charge_amount)}</p>
    <div class="card-actions">
      ${i.issue_status !== 'Fixed' ? `<button class="btn-sm btn-success" onclick="openFixModal(${i.id})">Mark Fixed</button>` : ''}
      <button class="btn-sm btn-warning" onclick="editIssue(${i.id})">Edit</button>
    </div></div>`).join('');
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
  // Show status update modal
  document.getElementById('confirmTitle').textContent = 'Update Issue Status';
  document.getElementById('confirmMsg').innerHTML = '';
  const sel = document.createElement('select');
  sel.style.cssText = 'width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;margin-top:0.5rem';
  ['Reported','Checking','Repair In Progress','Fixed','Returned to Customer','Rejected'].forEach(s => {
    sel.innerHTML += `<option value="${s}">${s}</option>`;
  });
  document.getElementById('confirmMsg').appendChild(sel);
  document.getElementById('confirmYesBtn').textContent = 'Update';
  document.getElementById('confirmYesBtn').style.background = 'var(--primary)';
  document.getElementById('confirmYesBtn').onclick = async () => {
    hideModal('confirmModal');
    await api('/issues/' + id, { method: 'PUT', body: JSON.stringify({ issue_status: sel.value }) });
    loadIssues();
    showToast('Issue status updated', 'success');
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
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state"><i class="fas fa-users"></i><p>No customer records found</p></td></tr>';
    cards.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No customer records</p></div>';
    return;
  }
  tbody.innerHTML = data.map(c => `<tr>
    <td>${c.name}</td><td>${c.phone||'-'}</td><td>${c.product_name||'-'}</td><td>${c.quantity||0}</td>
    <td>${formatCurrency(c.total_amount)}</td><td>${formatCurrency(c.amount_paid)}</td>
    <td>${getWarrantyBadge(c.warranty_end_date)}</td>
    <td>${c.purchased_on?formatDate(c.purchased_on):'-'}</td>
    <td>${c.created_at?formatDate(c.created_at):'-'}</td>
    <td>${c.updated_at?formatDate(c.updated_at):'-'}</td>
    <td>
      <button class="btn-sm btn-info" onclick="viewCustomerHistory(${c.id})" title="History"><i class="fas fa-history"></i></button>
      ${c.cph_id?`<button class="btn-sm btn-primary" onclick="addIssueFor(${c.cph_id})" title="Issue"><i class="fas fa-tools"></i></button>`:''}
      <button class="btn-sm btn-warning" onclick="editCustomer(${c.id})" title="Edit"><i class="fas fa-edit"></i></button>
      <button class="btn-sm btn-danger" onclick="deleteCustomer(${c.id})" title="Delete"><i class="fas fa-trash"></i></button>
    </td></tr>`).join('');
  cards.innerHTML = data.map(c => `<div class="mobile-card">
    <h4>${c.name} <small style="color:var(--text-muted)">${c.phone||''}</small></h4>
    <p>Product: ${c.product_name||'-'} | Qty: ${c.quantity||0}</p>
    <p>Total: ${formatCurrency(c.total_amount)} | Paid: ${formatCurrency(c.amount_paid)}</p>
    <p>${getWarrantyBadge(c.warranty_end_date)} ${c.purchased_on?formatDate(c.purchased_on):''}</p>
    <p style="font-size:0.72rem;color:var(--text-muted)">Created: ${c.created_at?formatDate(c.created_at):'-'} | Modified: ${c.updated_at?formatDate(c.updated_at):'-'}</p>
    <div class="card-actions">
      <button class="btn-sm btn-info" onclick="viewCustomerHistory(${c.id})">History</button>
      ${c.cph_id?`<button class="btn-sm btn-primary" onclick="addIssueFor(${c.cph_id})">Issue</button>`:''}
      <button class="btn-sm btn-warning" onclick="editCustomer(${c.id})">Edit</button>
      <button class="btn-sm btn-danger" onclick="deleteCustomer(${c.id})">Delete</button>
    </div></div>`).join('');
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
  if (dateFrom) data = data.filter(c => c.purchased_on && c.purchased_on.split('T')[0] >= dateFrom);
  if (dateTo) data = data.filter(c => c.purchased_on && c.purchased_on.split('T')[0] <= dateTo);
  if (product) data = data.filter(c => c.product_name === product);
  if (warranty === 'active') data = data.filter(c => c.warranty_end_date && new Date(c.warranty_end_date) >= new Date());
  if (warranty === 'expired') data = data.filter(c => c.warranty_end_date && new Date(c.warranty_end_date) < new Date());
  if (warranty === 'none') data = data.filter(c => !c.warranty_end_date);
  if (payment === 'paid') data = data.filter(c => (+c.balance_amount || 0) === 0);
  if (payment === 'pending') data = data.filter(c => (+c.balance_amount || 0) > 0);
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
