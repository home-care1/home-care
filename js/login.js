document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const btn = loginForm.querySelector('button[type="submit"]');

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    console.error('Supabase auth error:', error);
                    if (error.message.includes('Email not confirmed')) {
                        await appAlert('الرجاء تأكيد البريد الإلكتروني أولاً.\nتحقق من صندوق البريد الإلكتروني وأضغط على رابط التأكيد.');
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
                        return;
                    } else if (error.message.includes('Invalid login') || error.message.includes('invalid credentials')) {
                        await appAlert('البريد الإلكتروني أو كلمة المرور غير صحيحة');
                    } else if (error.message.includes('User not found')) {
                        await appAlert('هذا البريد الإلكتروني غير مسجل. يرجى إنشاء حساب أولاً.');
                    } else {
                        await appAlert('خطأ في تسجيل الدخول: ' + error.message);
                    }
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
                    return;
                }

                const { data: profile, error: profileError } = await supabaseClient
                    .from('users')
                    .select('*')
                    .eq('id', data.user.id)
                    .maybeSingle();

                console.log('Profile query result:', profile, 'Error:', profileError);

                if (profileError) {
                    throw profileError;
                }

                console.log('Profile status before check:', profile?.status);

                if (!profile) {
                    await supabaseClient.auth.signOut();
                    clearCurrentUserCache();
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
                    await appAlert('الحساب محذوف أو معطل أو لم تكتمل بياناته. يرجى التواصل مع الإدارة.');
                    return;
                }

                if (profile.role === 'technician' && (profile.status === 'pending' || profile.status === 'inactive')) {
                    await appAlert('حسابك غير نشط. تواصل مع الإدارة.');
                    await supabaseClient.auth.signOut();
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
                    return;
                }
                
                if (profile.role === 'customer' && profile.status === 'inactive') {
                    await appAlert('حسابك غير نشط. تواصل مع الإدارة.');
                    await supabaseClient.auth.signOut();
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
                    return;
                }

                setCurrentUserCache(profile);

                if (profile.role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                } else if (profile.role === 'technician') {
                    window.location.href = 'technician-dashboard.html';
                } else {
                    window.location.href = 'customer-dashboard.html';
                }
            } catch (err) {
                console.error('Login error:', err);
                await appAlert('حدث خطأ، حاول مرة أخرى');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
            }
        });
    }
});
