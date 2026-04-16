document.addEventListener('DOMContentLoaded', async function() {
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'customer') {
        window.location.href = 'login.html';
        return;
    }

    loadNotifications('all');
});

function filterNotifications(event, type) {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    loadNotifications(type);
}

async function deleteAllNotifications() {
    await deleteAllNotificationsFromDB();
    loadNotifications('all');
}

async function loadNotifications(filterType = 'all') {
    const currentUser = await ensureCurrentUser();
    console.log('Loading notifications for user:', currentUser.id);
    
    const allNotifications = await getAllNotifications(currentUser.id);
    console.log('Got notifications:', allNotifications);
    
    if (!allNotifications || allNotifications.length === 0) {
        document.getElementById('notificationsList').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash empty-state-icon"></i>
                <h3 class="empty-state-title">لا توجد إشعارات</h3>
                <p class="empty-state-desc">لم تتلق أي إشعارات حتى الآن</p>
            </div>
        `;
        return;
    }
    
    let notifications = allNotifications.map(notif => ({
        id: notif.id,
        type: notif.type,
        icon: notif.icon,
        iconColor: notif.icon_color,
        title: notif.title,
        description: notif.description,
        time: notif.created_at,
        is_read: notif.is_read,
        orderId: notif.ref_id
    }));
    
    if (filterType !== 'all') {
        if (filterType === 'new' || filterType === 'unread') {
            notifications = notifications.filter(n => !n.is_read);
        } else if (filterType === 'read') {
            notifications = notifications.filter(n => n.is_read);
        } else {
            notifications = notifications.filter(n => n.type === filterType);
        }
    }
    
    renderNotifications(notifications, currentUser.id);
}

function renderNotifications(notifications, userId) {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash empty-state-icon"></i>
                <h3 class="empty-state-title">لا توجد إشعارات</h3>
                <p class="empty-state-desc">لم تتلق أي إشعارات حتى الآن</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = notifications.map(notif => `
        <li
            class="notif-page-item ${notif.is_read ? 'read' : ''}"
            data-order-id="${escapeAttribute(notif.orderId || '')}"
            data-type="${escapeAttribute(notif.type || '')}"
            data-user-id="${escapeAttribute(userId)}"
        >
            <div class="notif-page-icon ${getSafeNotifColor(notif.iconColor)}">
                <i class="${escapeAttribute(getSafeIconClass(notif.icon))}"></i>
            </div>
            <div class="notif-page-content">
                <h4 class="notif-page-title">${escapeHtml(notif.title)}</h4>
                <p class="notif-page-desc">${escapeHtml(notif.description)}</p>
                <div class="notif-page-time">
                    <i class="fas fa-clock"></i>
                    <span>${escapeHtml(timeAgo(notif.time))}</span>
                </div>
            </div>
        </li>
    `).join('');

    notificationsList.querySelectorAll('.notif-page-item').forEach(item => {
        item.addEventListener('click', function() {
            viewOrderDetails(
                item.dataset.orderId || '',
                item.dataset.type || '',
                item.dataset.userId || ''
            );
        });
    });
}

async function viewOrderDetails(orderId, type, userId) {
    await markNotificationRead(userId, type, orderId);
    const targetPage = getNotificationTargetPage('customer', type);
    if (orderId && targetPage) {
        sessionStorage.setItem('viewOrderId', orderId);
        window.location.href = targetPage;
    }
}