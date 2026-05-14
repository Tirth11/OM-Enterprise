// Self Weld Industries - Modules JS (Customers, Inventory, Issues)
const API = '/api';

async function api(path, opts = {}) {
  const res = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return res.json();
}

function refreshDashboardCounts() {
  if (window.dashboardInstance) window.dashboardInstance.loadRealData();
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
// CUSTOMERS MODULE
// ============================================================================
async function loadCustomers(search = '') {
  const data = await api('/customers?search=' + encodeURIComponent(search));
  const tbody = document.getElementById('customersTableBody');
  const cards = document.getElementById('customersCards');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-users"></i><p>No customer records found</p></td></tr>';
    cards.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No customer records</p></div>';
    return;
  }
  tbody.innerHTML = data.map(c => `<tr>
    <td>${c.name}</td><td>${c.phone}</td><td>${c.product_name}</td><td>${c.quantity}</td>
    <td>${formatDate(c.purchased_on)}</td><td>${getWarrantyBadge(c.warranty_end_date)}</td><td>${getStatusBadge(c.payment_status)}</td>
    <td>
      <button class="btn-sm btn-info" onclick="viewCustomerHistory(${c.id})"><i class="fas fa-history"></i></button>
      <button class="btn-sm btn-warning" onclick="editCustomer(${c.id})"><i class="fas fa-edit"></i></button>
      <button class="btn-sm btn-danger" onclick="deleteCustomer(${c.id})"><i class="fas fa-trash"></i></button>
      ${c.cph_id ? `<button class="btn-sm btn-primary" onclick="addIssueFor(${c.cph_id})"><i class="fas fa-tools"></i></button>` : ''}
    </td></tr>`).join('');
  cards.innerHTML = data.map(c => `<div class="mobile-card">
    <h4>${c.name}</h4><p>Phone: ${c.phone}</p><p>Product: ${c.product_name} (Qty: ${c.quantity})</p>
    <p>Purchased: ${formatDate(c.purchased_on)}</p><p>${getWarrantyBadge(c.warranty_end_date)} ${getStatusBadge(c.payment_status)}</p>
    <div class="card-actions">
      <button class="btn-sm btn-info" onclick="viewCustomerHistory(${c.id})">History</button>
      <button class="btn-sm btn-warning" onclick="editCustomer(${c.id})">Edit</button>
      ${c.cph_id ? `<button class="btn-sm btn-primary" onclick="addIssueFor(${c.cph_id})">Add Issue</button>` : ''}
    </div></div>`).join('');
}

async function openAddCustomerModal() {
  document.getElementById('customerForm').reset();
  document.getElementById('customerFormTitle').textContent = 'Add Customer Record';
  document.getElementById('customerFormId').value = '';
  await loadProductDropdown();
  showModal('customerModal');
}

async function loadProductDropdown() {
  const products = await api('/products');
  const sel = document.getElementById('customerProductSelect');
  sel.innerHTML = '<option value="">-- Select Product --</option>' + products.map(p =>
    `<option value="${p.id}">${p.name} — Available: ${p.current_quantity}</option>`
  ).join('');
}

async function saveCustomer() {
  const form = document.getElementById('customerForm');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  body.warranty_available = document.getElementById('custWarrantyAvail').checked;
  const editId = document.getElementById('customerFormId').value;

  if (editId) {
    await api('/customers/' + editId, { method: 'PUT', body: JSON.stringify(body) });
  } else {
    const res = await api('/customers', { method: 'POST', body: JSON.stringify(body) });
    if (res.message && res.message.includes('Stock not')) { alert(res.message); return; }
  }
  hideModal('customerModal');
  loadCustomers();
  refreshDashboardCounts();
}

async function editCustomer(id) {
  const c = await api('/customers/' + id);
  document.getElementById('customerFormTitle').textContent = 'Edit Customer';
  document.getElementById('customerFormId').value = id;
  document.getElementById('custName').value = c.name;
  document.getElementById('custPhone').value = c.phone;
  showModal('customerModal');
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer record?')) return;
  await api('/customers/' + id, { method: 'DELETE' });
  loadCustomers();
}

async function viewCustomerHistory(customerId) {
  const data = await api('/customers/' + customerId + '/history');
  const customer = await api('/customers/' + customerId);
  const container = document.getElementById('customerHistoryContent');
  const totalPaid = data.reduce((s, r) => s + (+r.amount_paid || 0), 0);

  let html = `<button class="btn-back" onclick="showCustomerList()"><i class="fas fa-arrow-left"></i> Back</button>
    <h2>${customer.name} <small style="color:var(--text-muted)">${customer.phone}</small></h2>
    <div class="stats-row">
      <div class="stat-card"><h4>${data.length}</h4><p>Products Taken</p></div>
      <div class="stat-card"><h4>${data.reduce((s,r) => s + r.quantity, 0)}</h4><p>Total Qty</p></div>
      <div class="stat-card"><h4>${formatCurrency(totalPaid)}</h4><p>Total Paid</p></div>
      <div class="stat-card"><h4>${data.reduce((s,r) => s + r.issue_count, 0)}</h4><p>Total Issues</p></div>
    </div>`;

  if (data.length) {
    html += `<div class="module-table-wrap"><table class="module-table"><thead><tr>
      <th>Product</th><th>Qty</th><th>Purchased</th><th>Warranty</th><th>Status</th><th>Payment</th><th>Issues</th><th>Actions</th>
    </tr></thead><tbody>` + data.map(r => `<tr>
      <td>${r.product_name}</td><td>${r.quantity}</td><td>${formatDate(r.purchased_on)}</td>
      <td>${getWarrantyBadge(r.warranty_end_date, r.extended_warranty_end_date)}</td>
      <td>${r.warranty_status}</td><td>${getStatusBadge(r.payment_status)}</td><td>${r.issue_count}</td>
      <td>
        <button class="btn-sm btn-primary" onclick="viewProductDetail(${r.id})">Detail</button>
        <button class="btn-sm btn-success" onclick="addIssueFor(${r.id})">Add Issue</button>
        <button class="btn-sm btn-warning" onclick="editWarranty(${r.id})">Warranty</button>
      </td></tr>`).join('') + '</tbody></table></div>';
    // Mobile cards
    html += `<div class="mobile-cards">` + data.map(r => `<div class="mobile-card">
      <h4>${r.product_name}</h4><p>Qty: ${r.quantity} | Purchased: ${formatDate(r.purchased_on)}</p>
      <p>${getWarrantyBadge(r.warranty_end_date, r.extended_warranty_end_date)} Issues: ${r.issue_count} | Charges: ${formatCurrency(r.total_charges)}</p>
      <div class="card-actions">
        <button class="btn-sm btn-primary" onclick="viewProductDetail(${r.id})">Detail</button>
        <button class="btn-sm btn-success" onclick="addIssueFor(${r.id})">Add Issue</button>
        <button class="btn-sm btn-warning" onclick="editWarranty(${r.id})">Warranty</button>
      </div></div>`).join('') + '</div>';
  } else {
    html += '<div class="empty-state"><p>No product records for this customer</p></div>';
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
async function loadProducts(search = '') {
  const data = await api('/products?search=' + encodeURIComponent(search));
  const tbody = document.getElementById('inventoryTableBody');
  const cards = document.getElementById('inventoryCards');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><i class="fas fa-boxes"></i><p>No products found</p></td></tr>';
    cards.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>No products</p></div>';
    return;
  }
  tbody.innerHTML = data.map(p => {
    const lowStock = p.current_quantity <= p.low_stock_quantity;
    return `<tr>
      <td>${p.name}</td><td>${p.category || '-'}</td><td>${p.brand || '-'}</td>
      <td><span class="${lowStock ? 'badge badge-danger' : ''}">${p.current_quantity}</span></td>
      <td>${formatCurrency(p.purchase_price)}</td><td>${formatCurrency(p.selling_price)}</td>
      <td>${p.warranty_available ? '✓ ' + (p.warranty_period || '') : '-'}</td>
      <td>${p.low_stock_quantity}</td>
      <td>${lowStock ? '<span class="badge badge-danger">Low</span>' : '<span class="badge badge-success">OK</span>'}</td>
      <td>
        <button class="btn-sm btn-info" onclick="viewProductHistory(${p.id})"><i class="fas fa-history"></i></button>
        <button class="btn-sm btn-success" onclick="openVendorStockModal(${p.id})"><i class="fas fa-plus"></i></button>
        <button class="btn-sm btn-warning" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
      </td></tr>`;
  }).join('');
  cards.innerHTML = data.map(p => {
    const lowStock = p.current_quantity <= p.low_stock_quantity;
    return `<div class="mobile-card">
      <h4>${p.name}</h4><p>Stock: ${p.current_quantity} ${lowStock ? '⚠️ Low' : ''} | Selling: ${formatCurrency(p.selling_price)}</p>
      <p>${p.category || ''} ${p.brand || ''} | Low Limit: ${p.low_stock_quantity}</p>
      <div class="card-actions">
        <button class="btn-sm btn-success" onclick="openVendorStockModal(${p.id})">Add Stock</button>
        <button class="btn-sm btn-info" onclick="viewProductHistory(${p.id})">History</button>
        <button class="btn-sm btn-warning" onclick="editProduct(${p.id})">Edit</button>
      </div></div>`;
  }).join('');
}

function openAddProductModal() {
  document.getElementById('productForm').reset();
  document.getElementById('productFormTitle').textContent = 'Add Product';
  document.getElementById('productFormId').value = '';
  showModal('productModal');
}

async function saveProduct() {
  const form = document.getElementById('productForm');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  body.warranty_available = document.getElementById('prodWarrantyAvail').checked;
  const editId = document.getElementById('productFormId').value;
  if (editId) {
    await api('/products/' + editId, { method: 'PUT', body: JSON.stringify(body) });
  } else {
    await api('/products', { method: 'POST', body: JSON.stringify(body) });
  }
  hideModal('productModal');
  loadProducts();
  refreshDashboardCounts();
}

async function editProduct(id) {
  const p = await api('/products/' + id);
  document.getElementById('productFormTitle').textContent = 'Edit Product';
  document.getElementById('productFormId').value = id;
  document.getElementById('prodName').value = p.name;
  document.getElementById('prodCategory').value = p.category || '';
  document.getElementById('prodBrand').value = p.brand || '';
  document.getElementById('prodQuantity').value = p.current_quantity;
  document.getElementById('prodPurchasePrice').value = p.purchase_price;
  document.getElementById('prodSellingPrice').value = p.selling_price;
  document.getElementById('prodWarrantyAvail').checked = p.warranty_available;
  document.getElementById('prodWarrantyPeriod').value = p.warranty_period || '';
  document.getElementById('prodLowStock').value = p.low_stock_quantity;
  document.getElementById('prodNotes').value = p.notes || '';
  showModal('productModal');
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  await api('/products/' + id, { method: 'DELETE' });
  loadProducts();
}

function openVendorStockModal(productId) {
  document.getElementById('vendorStockForm').reset();
  document.getElementById('vendorProductId').value = productId;
  showModal('vendorStockModal');
}

async function saveVendorStock() {
  const form = document.getElementById('vendorStockForm');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  await api('/vendor-stock', { method: 'POST', body: JSON.stringify(body) });
  hideModal('vendorStockModal');
  loadProducts();
  refreshDashboardCounts();
}

async function viewProductHistory(productId) {
  const product = await api('/products/' + productId);
  const txns = await api('/products/' + productId + '/history');
  const container = document.getElementById('productHistoryContent');
  const totalIn = txns.reduce((s, t) => s + (t.quantity_in || 0), 0);
  const totalOut = txns.reduce((s, t) => s + (t.quantity_out || 0), 0);

  let html = `<button class="btn-back" onclick="showInventoryList()"><i class="fas fa-arrow-left"></i> Back</button>
    <h2>${product.name}</h2>
    <div class="stats-row">
      <div class="stat-card"><h4>${product.current_quantity}</h4><p>Current Stock</p></div>
      <div class="stat-card"><h4>${totalIn}</h4><p>Total In</p></div>
      <div class="stat-card"><h4>${totalOut}</h4><p>Total Out</p></div>
      <div class="stat-card"><h4>${product.current_quantity <= product.low_stock_quantity ? '⚠️ Low' : '✓ OK'}</h4><p>Status</p></div>
    </div>`;

  if (txns.length) {
    html += `<div class="module-table-wrap"><table class="module-table"><thead><tr>
      <th>Date</th><th>Type</th><th>In</th><th>Out</th><th>Balance</th><th>Notes</th>
    </tr></thead><tbody>` + txns.map(t => `<tr>
      <td>${formatDate(t.created_at)}</td><td>${t.transaction_type}</td>
      <td style="color:#10b981">${t.quantity_in || '-'}</td><td style="color:#ef4444">${t.quantity_out || '-'}</td>
      <td>${t.balance_after}</td><td>${t.notes || '-'}</td></tr>`).join('') + '</tbody></table></div>';
    html += `<div class="mobile-cards">` + txns.map(t => `<div class="mobile-card">
      <p><strong>${t.transaction_type}</strong></p><p>${formatDate(t.created_at)}</p>
      <p>In: ${t.quantity_in || 0} | Out: ${t.quantity_out || 0} | Balance: ${t.balance_after}</p>
      <p>${t.notes || ''}</p></div>`).join('') + '</div>';
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
  document.getElementById('issueDate').value = new Date().toISOString().split('T')[0];
  showModal('issueModal');
}

async function saveIssue() {
  const form = document.getElementById('issueForm');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  body.charges_applicable = document.getElementById('issueChargesApplicable').checked;
  body.customer_product_history_id = body.cph_id;
  await api('/issues', { method: 'POST', body: JSON.stringify(body) });
  hideModal('issueModal');
  loadIssues();
  loadCustomers();
  refreshDashboardCounts();
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
  // Simple status update
  const newStatus = prompt('Update status to:\nReported, Checking, Fixed, Returned to Customer, Rejected');
  if (!newStatus) return;
  await api('/issues/' + id, { method: 'PUT', body: JSON.stringify({ issue_status: newStatus }) });
  loadIssues();
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
