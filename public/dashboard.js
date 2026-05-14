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
    // Load real data from API
    this.loadRealData();
  }

  async loadRealData() {
    try {
      const [customers, products, issues] = await Promise.all([
        fetch('/api/customers').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
        fetch('/api/issues').then(r => r.json())
      ]);
      this.data = { customers, products, productIssues: issues };
      this.updateDashboard();
    } catch(e) { console.error('Failed to load data:', e); }
  }

  updateDashboard() {
    const customers = this.data.customers || [];
    const products = this.data.products || [];
    const issues = this.data.productIssues || [];
    const totalStock = products.reduce((sum, p) => sum + (+p.current_quantity || 0), 0);
    const pendingIssues = issues.filter(i => i.issue_status && i.issue_status !== 'Fixed' && i.issue_status !== 'Returned to Customer').length;

    document.getElementById('totalCustomers').textContent = customers.length;
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('totalStock').textContent = totalStock;
    document.getElementById('todaySales').textContent = '₹0';
    document.getElementById('todayProfit').textContent = '₹0';
    document.getElementById('pendingIssues').textContent = pendingIssues;

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
  window.dashboardInstance = new AdminDashboard();
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