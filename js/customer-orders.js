document.addEventListener('DOMContentLoaded', async function() {
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'customer') {
        window.location.href = 'login.html';
        return;
    }

    let currentFilter = 'all';
    let pendingViewOrderId = consumeViewOrderId();

    loadOrders().then(() => openPendingViewOrder());

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            loadOrders(this.value);
        });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadOrders(searchInput ? searchInput.value : '');
        });
    });

    async function loadOrders(searchTerm = '') {
        let orders = await getCustomerOrders(currentUser.id);
        
        if (currentFilter !== 'all') {
            orders = orders.filter(o => o.status === currentFilter);
        }
        
        if (searchTerm) {
            orders = orders.filter(o =>
                (o.service && o.service.includes(searchTerm)) ||
                (o.service_type && o.service_type.includes(searchTerm)) ||
                (o.title && o.title.includes(searchTerm))
            );
        }
        
        orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const allOrders = await getCustomerOrders(currentUser.id);
        document.getElementById('totalOrders').textContent = allOrders.length;
        document.getElementById('pendingOrders').textContent = allOrders.filter(o => o.status === 'pending').length;
        document.getElementById('inProgressOrders').textContent = allOrders.filter(o => o.status === 'in_progress').length;
        document.getElementById('completedOrders').textContent = allOrders.filter(o => o.status === 'completed').length;
        
        const ordersList = document.getElementById('ordersList');
        if (!ordersList) return;
        
        if (orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list empty-state-icon"></i>
                    <h3 class="empty-state-title">لا توجد طلبات</h3>
                    <p class="empty-state-desc">لم تقم بإنشاء أي طلبات بعد</p>
                </div>
            `;
            return;
        }
        
        console.log('Rendering', orders.length, 'orders');
        ordersList.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">#${escapeHtml(order.order_number || order.id)}</span>
                    <span class="order-status status-${escapeHtml(order.status)}">${escapeHtml(getStatusText(order.status))}</span>
                </div>
                <div class="order-details">
                    <div class="order-detail">
                        <i class="fas fa-tools"></i>
                        <span>${escapeHtml(order.title || order.service_type || order.service)}</span>
                    </div>
                    <div class="order-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(order.address)}</span>
                    </div>
                    <div class="order-detail">
                        <i class="fas fa-calendar"></i>
                        <span>${escapeHtml(formatDate(order.created_at))}</span>
                    </div>
                    ${order.technician_name ? `
                    <div class="order-detail">
                        <i class="fas fa-user"></i>
                        <span>${escapeHtml(order.technician_name)}</span>
                        <button class="technician-info-btn" onclick="showTechnicianInfo('${order.id}')" title="معلومات الفني">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="order-actions">
                    <button class="action-btn btn-view" onclick="viewOrder('${order.id}')">
                        <i class="fas fa-eye"></i> عرض
                    </button>
                    ${order.status === 'pending' ? `
                    <button class="action-btn btn-cancel" onclick="cancelOrder('${order.id}')">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                    ` : ''}
                    ${order.status === 'completed' && !order.rated ? `
                    <button class="action-btn btn-rate" onclick="rateOrder('${order.id}')">
                        <i class="fas fa-star"></i> تقييم
                    </button>
                    ` : ''}
                    ${order.status === 'completed' || order.status === 'cancelled' ? `
                    <button class="action-btn btn-delete-single" onclick="deleteSingleOrder('${order.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async function openPendingViewOrder() {
        if (!pendingViewOrderId) return;

        const orderId = pendingViewOrderId;
        pendingViewOrderId = null;

        const order = await findOrderById(orderId);
        if (order && order.customer_id === currentUser.id) {
            await window.viewOrder(orderId);
        }
    }

    window.viewOrder = async function(id) {
        const order = await findOrderById(id);
        if (order) {
            document.getElementById('detailOrderId').textContent = '#' + (order.order_number || order.id);
            document.getElementById('detailService').textContent = getServiceName(order.title || order.service_type || order.service);
            document.getElementById('detailDescription').textContent = order.description || 'غير محدد';
            document.getElementById('detailCity').textContent = getCityName(order.city) || 'غير محدد';
            document.getElementById('detailPhone').textContent = order.customer_phone || order.phone || 'غير محدد';
            document.getElementById('detailPreferredDate').textContent = formatDate(order.scheduled_date || order.preferred_date) || 'غير محدد';
            document.getElementById('detailPreferredTime').textContent = getPreferredTimeText(order.scheduled_time || order.preferred_time) || 'غير محدد';
            document.getElementById('detailStatus').textContent = getStatusText(order.status);
            document.getElementById('detailCreatedAt').textContent = formatDate(order.created_at);

            const technicianRow = document.getElementById('detailTechnicianRow');
            if (order.technician_name) {
                document.getElementById('detailTechnician').textContent = order.technician_name;
                technicianRow.style.display = 'flex';
            } else {
                technicianRow.style.display = 'none';
            }

            const notesRow = document.getElementById('detailNotesRow');
            if (order.notes) {
                document.getElementById('detailNotes').textContent = order.notes;
                notesRow.style.display = 'flex';
            } else {
                notesRow.style.display = 'none';
            }

            document.getElementById('orderDetailsModal').classList.add('show');
        }
    };

    window.closeOrderDetailsModal = function() {
        document.getElementById('orderDetailsModal').classList.remove('show');
    };

    function getCityName(city) {
        const cities = {
            'ramallah': 'رام الله',
            'nablus': 'نابلس',
            'hebron': 'الخليل',
            'bethlehem': 'بيت لحم',
            'jericho': 'أريحا',
            'jenin': 'جنين',
            'tulkarm': 'طولكرم',
            'qalqilya': 'قلقيلية',
            'salfit': 'سلفيت',
            'tubas': 'طوباس',
            'jerusalem': 'القدس',
            'gaza': 'غزة'
        };
        return cities[city] || city;
    }

    function getPreferredTimeText(time) {
        const times = {
            'morning': 'صباحاً (8:00 - 12:00)',
            'afternoon': 'بعد الظهر (12:00 - 4:00)',
            'evening': 'مساءً (4:00 - 8:00)'
        };
        return times[time] || time;
    }

    window.cancelOrder = async function(id) {
        if (await appConfirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
            const result = await customerCancelOrder(id, currentUser.id);
            if (result) {
                loadOrders(searchInput ? searchInput.value : '');
            }
        }
    };

    window.rateOrder = async function(id) {
        const order = await findOrderById(id);
        if (order) {
            document.getElementById('ratingModal').classList.add('show');
            window.currentRatingOrderId = id;
        }
    };

window.closeRatingModal = function() {
        document.getElementById('ratingModal').classList.remove('show');
        document.getElementById('stars').value = '';
        document.getElementById('ratingComment').value = '';
        document.querySelectorAll('.star').forEach(star => star.classList.remove('active'));
        window.currentRatingOrderId = null;
    };

    window.setRating = function(value) {
        document.getElementById('stars').value = value;
        document.querySelectorAll('.star').forEach((star, index) => {
            if (index < value) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });

        const ratingTexts = ['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];
        document.getElementById('ratingText').textContent = ratingTexts[value];
    };

    window.submitRating = async function() {
        const rating = parseInt(document.getElementById('stars').value);
        const comment = document.getElementById('ratingComment').value;

        if (window.currentRatingOrderId) {
            await updateOrder(window.currentRatingOrderId, {
                rated: true,
                rating: rating,
                rating_comment: comment
            });

            closeRatingModal();
            loadOrders(searchInput ? searchInput.value : '');
        }
    };

    window.deleteSingleOrder = async function(id) {
        if (await appConfirm('هل أنت متأكد من حذف هذا الطلب؟')) {
            await customerDeleteOrder(id, currentUser.id);
            loadOrders(searchInput ? searchInput.value : '');
        }
    };

    window.deleteOldOrdersClick = async function() {
        if (await appConfirm('هل أنت متأكد من حذف جميع الطلبات المكتملة والملغاة؟')) {
            const ordersToDelete = (await getCustomerOrders(currentUser.id))
                .filter(o => o.status === 'completed' || o.status === 'cancelled');
            
            for (const order of ordersToDelete) {
                await customerDeleteOrder(order.id, currentUser.id);
            }
            
            loadOrders(searchInput ? searchInput.value : '');
        }
    };

    window.showTechnicianInfo = async function(orderId) {
        const order = await findOrderById(orderId);
        if (order && order.technician_name) {
            const technician = await findUserById(order.technician_id);

            const technicianOrders = (await getOrders()).filter(o => o.technician_id === order.technician_id && o.rating);
            const avgRating = technicianOrders.length > 0
                ? technicianOrders.reduce((sum, o) => sum + o.rating, 0) / technicianOrders.length
                : 0;

            document.getElementById('technicianInfoName').textContent = technician ? technician.name : order.technician_name;
            document.getElementById('technicianInfoPhone').textContent = technician ? (technician.phone || 'غير محدد') : 'غير محدد';

            const ratingStars = '★'.repeat(Math.floor(avgRating)) + '☆'.repeat(5 - Math.floor(avgRating));
            document.getElementById('technicianInfoRating').textContent = ratingStars + ` (${avgRating.toFixed(1)})`;

            document.getElementById('technicianInfoModal').classList.add('show');
        }
    };

    window.closeTechnicianInfoModal = function() {
        document.getElementById('technicianInfoModal').classList.remove('show');
    };
});
