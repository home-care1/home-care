  fetch('navbar-admin.html')
            .then(response => response.text())
            .then(data => {
                document.getElementById('navbar-container').innerHTML = data;
                loadNotifDropdown();
            });
            
document.addEventListener('DOMContentLoaded', async function() {
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `مرحباً ${currentUser.name}!`;
    }

    loadStats();

    loadRecentOrders();

    async function loadStats() {
        const orders = await getOrders();
        const users = await getStoredUsers();
        
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        const totalTechnicians = users.filter(u => u.role === 'technician').length;
        const totalCustomers = users.filter(u => u.role === 'customer').length;

        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('pendingOrders').textContent = pendingOrders;
        document.getElementById('completedOrders').textContent = completedOrders;
        document.getElementById('totalTechnicians').textContent = totalTechnicians;
        document.getElementById('totalCustomers').textContent = totalCustomers;
    }

    async function loadRecentOrders() {
        const orders = (await getOrders())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 3);

        const tbody = document.getElementById('recentOrdersList');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">لا توجد طلبات</td></tr>';
            return;
        }

        const rows = await Promise.all(orders.map(async (order) => {
            const customer = await findUserById(order.customer_id);
            return `
                <tr>
                    <td>#${order.order_number || order.id}</td>
                    <td>${order.title || '---'}</td>
                    <td>${customer ? customer.name : '---'}</td>
                    <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
                    <td>${formatDate(order.created_at)}</td>
                </tr>
            `;
        }));
        tbody.innerHTML = rows.join('');
    }
});
