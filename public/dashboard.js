// AUM Enterprise - Dashboard JS
class AdminDashboard {
  constructor() {
    this.currentPage = 'dashboard';
    this.dateRange = 'today';
    this.customFrom = '';
    this.customTo = '';
    this.charts = {};
    this.data = { customers: [], products: [], issues: [] };
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupDateFilters();
    this.setupCardClicks();
    this.setupSidebar();
    this.loadData();
  }

  setupNavigation() {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateToPage(item.dataset.page);
      });
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      document.getElementById('logoutModal').classList.add('active');
    });
  }

  setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    document.getElementById('menuToggle')?.addEventListener('click', () => sidebar.classList.toggle('active'));
    document.getElementById('sidebarToggle')?.addEventListener('click', () => sidebar.classList.remove('active'));
  }

  setupDateFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.dateRange = btn.dataset.range;
        const custom = document.getElementById('customDateRange');
        if (this.dateRange === 'custom') { custom.style.display = 'flex'; }
        else { custom.style.display = 'none'; this.updateDashboard(); }
      });
    });
    document.getElementById('applyCustomDate')?.addEventListener('click', () => {
      this.customFrom = document.getElementById('dateFrom').value;
      this.customTo = document.getElementById('dateTo').value;
      if (this.customFrom && this.customTo) this.updateDashboard();
    });
  }

  setupCardClicks() {
    document.querySelectorAll('.summary-card.clickable').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.action;
        this.handleCardClick(action);
      });
    });
  }

  handleCardClick(action) {
    switch(action) {
      case 'customer-purchases':
        this.navigateToPage('customers');
        setTimeout(() => this.applyCustomerDateFilter(), 100);
        break;
      case 'products-sold':
        this.navigateToPage('customers');
        setTimeout(() => this.applyCustomerDateFilter(), 100);
        break;
      case 'amount-received':
        this.navigateToPage('customers');
        setTimeout(() => this.applyCustomerDateFilter(), 100);
        break;
      case 'out-of-stock':
        this.navigateToPage('inventory');
        setTimeout(() => {
          document.getElementById('invFilterStock').value = 'out_of_stock';
          document.getElementById('invFilters').style.display = 'block';
          document.getElementById('invFilterToggle').classList.add('active');
          document.getElementById('invClearFilters').style.display = 'inline-flex';
          if (typeof applyInventoryFilters === 'function') applyInventoryFilters();
        }, 100);
        break;
      case 'inventory-added':
        this.navigateToPage('inventory');
        setTimeout(() => {
          const {from} = this.getDateRange();
          document.getElementById('invFilterAddedFrom').value = from;
          document.getElementById('invFilters').style.display = 'block';
          document.getElementById('invFilterToggle').classList.add('active');
          document.getElementById('invClearFilters').style.display = 'inline-flex';
          if (typeof applyInventoryFilters === 'function') applyInventoryFilters();
        }, 100);
        break;
      case 'pending-issues':
        this.navigateToPage('issues');
        break;
    }
  }

  applyCustomerDateFilter() {
    const {from, to} = this.getDateRange();
    document.getElementById('custFilterDateFrom').value = from;
    document.getElementById('custFilterDateTo').value = to;
    document.getElementById('custFilters').style.display = 'block';
    document.getElementById('custFilterToggle').classList.add('active');
    document.getElementById('custClearFilters').style.display = 'inline-flex';
    if (typeof applyCustomerFilters === 'function') applyCustomerFilters();
  }

  getDateRange() {
    const today = new Date();
    let from, to;
    to = today.toISOString().split('T')[0];
    switch(this.dateRange) {
      case 'today': from = to; break;
      case 'yesterday':
        const y = new Date(today); y.setDate(y.getDate()-1);
        from = to = y.toISOString().split('T')[0]; break;
      case 'week':
        const w = new Date(today); w.setDate(w.getDate()-6);
        from = w.toISOString().split('T')[0]; break;
      case 'month':
        from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; break;
      case 'custom':
        from = this.customFrom; to = this.customTo; break;
      default: from = to;
    }
    return {from, to};
  }

  navigateToPage(page) {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}Page`)?.classList.add('active');
    document.getElementById('pageTitle').textContent = page.charAt(0).toUpperCase() + page.slice(1);
    this.currentPage = page;
    document.getElementById('sidebar').classList.remove('active');

    switch(page) {
      case 'customers': if (typeof loadCustomers === 'function') { showCustomerList(); loadCustomers(); } break;
      case 'inventory': if (typeof loadProducts === 'function') { showInventoryList(); loadProducts(); } break;
      case 'issues': if (typeof loadIssues === 'function') loadIssues(); break;
    }
  }

  async loadData() {
    try {
      const [customers, products, issues] = await Promise.all([
        fetch('/api/customers').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
        fetch('/api/issues').then(r => r.json())
      ]);
      this.data = { customers, products, issues };
      this.updateDashboard();
    } catch(e) { console.error('Load failed:', e); }
  }

  updateDashboard() {
    this.updateNotificationBar();
    this.updateSummaryCards();
    this.renderCharts();
    this.renderLowStockList();
  }


  updateNotificationBar() {
    const products = this.data.products || [];
    const customers = this.data.customers || [];
    const issues = this.data.issues || [];

    const outOfStock = products.filter(p => +p.current_quantity === 0).length;
    const lowStock = products.filter(p => +p.current_quantity > 0 && +p.current_quantity <= (+p.low_stock_quantity || 5)).length;
    const pendingIssues = issues.filter(i => !['Fixed','Returned to Customer','Rejected'].includes(i.issue_status)).length;
    const pendingPayment = customers.reduce((s, c) => s + (+c.balance_amount || 0), 0);

    const today = new Date().toISOString().split('T')[0];
    const invToday = products.filter(p => p.created_at && p.created_at.startsWith(today)).length;

    document.getElementById('notifOutOfStock').textContent = outOfStock;
    document.getElementById('notifLowStock').textContent = lowStock;
    document.getElementById('notifPendingIssues').textContent = pendingIssues;
    document.getElementById('notifPendingPayment').textContent = pendingPayment.toLocaleString('en-IN');
    document.getElementById('notifInventoryToday').textContent = invToday;
  }

  updateSummaryCards() {
    const {from, to} = this.getDateRange();
    const customers = this.data.customers || [];
    const products = this.data.products || [];
    const issues = this.data.issues || [];

    // Filter customers by purchase date
    const filtered = customers.filter(c => {
      if (!c.purchased_on) return false;
      const d = c.purchased_on.split('T')[0];
      return d >= from && d <= to;
    });

    const totalPurchases = filtered.length;
    const totalQtySold = filtered.reduce((s, c) => s + (+c.quantity || 0), 0);
    const totalReceived = filtered.reduce((s, c) => s + (+c.amount_paid || 0), 0);
    const outOfStock = products.filter(p => +p.current_quantity === 0).length;
    const pendingIssues = issues.filter(i => !['Fixed','Returned to Customer','Rejected'].includes(i.issue_status)).length;

    // Inventory added in date range
    const invAdded = products.filter(p => {
      if (!p.created_at) return false;
      const d = p.created_at.split('T')[0];
      return d >= from && d <= to;
    }).length;

    document.getElementById('cardCustomerPurchases').textContent = totalPurchases;
    document.getElementById('cardProductsSold').textContent = totalQtySold;
    document.getElementById('cardAmountReceived').textContent = '₹' + totalReceived.toLocaleString('en-IN');
    document.getElementById('cardOutOfStock').textContent = outOfStock;
    document.getElementById('cardInventoryAdded').textContent = invAdded;
    document.getElementById('cardPendingIssues').textContent = pendingIssues;
  }

  renderLowStockList() {
    const products = this.data.products || [];
    const alertProducts = products.filter(p => +p.current_quantity <= (+p.low_stock_quantity || 5))
      .sort((a, b) => +a.current_quantity - +b.current_quantity).slice(0, 15);

    const container = document.getElementById('lowStockList');
    if (!alertProducts.length) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="fas fa-check-circle" style="font-size:2rem;margin-bottom:0.5rem;display:block"></i>All products in stock!</div>';
      return;
    }
    container.innerHTML = alertProducts.map(p => {
      const isOut = +p.current_quantity === 0;
      return `<div class="low-stock-item">
        <span class="product-name">${p.name}</span>
        <span class="stock-badge ${isOut ? 'out' : 'low'}">${isOut ? 'OUT OF STOCK' : p.current_quantity + ' left'}</span>
      </div>`;
    }).join('');
  }


  renderCharts() {
    // Destroy existing charts
    Object.values(this.charts).forEach(c => c?.destroy());
    this.charts = {};

    const {from, to} = this.getDateRange();
    const customers = (this.data.customers || []).filter(c => {
      if (!c.purchased_on) return false;
      const d = c.purchased_on.split('T')[0];
      return d >= from && d <= to;
    });
    const issues = this.data.issues || [];

    const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
    const gridOpts = { scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } };

    // 1. Daily Sales Trend (line)
    const salesByDay = {};
    customers.forEach(c => {
      const d = c.purchased_on.split('T')[0];
      salesByDay[d] = (salesByDay[d] || 0) + (+c.amount_paid || 0);
    });
    const salesDays = Object.keys(salesByDay).sort();
    const salesVals = salesDays.map(d => salesByDay[d]);
    const ctx1 = document.getElementById('chartSalesTrend');
    if (ctx1) {
      this.charts.sales = new Chart(ctx1, {
        type: 'line',
        data: { labels: salesDays.map(d => d.slice(5)), datasets: [{ label: 'Sales ₹', data: salesVals, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.08)', tension: 0.4, fill: true, pointRadius: 3 }] },
        options: { ...chartOpts, ...gridOpts }
      });
    }

    // 2. Quantity Sold Trend (bar)
    const qtyByDay = {};
    customers.forEach(c => {
      const d = c.purchased_on.split('T')[0];
      qtyByDay[d] = (qtyByDay[d] || 0) + (+c.quantity || 0);
    });
    const qtyDays = Object.keys(qtyByDay).sort();
    const ctx2 = document.getElementById('chartQtySold');
    if (ctx2) {
      this.charts.qty = new Chart(ctx2, {
        type: 'bar',
        data: { labels: qtyDays.map(d => d.slice(5)), datasets: [{ label: 'Qty Sold', data: qtyDays.map(d => qtyByDay[d]), backgroundColor: '#10b981', borderRadius: 6 }] },
        options: { ...chartOpts, ...gridOpts }
      });
    }

    // 3. Stock In vs Stock Out (grouped bar) - use product data
    const products = this.data.products || [];
    const catStock = {};
    products.forEach(p => {
      const cat = p.category || 'Other';
      if (!catStock[cat]) catStock[cat] = { in: 0, out: 0 };
      catStock[cat].in += +p.current_quantity || 0;
    });
    customers.forEach(c => {
      const p = products.find(x => x.id === c.product_id);
      const cat = p?.category || 'Other';
      if (!catStock[cat]) catStock[cat] = { in: 0, out: 0 };
      catStock[cat].out += +c.quantity || 0;
    });
    const cats = Object.keys(catStock).slice(0, 8);
    const ctx3 = document.getElementById('chartStockInOut');
    if (ctx3) {
      this.charts.stockIO = new Chart(ctx3, {
        type: 'bar',
        data: { labels: cats, datasets: [
          { label: 'In Stock', data: cats.map(c => catStock[c].in), backgroundColor: '#2563eb', borderRadius: 4 },
          { label: 'Sold', data: cats.map(c => catStock[c].out), backgroundColor: '#f97316', borderRadius: 4 }
        ]},
        options: { ...chartOpts, ...gridOpts, plugins: { legend: { display: true, position: 'top' } } }
      });
    }

    // 4. Issue Status (donut)
    const statusCount = {};
    issues.forEach(i => { statusCount[i.issue_status] = (statusCount[i.issue_status] || 0) + 1; });
    const statuses = Object.keys(statusCount);
    const statusColors = { 'Reported': '#f97316', 'Checking': '#0891b2', 'Fixed': '#059669', 'Returned to Customer': '#2563eb', 'Rejected': '#dc2626', 'Repair In Progress': '#d97706' };
    const ctx4 = document.getElementById('chartIssueStatus');
    if (ctx4) {
      this.charts.issues = new Chart(ctx4, {
        type: 'doughnut',
        data: { labels: statuses, datasets: [{ data: statuses.map(s => statusCount[s]), backgroundColor: statuses.map(s => statusColors[s] || '#94a3b8'), borderWidth: 0 }] },
        options: { ...chartOpts, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
      });
    }

    // 4. Payment Mode (donut)
    const payModes = {};
    customers.forEach(c => { if (c.paid_via) payModes[c.paid_via] = (payModes[c.paid_via] || 0) + (+c.amount_paid || 0); });
    const modes = Object.keys(payModes);
    const modeColors = ['#2563eb','#059669','#7c3aed','#d97706','#dc2626','#0891b2','#ec4899','#f97316'];
    const ctx5 = document.getElementById('chartPaymentMode');
    if (ctx5) {
      this.charts.payment = new Chart(ctx5, {
        type: 'doughnut',
        data: { labels: modes, datasets: [{ data: modes.map(m => payModes[m]), backgroundColor: modeColors.slice(0, modes.length), borderWidth: 0 }] },
        options: { ...chartOpts, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
      });
    }

    // 6. Top Selling Products (horizontal bar)
    const prodSales = {};
    customers.forEach(c => { if (c.product_name) prodSales[c.product_name] = (prodSales[c.product_name] || 0) + (+c.quantity || 0); });
    const topProds = Object.entries(prodSales).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const ctx6 = document.getElementById('chartTopProducts');
    if (ctx6) {
      this.charts.topProds = new Chart(ctx6, {
        type: 'bar',
        data: { labels: topProds.map(p => p[0].length > 20 ? p[0].slice(0,20)+'...' : p[0]), datasets: [{ label: 'Qty Sold', data: topProds.map(p => p[1]), backgroundColor: '#7c3aed', borderRadius: 4 }] },
        options: { ...chartOpts, indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } } }
      });
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new AdminDashboard();
});

function refreshDashboardCounts() { if (window.dashboard) window.dashboard.loadData(); }

function confirmLogout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  sessionStorage.clear();
  window.location.href = 'login.html';
}
