document.addEventListener('DOMContentLoaded', async function() {
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'technician') {
        window.location.href = 'login.html';
        return;
    }

    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `مرحباً ${currentUser.name}!`;
    }

    loadStats();

    loadRecentOrders();

    loadNotifDropdown();
    setInterval(loadNotifDropdown, 15000);

    async function loadStats() {
        const orders = (await getOrders()).filter(o => o.technician_id === currentUser.id);
        
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'accepted' || o.status === 'in_progress').length;
        const completedOrders = orders.filter(o => o.status === 'completed').length;

        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('pendingOrders').textContent = pendingOrders;
        document.getElementById('completedOrders').textContent = completedOrders;
    }

    async function loadRecentOrders() {
        const orders = (await getOrders())
            .filter(o => o.technician_id === currentUser.id)
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
                    <td>${getServiceName(order.title || order.service_type || order.service)}</td>
                    <td>${customer ? customer.name : '---'}</td>
                    <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
                    <td>${formatDate(order.created_at)}</td>
                </tr>
            `;
        }));
        tbody.innerHTML = rows.join('');
    }
});
