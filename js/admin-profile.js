fetch('navbar-admin.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('navbar-container').innerHTML = data;
        loadNotifDropdown();
    });

document.addEventListener('DOMContentLoaded', async function () {
    const currentUser = await ensureCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    loadProfile();

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const btn = profileForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            const name = document.getElementById('profileNameInput').value;
            const phone = document.getElementById('profilePhoneInput').value;
            const email = document.getElementById('profileEmailInput').value;

            await updateUser(currentUser.id, {
                name: name,
                phone: phone,
                email: email
            });

            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';

            showAlert('تم حفظ التغييرات بنجاح', 'success');

            loadProfile();
        });
    }

    async function loadProfile() {
        const user = await findUserById(currentUser.id);

        if (user) {
            document.getElementById('profileName').textContent = user.name || '---';
            document.getElementById('profileRole').textContent = 'مدير';
            document.getElementById('profileEmail').textContent = user.email || '---';

            document.getElementById('profileNameInput').value = user.name || '';
            document.getElementById('profilePhoneInput').value = user.phone || '';
            document.getElementById('profileEmailInput').value = user.email || '';
        }
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
