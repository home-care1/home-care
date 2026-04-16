document.addEventListener('DOMContentLoaded', async function() {
    const user = await ensureCurrentUser();
    if (!user || user.role !== 'technician') {
        window.location.href = 'login.html';
        return;
    }

    let pendingViewOrderId = consumeViewOrderId();

    loadMyOrders().then(() => openPendingViewOrder());

    loadNotifDropdown();
    setInterval(loadNotifDropdown, 15000);

    async function openPendingViewOrder() {
        if (!pendingViewOrderId) return;

        const orderId = pendingViewOrderId;
        pendingViewOrderId = null;

        const order = await findOrderById(orderId);
        if (order && canTechnicianAccessOrder(order, user.id)) {
            await viewOrderDetails(orderId);
        }
    }
});

function canTechnicianAccessOrder(order, technicianId) {
    return Boolean(
        order &&
        order.technician_id === technicianId &&
        order.deleted_by_technician !== true
    );
}

function filterMyOrders(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    loadMyOrders(filter);
}

async function loadMyOrders(filter = 'all') {
    const user = getCurrentUser() || await ensureCurrentUser();
    if (!user || user.role !== 'technician') return;
    const orders = await getTechnicianOrders(user.id);

    let myOrders = orders.filter(order => 
        (order.status === 'accepted' || order.status === 'in_progress' || order.status === 'completed')
    );

    if (filter !== 'all') {
        myOrders = myOrders.filter(order => order.status === filter);
    }

    myOrders.sort((a, b) => new Date(b.accepted_at || b.created_at) - new Date(a.accepted_at || a.created_at));

    const allMyOrders = orders.filter(order => 
        (order.status === 'accepted' || order.status === 'in_progress' || order.status === 'completed')
    );

    document.getElementById('acceptedCount').textContent = allMyOrders.filter(o => o.status === 'accepted').length;
    document.getElementById('inProgressCount').textContent = allMyOrders.filter(o => o.status === 'in_progress').length;
    document.getElementById('completedCount').textContent = allMyOrders.filter(o => o.status === 'completed').length;

    renderOrders(myOrders, user);
}

async function renderOrders(orders, user) {
    const ordersList = document.getElementById('myOrdersList');
    const emptyState = document.getElementById('emptyState');

    if (orders.length === 0) {
        ordersList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    const ordersWithCustomers = await Promise.all(orders.map(async (order) => {
        const customer = await findUserById(order.customer_id);
        return { ...order, customer };
    }));

    ordersList.innerHTML = ordersWithCustomers.map(order => {
        let actionsHtml = '';

        if (order.status === 'accepted') {
            actionsHtml = `
                <button class="action-btn btn-start" onclick="startOrder('${order.id}')">
                    <i class="fas fa-play"></i> بدء العمل
                </button>
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> التفاصيل
                </button>
            `;
        } else if (order.status === 'in_progress') {
            actionsHtml = `
                <button class="action-btn btn-complete" onclick="completeOrder('${order.id}')">
                    <i class="fas fa-check-double"></i> إكمال
                </button>
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> التفاصيل
                </button>
            `;
        } else {
            actionsHtml = `
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> التفاصيل
                </button>
                <button class="action-btn btn-delete-single" onclick="deleteSingleOrder('${order.id}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
            `;
        }

        return `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id">#${escapeHtml(order.order_number || order.id)}</div>
                    <div class="order-status status-${escapeHtml(order.status)}">${escapeHtml(getStatusText(order.status))}</div>
                </div>
                <div class="order-title">${escapeHtml(order.service_type || order.service || 'بدون عنوان')}</div>
                <div class="order-details">
                    <div class="order-detail">
                        <i class="fas fa-user"></i>
                        <span>${escapeHtml(order.customer ? order.customer.name : 'غير محدد')}</span>
                    </div>
                    <div class="order-detail">
                        <i class="fas fa-phone"></i>
                        <span>${escapeHtml(order.customer_phone || 'غير محدد')}</span>
                    </div>
                    <div class="order-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(order.address || 'غير محدد')}</span>
                    </div>
                    <div class="order-detail">
                        <i class="fas fa-calendar"></i>
                        <span>${escapeHtml(formatDate(order.scheduled_date))}</span>
                    </div>
                    <div class="order-detail">
                        <i class="fas fa-clock"></i>
                        <span>${escapeHtml(getTimeText(order.scheduled_time))}</span>
                    </div>
                </div>
                <div class="order-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');

    ordersList.style.display = 'grid';
}
function getStatusText(status) {
    const statusMap = {
        'pending': 'في الانتظار',
        'accepted': 'مقبول',
        'in_progress': 'قيد العمل',
        'completed': 'مكتمل',
        'cancelled': 'ملغي',
        'rejected': 'مرفوض'
    };
    return statusMap[status] || status;
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

function formatDate(dateString) {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function startOrder(orderId) {
    if (await appConfirm('هل أنت متأكد من بدء العمل في هذا الطلب؟')) {
        const user = getCurrentUser();
        const order = await findOrderById(orderId);

        if (canTechnicianAccessOrder(order, user.id) && order.status === 'accepted') {
            await updateOrder(orderId, {
                status: 'in_progress',
                started_at: new Date().toISOString()
            });
            await appAlert('تم بدء العمل في الطلب!');
            loadMyOrders();
        } else {
            await appAlert('خطأ: هذا الطلب ليس مسجلاً باسمك');
        }
    }
}

async function completeOrder(orderId) {
    if (await appConfirm('هل أنت متأكد من إكمال هذا الطلب؟')) {
        const user = getCurrentUser();
        const order = await findOrderById(orderId);

        if (canTechnicianAccessOrder(order, user.id) && order.status === 'in_progress') {
            await updateOrder(orderId, {
                status: 'completed',
                completed_at: new Date().toISOString()
            });
            await appAlert('تم إكمال الطلب بنجاح!');
            loadMyOrders();
        } else {
            await appAlert('خطأ: هذا الطلب ليس مسجلاً باسمك');
        }
    }
}

async function viewOrderDetails(orderId) {
    const order = await findOrderById(orderId);
    const customer = order ? await findUserById(order.customer_id) : null;

    if (order) {
        const modal = document.getElementById('orderModal');
        const modalBody = document.getElementById('modalBody');

        modalBody.innerHTML = `
            <div class="modal-order-details">
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-hashtag"></i> رقم الطلب
                    </div>
                    <div class="modal-detail-value">#${escapeHtml(order.order_number || order.id)}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-tools"></i> نوع الخدمة
                    </div>
                    <div class="modal-detail-value">${escapeHtml(order.service_type || order.service || 'غير محدد')}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-align-left"></i> الوصف
                    </div>
                    <div class="modal-detail-value">${escapeHtml(order.description || 'لا يوجد وصف')}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-user"></i> العميل
                    </div>
                    <div class="modal-detail-value">${escapeHtml(customer ? customer.name : 'غير محدد')}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-phone"></i> الهاتف
                    </div>
                    <div class="modal-detail-value">${escapeHtml(order.customer_phone || 'غير محدد')}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-map-marker-alt"></i> الموقع
                    </div>
                    <div class="modal-detail-value">${escapeHtml(order.address || 'غير محدد')}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-calendar"></i> التاريخ
                    </div>
                    <div class="modal-detail-value">${escapeHtml(formatDate(order.scheduled_date))}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-clock"></i> الوقت
                    </div>
                    <div class="modal-detail-value">${escapeHtml(getTimeText(order.scheduled_time))}</div>
                </div>
                <div class="modal-detail-row">
                    <div class="modal-detail-label">
                        <i class="fas fa-info-circle"></i> الحالة
                    </div>
                    <div class="modal-detail-value">
                        <span class="order-status status-${escapeHtml(order.status)}">${escapeHtml(getStatusText(order.status))}</span>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
}

async function deleteSingleOrder(orderId) {
    const user = getCurrentUser() || await ensureCurrentUser();
    if (!user || user.role !== 'technician') return;
    if (await appConfirm('هل أنت متأكد من حذف هذا الطلب؟')) {
        const order = await findOrderById(orderId);
        if (!canTechnicianAccessOrder(order, user.id)) {
            await appAlert('لا يمكنك حذف هذا الطلب');
            return;
        }

        if (order.status !== 'completed') {
            await appAlert('يمكن حذف الطلب المكتمل فقط من هذه الصفحة');
            return;
        }

        await technicianDeleteOrder(orderId, user.id);
        loadMyOrders();
    }
}

function logout() {
    window.location.href = 'login.html';
}
