// Dashboard JavaScript - Modern Admin Panel
class AdminDashboard {
  constructor() {
    this.currentPage = 'dashboard';
    this.dateFilter = 'today';
    this.charts = {};
    this.data = {
      customers: [],
      products: [],
      sales: [],
      issues: [],
      stock: []
    };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadMockData();
    this.updateDashboard();
    this.initCharts();
    this.loadNotifications();
    this.loadAlerts();
  }

  setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigateToPage(page);
      });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');

    menuToggle?.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });

    sidebarToggle?.addEventListener('click', () => {
      sidebar.classList.remove('active');
    });

    // Date filter
    document.getElementById('dateFilter')?.addEventListener('change', (e) => {
      this.dateFilter = e.target.value;
      this.updateDashboard();
    });

    // Notifications
    document.getElementById('notificationBtn')?.addEventListener('click', () => {
      const dropdown = document.getElementById('notificationDropdown');
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Quick actions
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });

    // Chart tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chart = btn.dataset.chart;
        this.switchChartTab(chart, btn);
      });
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      this.logout();
    });

    // Global search
    document.getElementById('globalSearch')?.addEventListener('input', (e) => {
      this.handleGlobalSearch(e.target.value);
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notifications')) {
        document.getElementById('notificationDropdown').style.display = 'none';
      }
    });
  }

  navigateToPage(page) {
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    // Show selected page
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });
    document.getElementById(`${page}Page`).classList.add('active');

    this.currentPage = page;

    // Load page-specific content
    switch(page) {
      case 'customers':
        if (typeof loadCustomers === 'function') { showCustomerList(); loadCustomers(); }
        break;
      case 'inventory':
        if (typeof loadProducts === 'function') { showInventoryList(); loadProducts(); }
        break;
      case 'product-history':
        break;
      case 'customer-history':
        break;
      case 'issues':
        if (typeof loadIssues === 'function') { loadIssues(); }
        break;
      case 'reports':
        break;
      case 'settings':
        break;
    }

    // Close mobile sidebar
    document.querySelector('.sidebar').classList.remove('active');
  }

  loadMockData() {
    // Load data from localStorage or initialize with mock data
    this.loadFromStorage();
    
    // If no data exists, initialize with mock data
    if (!this.data.customers.length) {
      this.initializeMockData();
    }
  }

  loadFromStorage() {
    this.data = {
      customers: JSON.parse(localStorage.getItem('customers') || '[]'),
      products: JSON.parse(localStorage.getItem('products') || '[]'),
      customerProductHistory: JSON.parse(localStorage.getItem('customerProductHistory') || '[]'),
      vendorStockHistory: JSON.parse(localStorage.getItem('vendorStockHistory') || '[]'),
      productIssues: JSON.parse(localStorage.getItem('productIssues') || '[]'),
      inventoryTransactions: JSON.parse(localStorage.getItem('inventoryTransactions') || '[]')
    };
  }

  saveToStorage() {
    localStorage.setItem('customers', JSON.stringify(this.data.customers));
    localStorage.setItem('products', JSON.stringify(this.data.products));
    localStorage.setItem('customerProductHistory', JSON.stringify(this.data.customerProductHistory));
    localStorage.setItem('vendorStockHistory', JSON.stringify(this.data.vendorStockHistory));
    localStorage.setItem('productIssues', JSON.stringify(this.data.productIssues));
    localStorage.setItem('inventoryTransactions', JSON.stringify(this.data.inventoryTransactions));
  }

  initializeMockData() {
    // customers table
    this.data.customers = [
      { id: 1, name: 'Rajesh Kumar', phone: '9876543210', created_at: '2024-05-10', updated_at: '2024-05-10', deleted_at: null },
      { id: 2, name: 'Priya Sharma', phone: '9876543211', created_at: '2024-05-11', updated_at: '2024-05-11', deleted_at: null },
      { id: 3, name: 'Amit Patel', phone: '9876543212', created_at: '2024-05-12', updated_at: '2024-05-12', deleted_at: null }
    ];

    // products table
    this.data.products = [
      { id: 1, name: 'Dewalt Drill Machine', category: 'Power Tools', brand: 'Dewalt', current_quantity: 15, purchase_price: 7000, selling_price: 8500, warranty_available: true, warranty_period: 12, low_stock_quantity: 5, notes: 'High demand item', created_at: '2024-05-01', updated_at: '2024-05-14', deleted_at: null },
      { id: 2, name: 'Welding Machine 200A', category: 'Welding', brand: 'Lincoln', current_quantity: 8, purchase_price: 12000, selling_price: 15000, warranty_available: true, warranty_period: 24, low_stock_quantity: 3, notes: 'Professional grade', created_at: '2024-05-01', updated_at: '2024-05-14', deleted_at: null },
      { id: 3, name: 'Welding Rods 3.2mm', category: 'Consumables', brand: 'ESAB', current_quantity: 100, purchase_price: 350, selling_price: 450, warranty_available: false, warranty_period: 0, low_stock_quantity: 20, notes: 'Bulk item', created_at: '2024-05-01', updated_at: '2024-05-14', deleted_at: null },
      { id: 4, name: 'Welding Cable 25mm', category: 'Accessories', brand: 'Generic', current_quantity: 0, purchase_price: 100, selling_price: 120, warranty_available: false, warranty_period: 0, low_stock_quantity: 5, notes: 'Out of stock', created_at: '2024-05-01', updated_at: '2024-05-14', deleted_at: null }
    ];

    // customer_product_history table
    this.data.customerProductHistory = [
      { id: 1, customer_id: 1, product_id: 1, quantity: 1, purchased_on: '2024-05-14', warranty_available: true, warranty_start_date: '2024-05-14', warranty_end_date: '2025-05-14', payment_status: 'paid', amount_paid: 8500, notes: 'Cash payment', created_at: '2024-05-14', updated_at: '2024-05-14' },
      { id: 2, customer_id: 2, product_id: 2, quantity: 1, purchased_on: '2024-05-13', warranty_available: true, warranty_start_date: '2024-05-13', warranty_end_date: '2026-05-13', payment_status: 'paid', amount_paid: 15000, notes: 'UPI payment', created_at: '2024-05-13', updated_at: '2024-05-13' },
      { id: 3, customer_id: 3, product_id: 3, quantity: 10, purchased_on: '2024-05-12', warranty_available: false, warranty_start_date: null, warranty_end_date: null, payment_status: 'partial', amount_paid: 3000, notes: 'Partial payment received', created_at: '2024-05-12', updated_at: '2024-05-12' }
    ];

    // vendor_stock_history table
    this.data.vendorStockHistory = [
      { id: 1, product_id: 1, vendor_name: 'Dewalt Distributor', quantity_bought: 20, bought_on: '2024-05-01', purchase_price_per_unit: 7000, total_amount: 140000, notes: 'Bulk purchase', created_at: '2024-05-01' },
      { id: 2, product_id: 2, vendor_name: 'Lincoln Welding', quantity_bought: 10, bought_on: '2024-05-01', purchase_price_per_unit: 12000, total_amount: 120000, notes: 'Direct from manufacturer', created_at: '2024-05-01' },
      { id: 3, product_id: 3, vendor_name: 'ESAB India', quantity_bought: 200, bought_on: '2024-05-01', purchase_price_per_unit: 350, total_amount: 70000, notes: 'Consumable stock', created_at: '2024-05-01' }
    ];

    // product_issues table
    this.data.productIssues = [
      { id: 1, customer_product_history_id: 1, issue_date: '2024-05-10', issue_description: 'Chuck not working properly', status: 'reported', warranty_applicable: true, resolution_notes: 'Under investigation', created_at: '2024-05-10', updated_at: '2024-05-10' },
      { id: 2, customer_product_history_id: 2, issue_date: '2024-05-08', issue_description: 'Welding arc unstable', status: 'checking', warranty_applicable: true, resolution_notes: 'Sent for service check', created_at: '2024-05-08', updated_at: '2024-05-09' }
    ];

    // inventory_transactions table
    this.data.inventoryTransactions = [
      { id: 1, product_id: 1, transaction_type: 'vendor_stock_added', quantity_in: 20, quantity_out: 0, balance_after: 20, reference_type: 'vendor_stock_history', reference_id: 1, notes: 'Initial stock from Dewalt Distributor', created_at: '2024-05-01' },
      { id: 2, product_id: 1, transaction_type: 'customer_purchase', quantity_in: 0, quantity_out: 1, balance_after: 19, reference_type: 'customer_product_history', reference_id: 1, notes: 'Sold to Rajesh Kumar', created_at: '2024-05-14' },
      { id: 3, product_id: 2, transaction_type: 'vendor_stock_added', quantity_in: 10, quantity_out: 0, balance_after: 10, reference_type: 'vendor_stock_history', reference_id: 2, notes: 'Initial stock from Lincoln Welding', created_at: '2024-05-01' },
      { id: 4, product_id: 2, transaction_type: 'customer_purchase', quantity_in: 0, quantity_out: 1, balance_after: 9, reference_type: 'customer_product_history', reference_id: 2, notes: 'Sold to Priya Sharma', created_at: '2024-05-13' }
    ];

    this.saveToStorage();
  }

  updateDashboard() {
    // Calculate summary data
    const totalCustomers = this.data.customers.length;
    const totalProducts = this.data.products.length;
    const totalStock = this.data.products.reduce((sum, p) => sum + (p.current_quantity || 0), 0);
    const pendingIssues = this.data.productIssues.filter(i => i.status === 'reported' || i.status === 'checking' || i.status === 'Reported' || i.status === 'Checking').length;

    // Update summary cards
    document.getElementById('totalCustomers').textContent = totalCustomers;
    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalStock').textContent = totalStock;
    document.getElementById('todaySales').textContent = '₹0';
    document.getElementById('todayProfit').textContent = '₹0';
    document.getElementById('pendingIssues').textContent = pendingIssues;

    // Update charts
    this.updateCharts();
  }

  initCharts() {
    // Sales Chart
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
      this.charts.sales = new Chart(salesCtx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Sales (₹)',
            data: [12000, 15000, 8000, 18000, 23000, 16000, 20000],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { 
              beginAtZero: true,
              grid: { color: '#334155' },
              ticks: { color: '#cbd5e1' }
            },
            x: {
              grid: { color: '#334155' },
              ticks: { color: '#cbd5e1' }
            }
          }
        }
      });
    }

    // Products Chart
    const productsCtx = document.getElementById('productsChart');
    if (productsCtx) {
      this.charts.products = new Chart(productsCtx, {
        type: 'doughnut',
        data: {
          labels: ['Power Tools', 'Welding Machines', 'Consumables', 'Accessories'],
          datasets: [{
            data: [35, 25, 25, 15],
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#cbd5e1' }
            }
          }
        }
      });
    }

    // Payment Chart
    const paymentCtx = document.getElementById('paymentChart');
    if (paymentCtx) {
      this.charts.payment = new Chart(paymentCtx, {
        type: 'bar',
        data: {
          labels: ['Cash', 'UPI', 'Card', 'Cheque'],
          datasets: [{
            label: 'Transactions',
            data: [45, 35, 15, 5],
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { 
              beginAtZero: true,
              grid: { color: '#334155' },
              ticks: { color: '#cbd5e1' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#cbd5e1' }
            }
          }
        }
      });
    }

    // Profit Chart
    const profitCtx = document.getElementById('profitChart');
    if (profitCtx) {
      this.charts.profit = new Chart(profitCtx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          datasets: [{
            label: 'Profit (₹)',
            data: [25000, 32000, 28000, 35000, 42000],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { 
              beginAtZero: true,
              grid: { color: '#334155' },
              ticks: { color: '#cbd5e1' }
            },
            x: {
              grid: { color: '#334155' },
              ticks: { color: '#cbd5e1' }
            }
          }
        }
      });
    }
  }

  updateCharts() {
    // Update chart data based on date filter
    // This would typically fetch new data from API
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.update();
    });
  }

  switchChartTab(chartType, button) {
    // Update active tab
    button.parentElement.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    button.classList.add('active');

    // Update chart data
    if (chartType === 'quantity') {
      this.charts.sales.data.datasets[0].label = 'Quantity Sold';
      this.charts.sales.data.datasets[0].data = [15, 20, 12, 25, 30, 18, 22];
    } else {
      this.charts.sales.data.datasets[0].label = 'Sales (₹)';
      this.charts.sales.data.datasets[0].data = [12000, 15000, 8000, 18000, 23000, 16000, 20000];
    }
    this.charts.sales.update();
  }

  loadNotifications() {
    const notifications = [
      { type: 'warning', title: 'Low Stock Alert', message: 'Welding Rods 3.2mm only 2 pieces left', time: '5 min ago' },
      { type: 'danger', title: 'Out of Stock', message: 'Welding Cable 25mm is out of stock', time: '1 hour ago' },
      { type: 'info', title: 'New Customer', message: 'Rajesh Kumar registered as new customer', time: '2 hours ago' }
    ];

    const notificationList = document.getElementById('notificationList');
    if (notificationList) {
      notificationList.innerHTML = notifications.map(notif => `
        <div class="notification-item">
          <div class="notification-icon ${notif.type}">
            <i class="fas fa-${notif.type === 'warning' ? 'exclamation-triangle' : notif.type === 'danger' ? 'times-circle' : 'info-circle'}"></i>
          </div>
          <div class="notification-content">
            <h5>${notif.title}</h5>
            <p>${notif.message}</p>
            <span class="notification-time">${notif.time}</span>
          </div>
        </div>
      `).join('');
    }

    // Update notification badge
    document.getElementById('notificationBadge').textContent = notifications.length;
  }

  loadAlerts() {
    const alerts = [
      { type: 'warning', title: 'Low Stock Products', message: '3 products are running low on stock', icon: 'exclamation-triangle' },
      { type: 'danger', title: 'Out of Stock', message: '1 product is completely out of stock', icon: 'times-circle' },
      { type: 'info', title: 'Pending Issues', message: '2 customer issues need attention', icon: 'tools' }
    ];

    const alertsGrid = document.getElementById('alertsGrid');
    if (alertsGrid) {
      alertsGrid.innerHTML = alerts.map(alert => `
        <div class="alert-card ${alert.type}">
          <div class="alert-icon ${alert.type}">
            <i class="fas fa-${alert.icon}"></i>
          </div>
          <div class="alert-content">
            <h4>${alert.title}</h4>
            <p>${alert.message}</p>
          </div>
        </div>
      `).join('');
    }
  }

  handleQuickAction(action) {
    switch (action) {
      case 'add-product':
        this.navigateToPage('inventory');
        break;
      case 'add-stock':
        this.navigateToPage('inventory');
        break;
      case 'create-sale':
        this.navigateToPage('customers');
        break;
      case 'add-customer':
        this.navigateToPage('customers');
        break;
      case 'add-issue':
        this.navigateToPage('issues');
        break;
      case 'view-reports':
        this.navigateToPage('reports');
        break;
    }
  }

  handleGlobalSearch(query) {
    if (query.length < 2) return;

    // Mock search results
    const results = [
      ...this.data.products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())),
      ...this.data.customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query))
    ];

    console.log('Search results:', results);
    // In a real app, you would show search results dropdown
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;
    notification.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove notification
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }

  logout() {
    if (confirm('Are you sure you want to logout?')) {
      // Clear session data
      localStorage.removeItem('adminToken');
      sessionStorage.clear();
      
      // Redirect to login
      window.location.href = 'login.html';
    }
  }
}

// Toast notification styles
const toastStyles = `
  .toast-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    box-shadow: var(--shadow-lg);
    z-index: 10000;
    transform: translateX(400px);
    transition: transform 0.3s ease;
    max-width: 300px;
  }
  
  .toast-notification.show {
    transform: translateX(0);
  }
  
  .toast-notification.success {
    border-left: 4px solid var(--success);
  }
  
  .toast-notification.error {
    border-left: 4px solid var(--danger);
  }
  
  .toast-notification.info {
    border-left: 4px solid var(--info);
  }
  
  .toast-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  
  .toast-content i {
    color: var(--primary);
  }
  
  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
  }
  
  .notification-item:last-child {
    border-bottom: none;
  }
  
  .notification-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    color: white;
  }
  
  .notification-icon.warning { background: var(--warning); }
  .notification-icon.danger { background: var(--danger); }
  .notification-icon.info { background: var(--info); }
  
  .notification-content h5 {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .notification-content p {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }
  
  .notification-time {
    font-size: 0.625rem;
    color: var(--text-muted);
  }
`;

// Add toast styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize dashboard (skip auth check for local dev)
  new AdminDashboard();
});

// Auth check function
function requireAuth() {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}