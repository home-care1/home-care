function notDeletedOrNull(columnName) {
    return `${columnName}.is.false,${columnName}.is.null`;
}

async function notifyOrderCancelled(orderId, order) {
    if (!order) return;

    const serviceName = getServiceName(order.title || order.service_type || order.service);
    const customerName = order.customer_name || 'غير معروف';
    const technicianName = order.technician_name || 'غير معروف';

    if (order.customer_id) {
        await saveNotification(
            order.customer_id,
            'customer',
            'تم إلغاء الطلب',
            `تم إلغاء طلب ${serviceName}`,
            'fas fa-times-circle',
            'orange',
            'cancelled',
            orderId
        );
    }

    if (order.technician_id) {
        await saveNotification(
            order.technician_id,
            'technician',
            'تم إلغاء الطلب',
            `تم إلغاء طلب ${serviceName} الخاص بالعميل ${customerName}`,
            'fas fa-times-circle',
            'orange',
            'cancelled',
            orderId
        );
    }

    await saveAdminNotification(
        'تم إلغاء طلب صيانة',
        `تم إلغاء طلب ${serviceName} (العميل: ${customerName}, الفني: ${technicianName})`,
        'fas fa-times-circle',
        'orange',
        'cancelled',
        orderId
    );
}

async function getCustomerOrders(customerId) {
    const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .or(notDeletedOrNull('deleted_by_customer'))
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching customer orders:', error);
        return [];
    }
    return data || [];
}

async function getTechnicianOrders(technicianId) {
    const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('technician_id', technicianId)
        .or(notDeletedOrNull('deleted_by_technician'))
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching technician orders:', error);
        return [];
    }
    return data || [];
}

async function getAdminOrders(includeArchived = false) {
    let query = supabaseClient
        .from('orders')
        .select('*')
        .or(notDeletedOrNull('deleted_by_admin'))
        .order('created_at', { ascending: false });

    if (!includeArchived) {
        query = query.is('archived_at', null);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching admin orders:', error);
        return [];
    }
    return data || [];
}

async function getCompletedOrdersForRatings() {
    const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching completed orders:', error);
        return [];
    }
    return data || [];
}

async function customerDeleteOrder(orderId, customerId) {
    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({
                deleted_by_customer: true
            })
            .eq('id', orderId)
            .eq('customer_id', customerId);

        if (error) {
            console.error('Error marking order as deleted by customer:', error);
            await appAlert('فشل في حذف الطلب');
            return false;
        }
        return true;
    } catch (e) {
        console.error('Exception in customerDeleteOrder:', e);
        return false;
    }
}

async function customerCancelOrder(orderId, customerId) {
    try {
        const now = new Date().toISOString();
        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                status: 'cancelled',
                cancelled_at: now
            })
            .eq('id', orderId)
            .eq('customer_id', customerId)
            .eq('status', 'pending')
            .select('*')
            .maybeSingle();

        if (error) {
            console.error('Error cancelling order:', error);
            await appAlert('فشل في إلغاء الطلب');
            return false;
        }

        if (!data) {
            await appAlert('لا يمكن إلغاء هذا الطلب بعد الآن');
            return false;
        }

        await notifyOrderCancelled(orderId, data);
        return true;
    } catch (e) {
        console.error('Exception in customerCancelOrder:', e);
        return false;
    }
}

async function technicianDeleteOrder(orderId, technicianId) {
    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({
                deleted_by_technician: true
            })
            .eq('id', orderId)
            .eq('technician_id', technicianId);

        if (error) {
            console.error('Error marking order as deleted by technician:', error);
            await appAlert('فشل في حذف الطلب');
            return false;
        }
        return true;
    } catch (e) {
        console.error('Exception in technicianDeleteOrder:', e);
        return false;
    }
}

async function adminDeleteOrder(orderId) {
    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({
                deleted_by_admin: true
            })
            .eq('id', orderId);

        if (error) {
            console.error('Error marking order as deleted by admin:', error);
            await appAlert('فشل في حذف الطلب');
            return false;
        }
        return true;
    } catch (e) {
        console.error('Exception in adminDeleteOrder:', e);
        return false;
    }
}

async function adminCancelOrder(orderId) {
    try {
        const now = new Date().toISOString();
        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                status: 'cancelled',
                cancelled_at: now
            })
            .eq('id', orderId)
            .neq('status', 'cancelled')
            .select('*')
            .maybeSingle();

        if (error) {
            console.error('Error cancelling order by admin:', error);
            await appAlert('فشل في إلغاء الطلب');
            return false;
        }

        if (!data) {
            await appAlert('الطلب ملغي بالفعل');
            return false;
        }

        await notifyOrderCancelled(orderId, data);
        return true;
    } catch (e) {
        console.error('Exception in adminCancelOrder:', e);
        return false;
    }
}