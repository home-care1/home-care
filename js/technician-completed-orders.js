
document.addEventListener('DOMContentLoaded', async function() {
    const user = await ensureCurrentUser();
    if (!user || user.role !== 'technician') {
        window.location.href = 'login.html';
        return;
    }

    loadCompletedOrders();

    loadNotifDropdown();
    setInterval(loadNotifDropdown, 15000);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            loadCompletedOrders(e.target.value);
        });
    }
});

async function loadCompletedOrders(searchTerm = '', filter = 'all') {
    const user = await ensureCurrentUser();
    
    let completedOrders = await getCompletedOrdersForRatings();
    
    completedOrders = completedOrders.filter(order => 
        order.technician_id === user.id
    );

    if (searchTerm) {
        completedOrders = completedOrders.filter(order => 
            (order.service_type || order.service || order.title || '').includes(searchTerm) || 
            (order.description || '').includes(searchTerm)
        );
    }
    
    if (filter === 'rated') {
        completedOrders = completedOrders.filter(order => order.rating);
    } else if (filter === 'unrated') {
        completedOrders = completedOrders.filter(order => !order.rating);
    }

    const totalCompleted = completedOrders.length;
    const ratedCount = completedOrders.filter(order => order.rating).length;
    const unratedCount = totalCompleted - ratedCount;
    const avgRating = completedOrders.length > 0 
        ? (completedOrders.reduce((sum, order) => sum + (order.rating || 0), 0) / completedOrders.length).toFixed(1)
        : 0;

    document.getElementById('totalCompleted').textContent = totalCompleted;
    document.getElementById('ratedCount').textContent = ratedCount;
    document.getElementById('unratedCount').textContent = unratedCount;
    document.getElementById('avgRating').textContent = avgRating;

    const ordersList = document.getElementById('completedOrdersList');
    
    if (completedOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <h3>لا توجد طلبات مكتملة</h3>
                <p>لم تقم بإكمال أي طلبات بعد</p>
            </div>
        `;
        return;
    }

    const ordersWithCustomers = await Promise.all(completedOrders.map(async (order) => {
        const customer = await findUserById(order.customer_id);
        return { ...order, customer };
    }));

    ordersList.innerHTML = ordersWithCustomers.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">#${order.order_number || order.id}</div>
                <div class="order-status completed">مكتمل</div>
            </div>
            <div class="order-title">${order.service_type || order.service || 'بدون عنوان'}</div>
            <div class="order-details">
                <div class="order-detail">
                    <i class="fas fa-user"></i>
                    <span>${order.customer ? order.customer.name : 'غير محدد'}</span>
                </div>
                <div class="order-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(order.completed_at || order.scheduled_date)}</span>
                </div>

            </div>
            ${order.rating ? `
            <div class="order-rating">
                <div class="rating-stars">
                    ${generateStars(order.rating)}
                </div>
                <span class="rating-text">${order.rating}/5</span>
            </div>
            ` : ''}
            ${order.rating_comment ? `
            <div class="order-review">
                <strong>تعليق العميل:</strong>
                <p>${order.rating_comment}</p>
            </div>
            ` : ''}
            <div class="order-actions">
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> التفاصيل
                </button>
            </div>
        </div>
    `).join('');
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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function viewOrderDetails(orderId) {
    const order = await findOrderById(orderId);
    
    if (order) {
        document.getElementById('detailOrderId').textContent = '#' + (order.order_number || order.id);
        document.getElementById('detailTitle').textContent = order.title || order.service || order.service_type || 'غير محدد';
        document.getElementById('detailDescription').textContent = order.description || 'غير محدد';
        const customer = await findUserById(order.customer_id);
        document.getElementById('detailCustomer').textContent = customer ? customer.name : 'غير محدد';
        document.getElementById('detailPhone').textContent = order.customer_phone || 'غير محدد';
        document.getElementById('detailAddress').textContent = order.address || 'غير محدد';
        document.getElementById('detailDate').textContent = formatDate(order.completed_at || order.scheduled_date);
        document.getElementById('detailTime').textContent = getTimeText(order.scheduled_time) || 'غير محدد';

        
        const ratingRow = document.getElementById('detailRatingRow');
        if (order.rating) {
            document.getElementById('detailRating').textContent = order.rating + '/5';
            ratingRow.style.display = 'flex';
        } else {
            ratingRow.style.display = 'none';
        }
        
        const reviewRow = document.getElementById('detailReviewRow');
        if (order.rating_comment) {
            document.getElementById('detailReview').textContent = order.rating_comment;
            reviewRow.style.display = 'flex';
        } else {
            reviewRow.style.display = 'none';
        }
        
        document.getElementById('orderDetailsModal').classList.add('show');
    }
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
    
    return timeMap[time] || time;
}

function closeOrderDetailsModal() {
    document.getElementById('orderDetailsModal').classList.remove('show');
}

function filterOrders(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
        }
    });
    
    loadCompletedOrders('', filter);
}

function logout() {
    window.location.href = 'login.html';
}
