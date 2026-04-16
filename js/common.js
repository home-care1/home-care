function ensureNotifDropdownTheme() {
    if (!document.head || document.getElementById('notifDropdownThemeStyles')) {
        return;
    }

    const link = document.createElement('link');
    link.id = 'notifDropdownThemeStyles';
    link.rel = 'stylesheet';
    link.href = 'css/notif-dropdown.css';
    document.head.appendChild(link);
}

ensureNotifDropdownTheme();

let appDialogRoot = null;
let appDialogTitle = null;
let appDialogMessage = null;
let appDialogOkBtn = null;
let appDialogCancelBtn = null;

function ensureAppDialogTheme() {
    if (!document.head || document.getElementById('appDialogThemeStyles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'appDialogThemeStyles';
    style.textContent = `
        .app-dialog-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.65);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 16px;
        }
        .app-dialog-card {
            width: min(460px, 100%);
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
            color: #fff;
            font-family: 'Cairo', sans-serif;
        }
        .app-dialog-title {
            margin-bottom: 10px;
            font-size: 1.2rem;
            color: #fff;
        }
        .app-dialog-message {
            color: rgba(255, 255, 255, 0.75);
            line-height: 1.8;
            white-space: pre-line;
            margin-bottom: 18px;
        }
        .app-dialog-actions {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .app-dialog-btn {
            border: none;
            border-radius: 999px;
            padding: 10px 24px;
            background: linear-gradient(135deg, #89ace8 0%, #a8c3ef 100%);
            color: #13213f;
            font-family: 'Cairo', sans-serif;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
        }
        .app-dialog-btn:hover {
            filter: brightness(1.05);
        }
        .app-dialog-btn-cancel {
            background: rgba(255, 255, 255, 0.15);
            color: #fff;
        }
    `;
    document.head.appendChild(style);
}

function ensureAppDialogElements() {
    if (!document.body || document.getElementById('appDialogOverlay')) {
        appDialogRoot = document.getElementById('appDialogOverlay');
        appDialogTitle = document.getElementById('appDialogTitle');
        appDialogMessage = document.getElementById('appDialogMessage');
        appDialogOkBtn = document.getElementById('appDialogOkBtn');
        appDialogCancelBtn = document.getElementById('appDialogCancelBtn');
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'appDialogOverlay';
    wrapper.className = 'app-dialog-overlay';
    wrapper.innerHTML = `
        <div class="app-dialog-card">
            <h3 class="app-dialog-title" id="appDialogTitle">تنبيه</h3>
            <p class="app-dialog-message" id="appDialogMessage"></p>
            <div class="app-dialog-actions">
                <button type="button" class="app-dialog-btn app-dialog-btn-cancel" id="appDialogCancelBtn">إلغاء</button>
                <button type="button" class="app-dialog-btn" id="appDialogOkBtn">حسنا</button>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);

    appDialogRoot = wrapper;
    appDialogTitle = document.getElementById('appDialogTitle');
    appDialogMessage = document.getElementById('appDialogMessage');
    appDialogOkBtn = document.getElementById('appDialogOkBtn');
    appDialogCancelBtn = document.getElementById('appDialogCancelBtn');
}

function ensureAppDialogReady() {
    ensureAppDialogTheme();
    ensureAppDialogElements();
}

async function appAlert(message, title = 'تنبيه') {
    ensureAppDialogReady();
    if (!appDialogRoot || !appDialogTitle || !appDialogMessage || !appDialogOkBtn) {
        alert(message);
        return;
    }

    appDialogTitle.textContent = title;
    appDialogMessage.textContent = message;
    appDialogCancelBtn.style.display = 'none';
    appDialogRoot.style.display = 'flex';

    return new Promise((resolve) => {
        const closeDialog = () => {
            appDialogRoot.style.display = 'none';
            appDialogOkBtn.removeEventListener('click', closeDialog);
            resolve();
        };
        appDialogOkBtn.addEventListener('click', closeDialog);
    });
}

async function appConfirm(message, title = 'تأكيد') {
    ensureAppDialogReady();
    if (!appDialogRoot || !appDialogTitle || !appDialogMessage || !appDialogOkBtn || !appDialogCancelBtn) {
        return confirm(message);
    }

    appDialogTitle.textContent = title;
    appDialogMessage.textContent = message;
    appDialogCancelBtn.style.display = 'inline-flex';
    appDialogRoot.style.display = 'flex';

    return new Promise((resolve) => {
        const closeDialog = (result) => {
            appDialogRoot.style.display = 'none';
            appDialogOkBtn.removeEventListener('click', onConfirm);
            appDialogCancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onConfirm = () => closeDialog(true);
        const onCancel = () => closeDialog(false);

        appDialogOkBtn.addEventListener('click', onConfirm);
        appDialogCancelBtn.addEventListener('click', onCancel);
    });
}

document.addEventListener('DOMContentLoaded', ensureAppDialogReady);

let currentUserCache = null;
let currentUserPromise = null;

function getCurrentUser() {
    return currentUserCache;
}

function setCurrentUserCache(user) {
    currentUserCache = user || null;
}

function clearCurrentUserCache() {
    currentUserCache = null;
    currentUserPromise = null;
}

async function fetchCurrentUserProfile(userId) {
    if (!userId) return null;

    const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching current user profile:', error);
        return null;
    }

    return data || null;
}

async function ensureCurrentUser(forceRefresh = false) {
    if (!forceRefresh && currentUserCache) {
        return currentUserCache;
    }

    if (!forceRefresh && currentUserPromise) {
        return currentUserPromise;
    }

    currentUserPromise = (async function() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();

            if (error || !session?.user?.id) {
                clearCurrentUserCache();
                return null;
            }

            const profile = await fetchCurrentUserProfile(session.user.id);
            currentUserCache = profile;
            return profile;
        } catch (error) {
            console.error('Error ensuring current user:', error);
            clearCurrentUserCache();
            return null;
        } finally {
            currentUserPromise = null;
        }
    })();

    return currentUserPromise;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function(char) {
        const htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return htmlEntities[char] || char;
    });
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function getSafeNotifColor(color) {
    const allowedColors = ['blue', 'green', 'orange', 'red', 'gray'];
    return allowedColors.includes(color) ? color : 'blue';
}

function getSafeIconClass(iconClass) {
    const normalizedIcon = String(iconClass ?? '').trim();
    return /^[a-zA-Z0-9\s-]+$/.test(normalizedIcon) && normalizedIcon
        ? normalizedIcon
        : 'fas fa-bell';
}

function isComplaintNotificationType(type) {
    return type === 'complaint' || type === 'complaints';
}

function isAdminUserNotificationType(type) {
    return String(type || '').startsWith('admin_user_');
}

function buildNotificationPayload(userId, userRole, title, description, icon, iconColor, type, refId) {
    return {
        user_id: userId,
        user_role: userRole,
        title: title,
        description: description,
        icon: icon,
        icon_color: iconColor,
        type: type,
        ref_id: refId,
        is_read: false,
        created_at: new Date().toISOString()
    };
}

function getNotificationTargetPage(role, type) {
    if (role === 'admin') {
        if (isAdminUserNotificationType(type)) {
            return 'admin-technicians.html';
        }
        return isComplaintNotificationType(type) ? 'admin-notifications.html' : 'admin-orders.html';
    }

    if (role === 'technician') {
        return type === 'new_order'
            ? 'technician-all-orders.html'
            : 'technician-accepted-orders.html';
    }

    if (role === 'customer') {
        return 'customer-orders.html';
    }

    return null;
}

function consumeViewOrderId() {
    const orderId = sessionStorage.getItem('viewOrderId');
    if (orderId) {
        sessionStorage.removeItem('viewOrderId');
    }
    return orderId;
}

async function logout() {
    await supabaseClient.auth.signOut();
    clearCurrentUserCache();
    window.location.href = 'index.html';
}

async function getStoredUsers() {
    const { data, error } = await supabaseClient.from('users').select('*');
    if (error) { console.error('Error fetching users:', error); return []; }
    return data || [];
}

async function saveNotification(userId, userRole, title, description, icon, iconColor, type, refId) {
    try {
        console.log('Creating notification:', { userId, userRole, title, description, type, refId });
        
        const notificationData = buildNotificationPayload(userId, userRole, title, description, icon, iconColor, type, refId);
        
        console.log('Notification data:', notificationData);
        
        const { data, error } = await supabaseClient.from('notifications').insert(notificationData);
        
        if (error) {
            console.error('Notification insert error:', error);
        } else {
            console.log('Notification created successfully:', data);
        }
    } catch(e) {
        console.error('Notification exception:', e);
    }
}

async function saveAdminNotification(title, description, icon, iconColor, type, refId) {
    try {
        const { data: admins, error: adminsError } = await supabaseClient
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .eq('status', 'active');

        if (adminsError) {
            console.error('Error fetching admins for notifications:', adminsError);
            return;
        }

        if (!admins || admins.length === 0) {
            return;
        }

        const adminNotifications = admins.map(admin =>
            buildNotificationPayload(admin.id, 'admin', title, description, icon, iconColor, type, refId)
        );

        const { error } = await supabaseClient.from('notifications').insert(adminNotifications);

        if (error) {
            console.error('Admin notification insert error:', error);
        }
    } catch (e) {
        console.error('Admin notification exception:', e);
    }
}

async function getUnreadNotifications(userId, limit = 3) {
    try {
        const currentUser = await ensureCurrentUser();
        if (!currentUser) return [];

        let query = supabaseClient
            .from('notifications')
            .select('*')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (currentUser.role === 'admin') {
            query = query.eq('user_role', 'admin').eq('user_id', currentUser.id);
        } else {
            query = query.eq('user_id', userId);
        }
        
        let { data, error } = await query;
        
        if (error) throw error;
        return data || [];
    } catch(e) {
        return [];
    }
}

async function getAllNotifications(userId) {
    try {
        console.log('getAllNotifications called with userId:', userId);
        const currentUser = await ensureCurrentUser();
        
        let query = supabaseClient
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (currentUser && currentUser.role === 'admin') {
            query = query.eq('user_role', 'admin').eq('user_id', currentUser.id);
        } else if (userId) {
            query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }
        
        console.log('Fetched notifications:', data);
        return data || [];
    } catch(e) {
        console.error('Exception in getAllNotifications:', e);
        return [];
    }
}

async function getUnreadCount(userId) {
    try {
        const currentUser = await ensureCurrentUser();
        if (!currentUser) return 0;

        let query = supabaseClient
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);
        
        if (currentUser.role === 'admin') {
            query = query.eq('user_role', 'admin').eq('user_id', currentUser.id);
        } else {
            query = query.eq('user_id', userId);
        }
        
        let { count, error } = await query;
        
        if (error) throw error;
        return count || 0;
    } catch(e) {
        return 0;
    }
}

async function markNotificationRead(userId, type, refId) {
    try {
        const currentUser = await ensureCurrentUser();
        let query = supabaseClient.from('notifications').update({ 
            is_read: true,
            read_at: new Date().toISOString()
        }).eq('type', type).eq('ref_id', refId);

        if (currentUser && currentUser.role === 'admin') {
            query = query.eq('user_role', 'admin').eq('user_id', currentUser.id);
        } else {
            query = query.eq('user_id', userId);
        }

        await query;
    } catch(e) {}
}

async function deleteAllNotificationsFromDB() {
    const currentUser = await ensureCurrentUser();
    if (!currentUser) return;
    
    if (!await appConfirm('هل أنت متأكد من حذف جميع الإشعارات؟')) {
        return;
    }
    
    try {
        let query = supabaseClient.from('notifications').delete();

        if (currentUser.role === 'admin') {
            query = query.eq('user_role', 'admin').eq('user_id', currentUser.id);
        } else {
            query = query.eq('user_id', currentUser.id);
        }

        await query;
        await appAlert('تم حذف جميع الإشعارات بنجاح');
    } catch(e) {
        console.error('Error deleting notifications:', e);
    }
}

async function markSingleNotificationRead(notifId, userId) {
    try {
        await supabaseClient.from('notifications').update({ 
            is_read: true,
            read_at: new Date().toISOString()
        }).eq('id', notifId);
        
        loadNotifDropdown();
    } catch(e) {
        console.error('Error marking notification as read:', e);
    }
}

async function findUserById(id) {
    const { data, error } = await supabaseClient.from('users').select('*').eq('id', id).single();
    if (error) { console.error('Error finding user:', error); return null; }
    return data;
}

async function updateUser(id, data) {
    console.log('Updating user:', id, data);
    const { data: response, error } = await supabaseClient.from('users').update(data).eq('id', id).select();
    if (error) { 
        console.error('Error updating user:', error); 
        return; 
    }
    console.log('Update response:', response);
    return response;
}

async function getOrders() {
    const { data, error } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching orders:', error); return []; }
    return data || [];
}

async function findOrderById(id) {
    const { data, error } = await supabaseClient.from('orders').select('*').eq('id', id).single();
    if (error) { console.error('Error finding order:', error); return null; }
    return data;
}

async function updateOrder(id, data) {
    const oldOrder = await findOrderById(id);
    
    const { error } = await supabaseClient.from('orders').update(data).eq('id', id);
    if (error) {
        console.error('Error updating order:', error);
        await appAlert('خطأ في تحديث الطلب: ' + error.message);
        return;
    }
    console.log('Order updated successfully');
    
    const order = await findOrderById(id);
    if (order && data.status) {
        if (oldOrder && oldOrder.status !== data.status) {
            const serviceName = getServiceName(order.title || order.service_type || order.service);
            const customerName = order.customer_name || oldOrder.customer_name || 'غير معروف';
            let technicianName = order.technician_name || oldOrder.technician_name || 'غير معروف';

            if (order.technician_id && technicianName === 'غير معروف') {
                const { data: technicianProfile } = await supabaseClient
                    .from('users')
                    .select('name')
                    .eq('id', order.technician_id)
                    .maybeSingle();

                technicianName = technicianProfile?.name || technicianName;
            }

            if (data.status === 'accepted' && order.technician_id) {
                await saveNotification(order.customer_id, 'customer', 'تم قبول الطلب', `الفني ${technicianName} في طريقه إليك`, 'fas fa-check-circle', 'green', 'accepted', id);
                await saveNotification(order.technician_id, 'technician', 'تم قبول الطلب', `لقد قمت بقبول طلب ${serviceName} من العميل ${customerName}`, 'fas fa-check-circle', 'blue', 'accepted', id);
                await saveAdminNotification('تم قبول طلب صيانة', `قام الفني ${technicianName} بقبول طلب صيانة ${serviceName} للعميل ${customerName}`, 'fas fa-check-circle', 'blue', 'admin_order_accepted', id);
            }
            if (data.status === 'in_progress' && order.technician_id) {
                await saveNotification(order.technician_id, 'technician', 'بدء التنفيذ', `بدء تنفيذ طلب ${serviceName}`, 'fas fa-play-circle', 'orange', 'in_progress', id);
                await saveAdminNotification('الفني بالطريق إلى العميل', `الفني ${technicianName} بالطريق إلى العميل ${customerName} لتنفيذ طلب صيانة ${serviceName}`, 'fas fa-truck', 'orange', 'admin_order_in_progress', id);
            }
            if (data.status === 'completed') {
                const hasRated = order.rated;
                if (order.customer_id) {
                    await saveNotification(order.customer_id, 'customer', hasRated ? 'تم إكمال الطلب' : 'قيّم الخدمة', hasRated ? `تم إكمال طلب ${serviceName} بنجاح` : `شاركنا رأيك عن خدمة ${serviceName}`, hasRated ? 'fas fa-flag-checkered' : 'fas fa-star', hasRated ? 'blue' : 'orange', 'completed', id);
                }
                if (order.technician_id) {
                    await saveNotification(order.technician_id, 'technician', 'تم إكمال الطلب', `تم إكمال طلب ${serviceName} بنجاح`, 'fas fa-flag-checkered', 'orange', 'completed', id);
                }
                await saveAdminNotification('تم إكمال الطلب', `أكمل الفني ${technicianName} طلب صيانة ${serviceName} للعميل ${customerName}`, 'fas fa-flag-checkered', 'green', 'admin_order_completed', id);
            }
            if (data.status === 'cancelled' && order.customer_id) {
                await saveNotification(order.customer_id, 'customer', 'تم إلغاء الطلب', `تم إلغاء طلب ${serviceName}`, 'fas fa-times-circle', 'orange', 'cancelled', id);
                if (order.technician_id) {
                    await saveNotification(order.technician_id, 'technician', 'تم إلغاء الطلب', `تم إلغاء طلب ${serviceName} الخاص بالعميل ${customerName}`, 'fas fa-times-circle', 'orange', 'cancelled', id);
                }
                await saveAdminNotification('تم إلغاء طلب صيانة', `تم إلغاء طلب ${serviceName} (العميل: ${customerName}, الفني: ${technicianName})`, 'fas fa-times-circle', 'orange', 'cancelled', id);
            }
        }
    }
}

async function notifyTechniciansOfNewOrder(order) {
    const serviceName = getServiceName(order.service_type || order.service);

    const { data: technicians, error } = await supabaseClient
        .from('users')
        .select('id, name')
        .eq('role', 'technician')
        .eq('status', 'active');

    if (error) {
        console.error('Error fetching technicians:', error);
        await saveAdminNotification(
            'طلب صيانة جديد',
            `قام العميل ${order.customer_name || 'غير معروف'} بإنشاء طلب صيانة ${serviceName}`,
            'fas fa-bell',
            'blue',
            'admin_order_created',
            order.id
        );
        return;
    }
    
    for (const tech of technicians) {
        await saveNotification(
            tech.id,
            'technician',
            'طلب صيانة جديد',
            `هناك طلب صيانة جديد: ${serviceName}`,
            'fas fa-bell',
            'blue',
            'new_order',
            order.id
        );
    }

    await saveAdminNotification(
        'طلب صيانة جديد',
        `قام العميل ${order.customer_name || 'غير معروف'} بإنشاء طلب صيانة ${serviceName}`,
        'fas fa-bell',
        'blue',
        'admin_order_created',
        order.id
    );
}

function formatDate(dateString) {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('ar-SA', options);
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'الآن';
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
    if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
    return formatDate(dateString);
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

function getServiceName(service) {
    const serviceMap = {
        'plumbing': 'سباكة',
        'electrical': 'كهرباء',
        'carpentry': 'نجارة',
        'painting': 'دهان',
        'ac': 'تكييف',
        'cleaning': 'تنظيف',
        'other': 'أخرى'
    };
    if (Object.values(serviceMap).includes(service)) {
        return service;
    }
    return serviceMap[service] || service;
}

function isNumberKey(evt) {
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
        return false;
    }
    return true;
}

function toggleNotif(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

async function markAllAsRead() {
    const currentUser = await ensureCurrentUser();
    if (!currentUser) return;

    try {
        if (currentUser.role === 'admin') {
            await supabaseClient.from('notifications').update({ 
                is_read: true,
                read_at: new Date().toISOString()
            }).eq('user_role', 'admin').eq('user_id', currentUser.id).eq('is_read', false);
        } else {
            await supabaseClient.from('notifications').update({ 
                is_read: true,
                read_at: new Date().toISOString()
            }).eq('user_id', currentUser.id).eq('is_read', false);
        }
    } catch(e) {}
    
    const notifList = document.querySelector('.notif-list');
    if (notifList) notifList.innerHTML = '';
    
    const badge = document.querySelector('.notif-badge');
    if (badge) badge.textContent = '0';
}

async function loadNotifDropdown() {
    const notifList = document.querySelector('.notif-list');
    const notifBadge = document.querySelector('.notif-badge');
    
    const currentUser = await ensureCurrentUser();
    if (!currentUser) return;

    const unreadCount = await getUnreadCount(currentUser.id);
    
    if (notifBadge) {
        if (unreadCount > 0) {
            notifBadge.style.display = 'flex';
            notifBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        } else {
            notifBadge.style.display = 'none';
        }
    }
    
    if (!notifList) return;
    
    const recentNotifs = await getUnreadNotifications(currentUser.id, 3);
    
    if (notifBadge) {
        if (unreadCount > 0) {
            notifBadge.style.display = 'flex';
            notifBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        } else {
            notifBadge.style.display = 'none';
        }
    }
    
    if (recentNotifs.length > 0) {
        notifList.innerHTML = recentNotifs.map((notif, index) => {
            const refId = notif.ref_id ? String(notif.ref_id) : '';
            const notifType = String(notif.type || '');
            const notifUserId = String(currentUser.id);
            const notifId = String(notif.id || '');
            const safeIconClass = getSafeIconClass(notif.icon);
            const safeColorClass = getSafeNotifColor(notif.icon_color);

            return `
                <li
                    class="notif-item${index === 0 ? ' notif-new' : ''}"
                    data-ref-id="${escapeAttribute(refId)}"
                    data-type="${escapeAttribute(notifType)}"
                    data-user-id="${escapeAttribute(notifUserId)}"
                >
                    <div class="notif-icon notif-icon-${safeColorClass}">
                        <i class="${escapeAttribute(safeIconClass)}"></i>
                    </div>
                    <div class="notif-content">
                        <div class="notif-title">${escapeHtml(notif.title)}</div>
                        <div class="notif-desc">${escapeHtml(notif.description)}</div>
                    </div>
                    <div class="notif-actions">
                        <button
                            class="notif-read-btn"
                            type="button"
                            data-notif-id="${escapeAttribute(notifId)}"
                            data-user-id="${escapeAttribute(notifUserId)}"
                            title="تعليم كمقروء"
                        >
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                    <div class="notif-time">
                        <span class="notif-time-text">${escapeHtml(timeAgo(notif.created_at))}</span>
                    </div>
                </li>
            `;
        }).join('');

        notifList.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', function() {
                handleNotifClick(
                    item.dataset.refId || '',
                    item.dataset.type || '',
                    item.dataset.userId || ''
                );
            });
        });

        notifList.querySelectorAll('.notif-read-btn').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                markSingleNotificationRead(
                    button.dataset.notifId || '',
                    button.dataset.userId || ''
                );
            });
        });
    } else {
        notifList.innerHTML = '<li class="notif-empty">لا توجد إشعارات جديدة</li>';
    }
}

async function handleNotifClick(refId, type, userId) {
    await markNotificationRead(userId, type, refId);
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.remove('show');
    
    const currentUser = await ensureCurrentUser();

    if (!currentUser) return;

    const targetPage = getNotificationTargetPage(currentUser.role, type);
    if (!targetPage) return;

    if (refId && !isComplaintNotificationType(type)) {
        if (currentUser.role === 'admin' && isAdminUserNotificationType(type)) {
            sessionStorage.setItem('viewTechnicianId', refId);
        } else {
            sessionStorage.setItem('viewOrderId', refId);
        }
    }

    window.location.href = targetPage;
}

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('notifDropdown');
    const btn = document.getElementById('notifButton');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

document.addEventListener('DOMContentLoaded', async function() {
    const requiredRole = document.body.getAttribute('data-required-role');

    if (requiredRole) {
        const currentUser = await ensureCurrentUser();

        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error || !session) {
                clearCurrentUserCache();
                window.location.href = 'login.html';
                return;
            }
        } catch(e) {
            clearCurrentUserCache();
            window.location.href = 'login.html';
            return;
        }

        if (currentUser.role !== requiredRole) {
            if (currentUser.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else if (currentUser.role === 'technician') {
                window.location.href = 'technician-dashboard.html';
            } else {
                window.location.href = 'customer-dashboard.html';
            }
        }
    }

    function setActiveLink() {
        const currentPage = window.location.href.split('/').pop() || 'index.html';
        const navbarLinks = document.querySelectorAll('.navbar-link');
        navbarLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage) {
                link.classList.add('active');
            }
        });
    }

    const currentPage = window.location.href.split('/').pop() || 'index.html';
    const navbarLinks = document.querySelectorAll('.navbar-link');
    navbarLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });

    const observer = new MutationObserver(setActiveLink);
    observer.observe(document.body, { childList: true, subtree: true });

    await loadNotifDropdown();
});
