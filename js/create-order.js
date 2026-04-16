document.addEventListener('DOMContentLoaded', async function () {
    const user = await ensureCurrentUser();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('preferredDate').min = today;

    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    const radios = document.querySelectorAll('input[name="serviceType"]');
    const customGroup = document.getElementById('customServiceTypeGroup');
    const customInput = document.getElementById('customServiceType');

    radios.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.value === 'أخرى') {
                customGroup.style.display = 'block';
                customInput.setAttribute('required', 'required');
            } else {
                customGroup.style.display = 'none';
                customInput.removeAttribute('required');
                customInput.value = '';
            }
        });
    });

    const orderForm = document.getElementById('orderForm');

    orderForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const selected = document.querySelector('input[name="serviceType"]:checked');
        if (!selected) {
            await appAlert('يرجى اختيار نوع الخدمة');
            return;
        }

        let serviceType = selected.value;

        if (serviceType === 'أخرى') {
            const customValue = customInput.value.trim();
            if (!customValue) {
                await appAlert('يرجى كتابة نوع الخدمة');
                return;
            }
            serviceType = customValue;
        }

        const btn = orderForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = 'جاري الإرسال...';

        const formData = {
            customer_id: user.id,
            customer_name: user.name || '',
            service_type: serviceType,
            service: serviceType,
            status: 'pending',
            description: document.getElementById('description')?.value || '',
            address: document.getElementById('address')?.value || '',
            city: document.getElementById('city')?.value || '',
            customer_phone: document.getElementById('phone')?.value || '',
            scheduled_date: document.getElementById('preferredDate')?.value || null,
            scheduled_time: document.getElementById('preferredTime')?.value || null,
            created_at: new Date().toISOString()
        };

        if (!formData.customer_id) {
            await appAlert('خطأ: المستخدم غير موجود');
            btn.disabled = false;
            btn.innerHTML = 'إرسال الطلب';
            return;
        }

        const { data: userCheck, error: userCheckError } = await supabaseClient
            .from('users')
            .select('id')
            .eq('id', formData.customer_id)
            .single();

        if (userCheckError || !userCheck) {
            console.error('User not found in database:', userCheckError);
            await appAlert('خطأ: حسابك غير موجود. يرجى تسجيل الدخول مجددا');
            clearCurrentUserCache();
            window.location.href = 'login.html';
            return;
        }

        const { data, error } = await supabaseClient
            .from('orders')
            .insert([formData])
            .select();

        if (error) {
            console.error('Order Error:', error);
            await appAlert('خطأ في إنشاء الطلب: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = 'إرسال الطلب';
            return;
        }

        btn.disabled = false;
        btn.innerHTML = 'تم الإرسال';
        
        await notifyTechniciansOfNewOrder(data[0]);

        await appAlert('تم إنشاء الطلب بنجاح ✅');

        window.location.href = 'customer-orders.html';
    });
}); 