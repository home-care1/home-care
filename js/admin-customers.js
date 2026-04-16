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

    loadCustomers();

    function sortByNewestAccount(firstUser, secondUser) {
        const firstTime = firstUser && firstUser.created_at ? new Date(firstUser.created_at).getTime() : 0;
        const secondTime = secondUser && secondUser.created_at ? new Date(secondUser.created_at).getTime() : 0;
        return secondTime - firstTime;
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadCustomers(this.getAttribute('data-filter'));
        });
    });

    async function loadCustomers(filter = 'all') {
        let customers = (await getStoredUsers()).filter(u => u.role === 'customer');
        
        if (filter !== 'all') {
            customers = customers.filter(c => c.status === filter);
        }

        customers.sort(sortByNewestAccount);

        const customersList = document.getElementById('customersList');
        if (!customersList) return;

        if (customers.length === 0) {
            customersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users empty-state-icon"></i>
                    <h3 class="empty-state-title">لا يوجد عملاء</h3>
                    <p class="empty-state-desc">لا توجد طلبات تطابق الفلتر المحدد</p>
                </div>
            `;
            return;
        }

        const allOrders = await getOrders();
        customersList.innerHTML = customers.map(customer => {
            const orders = allOrders.filter(o => o.customer_id === customer.id);
            const totalOrders = orders.length;
            const completedOrders = orders.filter(o => o.status === 'completed').length;
            
            return `
                <div class="customer-card">
                    <div class="customer-header">
                        <div class="customer-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="customer-info">
                            <h3>${escapeHtml(customer.name)}</h3>
                            <p>${escapeHtml(customer.email)}</p>
                        </div>
                        <span class="customer-status status-${escapeHtml(customer.status)}">${customer.status === 'active' ? 'نشط' : 'غير نشط'}</span>
                    </div>
                    <div class="customer-details">
                        <div class="customer-detail">
                            <i class="fas fa-phone"></i>
                            <span>${escapeHtml(customer.phone || '---')}</span>
                        </div>
                        <div class="customer-detail">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${escapeHtml(customer.address || '---')}</span>
                        </div>
                    </div>
                    <div class="customer-stats">
                        <div class="customer-stat">
                            <div class="customer-stat-number">${totalOrders}</div>
                            <div class="customer-stat-label">إجمالي الطلبات</div>
                        </div>
                        <div class="customer-stat">
                            <div class="customer-stat-number">${completedOrders}</div>
                            <div class="customer-stat-label">مكتمل</div>
                        </div>
                    </div>
                    <div class="customer-actions">
                        <button class="action-btn btn-view" onclick="viewCustomer('${customer.id}')">
                            <i class="fas fa-eye"></i> عرض
                        </button>
                        <button class="action-btn btn-edit" onclick="editCustomer('${customer.id}')">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteCustomer('${customer.id}')">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.viewCustomer = async function(id) {
        const customer = await findUserById(id);
        if (customer) {
            document.getElementById('viewModal').classList.add('show');
            document.getElementById('viewModalBody').innerHTML = `
                <div class="modal-customer-header">
                    <div class="modal-customer-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="modal-customer-info">
                        <h3>${escapeHtml(customer.name)}</h3>
                        <p>${escapeHtml(customer.email)}</p>
                    </div>
                </div>
                <div class="modal-details-grid">
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">رقم الهاتف</div>
                        <div class="modal-detail-value">${escapeHtml(customer.phone || '---')}</div>
                    </div>
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">العنوان</div>
                        <div class="modal-detail-value">${escapeHtml(customer.address || '---')}</div>
                    </div>
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">الحالة</div>
                        <div class="modal-detail-value">${customer.status === 'active' ? 'نشط' : 'غير نشط'}</div>
                    </div>
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">تاريخ التسجيل</div>
                        <div class="modal-detail-value">${formatDate(customer.created_at)}</div>
                    </div>
                </div>
            `;
        }
    };

    window.editCustomer = async function(id) {
        const customer = await findUserById(id);
        if (customer) {
            document.getElementById('editModal').classList.add('show');
            document.getElementById('editStatus').value = customer.status || 'inactive';
            window.currentEditId = id;
        }
    };

    window.saveEdit = async function() {
        if (window.currentEditId) {
            const newStatus = document.getElementById('editStatus').value;
            await updateUser(window.currentEditId, { status: newStatus });
            closeModal('editModal');
            loadCustomers();
        }
    };

    window.deleteCustomer = async function(id) {
        const customer = await findUserById(id);
        if (customer) {
            document.getElementById('deleteModal').classList.add('show');
            document.getElementById('deleteWarningText').innerHTML = `
                هل أنت متأكد من حذف العميل "<strong>${escapeHtml(customer.name)}</strong>"؟<br>
                سيتم حذف بياناته وطلباته وإشعاراته وشكاويه نهائياً من جداول المشروع.
            `;
            window.currentDeleteId = id;
        }
    };

    window.confirmDelete = async function() {
        if (window.currentDeleteId) {
            const customerId = window.currentDeleteId;

            const { data: customerOrders, error: orderLookupError } = await supabaseClient
                .from('orders')
                .select('id')
                .eq('customer_id', customerId);

            if (orderLookupError) {
                await appAlert('خطأ أثناء جلب طلبات العميل: ' + orderLookupError.message);
                return;
            }

            const orderIds = (customerOrders || []).map(order => order.id);

            if (orderIds.length > 0) {
                const { error: orderNotificationsError } = await supabaseClient
                    .from('notifications')
                    .delete()
                    .in('ref_id', orderIds);

                if (orderNotificationsError) {
                    await appAlert('خطأ أثناء حذف إشعارات الطلبات: ' + orderNotificationsError.message);
                    return;
                }
            }

            const { error: notificationsError } = await supabaseClient
                .from('notifications')
                .delete()
                .eq('user_id', customerId);

            if (notificationsError) {
                await appAlert('خطأ أثناء حذف إشعارات العميل: ' + notificationsError.message);
                return;
            }

            const { error: complaintsError } = await supabaseClient
                .from('complaints')
                .delete()
                .eq('user_id', customerId);

            if (complaintsError) {
                await appAlert('خطأ أثناء حذف شكاوى العميل: ' + complaintsError.message);
                return;
            }

            const { error: ordersError } = await supabaseClient
                .from('orders')
                .delete()
                .eq('customer_id', customerId);

            if (ordersError) {
                await appAlert('خطأ أثناء حذف طلبات العميل: ' + ordersError.message);
                return;
            }

            const { error: userError } = await supabaseClient
                .from('users')
                .delete()
                .eq('id', customerId);

            if (userError) {
                await appAlert('خطأ أثناء حذف بيانات العميل: ' + userError.message);
                return;
            }
            
            closeModal('deleteModal');
            await appAlert('تم حذف بيانات العميل بنجاح');
            loadCustomers();
        }
    };

    window.closeModal = function(modalId) {
        document.getElementById(modalId).classList.remove('show');
    };

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    };
});
