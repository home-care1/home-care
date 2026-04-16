fetch('navbar-admin.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('navbar-container').innerHTML = data;
        loadNotifDropdown();
    });

document.addEventListener('DOMContentLoaded', async function () {
    const user = await ensureCurrentUser();
    if (!user || user.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    loadAllOrders().then(() => openPendingViewOrder());

    document.getElementById('searchInput').addEventListener('input', function (e) {
        loadAllOrders(e.target.value, getCurrentFilter());
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const filter = this.getAttribute('data-filter');
            updateFilterButtons(filter);
            loadAllOrders(document.getElementById('searchInput').value, filter);
        });
    });
});

function getCurrentFilter() {
    const activeBtn = document.querySelector('.filter-btn.active');
    return activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
}

function updateFilterButtons(activeFilter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === activeFilter) {
            btn.classList.add('active');
        }
    });
}

function getCardActionsByStatus(order) {
    if (order.status === 'pending') {
        return `
            <button class="btn-action btn-cancel" onclick="cancelOrder('${order.id}')">
                <i class="fas fa-times"></i> إلغاء
            </button>
        `;
    }

    if (order.status === 'completed') {
        return `
            <button class="btn-action btn-cancel" onclick="deleteFromAdmin('${order.id}')">
                <i class="fas fa-trash"></i> حذف
            </button>
        `;
    }

    return '';
}

function getModalActionsByStatus(order) {
    if (order.status === 'pending') {
        return `
            <button class="btn-action btn-cancel" onclick="cancelOrder('${order.id}'); closeModal();">
                <i class="fas fa-times"></i> إلغاء الطلب
            </button>
        `;
    }

    if (order.status === 'completed') {
        return `
            <button class="btn-action btn-cancel" onclick="deleteFromAdmin('${order.id}'); closeModal();">
                <i class="fas fa-trash"></i> حذف الطلب
            </button>
        `;
    }

    return '';
}

function getTimeText(time) {
    if (!time) return 'غير محدد';

    const timeMap = {
        'morning': 'صباحاً (8:00 - 12:00)',
        'afternoon': 'بعد الظهر (12:00 - 4:00)',
        'evening': 'مساءً (4:00 - 8:00)',
        'صباحاً': 'صباحاً (8:00 - 12:00)',
        'بعد الظهر': 'بعد الظهر (12:00 - 4:00)',
        'مساءً': 'مساءً (4:00 - 8:00)'
    };

    const key = time.toLowerCase();
    return timeMap[key] || time;
}

async function loadAllOrders(searchTerm = '', statusFilter = 'all') {
    let orders = await getAdminOrders();

    const users = await getStoredUsers();
    const getCustomerName = (customerId) => {
        const customer = users.find(u => u.id === customerId);
        return customer ? customer.name : 'غير معروف';
    };
    const getTechnicianName = (techId) => {
        if (!techId) return null;
        const tech = users.find(u => u.id === techId);
        return tech ? tech.name : null;
    };

    orders = orders.map(order => ({
        ...order,
        customerName: getCustomerName(order.customer_id),
        technicianName: getTechnicianName(order.technician_id),
        serviceType: order.service_type || order.service || order.title || 'خدمة',
        customerPhone: order.customer_phone || '',
        scheduledDate: order.scheduled_date || '',
        scheduledTime: order.scheduled_time || ''
    }));

    let filteredOrders = orders;

    if (searchTerm) {
        filteredOrders = filteredOrders.filter(order =>
            (order.serviceType || '').includes(searchTerm) ||
            (order.description || '').includes(searchTerm) ||
            (order.customerName || '').includes(searchTerm) ||
            (order.technicianName || '').includes(searchTerm)
        );
    }

    if (statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }

    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('pendingOrders').textContent = pendingOrders;
    document.getElementById('completedOrders').textContent = completedOrders;
    document.getElementById('cancelledOrders').textContent = cancelledOrders;

    const ordersList = document.getElementById('ordersList');

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>لا توجد طلبات</h3>
                <p>لا توجد طلبات تطابق الفلتر المحدد</p>
            </div>
        `;
        return;
    }

    ordersList.innerHTML = filteredOrders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">#${escapeHtml(order.order_number || order.id)}</div>
                <div class="order-status ${escapeHtml(order.status)}">${escapeHtml(getStatusText(order.status))}</div>
            </div>
            <div class="order-title">${escapeHtml(order.serviceType)}</div>
            <div class="order-details">
                <div class="order-detail">
                    <i class="fas fa-user"></i>
                    <span>${escapeHtml(order.customerName)}</span>
                </div>
                ${order.technicianName ? `
                <div class="order-detail">
                    <i class="fas fa-user-cog"></i>
                    <span>${escapeHtml(order.technicianName)}</span>
                </div>
                ` : ''}
                <div class="order-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${escapeHtml(order.address || 'غير محدد')}</span>
                </div>
                <div class="order-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${escapeHtml(formatDate(order.scheduledDate))}</span>
                </div>
                ${order.price ? `
                <div class="order-detail">
                    <i class="fas fa-money-bill-wave"></i>
                    <span>${escapeHtml(order.price)} شيكل</span>
                </div>
                ` : ''}
            </div>
            <div class="order-description">${escapeHtml(order.description || 'لا يوجد وصف')}</div>
            ${order.rating ? `
            <div class="order-rating">
                <div class="rating-stars">
                    ${generateStars(order.rating)}
                </div>
                <span class="rating-text">${order.rating}/5</span>
            </div>
            ` : ''}
            <div class="order-actions">
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> التفاصيل
                </button>
                ${getCardActionsByStatus(order)}
            </div>
        </div>
    `).join('');
}

function openPendingViewOrder() {
    const pendingViewOrderId = consumeViewOrderId();
    if (!pendingViewOrderId) return;
    viewOrderDetails(pendingViewOrderId);
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'في الانتظار',
        'accepted': 'مقبول',
        'in_progress': 'قيد التنفيذ',
        'completed': 'مكتمل',
        'cancelled': 'ملغي'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) {
        return 'غير محدد';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'غير محدد';
    }
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star filled"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    return stars;
}

async function viewOrderDetails(orderId) {
    const order = await findOrderById(orderId);

    if (order) {
        const users = await getStoredUsers();
        const customer = users.find(u => u.id === order.customer_id);
        const technician = order.technician_id ? users.find(u => u.id === order.technician_id) : null;

        const modal = document.getElementById('orderModal');
        const modalBody = document.getElementById('modalBody');

        modalBody.innerHTML = `
            <div class="modal-order-header">
                <div class="modal-order-icon">
                    <i class="fas fa-clipboard-list"></i>
                </div>
                <div class="modal-order-info">
                    <h3>طلب #${escapeHtml(order.order_number || order.id)}</h3>
                    <p>${escapeHtml(order.service_type || order.service || order.title || 'خدمة')}</p>
                </div>
            </div>
            <div class="modal-details-grid">
                <div class="modal-detail-item">
                    <div class="modal-detail-label">العميل</div>
                    <div class="modal-detail-value">${escapeHtml(customer ? customer.name : 'غير معروف')}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">رقم الهاتف</div>
                    <div class="modal-detail-value">${escapeHtml(order.customer_phone || 'غير محدد')}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">العنوان</div>
                    <div class="modal-detail-value">${escapeHtml(order.address || 'غير محدد')}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">التاريخ</div>
                    <div class="modal-detail-value">${escapeHtml(formatDate(order.scheduled_date))}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">الوقت</div>
                    <div class="modal-detail-value">${escapeHtml(getTimeText(order.scheduled_time))}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">الحالة</div>
                    <div class="modal-detail-value">${escapeHtml(getStatusText(order.status))}</div>
                </div>
                ${technician ? `
                <div class="modal-detail-item">
                    <div class="modal-detail-label">الفني</div>
                    <div class="modal-detail-value">${escapeHtml(technician.name)}</div>
                </div>
                ` : ''}
                ${order.price ? `
                <div class="modal-detail-item">
                    <div class="modal-detail-label">السعر</div>
                    <div class="modal-detail-value">${escapeHtml(order.price)} شيكل</div>
                </div>
                ` : ''}
            </div>
            <div class="modal-detail-item">
                <div class="modal-detail-label">الوصف</div>
                <div class="modal-detail-value">${escapeHtml(order.description || 'لا يوجد وصف')}</div>
            </div>
            ${order.rating ? `
            <div class="modal-detail-item">
                <div class="modal-detail-label">التقييم</div>
                <div class="modal-detail-value">
                    <div class="rating-stars">
                        ${generateStars(order.rating)}
                    </div>
                    <span class="rating-text">${order.rating}/5</span>
                </div>
            </div>
            ` : ''}
            <div class="modal-actions">
                ${getModalActionsByStatus(order)}
                <button class="action-btn btn-view modal-action-close" onclick="closeModal()">
                    <i class="fas fa-times"></i> إغلاق
                </button>
            </div>
        `;

        modal.classList.add('show');
    }
}
async function cancelOrder(orderId) {
    if (await appConfirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
        await adminCancelOrder(orderId);
        loadAllOrders();
    }
}

async function deleteFromAdmin(orderId) {
    if (await appConfirm('هل تريد حذف هذا الطلب من قائمة المدير فقط؟')) {
        await adminDeleteOrder(orderId);
        loadAllOrders();
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    clearCurrentUserCache();
    window.location.href = 'index.html';
}

async function adminDeleteOldOrders() {
    if (await appConfirm('هل أنت متأكد من حذف جميع الطلبات المكتملة من قائمة المدير؟')) {
        const orders = await getAdminOrders();
        const oldOrders = orders.filter(order => order.status === 'completed');

        if (oldOrders.length === 0) {
            await appAlert('لا توجد طلبات مكتملة');
            return;
        }

        for (const order of oldOrders) {
            await adminDeleteOrder(order.id);
        }

        loadAllOrders();
        await appAlert(`تم حذف ${oldOrders.length} طلب مكتمل من قائمة المدير بنجاح`);
    }
}

function toggleNotif(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('notifDropdown');
    dropdown.classList.toggle('show');
}

document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('notifDropdown');
    const notifBtn = document.getElementById('notifButton');
    if (dropdown && !dropdown.contains(event.target) && !notifBtn.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

function closeModal() {
    const modal = document.getElementById('orderModal');
    if (modal) {
        modal.classList.remove('show');
    }
}
