document.addEventListener('DOMContentLoaded', async function() {
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    loadNotifications('all');
    updateComplaintsCount();
    
    const modal = document.getElementById('complaintsModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeComplaints();
            }
        });
    }
});

function filterNotifications(event, type) {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    loadNotifications(type);
}

async function deleteAllNotifications() {
    if (!await appConfirm('هل أنت متأكد من حذف جميع الإشعارات؟')) {
        return;
    }
    
    try {
        await deleteAllNotificationsFromDB();
        await loadNotifications('all');
    } catch(e) {
        console.error('Error deleting notifications:', e);
        await appAlert('حدث خطأ أثناء حذف الإشعارات: ' + e.message);
    }
}

function getAdminNotificationLink(type) {
    if (isAdminUserNotificationType(type)) {
        return 'admin-technicians.html';
    }

    return 'admin-orders.html';
}

async function loadNotifications(filterType = 'all') {
    console.log('Loading notifications for admin...');
    const allNotifications = await getAllNotifications('');
    console.log('Raw notifications:', allNotifications);
    
    if (!allNotifications || allNotifications.length === 0) {
        console.log('No notifications found');
        document.getElementById('notificationsList').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash empty-state-icon"></i>
                <h3 class="empty-state-title">لا توجد إشعارات</h3>
                <p class="empty-state-desc">لم يتم إنشاء أي إشعارات حتى الآن</p>
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
        if (filterType === 'unread') {
            notifications = notifications.filter(n => !n.is_read);
        } else if (filterType === 'read') {
            notifications = notifications.filter(n => n.is_read);
        } else if (filterType === 'new') {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            notifications = notifications.filter(n => new Date(n.time) > oneDayAgo);
        } else if (filterType === 'orders') {
            notifications = notifications.filter(n => String(n.type || '').startsWith('admin_order_'));
        } else if (filterType === 'users') {
            notifications = notifications.filter(n => String(n.type || '').startsWith('admin_user_'));
        } else {
            notifications = notifications.filter(n => n.type === filterType);
        }
    }
    
    renderNotifications(notifications);
}

function renderNotifications(notifications) {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash empty-state-icon"></i>
                <h3 class="empty-state-title">لا توجد إشعارات</h3>
                <p class="empty-state-desc">لا توجد إشعارات تطابق الفلتر المحدد</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = notifications.map(notif => `
        <li
            class="notif-page-item ${notif.is_read ? 'read' : ''}"
            data-notif-id="${escapeAttribute(notif.id || '')}"
            data-type="${escapeAttribute(notif.type || '')}"
            data-ref-id="${escapeAttribute(notif.orderId || '')}"
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
        item.addEventListener('click', async function() {
            const notifType = item.dataset.type || '';
            const refId = item.dataset.refId || '';
            const notifId = item.dataset.notifId || '';

            if (notifId) {
                await markSingleNotificationRead(notifId, '');
            }

            if (isComplaintNotificationType(notifType)) {
                showComplaintDetails(refId);
                return;
            }

            if (refId) {
                viewDetails(getAdminNotificationLink(notifType), refId);
            }
        });
    });
}

async function showComplaintDetails(complaintId) {
    const { data: complaint, error } = await supabaseClient
        .from('complaints')
        .select('*')
        .eq('id', complaintId)
        .single();
    
    if (error || !complaint) {
        await appAlert('حدث خطأ في تحميل تفاصيل الشكوى');
        return;
    }
    
    const modal = document.getElementById('complaintsModal');
    const listContainer = document.getElementById('complaintsList');
    
    listContainer.innerHTML = `
        <div class="complaint-detail">
            <div class="complaint-detail-header">
                <h3>تفاصيل الشكوى</h3>
                <button class="complaint-close-btn" onclick="closeComplaints()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="complaint-detail-body">
                <div class="complaint-info-row">
                    <span class="complaint-info-label">المرسل:</span>
                    <span class="complaint-info-value">${escapeHtml(complaint.user_name || 'مستخدم')}</span>
                </div>
                <div class="complaint-info-row">
                    <span class="complaint-info-label">التاريخ:</span>
                    <span class="complaint-info-value">${formatDate(complaint.created_at)}</span>
                </div>
                <div class="complaint-info-row">
                    <span class="complaint-info-label">الحالة:</span>
                    <span class="complaint-status-badge ${complaint.status === 'pending' ? 'pending' : 'handled'}">
                        ${complaint.status === 'pending' ? 'جديدة' : 'تم التعامل'}
                    </span>
                </div>
                <div class="complaint-text-full">
                    <h4>نص الشكوى:</h4>
                    <p>${escapeHtml(complaint.text)}</p>
                </div>
                ${complaint.status === 'pending' ? `
                    <button class="mark-handled-btn" type="button" data-complaint-id="${escapeAttribute(complaint.id)}">
                        <i class="fas fa-check"></i>
                        <span>تحديد كتم التعامل معها</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    const markHandledButton = listContainer.querySelector('.mark-handled-btn');
    if (markHandledButton) {
        markHandledButton.addEventListener('click', function() {
            markComplaintAsHandled(markHandledButton.dataset.complaintId || '');
        });
    }

    modal.classList.add('show');
}

async function markComplaintAsHandled(complaintId) {
    const { error } = await supabaseClient
        .from('complaints')
        .update({ status: 'handled' })
        .eq('id', complaintId);
    
    if (error) {
        console.error('Error updating complaint:', error);
        await appAlert('حدث خطأ أثناء تحديث حالة الشكوى');
    } else {
        await appAlert('تم تحديث حالة الشكوى بنجاح');
        showComplaintDetails(complaintId);
        loadNotifications('all');
        updateComplaintsCount();
    }
}

function viewDetails(link, id) {
    if (link.includes('orders')) {
        sessionStorage.setItem('viewOrderId', id);
    } else if (link.includes('technicians')) {
        sessionStorage.setItem('viewTechnicianId', id);
    } else if (link.includes('customers')) {
        sessionStorage.setItem('viewCustomerId', id);
    }
    window.location.href = link;
}

async function updateComplaintsCount() {
    const { data: complaints, error } = await supabaseClient
        .from('complaints')
        .select('id')
        .eq('status', 'pending');
    
    const countElement = document.getElementById('complaintsCount');
    if (countElement) {
        countElement.textContent = error ? 0 : complaints.length;
    }
}

async function showComplaints() {
    const { data: complaints, error } = await supabaseClient
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });
    
    console.log('showComplaints - complaints:', complaints, 'error:', error);
    
    const modal = document.getElementById('complaintsModal');
    const listContainer = document.getElementById('complaintsList');
    const actionsContainer = document.querySelector('.complaints-actions');
    
    if (actionsContainer) {
        actionsContainer.style.display = 'block';
    }
    
    if (error || !complaints || complaints.length === 0) {
        listContainer.innerHTML = `
            <div class="complaints-empty">
                <i class="fas fa-check-circle"></i>
                <p>لا توجد شكاوي حالياً</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = complaints.map(complaint => `
            <div class="complaint-item">
                <p class="complaint-text">${escapeHtml(complaint.text)}</p>
                <div class="complaint-meta">
                    <span class="complaint-date">
                        <i class="fas fa-calendar-alt"></i>
                        ${formatDate(complaint.created_at)}
                    </span>
                    <span class="complaint-user">
                        <i class="fas fa-user"></i>
                        ${escapeHtml(complaint.user_name || 'مستخدم')}
                    </span>
                    <span class="complaint-status">
                        <i class="fas fa-info-circle"></i>
                        ${complaint.status === 'pending' ? 'جديدة' : 'تم التعامل'}
                    </span>
                </div>
            </div>
        `).join('');
    }
    
    modal.classList.add('show');
}

function closeComplaints() {
    const modal = document.getElementById('complaintsModal');
    modal.classList.remove('show');
    
    const actionsContainer = document.querySelector('.complaints-actions');
    if (actionsContainer) {
        actionsContainer.style.display = 'block';
    }
}

async function deleteAllComplaints() {
    if (!await appConfirm('هل أنت متأكد من حذف جميع الشكاوي؟')) {
        return;
    }
    
    try {
        const { data: allComplaints, error: fetchError } = await supabaseClient
            .from('complaints')
            .select('id');
        
        console.log('Fetched complaints:', allComplaints);
        console.log('Fetch error:', fetchError);
        
        if (fetchError) throw fetchError;
        
        if (!allComplaints || allComplaints.length === 0) {
            await appAlert('لا توجد شكاوي للحذف');
            return;
        }
        
        console.log('Deleting', allComplaints.length, 'complaints...');
        
        for (const c of allComplaints) {
            console.log('Deleting complaint id:', c.id);
            const { error: deleteError } = await supabaseClient
                .from('complaints')
                .delete()
                .eq('id', c.id);
            
            console.log('Delete result for id', c.id, ':', deleteError);
            
            if (deleteError) {
                console.error('Delete error for id', c.id, ':', deleteError);
            }
        }
        
        const { data: verify } = await supabaseClient.from('complaints').select('id');
        console.log('Remaining complaints after delete:', verify);
        
        await appAlert('تم حذف جميع الشكاوي بنجاح');
        
        setTimeout(() => {
            showComplaints();
            updateComplaintsCount();
        }, 100);
    } catch(e) {
        console.error('Error deleting complaints:', e);
        await appAlert('حدث خطأ أثناء حذف الشكاوي');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
