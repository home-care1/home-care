let currentCategory = 'all';
let currentSearchTerm = '';

document.addEventListener('DOMContentLoaded', async function() {
    const user = await ensureCurrentUser();
    if (!user || user.role !== 'technician') {
        window.location.href = 'login.html';
        return;
    }

    let pendingViewOrderId = consumeViewOrderId();

    loadPendingOrders().then(() => openPendingViewOrder());

    loadNotifDropdown();
    setInterval(loadNotifDropdown, 15000);

    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            if (value.length > 0) {
                searchClear.style.display = 'block';
            } else {
                searchClear.style.display = 'none';
            }
            currentSearchTerm = value;
            loadPendingOrders();
        });
    }

    async function openPendingViewOrder() {
        if (!pendingViewOrderId) return;

        const orderId = pendingViewOrderId;
        pendingViewOrderId = null;

        const order = await findOrderById(orderId);
        if (order && order.status === 'pending' && (!order.rejectedby || !order.rejectedby.includes(user.id))) {
            await viewOrderDetails(orderId);
        }
    }
});

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';
    currentSearchTerm = '';
    loadPendingOrders();
}

function filterByCategory(category) {
    currentCategory = category;
    
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === category) {
            btn.classList.add('active');
        }
    });
    
    loadPendingOrders();
}

async function loadPendingOrders() {
    const user = getCurrentUser();
    const orders = await getOrders();
    
    let pendingOrders = orders.filter(order => 
        order.status === 'pending' && 
        (!order.rejectedby || !order.rejectedby.includes(user.id))
    );

    if (currentCategory !== 'all') {
        pendingOrders = pendingOrders.filter(order => {
            const orderCategory = (order.service_type || order.service || '').toLowerCase();
            if (!orderCategory) return false;
            
            const categoryMap = {
                'كهرباء': 'electricity',
                'electricity': 'electricity',
                'electrical': 'electricity',
                'سباكة': 'plumbing',
                'plumbing': 'plumbing',
                'نجارة': 'carpentry',
                'carpentry': 'carpentry',
                'دهان': 'painting',
                'painting': 'painting',
                'تكييف': 'ac',
                'ac': 'ac'
            };
            
            const normalizedOrderCategory = categoryMap[orderCategory] || orderCategory;
            return normalizedOrderCategory === currentCategory.toLowerCase();
        });
    }

    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        pendingOrders = pendingOrders.filter(order =>
            (order.service_type && order.service_type.toLowerCase().includes(term)) ||
            (order.service && order.service.toLowerCase().includes(term)) ||
            (order.description && order.description.toLowerCase().includes(term)) ||
            (order.address && order.address.toLowerCase().includes(term))
        );
    }

    pendingOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    document.getElementById('pendingCount').textContent = pendingOrders.length;
    renderOrders(pendingOrders);
}

async function renderOrders(orders) {
    const ordersList = document.getElementById('allOrdersList');
    const emptyState = document.getElementById('emptyState');

    if (orders.length === 0) {
        ordersList.innerHTML = '';
        ordersList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    ordersList.style.display = 'grid';

    const ordersWithCustomers = await Promise.all(orders.map(async (order) => {
        const customer = await findUserById(order.customer_id);
        return { ...order, customer };
    }));

    ordersList.innerHTML = ordersWithCustomers.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">#${escapeHtml(order.order_number || order.id)}</div>
                <div class="order-status status-pending">في الانتظار</div>
            </div>
            <div class="order-title">${escapeHtml(order.service_type || order.service || 'بدون عنوان')}</div>
            <div class="order-details">
                <div class="order-detail">
                    <i class="fas fa-tools"></i>
                    <span>${escapeHtml(getCategoryText(order.service_type || order.service))}</span>
                </div>
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
            <div class="order-description">${escapeHtml(order.description || 'لا يوجد وصف')}</div>
            <div class="order-actions">
                <button class="action-btn btn-accept" onclick="acceptOrder('${order.id}')">
                    <i class="fas fa-check"></i> قبول
                </button>
                <button class="action-btn btn-reject" onclick="rejectOrder('${order.id}')">
                    <i class="fas fa-times"></i> رفض
                </button>
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> التفاصيل
                </button>
            </div>
        </div>
    `).join('');
}

function getTimeText(time) {
    const timeMap = {
        'morning': 'صباحاً (8:00 - 12:00)',
        'afternoon': 'بعد الظهر (12:00 - 4:00)',
        'evening': 'مساءً (4:00 - 8:00)'
    };
    return timeMap[time] || time || 'غير محدد';
}

function getCategoryText(category) {
    const categoryMap = {
        'electricity': 'كهرباء',
        'electrical': 'كهرباء',
        'plumbing': 'سباكة',
        'carpentry': 'نجارة',
        'painting': 'دهان',
        'ac': 'تكييف',
        'other': 'أخرى'
    };
    return categoryMap[category] || category || 'غير محدد';
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

async function acceptOrder(orderId) {
    if (!await appConfirm('هل أنت متأكد من قبول هذا الطلب؟')) return;
    
    const user = getCurrentUser();
    if (!user || !user.id) {
        await appAlert('خطأ: لم يتم التعرف على المستخدم. يرجى تسجيل الدخول مجدداً.');
        return;
    }
    
    await updateOrder(orderId, {
        status: 'accepted',
        technician_id: user.id,
        technician_name: user.name,
        accepted_at: new Date().toISOString()
    });

    await appAlert('تم قبول الطلب بنجاح!');
    loadPendingOrders();
}

async function rejectOrder(orderId) {
    if (!await appConfirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    
    const user = getCurrentUser();
    if (!user || !user.id) {
        await appAlert('خطأ: لم يتم التعرف على المستخدم. يرجى تسجيل الدخول مجدداً.');
        return;
    }
    
    const order = await findOrderById(orderId);
    if (order) {
        const rejectedby = order.rejectedby || [];
        if (!rejectedby.includes(user.id)) {
            rejectedby.push(user.id);
        }
        
        await updateOrder(orderId, { rejectedby: rejectedby });
        await appAlert('تم رفض الطلب');
        loadPendingOrders();
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
            </div>
        `;

        modal.style.display = 'flex';
    }
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
}


