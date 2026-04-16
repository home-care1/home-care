document.addEventListener('DOMContentLoaded', function () {
    const TECHNICIAN_CV_BUCKET = 'technician-cvs';
    const registerForm = document.getElementById('registerForm');
    const roleSelect = document.getElementById('registerRole');
    const professionGroup = document.getElementById('professionGroup');
    const cvGroup = document.getElementById('cvGroup');
    const technicianCvInput = document.getElementById('technicianCv');
    const phoneInput = document.getElementById('registerPhone');
    const specialtyCheckboxes = document.querySelectorAll('input[name="specialty"]');
    const otherSpecialtyOption = document.getElementById('otherSpecialtyOption');
    const otherSpecialtyInput = document.getElementById('otherSpecialtyInput');
    const customModal = document.getElementById('customModal');
    const customModalTitle = document.getElementById('customModalTitle');
    const customModalMessage = document.getElementById('customModalMessage');
    const customModalBtn = document.getElementById('customModalBtn');

    function showCustomModal(message, title = 'تنبيه') {
        if (!customModal || !customModalTitle || !customModalMessage || !customModalBtn) {
            return appAlert(message, title);
        }

        customModalTitle.textContent = title;
        customModalMessage.textContent = message;
        customModal.style.display = 'flex';

        return new Promise((resolve) => {
            const closeModal = () => {
                customModal.style.display = 'none';
                customModalBtn.removeEventListener('click', closeModal);
                resolve();
            };
            customModalBtn.addEventListener('click', closeModal);
        });
    }

    function toggleOtherSpecialtyInput() {
        if (!otherSpecialtyOption || !otherSpecialtyInput || roleSelect.value !== 'technician') return;
        const isOtherChecked = otherSpecialtyOption.checked;
        otherSpecialtyInput.style.display = isOtherChecked ? 'block' : 'none';
        if (!isOtherChecked) {
            otherSpecialtyInput.value = '';
        }
    }

    function resetSpecialties() {
        specialtyCheckboxes.forEach((checkbox) => {
            checkbox.checked = false;
        });
        if (otherSpecialtyInput) {
            otherSpecialtyInput.style.display = 'none';
            otherSpecialtyInput.value = '';
        }
    }

    function getFileExtension(fileName) {
        if (!fileName || !fileName.includes('.')) return '';
        return `.${fileName.split('.').pop().toLowerCase()}`;
    }

    async function uploadTechnicianCv(file, userId) {
        const extension = getFileExtension(file.name);
        const filePath = `${userId}/cv${extension}`;
        const { error } = await supabaseClient.storage
            .from(TECHNICIAN_CV_BUCKET)
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type || 'application/octet-stream'
            });

        if (error) {
            throw new Error(`تعذر رفع ملف السيرة الذاتية: ${error.message || 'خطأ غير معروف'}`);
        }
    }

    if (roleSelect && professionGroup) {
        roleSelect.addEventListener('change', function () {
            if (this.value === 'technician') {
                professionGroup.style.display = 'block';
                if (cvGroup) {
                    cvGroup.style.display = 'block';
                }
                if (technicianCvInput) {
                    technicianCvInput.required = true;
                }
            } else {
                professionGroup.style.display = 'none';
                resetSpecialties();
                if (cvGroup) {
                    cvGroup.style.display = 'none';
                }
                if (technicianCvInput) {
                    technicianCvInput.required = false;
                    technicianCvInput.value = '';
                }
            }
        });
    }

    specialtyCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', function () {
            if (this.id === 'otherSpecialtyOption') {
                toggleOtherSpecialtyInput();
            }
        });
    });

    if (phoneInput) {
        phoneInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const phone = document.getElementById('registerPhone').value;
            const password = document.getElementById('registerPassword').value;
            const role = document.getElementById('registerRole').value;
            const btn = registerForm.querySelector('button[type="submit"]');
            let profession = '';
            const cvFile = technicianCvInput && technicianCvInput.files ? technicianCvInput.files[0] : null;

            if (role === 'technician') {
                const selectedSpecialties = Array.from(specialtyCheckboxes)
                    .filter((checkbox) => checkbox.checked)
                    .map((checkbox) => checkbox.value);

                if (selectedSpecialties.length === 0) {
                    await appAlert('يرجى اختيار تخصص واحد على الأقل');
                    return;
                }

                const includesOther = selectedSpecialties.includes('أخرى');
                const otherSpecialtyValue = otherSpecialtyInput ? otherSpecialtyInput.value.trim() : '';

                if (includesOther && !otherSpecialtyValue) {
                    await appAlert('يرجى كتابة التخصص في حقل أخرى');
                    return;
                }

                if (!cvFile) {
                    await appAlert('يرجى إرفاق السيرة الذاتية (CV)');
                    return;
                }

                const normalizedSpecialties = selectedSpecialties.filter((item) => item !== 'أخرى');
                if (includesOther) {
                    normalizedSpecialties.push(otherSpecialtyValue);
                }

                profession = normalizedSpecialties.join('، ');
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });

                console.log('SignUp result:', data, 'SignUp error:', error);

                if (error) {
                    console.log('SignUp error:', error);
                    if (error.message.includes('already registered')) {
                        await appAlert('هذا البريد الإلكتروني مسجل بالفعل');
                    } else {
                        await appAlert('حدث خطأ: ' + error.message);
                    }
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء الحساب';
                    return;
                }

                console.log('User created with ID:', data.user.id);

                if (role === 'technician' && cvFile) {
                    await uploadTechnicianCv(cvFile, data.user.id);
                }

                const userData = {
                    id: data.user.id,
                    name: name,
                    email: email,
                    phone: phone,
                    role: role,
                    profession: profession,
                    status: role === 'technician' ? 'pending' : 'active'
                };

                const { data: insertData, error: insertError } = await supabaseClient
                    .from('users')
                    .insert([userData])
                    .select();

                console.log('Insert result:', insertData, 'Insert error:', insertError);

                if (insertError) {
                    if (insertError.code === '409' || insertError.message.includes('duplicate')) {
                        await appAlert('هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.');
                        window.location.href = 'login.html';
                        return;
                    }
                    await appAlert('خطأ في حفظ البيانات: ' + insertError.message);
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء الحساب';
                    return;
                }

                if (role === 'technician') {
                    await saveAdminNotification(
                        'فني جديد بانتظار التفعيل',
                        `قام الفني ${name} بإنشاء حساب جديد بانتظار مراجعة الإدارة`,
                        'fas fa-user-plus',
                        'orange',
                        'admin_user_pending',
                        data.user.id
                    );
                    await supabaseClient.auth.signOut();
                    await showCustomModal(
                        'تم إنشاء حسابك بنجاح!\nحسابك قيد الانتظار وسيتم تفعيله من قبل الإدارة قريباً.',
                        'إنشاء الحساب بنجاح!'
                    );
                    window.location.href = 'login.html';
                } else {
                    setCurrentUserCache(userData);
                    window.location.href = 'customer-dashboard.html';
                }
            } catch (err) {
                await appAlert(err && err.message ? err.message : 'حدث خطأ، حاول مرة أخرى');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء الحساب';
            }
        });
    }
});
