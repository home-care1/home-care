document.addEventListener('DOMContentLoaded', async function() {
    const TECHNICIAN_CV_BUCKET = 'technician-cvs';
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'technician') {
        window.location.href = 'login.html';
        return;
    }

    loadProfile();

    loadNotifDropdown();
    setInterval(loadNotifDropdown, 15000);

    const profileForm = document.getElementById('profileForm');
    const cvReplaceInput = document.getElementById('cvReplaceInput');
    const chooseCvBtn = document.getElementById('chooseCvBtn');
    const replaceCvBtn = document.getElementById('replaceCvBtn');
    const cvCurrentFileName = document.getElementById('cvCurrentFileName');
    const saveProfileBtn = document.querySelector('button[type="submit"][form="profileForm"]');

    function getFileExtension(fileName) {
        if (!fileName || !fileName.includes('.')) return '';
        return `.${fileName.split('.').pop().toLowerCase()}`;
    }

    function setReplaceCvButtonState() {
        if (!replaceCvBtn || !cvReplaceInput) return;
        replaceCvBtn.disabled = !cvReplaceInput.files || cvReplaceInput.files.length === 0;
    }

    async function getTechnicianCvFile(userId) {
        const { data: files, error } = await supabaseClient.storage
            .from(TECHNICIAN_CV_BUCKET)
            .list(userId);

        if (error || !Array.isArray(files) || files.length === 0) {
            return null;
        }

        return files.find(file => file.name.toLowerCase().startsWith('cv')) || files[0];
    }

    async function refreshCvInfo() {
        if (!cvCurrentFileName) return;
        const cvFile = await getTechnicianCvFile(currentUser.id);
        cvCurrentFileName.textContent = cvFile
            ? `الملف الحالي: ${cvFile.name}`
            : 'لا يوجد CV مرفق حاليا';
    }

    async function replaceTechnicianCv() {
        if (!cvReplaceInput || !cvReplaceInput.files || cvReplaceInput.files.length === 0) {
            showAlert('يرجى اختيار ملف CV أولا', 'error');
            return;
        }

        const selectedFile = cvReplaceInput.files[0];
        const extension = getFileExtension(selectedFile.name);
        const newFilePath = `${currentUser.id}/cv${extension}`;

        replaceCvBtn.disabled = true;
        chooseCvBtn.disabled = true;
        replaceCvBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

        try {
            const { data: existingFiles } = await supabaseClient.storage
                .from(TECHNICIAN_CV_BUCKET)
                .list(currentUser.id);

            if (Array.isArray(existingFiles) && existingFiles.length > 0) {
                const oldPaths = existingFiles.map(file => `${currentUser.id}/${file.name}`);
                await supabaseClient.storage
                    .from(TECHNICIAN_CV_BUCKET)
                    .remove(oldPaths);
            }

            const { error: uploadError } = await supabaseClient.storage
                .from(TECHNICIAN_CV_BUCKET)
                .upload(newFilePath, selectedFile, {
                    upsert: true,
                    contentType: selectedFile.type || 'application/octet-stream'
                });

            if (uploadError) {
                throw new Error(uploadError.message || 'فشل رفع ملف السيرة الذاتية');
            }

            cvReplaceInput.value = '';
            setReplaceCvButtonState();
            await refreshCvInfo();
            showAlert('تم استبدال ملف CV بنجاح', 'success');
        } catch (error) {
            showAlert(`تعذر استبدال ملف CV: ${error.message || 'خطأ غير معروف'}`, 'error');
        } finally {
            chooseCvBtn.disabled = false;
            replaceCvBtn.disabled = false;
            replaceCvBtn.innerHTML = '<i class="fas fa-upload"></i> استبدال CV';
            setReplaceCvButtonState();
        }
    }

    if (chooseCvBtn && cvReplaceInput) {
        chooseCvBtn.addEventListener('click', function() {
            cvReplaceInput.click();
        });
    }

    if (cvReplaceInput) {
        cvReplaceInput.addEventListener('change', function() {
            setReplaceCvButtonState();
            if (cvCurrentFileName && this.files && this.files[0]) {
                cvCurrentFileName.textContent = `الملف المحدد: ${this.files[0].name}`;
            }
        });
    }

    if (replaceCvBtn) {
        replaceCvBtn.addEventListener('click', replaceTechnicianCv);
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (saveProfileBtn) {
                saveProfileBtn.disabled = true;
                saveProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
            }
            
            const name = document.getElementById('profileNameInput').value;
            const phone = document.getElementById('profilePhoneInput').value;
            const email = document.getElementById('profileEmailInput').value;
            const profession = document.getElementById('profileProfessionInput').value;
            const bio = document.getElementById('profileBioTextarea').value;

            const updateData = {
                name: name,
                phone: phone,
                email: email,
                bio: bio
            };
            
            if (profession) {
                updateData.profession = profession;
            }

            await updateUser(currentUser.id, updateData);

            if (saveProfileBtn) {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';
            }
            
            showAlert('تم حفظ التغييرات بنجاح', 'success');
            
            loadProfile();
        });
    }

    async function loadProfile() {
        const user = await findUserById(currentUser.id);
        
        if (user) {
            document.getElementById('profileName').textContent = user.name || '---';
            document.getElementById('profileRole').textContent = 'فني صيانة';
            document.getElementById('profileEmail').textContent = user.email || '---';

            document.getElementById('profileNameInput').value = user.name || '';
            document.getElementById('profilePhoneInput').value = user.phone || '';
            document.getElementById('profileEmailInput').value = user.email || '';
            document.getElementById('profileProfessionInput').value = user.profession || '';
            document.getElementById('profileBioTextarea').value = user.bio || '';
        }

        await refreshCvInfo();
    }

    function showAlert(message, type) {
        const alert = document.getElementById('profileAlert');
        if (alert) {
            alert.textContent = message;
            alert.className = `alert alert-${type} show`;
            
            setTimeout(() => {
                alert.classList.remove('show');
            }, 3000);
        }
    }
});
