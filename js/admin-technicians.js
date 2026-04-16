document.addEventListener('DOMContentLoaded', async function() {
    const TECHNICIAN_CV_BUCKET = 'technician-cvs';
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    function getProfessionArabic(profession) {
        const professions = {
            'electrician': 'كهربائي',
            'plumber': 'سباك',
            'carpenter': 'نجار',
            'painter': 'دهان',
            'other': 'اخرى'
        };
        return professions[profession] || profession || 'فني صيانة';
    }

    function sortByNewestAccount(firstUser, secondUser) {
        const firstTime = firstUser && firstUser.created_at ? new Date(firstUser.created_at).getTime() : 0;
        const secondTime = secondUser && secondUser.created_at ? new Date(secondUser.created_at).getTime() : 0;
        return secondTime - firstTime;
    }

    loadTechnicians();

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadTechnicians(this.getAttribute('data-filter'));
        });
    });

    async function removeTechnicianData(technicianId) {
        const supabaseClientAdmin = window.supabase.createClient(supabaseUrl, supabaseKey);

        const { data: cvFiles } = await supabaseClientAdmin.storage
            .from(TECHNICIAN_CV_BUCKET)
            .list(technicianId);

        if (Array.isArray(cvFiles) && cvFiles.length > 0) {
            const filePaths = cvFiles.map(file => `${technicianId}/${file.name}`);
            await supabaseClientAdmin.storage
                .from(TECHNICIAN_CV_BUCKET)
                .remove(filePaths);
        }

        const { data: technicianOrders, error: orderLookupError } = await supabaseClientAdmin
            .from('orders')
            .select('id, status')
            .eq('technician_id', technicianId);

        if (orderLookupError) {
            throw new Error('خطأ أثناء جلب طلبات الفني: ' + orderLookupError.message);
        }

        const { error: notificationsError } = await supabaseClientAdmin
            .from('notifications')
            .delete()
            .eq('user_id', technicianId);

        if (notificationsError) {
            throw new Error('خطأ أثناء حذف إشعارات الفني: ' + notificationsError.message);
        }

        const { error: complaintsError } = await supabaseClientAdmin
            .from('complaints')
            .delete()
            .eq('user_id', technicianId);

        if (complaintsError) {
            throw new Error('خطأ أثناء حذف شكاوى الفني: ' + complaintsError.message);
        }

        const activeOrderIds = (technicianOrders || [])
            .filter(order => order.status === 'accepted' || order.status === 'in_progress')
            .map(order => order.id);

        const historicalOrderIds = (technicianOrders || [])
            .filter(order => !activeOrderIds.includes(order.id))
            .map(order => order.id);

        if (activeOrderIds.length > 0) {
            const { error: activeOrdersError } = await supabaseClientAdmin
                .from('orders')
                .update({
                    status: 'pending',
                    technician_id: null,
                    technician_name: null,
                    accepted_at: null,
                    started_at: null,
                    deleted_by_technician: false
                })
                .in('id', activeOrderIds);

            if (activeOrdersError) {
                throw new Error('خطأ أثناء إعادة الطلبات النشطة إلى الانتظار: ' + activeOrdersError.message);
            }
        }

        if (historicalOrderIds.length > 0) {
            const { error: historicalOrdersError } = await supabaseClientAdmin
                .from('orders')
                .update({
                    technician_id: null,
                    technician_name: null,
                    deleted_by_technician: true
                })
                .in('id', historicalOrderIds);

            if (historicalOrdersError) {
                throw new Error('خطأ أثناء تنظيف الطلبات المرتبطة بالفني: ' + historicalOrdersError.message);
            }
        }

        const { error: userError } = await supabaseClientAdmin
            .from('users')
            .delete()
            .eq('id', technicianId);

        if (userError) {
            throw new Error('خطأ أثناء حذف بيانات الفني: ' + userError.message);
        }
    }

    async function loadTechnicians(filter = 'all') {
        document.getElementById('techniciansList').innerHTML = '<div class="loading">جاري التحميل...</div>';
        
        const supabaseClientAdmin = window.supabase.createClient(supabaseUrl, supabaseKey);
        const { data: allUsers, error: usersError } = await supabaseClientAdmin.from('users').select('*');
        if (usersError) {
            console.error('Error fetching users:', usersError);
            document.getElementById('techniciansList').innerHTML = '<div class="error">خطأ في تحميل البيانات</div>';
            return;
        }
        console.log('All users from DB:', allUsers);
        
        let technicians = allUsers.filter(u => u.role === 'technician');
        
        console.log('Technicians before filter:', technicians);
        
        if (filter !== 'all') {
            technicians = technicians.filter(t => t.status === filter);
        }

        technicians.sort(sortByNewestAccount);

        const techniciansList = document.getElementById('techniciansList');
        if (!techniciansList) return;

        if (technicians.length === 0) {
            techniciansList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-cog empty-state-icon"></i>
                    <h3 class="empty-state-title">لا يوجد فنيين</h3>
                    <p class="empty-state-desc">لا توجد طلبات تطابق الفلتر المحدد</p>
                </div>
            `;
            return;
        }

        const { data: allOrders } = await supabaseClientAdmin.from('orders').select('*').order('created_at', { ascending: false });
        techniciansList.innerHTML = technicians.map(tech => {
            const orders = allOrders.filter(o => o.technician_id === tech.id);
            const completedOrders = orders.filter(o => o.status === 'completed').length;
            const avgRating = orders.filter(o => o.rating).reduce((sum, o) => sum + o.rating, 0) / orders.filter(o => o.rating).length || 0;
            
            const statusText = tech.status === 'active' ? 'نشط' : tech.status === 'pending' ? 'قيد الانتظار' : 'غير نشط';
            const statusClass = tech.status === 'pending' ? 'status-pending' : `status-${tech.status}`;
            
            return `
                <div class="technician-card">
                    <div class="technician-header">
                        <div class="technician-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="technician-info">
                            <h3>${escapeHtml(tech.name)}</h3>
                            <p>${escapeHtml(getProfessionArabic(tech.profession))}</p>
                        </div>
                        <span class="technician-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="technician-details">
                        <div class="technician-detail">
                            <i class="fas fa-envelope"></i>
                            <span>${escapeHtml(tech.email)}</span>
                        </div>
                        <div class="technician-detail">
                            <i class="fas fa-phone"></i>
                            <span>${escapeHtml(tech.phone || '---')}</span>
                        </div>
                    </div>
                    <div class="technician-stats">
                        <div class="technician-stat">
                            <div class="technician-stat-number">${completedOrders}</div>
                            <div class="technician-stat-label">مكتمل</div>
                        </div>
                        <div class="technician-stat">
                            <div class="technician-stat-number">${avgRating.toFixed(1)}</div>
                            <div class="technician-stat-label">تقييم</div>
                        </div>
                    </div>
                    <div class="technician-actions">
                        ${tech.status === 'pending' ? `
                            <button class="action-btn btn-view" onclick="viewTechnician('${tech.id}')">
                                <i class="fas fa-eye"></i> عرض
                            </button>
                            <button class="action-btn btn-accept" onclick="acceptTechnician('${tech.id}')">
                                <i class="fas fa-check"></i> قبول
                            </button>
                            <button class="action-btn btn-reject" onclick="rejectTechnician('${tech.id}')">
                                <i class="fas fa-times"></i> رفض
                            </button>
                        ` : `
                            <button class="action-btn btn-view" onclick="viewTechnician('${tech.id}')">
                                <i class="fas fa-eye"></i> عرض
                            </button>
                            <button class="action-btn btn-edit" onclick="editTechnician('${tech.id}')">
                                <i class="fas fa-edit"></i> تعديل
                            </button>
                            <button class="action-btn btn-delete" onclick="deleteTechnician('${tech.id}')">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function getTechnicianCvAccess(supabaseClientAdmin, technicianId) {
        const { data: cvFiles, error: listError } = await supabaseClientAdmin.storage
            .from(TECHNICIAN_CV_BUCKET)
            .list(technicianId);

        if (listError || !Array.isArray(cvFiles) || cvFiles.length === 0) {
            return null;
        }

        const preferredFile = cvFiles.find(file => file.name.toLowerCase().startsWith('cv')) || cvFiles[0];
        const filePath = `${technicianId}/${preferredFile.name}`;
        const { data, error } = await supabaseClientAdmin.storage
            .from(TECHNICIAN_CV_BUCKET)
            .createSignedUrl(filePath, 60 * 60);

        if (error || !data?.signedUrl) {
            return null;
        }

        return {
            url: data.signedUrl,
            fileName: preferredFile.name
        };
    }

    window.viewTechnician = async function(id) {
        const supabaseClientAdmin = window.supabase.createClient(supabaseUrl, supabaseKey);
        const { data: tech } = await supabaseClientAdmin.from('users').select('*').eq('id', id).single();
        if (tech) {
            const cvAccess = await getTechnicianCvAccess(supabaseClientAdmin, id);
            const statusText = tech.status === 'active' ? 'نشط' : tech.status === 'pending' ? 'قيد الانتظار' : 'غير نشط';

            document.getElementById('viewModal').classList.add('show');
            document.getElementById('viewModalBody').innerHTML = `
                <div class="modal-technician-header">
                    <div class="modal-technician-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="modal-technician-info">
                        <h3>${escapeHtml(tech.name)}</h3>
                        <p>${escapeHtml(getProfessionArabic(tech.profession))}</p>
                    </div>
                </div>
                <div class="modal-details-grid">
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">البريد الإلكتروني</div>
                        <div class="modal-detail-value">${escapeHtml(tech.email)}</div>
                    </div>
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">رقم الهاتف</div>
                        <div class="modal-detail-value">${escapeHtml(tech.phone || '---')}</div>
                    </div>
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">الحالة</div>
                        <div class="modal-detail-value">${statusText}</div>
                    </div>
                    <div class="modal-detail-item">
                        <div class="modal-detail-label">تاريخ التسجيل</div>
                        <div class="modal-detail-value">${formatDate(tech.created_at)}</div>
                    </div>
                </div>
                <div class="cv-section">
                    <div class="cv-section-label">السيرة الذاتية (CV)</div>
                    ${cvAccess ? `
                        <div class="cv-file-name">اسم الملف: ${escapeHtml(cvAccess.fileName)}</div>
                        <div class="cv-actions">
                            <a class="cv-action-btn cv-open-btn" href="${cvAccess.url}" target="_blank" rel="noopener noreferrer">
                                <i class="fas fa-eye"></i>
                                فتح الملف
                            </a>
                            <a class="cv-action-btn cv-download-btn" href="${cvAccess.url}" download="${escapeHtml(tech.name)}-${escapeHtml(cvAccess.fileName)}">
                                <i class="fas fa-download"></i>
                                تنزيل الملف
                            </a>
                        </div>
                    ` : `
                        <div class="cv-empty-state">لا يوجد CV مرفق لهذا الفني</div>
                    `}
                </div>
            `;
        }
    };

    window.editTechnician = async function(id) {
        const supabaseClientAdmin = window.supabase.createClient(supabaseUrl, supabaseKey);
        const { data: tech } = await supabaseClientAdmin.from('users').select('*').eq('id', id).single();
        if (tech) {
            document.getElementById('editModal').classList.add('show');
            document.getElementById('editStatus').value = tech.status || 'inactive';
            window.currentEditId = id;
        }
    };

    window.saveEdit = async function() {
        if (window.currentEditId) {
            const newStatus = document.getElementById('editStatus').value;
            const supabaseClientAdmin = window.supabase.createClient(supabaseUrl, supabaseKey);
            
            const { error } = await supabaseClientAdmin
                .from('users')
                .update({ status: newStatus })
                .eq('id', window.currentEditId);
            
            if (error) {
                await appAlert('خطأ: ' + error.message);
                return;
            }
            
            closeModal('editModal');
            loadTechnicians();
        }
    };

    window.deleteTechnician = async function(id) {
        const supabaseClientAdmin = window.supabase.createClient(supabaseUrl, supabaseKey);
        const { data: tech } = await supabaseClientAdmin.from('users').select('*').eq('id', id).single();
        if (tech) {
            document.getElementById('deleteModal').classList.add('show');
            document.getElementById('deleteWarningText').innerHTML = `
                هل أنت متأكد من حذف الفني "<strong>${escapeHtml(tech.name)}</strong>"؟<br>
                سيتم حذف بياناته وإشعاراته وشكاويه، وفك ارتباطه من الطلبات نهائياً.
            `;
            window.currentDeleteId = id;
        }
    };

    window.confirmDelete = async function() {
        if (window.currentDeleteId) {
            try {
                await removeTechnicianData(window.currentDeleteId);
            } catch (error) {
                await appAlert(error.message);
                return;
            }

            closeModal('deleteModal');
            await appAlert('تم حذف بيانات الفني بنجاح');
            await loadTechnicians();
        }
    };

    window.acceptTechnician = async function(id) {
        const isConfirmed = await appConfirm('هل أنت متأكد من قبول هذا الفني؟');
        if (isConfirmed) {
            console.log('Accepting technician with id:', id);
            
            const supabaseClientAdmin = window.supabase.createClient(supabaseUrl, supabaseKey);
            
            try {
                const { error } = await supabaseClientAdmin
                    .from('users')
                    .update({ status: 'active' })
                    .eq('id', id);
                
                console.log('Update error:', error);
                
                if (error) {
                    await appAlert('خطأ: ' + error.message);
                    return;
                }
                
                await appAlert('تم قبول الفني بنجاح!');
                await loadTechnicians();
            } catch (err) {
                console.error('Exception:', err);
                await appAlert('خطأ: ' + err.message);
            }
        }
    };

    window.rejectTechnician = async function(id) {
        if (await appConfirm('هل أنت متأكد من رفض هذا الفني؟ سيتم حذف حسابه وبياناته من النظام.')) {
            try {
                await removeTechnicianData(id);
            } catch (error) {
                await appAlert(error.message);
                return;
            }
            await appAlert('تم رفض الحساب وحذف بيانات الفني');
            await loadTechnicians();
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
