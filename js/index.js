document.addEventListener('DOMContentLoaded', async function () {
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', function () {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');

    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', function () {
            navMenu.classList.toggle('show');
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.service-card, .feature-card, .step-card').forEach(el => {
        observer.observe(el);
    });

    await updateNavbar();
});

async function logout() {
    await supabaseClient.auth.signOut();
    clearCurrentUserCache();
    window.location.href = 'index.html';
}

async function updateNavbar() {
    const currentUser = await ensureCurrentUser();
    const navMenu = document.getElementById('navMenu');
    if (currentUser && navMenu) {
        let dashboardLink = 'login.html';
        if (currentUser.role === 'admin') dashboardLink = 'admin-dashboard.html';
        else if (currentUser.role === 'technician') dashboardLink = 'technician-dashboard.html';
        else if (currentUser.role === 'customer') dashboardLink = 'customer-dashboard.html';
        
        navMenu.innerHTML = `
            <li><a href="#services" class="nav-link">الخدمات</a></li>
            <li><a href="#features" class="nav-link">مميزاتنا</a></li>
            <li><a href="#how-it-works" class="nav-link">كيف يعمل</a></li>
            <li><a href="${dashboardLink}" class="nav-link">لوحة التحكم</a></li>
            <li><a href="#" class="nav-btn" onclick="logout()">خروج</a></li>
        `;
    }
}
async function submitComplaint(e) {
    e.preventDefault();
    const text = document.getElementById('complaintText').value.trim();
    if (!text) return;
    
    try {
        const currentUser = await ensureCurrentUser();
        const userName = currentUser?.name || 'مستخدم غير معروف';
        
        const { error } = await supabaseClient
            .from('complaints')
            .insert([
                {
                    text: text,
                    user_name: userName,
                    user_id: currentUser?.id || null,
                    status: 'pending'
                }
            ]);
        
        if (error) throw error;
        
        document.getElementById('complaintText').value = '';
        await appAlert('تم إرسال شكواك بنجاح، شكراً لتواصلك معنا.');
    } catch (err) {
        console.error('Error submitting complaint:', err);
        await appAlert('حدث خطأ أثناء إرسال الشكوى. يرجى المحاولة مرة أخرى.');
    }
}