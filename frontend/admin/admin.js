/* =========================================================
   DR. MUHAMMAD ZAHEER ANJUM CLINIC
   ADMIN DASHBOARD JAVASCRIPT
   Full-Stack REST Integration & Interactive Page Routing
========================================================= */

const API_BASE = "/api";

const state = {
    token: localStorage.getItem("mza_admin_token") || null,
    currentPage: "overview",
    appointments: [],
    reports: [],
    patients: [],
    offDays: [],
    blockedSlots: [],
    specialSchedules: [],
    treatments: [],
    consultations: [],
    staffMessages: [],
    emergencyAlerts: [],
    stats: null,
    activeStaffConversation: null,
    conversationPollInterval: null,
    leads: [],
    leadStats: null,
    currentLead: null,
    leadFilters: {
        search: '',
        source: '',
        status: '',
        mode: '',
        priority: ''
    }
};

// DOM References
const adminSidebar = document.getElementById("adminSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileMenuButton = document.getElementById("mobileMenuButton");
const refreshDashboardButton = document.getElementById("refreshDashboardButton");
const overviewPage = document.getElementById("overviewPage");
const dynamicAdminPage = document.getElementById("dynamicAdminPage");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

// Headers helper
function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = state.token || localStorage.getItem("mza_admin_token");
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupMobileToggle();
    setupRefreshButton();
    setupLogoutButton();

    const isAuth = await checkAuthGuard();
    if (!isAuth) return;

    await loadDashboardData();
    setupRealTimeAutoSync();
});

let autoSyncInterval = null;
function setupRealTimeAutoSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    autoSyncInterval = setInterval(async () => {
        if (!document.hidden) {
            await Promise.all([
                fetchAppointments(),
                fetchReports(),
                fetchStats()
            ]);
            updateOverviewDOM();
            if (state.currentPage === "appointments") {
                renderAppointmentsPage();
            } else if (state.currentPage === "reports") {
                renderReportsPage();
            }
        }
    }, 3000);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            loadDashboardData();
        }
    });

    window.addEventListener("focus", () => {
        loadDashboardData();
    });
}

async function checkAuthGuard() {
    const token = localStorage.getItem("mza_admin_token");
    if (!token) {
        window.location.replace("login.html");
        return false;
    }
    state.token = token;
    try {
        const res = await adminFetch(`${API_BASE}/auth/me`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });
        const json = await res.json();
        if (!json.success) {
            localStorage.removeItem("mza_admin_token");
            localStorage.removeItem("mza_admin_user");
            window.location.replace("login.html");
            return false;
        }
        return true;
    } catch (e) {
        return true;
    }
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await adminFetch(`${API_BASE}/auth/logout`, { method: "POST" });
            } catch (e) {}
            localStorage.removeItem("mza_admin_token");
            localStorage.removeItem("mza_admin_user");
            window.location.replace("login.html");
        });
    }
}

// Setup Sidebar Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item[data-page]");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");

            const page = item.dataset.page;
            state.currentPage = page;
            navigateToPage(page);

            // Mobile menu close
            if (window.innerWidth <= 900) {
                adminSidebar?.classList.remove("open");
                sidebarOverlay?.classList.remove("show");
            }
        });
    });

    // View All button on overview
    document.querySelectorAll("[data-open-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPage = btn.dataset.openPage;
            const navBtn = document.querySelector(`.nav-item[data-page="${targetPage}"]`);
            if (navBtn) navBtn.click();
        });
    });
}

function setupMobileToggle() {
    mobileMenuButton?.addEventListener("click", () => {
        adminSidebar?.classList.toggle("open");
        sidebarOverlay?.classList.toggle("show");
    });

    sidebarOverlay?.addEventListener("click", () => {
        adminSidebar?.classList.remove("open");
        sidebarOverlay?.classList.remove("show");
    });
}

function setupRefreshButton() {
    refreshDashboardButton?.addEventListener("click", () => {
        refreshDashboardButton.style.transform = "rotate(360deg)";
        refreshDashboardButton.style.transition = "transform 0.5s ease";
        setTimeout(() => { refreshDashboardButton.style.transform = "none"; }, 500);
        loadDashboardData();
    });
}

// Load All Backend Data
async function loadDashboardData() {
    try {
        await Promise.all([
            fetchStats(),
            fetchAppointments(),
            fetchReports(),
            fetchPatients(),
            fetchOffDays(),
            fetchBlockedSlots(),
            fetchTreatments(),
            fetchConsultations(),
            fetchStaffInbox(),
            fetchEmergencyAlerts(),
            fetchLeads(),
            fetchLeadStats()
        ]);
        updateOverviewDOM();
        navigateToPage(state.currentPage);
    } catch (e) {
        console.error("Dashboard Data Loading Error:", e);
    }
}

// API Fetch Functions
async function fetchStats() {
    try {
        const res = await adminFetch(`${API_BASE}/dashboard/stats`);
        const json = await res.json();
        if (json.success) state.stats = json.data;
    } catch (e) {}
}

async function fetchAppointments() {
    try {
        const res = await adminFetch(`${API_BASE}/appointments`);
        const json = await res.json();
        if (json.success) {
            state.appointments = json.data;
            const countEl = document.getElementById("appointmentNavCount");
            if (countEl) countEl.textContent = state.appointments.length;
        }
    } catch (e) {}
}

async function fetchReports() {
    try {
        const res = await adminFetch(`${API_BASE}/reports`);
        const json = await res.json();
        if (json.success) {
            state.reports = json.data;
            const countEl = document.getElementById("reportNavCount");
            if (countEl) countEl.textContent = state.reports.filter(r => r.status === 'new').length;
        }
    } catch (e) {}
}

async function fetchPatients() {
    try {
        const res = await adminFetch(`${API_BASE}/patients`);
        const json = await res.json();
        if (json.success) state.patients = json.data;
    } catch (e) {}
}

async function fetchOffDays() {
    try {
        const res = await adminFetch(`${API_BASE}/clinics/off-days`);
        const json = await res.json();
        if (json.success) state.offDays = json.data;
    } catch (e) {}
}

async function fetchBlockedSlots() {
    try {
        const res = await adminFetch(`${API_BASE}/clinics/blocked-slots`);
        const json = await res.json();
        if (json.success) state.blockedSlots = json.data;
    } catch (e) {}
}

async function fetchTreatments() {
    try {
        const res = await adminFetch(`${API_BASE}/treatments`);
        const json = await res.json();
        if (json.success) state.treatments = json.data;
    } catch (e) {}
}

async function fetchConsultations() {
    try {
        const res = await adminFetch(`${API_BASE}/consultations`);
        const json = await res.json();
        if (json.success) state.consultations = json.data;
    } catch (e) {}
}

async function fetchStaffInbox() {
    try {
        const res = await adminFetch(`${API_BASE}/staff/inbox`);
        const json = await res.json();
        if (json.success) {
            state.staffMessages = json.data;
            const countEl = document.getElementById("inboxNavCount");
            if (countEl) countEl.textContent = state.staffMessages.filter(m => m.status === 'pending').length;
        }
    } catch (e) {}
}

async function fetchEmergencyAlerts() {
    try {
        const res = await adminFetch(`${API_BASE}/staff/emergency`);
        const json = await res.json();
        if (json.success) {
            state.emergencyAlerts = json.data;
            const countEl = document.getElementById("emergencyNavCount");
            if (countEl) countEl.textContent = state.emergencyAlerts.filter(a => a.status === 'open').length;
        }
    } catch (e) {}
}

// Update DOM elements on the static Overview page
function updateOverviewDOM() {
    const s = state.stats || {
        todayAppointments: state.appointments.length,
        confirmed: state.appointments.filter(a => a.status === 'confirmed').length,
        completed: state.appointments.filter(a => a.status === 'completed').length,
        cancelled: state.appointments.filter(a => a.status === 'cancelled').length,
        noShows: state.appointments.filter(a => a.status === 'no-show').length,
        availableSlotsToday: 16,
        blockedSlotsCount: state.blockedSlots.length,
        upcomingDoctorLeave: state.offDays.length,
        pendingConsultations: state.consultations.filter(c => c.status === 'pending').length,
        humanHandovers: state.staffMessages.filter(m => m.status === 'pending').length,
        pendingEmergencyAlerts: state.emergencyAlerts.filter(e => e.status === 'open').length,
        pendingReportsReview: state.reports.filter(r => r.status === 'new').length,
        integrations: {
            database: "CONNECTED",
            whatsapp: "SIMULATION ACTIVE",
            appointmentApi: "CONNECTED",
            reminderStatus: "ENABLED",
            fileStorage: "CONNECTED",
            aiStatus: "ACTIVE"
        }
    };

    setElText("todayAppointments", s.todayAppointments);
    setElText("confirmedAppointments", s.confirmed);
    setElText("completedAppointments", s.completed);
    setElText("cancelledAppointments", s.cancelled);
    setElText("noShowAppointments", s.noShows);
    setElText("availableSlots", s.availableSlotsToday);
    setElText("blockedSlots", s.blockedSlotsCount);
    setElText("doctorLeave", s.upcomingDoctorLeave);
    setElText("pendingConsultations", s.pendingConsultations);
    setElText("humanHandovers", s.humanHandovers);
    setElText("pendingEmergencyAlerts", s.pendingEmergencyAlerts);
    setElText("pendingReports", s.pendingReportsReview);

    // Integrations
    setBadgeStatus("databaseStatus", s.integrations?.database || "CONNECTED");
    setBadgeStatus("whatsappStatus", s.integrations?.whatsapp || "SIMULATION ACTIVE");
    setBadgeStatus("appointmentApiStatus", s.integrations?.appointmentApi || "CONNECTED");
    setBadgeStatus("reminderStatus", s.integrations?.reminderSystem || "ENABLED");
    setBadgeStatus("fileStorageStatus", s.integrations?.fileStorage || "CONNECTED");
    setBadgeStatus("aiStatus", s.integrations?.aiAssistant || "ACTIVE");
    setBadgeStatus("adsAutomationStatus", s.integrations?.adsLeadAutomation || "ACTIVE");

    // Recent Appointments Table
    const tableBody = document.getElementById("recentAppointmentsTable");
    if (tableBody) {
        if (state.appointments.length === 0) {
            tableBody.innerHTML = `
                <tr class="empty-table-row">
                    <td colspan="8">
                        <div class="empty-state">
                            <div class="empty-state-icon">📅</div>
                            <strong>No appointments yet</strong>
                            <p>New appointments will appear here automatically.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = state.appointments.slice(0, 5).map(app => `
                <tr>
                    <td><strong>${app.tokenNumber}</strong></td>
                    <td><code>${app.appointmentId}</code></td>
                    <td><strong>${app.patientName}</strong><small class="text-muted">${app.scheduleReviewRequired ? "ADMIN REVIEW REQUIRED: schedule conflict - " : ""}${app.doctorName || ""} · ${app.source || ""}</small></td>
                    <td>${app.phone}</td>
                    <td>${app.appointmentType}</td>
                    <td>${app.date} \| ${app.time}</td>
                    <td>${app.clinic || 'Clinic not recorded'}</td>
                    <td><span class="status-badge ${app.status.toLowerCase()}">${app.status.toUpperCase()}</span></td>
                </tr>
            `).join("");
        }
    }
}

function setElText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setBadgeStatus(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
        el.className = "integration-badge connected";
        if (text.includes("NOT") || text.includes("DISCONNECTED")) el.className = "integration-badge not-configured";
        if (text.includes("SIMULATION")) el.className = "integration-badge simulation";
    }
}

// Router for switching sidebar pages
function navigateToPage(page) {
    if (page !== "staff-inbox" && state.conversationPollInterval) {
        clearInterval(state.conversationPollInterval);
        state.conversationPollInterval = null;
        state.activeStaffConversation = null;
    }
    if (page === "overview") {
        if (overviewPage) overviewPage.style.display = "block";
        if (dynamicAdminPage) dynamicAdminPage.style.display = "none";
        if (pageTitle) pageTitle.textContent = "Clinic Overview";
        if (pageSubtitle) pageSubtitle.textContent = "Real-time clinic management dashboard";
        updateOverviewDOM();
    } else {
        if (overviewPage) overviewPage.style.display = "none";
        if (dynamicAdminPage) {
            dynamicAdminPage.style.display = "block";
            renderDynamicPage(page);
        }
    }
}

// Render dynamic sub-pages
function renderDynamicPage(page) {
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 60);
    switch (page) {
        case "appointments":
            renderAppointmentsPage();
            break;
        case "calendar":
            renderCalendarPage();
            break;
        case "patients":
            renderPatientsPage();
            break;
        case "doctor-profile":
            renderDoctorProfilePage();
            break;
        case "clinics":
            renderClinicsPage();
            break;
        case "weekly-schedule":
            renderWeeklySchedulePage();
            break;
        case "off-days":
            renderOffDaysPage();
            break;
        case "special-schedules":
            renderSpecialSchedulesPage();
            break;
        case "blocked-slots":
            renderBlockedSlotsPage();
            break;
        case "services":
            renderServicesPage();
            break;
        case "reports":
            renderReportsPage();
            break;
        case "virtual-consultation":
            renderVirtualConsultationsPage();
            break;
        case "emergency-alerts":
            renderEmergencyAlertsPage();
            break;
        case "staff-inbox":
            renderStaffInboxPage();
            break;
        case "ads-leads":
            renderAdsLeadsPage();
            break;
        default:
            renderAppointmentsPage();
    }
}

// 1. Appointments Page
function renderAppointmentsPage() {
    if (pageTitle) pageTitle.textContent = "Appointments Directory";
    if (pageSubtitle) pageSubtitle.textContent = "Live appointment records & status management";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <div>
                    <h3>Live Appointments</h3>
                    <p>Manage, confirm, complete, or cancel appointments</p>
                </div>
                <input type="text" class="form-input" id="appSearchInput" placeholder="Search patient, phone, ID..." style="max-width: 260px;" onkeyup="filterAppointmentsTable()">
            </div>
            <div class="table-wrapper">
                <table class="admin-table" id="adminAppTable">
                    <thead>
                        <tr>
                            <th>Token</th>
                            <th>ID</th>
                            <th>Patient Name</th>
                            <th>Phone</th>
                            <th>Type</th>
                            <th>Clinic</th>
                            <th>Date & Time</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.appointments.length ? state.appointments.map(app => `
                            <tr>
                                <td><strong>${app.tokenNumber}</strong></td>
                                <td><code>${app.appointmentId}</code></td>
                                <td><strong>${app.patientName}</strong><small class="text-muted">${app.scheduleReviewRequired ? "ADMIN REVIEW REQUIRED: schedule conflict - " : ""}${app.doctorName || ""} · ${app.source || ""}</small></td>
                                <td>${app.phone}</td>
                                <td>${app.appointmentType}</td>
                                <td>${app.clinic}</td>
                                <td>${app.date} | ${app.time}</td>
                                <td><span class="status-badge ${app.status.toLowerCase()}">${app.status.toUpperCase()}</span></td>
                                <td>
                                    <div class="action-btn-group">
                                        <button class="btn-action green" onclick="changeAppStatus('${app._id}', 'confirmed')">Confirm</button>
                                        <button class="btn-action purple" onclick="changeAppStatus('${app._id}', 'completed')">Complete</button>
                                        <button class="btn-action red" onclick="changeAppStatus('${app._id}', 'cancelled')">Cancel</button><button class="btn-action blue" onclick="rescheduleAdminAppointment('${app._id}')">Reschedule</button>
                                    </div>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📅</div><strong>No appointments found</strong><p>Bookings will appear here live from backend.</p></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function changeAppStatus(id, newStatus) {
    try {
        const res = await adminFetch(`${API_BASE}/appointments/${id}/status`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();
        if (json.success) {
            await fetchAppointments();
            renderAppointmentsPage();
        }
    } catch (e) {
        alert("Failed to update status.");
    }
}

// 2. Calendar Page
function renderCalendarPage() {
    if (pageTitle) pageTitle.textContent = "Clinic Calendar";
    if (pageSubtitle) pageSubtitle.textContent = "Scheduled consultations by date";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 24px;">
            <div class="toolbar-row">
                <h3>Schedule Calendar Overview</h3>
                <input type="date" id="calendarDateFilter" class="form-input" style="max-width: 200px;" value="${new Date().toISOString().split('T')[0]}" onchange="renderCalendarPage()">
            </div>
            <div class="dashboard-statistics" style="margin-bottom: 0;">
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon green-icon">📅</div><span class="stat-label">Active</span></div>
                    <strong class="stat-number">${state.appointments.filter(a => a.status === 'confirmed').length}</strong>
                    <p>Confirmed Appointments</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon purple-icon">✔️</div><span class="stat-label">Done</span></div>
                    <strong class="stat-number">${state.appointments.filter(a => a.status === 'completed').length}</strong>
                    <p>Completed Visits</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon red-icon">🚫</div><span class="stat-label">Blocked</span></div>
                    <strong class="stat-number">${state.blockedSlots.length}</strong>
                    <p>Blocked Slots</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon orange-icon">🌴</div><span class="stat-label">Off-Days</span></div>
                    <strong class="stat-number">${state.offDays.length}</strong>
                    <p>Doctor Leaves</p>
                </div>
            </div>
        </div>
    `;
}

// 3. Patients Page
function renderPatientsPage() {
    if (pageTitle) pageTitle.textContent = "Patients Directory";
    if (pageSubtitle) pageSubtitle.textContent = "Registered patient records & history";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Patient Database</h3>
                <input type="text" class="form-input" placeholder="Search patients..." style="max-width: 260px;">
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Patient ID</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Total Bookings</th>
                            <th>Latest Visit</th>
                            <th>Registration Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.patients.length ? state.patients.map(p => `
                            <tr>
                                <td><code>${p.patientId}</code></td>
                                <td><strong>${p.name}</strong></td>
                                <td>${p.phone}</td>
                                <td><span class="status-badge confirmed">${p.totalAppointments || 1} Bookings</span></td>
                                <td>${p.latestAppointment || 'Recent'}</td>
                                <td>${p.createdAt ? p.createdAt.split('T')[0] : '2026-08-08'}</td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">👥</div><strong>No patient records</strong><p>Registered patients will be listed here.</p></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// 4. Doctor Profile Page
async function renderDoctorProfilePage() {
    if(pageTitle)pageTitle.textContent='Doctor Management';
    if(pageSubtitle)pageSubtitle.textContent='Approved profiles and real booking schedule';
    dynamicAdminPage.replaceChildren();
    const panel=document.createElement('div');panel.className='dashboard-panel';panel.style.padding='24px';dynamicAdminPage.append(panel);
    try {
        const response=await adminFetch('/api/knowledge/admin'),body=await response.json();if(!response.ok||!body.success)throw new Error();
        for(const doctor of body.data.doctors||[]){const title=document.createElement('h3');title.textContent=doctor.name;const details=document.createElement('p');details.textContent=(doctor.qualifications||[]).join(' | ')+' - '+(doctor.specialty||'Specialty not yet specified')+' · '+(doctor.active?'Active':'Inactive');panel.append(title,details);}
        const hours=document.createElement('p');hours.textContent='Appointment duration: '+body.data.schedule.slotMinutes+' minutes. '+Object.entries(body.data.schedule.weekly||{}).map(([day,s])=>day+': '+(s.active?s.open+'-'+s.close:'Closed')).join('; ')+'. Online booking: '+(body.data.schedule.bookingEnabled===false?'Disabled':'Enabled');panel.append(hours);
        const edit=document.createElement('button');edit.className='btn-primary';edit.textContent='Edit profile and schedule';edit.onclick=renderClinicsPage;panel.append(edit);
    }catch(_){panel.textContent='Unable to load doctor profiles. Please retry.';}
}

// 5. Clinics Page
async function renderClinicsPage() {
    if (pageTitle) pageTitle.textContent = 'Medical Complex Knowledge Base';
    if (pageSubtitle) pageSubtitle.textContent = 'Approved information shared by website chat and WhatsApp';
    dynamicAdminPage.replaceChildren();
    const panel = document.createElement('form'); panel.className = 'dashboard-panel'; panel.style.padding = '24px';
    const heading = document.createElement('h3'); heading.textContent = 'Verified clinic information';
    const notice = document.createElement('p'); notice.textContent = 'Only set verified to true after confirming information. Doctors and services require verified: true and active: true. Leave unknown details empty. Existing historical records are not imported automatically. Schedule times use HH:mm in Asia/Karachi. Use schedule.bookingEnabled to enable or disable booking; per-day breaks use [{"start":"13:00","end":"13:20"}]. Keep schedule.doctorId matched to the doctor id.';
    panel.append(heading,notice); dynamicAdminPage.append(panel);
    let data;
    try { const response = await adminFetch('/api/knowledge/admin'); const body = await response.json(); if (!response.ok || !body.success) throw new Error(); data = body.data; }
    catch (_) { notice.textContent = 'Unable to load knowledge settings. Check your admin session and database connection.'; return; }
    const inputs = {};
    const labels = { organization:'Organization',location:'Verified address and location',contact:'Verified phone, WhatsApp and email',schedule:'Verified operating hours and slot interval',doctors:'Verified doctor profiles',services:'Verified medical services',departments:'Medical departments',consultationFees:'Verified consultation fees',faqs:'Approved FAQs',bookingPolicies:'Approved booking policies',assistantInstructions:'AI style instructions (cannot override medical safety rules)' };
    for (const [key,label] of Object.entries(labels)) {
        const group = document.createElement('div'); group.className = 'form-group';
        const caption = document.createElement('label'); caption.textContent = label; caption.htmlFor = 'knowledge-' + key;
        const input = document.createElement('textarea'); input.id = caption.htmlFor; input.className = 'form-input'; input.rows = key === 'schedule' ? 12 : 5;
        input.value = key === 'assistantInstructions' ? (data[key] || '') : JSON.stringify(data[key] ?? (['doctors','services','departments','faqs'].includes(key) ? [] : {}),null,2);
        inputs[key] = input; group.append(caption,input); panel.append(group);
    }
    const button = document.createElement('button'); button.className = 'btn-primary'; button.type = 'submit'; button.textContent = 'Save approved knowledge';
    const status = document.createElement('p'); status.setAttribute('role','status'); panel.append(button,status);
    panel.addEventListener('submit', async event => {
        event.preventDefault(); button.disabled = true;
        try {
            const payload = Object.fromEntries(Object.entries(inputs).map(([key,input]) => [key,key === 'assistantInstructions' ? input.value : JSON.parse(input.value)]));
            const response = await adminFetch('/api/knowledge/admin',{method:'PUT',body:JSON.stringify(payload)}); const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to save knowledge.');
            status.textContent = 'Saved. New website and WhatsApp replies will use approved information immediately.';
        } catch (error) { status.textContent = error instanceof SyntaxError ? 'A field contains invalid JSON. Please check its syntax.' : error.message; }
        finally { button.disabled = false; }
    });
}

// 6. Weekly Schedule Page
function renderWeeklySchedulePage() { return renderClinicsPage(); }

// 7. Off-Days Page
function renderOffDaysPage() {
    if (pageTitle) pageTitle.textContent = "Doctor Off-Days";
    if (pageSubtitle) pageSubtitle.textContent = "Doctor leaves automatically removed from booking availability";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 22px;">
            <h3>Add Doctor Off-Day</h3>
            <div class="toolbar-row" style="margin-top: 14px; max-width: 600px;">
                <input type="date" id="offDayDate" class="form-input">
                <input type="text" id="offDayReason" class="form-input" placeholder="Reason (e.g. Medical Conference)">
                <button class="btn-primary" style="min-width: 130px;" onclick="addOffDaySubmit()">Add Leave</button>
            </div>
            <div class="table-wrapper" style="margin-top: 18px;">
                <table class="admin-table">
                    <thead>
                        <tr><th>Date</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.offDays.length ? state.offDays.map(o => `
                            <tr>
                                <td><strong>${o.date}</strong></td>
                                <td>${o.reason}</td>
                                <td><span class="status-badge cancelled">OFF-DAY</span></td>
                                <td><button class="btn-action red" onclick="removeOffDaySubmit('${o._id}')">Remove</button></td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">🗓</div><strong>No doctor off-days scheduled</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function addOffDaySubmit() {
    const date = document.getElementById("offDayDate").value;
    const reason = document.getElementById("offDayReason").value;
    if (!date) return alert("Please select an off-day date.");

    await adminFetch(`${API_BASE}/clinics/off-days`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, reason: reason || "Doctor Leave" })
    });
    await fetchOffDays();
    renderOffDaysPage();
}

async function removeOffDaySubmit(id) {
    await adminFetch(`${API_BASE}/clinics/off-days/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await fetchOffDays();
    renderOffDaysPage();
}

// 8. Special Schedules Page
function renderSpecialSchedulesPage() {
    if (pageTitle) pageTitle.textContent = "Special Schedules";
    if (pageSubtitle) pageSubtitle.textContent = "Override regular weekly schedule for specific dates";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 22px;">
            <h3>Add Special Schedule Override</h3>
            <div class="toolbar-row" style="margin-top: 14px; max-width: 700px;">
                <input type="date" id="spcDate" class="form-input">
                <input type="text" id="spcOpen" class="form-input" placeholder="Open (e.g. 2:00 PM)">
                <input type="text" id="spcClose" class="form-input" placeholder="Close (e.g. 6:00 PM)">
                <button class="btn-primary" style="min-width: 140px;" onclick="addSpecialScheduleSubmit()">Save Override</button>
            </div>
        </div>
    `;
}

async function addSpecialScheduleSubmit() {
    const date = document.getElementById("spcDate").value;
    const openingTime = document.getElementById("spcOpen").value;
    const closingTime = document.getElementById("spcClose").value;
    if (!date || !openingTime || !closingTime) return alert("Fill all fields.");

    await adminFetch(`${API_BASE}/clinics/special-schedules`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, openingTime, closingTime, reason: "Special Schedule Override" })
    });
    alert("Special schedule saved!");
}

// 9. Blocked Slots Page
function renderBlockedSlotsPage() {
    if (pageTitle) pageTitle.textContent = "Blocked Time Slots";
    if (pageSubtitle) pageSubtitle.textContent = "Block specific consultation slots on specific dates";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 22px;">
            <h3>Block Consultation Time Slot</h3>
            <div class="toolbar-row" style="margin-top: 14px; max-width: 650px;">
                <input type="date" id="blkDate" class="form-input">
                <input type="time" id="blkTime" class="form-input" step="60" aria-label="Time to block">
                <button class="btn-primary" style="min-width: 130px;" onclick="addBlockedSlotSubmit()">Block Slot</button>
            </div>
            <div class="table-wrapper" style="margin-top: 18px;">
                <table class="admin-table">
                    <thead>
                        <tr><th>Date</th><th>Time Slot</th><th>Reason</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.blockedSlots.length ? state.blockedSlots.map(b => `
                            <tr>
                                <td><strong>${b.date}</strong></td>
                                <td>${b.time}</td>
                                <td>${b.reason}</td>
                                <td><button class="btn-action green" onclick="removeBlockedSlotSubmit('${b._id}')">Unblock</button></td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">🚫</div><strong>No blocked time slots</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function addBlockedSlotSubmit() {
    const date = document.getElementById("blkDate").value;
    const time = document.getElementById("blkTime").value;
    if (!date || !time) return alert("Select date and time.");

    await adminFetch(`${API_BASE}/clinics/blocked-slots`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, time, reason: "Admin Blocked Slot" })
    });
    await fetchBlockedSlots();
    renderBlockedSlotsPage();
}

async function removeBlockedSlotSubmit(id) {
    await adminFetch(`${API_BASE}/clinics/blocked-slots/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await fetchBlockedSlots();
    renderBlockedSlotsPage();
}

// 10. Services / Treatments Page
function renderServicesPage() {
    if (pageTitle) pageTitle.textContent = "Services & Treatments";
    if (pageSubtitle) pageSubtitle.textContent = "Active clinical pain management, regenerative & aesthetic procedures";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Clinical Procedures List</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr><th>Treatment Title</th><th>Category</th><th>Description</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${state.treatments.length ? state.treatments.map(t => `
                            <tr>
                                <td><strong>${t.title}</strong></td>
                                <td><span class="status-badge reviewed">${t.category}</span></td>
                                <td>${t.description}</td>
                                <td><span class="status-badge ${t.active ? 'confirmed' : 'cancelled'}">${t.active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">🩺</div><strong>No treatments listed</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// 11. Uploaded Reports Page
function renderReportsPage() {
    if (pageTitle) pageTitle.textContent = "Uploaded Medical Reports";
    if (pageSubtitle) pageSubtitle.textContent = "Patient MRI, X-Ray, Prescriptions & Lab documents";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Medical Reports Directory</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Report ID</th>
                            <th>Patient Name</th>
                            <th>Phone</th>
                            <th>Token No.</th>
                            <th>Appt ID</th>
                            <th>Category</th>
                            <th>File Name</th>
                            <th>Upload Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.reports.length ? state.reports.map(r => {
                            const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleString() : 'Recent';
                            const targetId = r._id || r.reportId;
                            return `
                            <tr>
                                <td><code>${r.reportId}</code></td>
                                <td><strong>${r.patientName || 'Patient'}</strong></td>
                                <td>${r.phone}</td>
                                <td><strong>${r.token || 'N/A'}</strong></td>
                                <td><code>${r.appointmentId || 'N/A'}</code></td>
                                <td><span class="status-badge reviewed">${r.reportType}</span></td>
                                <td>${r.originalFileName}</td>
                                <td><small>${dateStr}</small></td>
                                <td><span class="status-badge ${r.status === 'reviewed' ? 'confirmed' : 'pending'}">${(r.status || 'NEW').toUpperCase()}</span></td>
                                <td>
                                    <div class="action-btn-group">
                                        <a href="${API_BASE}/reports/${targetId}/download" target="_blank" class="btn-action blue">View File</a>
                                        ${r.status === 'new' ? `<button class="btn-action green" onclick="markReportReviewedSubmit('${targetId}')">Mark Reviewed</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `; }).join("") : `
                            <tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">📄</div><strong>No uploaded reports</strong><p>Uploaded patient scans will appear here immediately.</p></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function markReportReviewedSubmit(id) {
    try {
        await adminFetch(`${API_BASE}/reports/${id}/review`, {
            method: "PATCH",
            headers: getAuthHeaders()
        });
        await fetchReports();
        renderReportsPage();
    } catch (e) {
        console.error("Error marking report reviewed:", e);
    }
}

// 12. Virtual Consultation Page
function renderVirtualConsultationsPage() {
    if (pageTitle) pageTitle.textContent = "Virtual Consultations";
    if (pageSubtitle) pageSubtitle.textContent = "Online clinic consultation booking requests";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Virtual Consultation Requests</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr><th>Request ID</th><th>Patient Name</th><th>Phone</th><th>Requested Date & Time</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.consultations.length ? state.consultations.map(c => `
                            <tr>
                                <td><code>${c.requestId}</code></td>
                                <td><strong>${c.patientName}</strong></td>
                                <td>${c.phone}</td>
                                <td>${c.preferredDate} | ${c.preferredTime}</td>
                                <td><span class="status-badge ${c.status === 'approved' ? 'confirmed' : 'pending'}">${c.status.toUpperCase()}</span></td>
                                <td>
                                    <div class="action-btn-group">
                                        <button class="btn-action green" onclick="updateConsultationSubmit('${c._id}', 'approved')">Approve</button>
                                        <button class="btn-action purple" onclick="updateConsultationSubmit('${c._id}', 'completed')">Complete</button>
                                    </div>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">💻</div><strong>No virtual consultation requests</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function updateConsultationSubmit(id, status) {
    await adminFetch(`${API_BASE}/consultations/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
    });
    await fetchConsultations();
    renderVirtualConsultationsPage();
}

// 13. Emergency Alerts Page
function renderEmergencyAlertsPage() {
    if (pageTitle) pageTitle.textContent = "Emergency Support Alerts";
    if (pageSubtitle) pageSubtitle.textContent = "Urgent staff-assistance alerts from patient chatbot";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Urgent Patient Alerts</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr><th>Patient Name</th><th>Phone</th><th>Alert Details</th><th>Priority</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.emergencyAlerts.length ? state.emergencyAlerts.map(e => `
                            <tr>
                                <td><strong>${e.patientName}</strong></td>
                                <td>${e.phone}</td>
                                <td>${e.message}</td>
                                <td><span class="status-badge cancelled">${e.priority.toUpperCase()}</span></td>
                                <td><span class="status-badge ${e.status === 'resolved' ? 'confirmed' : 'pending'}">${e.status.toUpperCase()}</span></td>
                                <td>
                                    <button class="btn-action green" onclick="resolveEmergencySubmit('${e._id}')">Resolve Alert</button>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">⚠</div><strong>No emergency alerts</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function resolveEmergencySubmit(id) {
    await adminFetch(`${API_BASE}/staff/emergency/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'resolved' })
    });
    await fetchEmergencyAlerts();
    renderEmergencyAlertsPage();
}

// 14. Staff Inbox Page
function renderStaffInboxPage() {
    if (pageTitle) pageTitle.textContent = "Staff Inbox";
    if (pageSubtitle) pageSubtitle.textContent = "Human assistance takeover & patient conversations";

    if (state.activeStaffConversation) {
        renderStaffConversationDetail();
        return;
    }

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <div>
                    <h3>Patient Conversations & Handover Inbox</h3>
                    <p style="font-size:12px; color:#64748B; margin-top:2px;">Manage AI Mode and Manual Doctor Takeover for each patient conversation</p>
                </div>
                <button class="btn-action blue" onclick="fetchStaffInbox().then(() => renderStaffInboxPage())">🔄 Refresh</button>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Patient Name</th>
                            <th>Phone / Session</th>
                            <th>Conversation Mode</th>
                            <th>Latest Message</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.staffMessages.length ? state.staffMessages.map(m => `
                            <tr>
                                <td><strong>${m.patientName || "Patient"}</strong></td>
                                <td>${m.phone || m.sessionId || "—"}</td>
                                <td>
                                    <span class="mode-badge ${m.mode === 'MANUAL' ? 'manual' : 'ai'}">
                                        ${m.mode === 'MANUAL' ? '👨‍⚕️ Manual Mode' : '🤖 AI Active'}
                                    </span>
                                </td>
                                <td style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                    ${m.lastMessage || m.message || "—"}
                                </td>
                                <td><span class="status-badge ${m.status === 'completed' ? 'confirmed' : (m.status === 'in-progress' ? 'completed' : 'pending')}">${(m.status || 'pending').toUpperCase()}</span></td>
                                <td>
                                    <div style="display:flex; gap:6px;">
                                        <button class="btn-action blue" onclick="openStaffConversation('${m._id}')">Open Chat</button>
                                        ${m.status !== 'completed' ? `<button class="btn-action green" onclick="completeStaffInboxSubmit('${m._id}')">Mark Done</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">💬</div><strong>No patient conversations found</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderStaffConversationDetail() {
    const conv = state.activeStaffConversation;
    if (!conv) return;

    const isManual = conv.mode === 'MANUAL';
    const messages = Array.isArray(conv.messages) ? conv.messages : [];

    dynamicAdminPage.innerHTML = `
        <div class="conversation-container">
            <div class="conversation-header-row">
                <div class="conv-patient-info">
                    <button class="btn-action" style="margin-bottom:6px;" onclick="closeStaffConversation()">← Back to Inbox</button>
                    <h3>${conv.patientName || "Patient"} <span style="font-size:13px; font-weight:normal; color:#64748B;">(${conv.phone || conv.sessionId || "Patient Chat"})</span></h3>
                    <p>Status: <strong>${(conv.status || 'pending').toUpperCase()}</strong> | Mode: <strong>${conv.mode || 'AI'}</strong> ${conv.manualTakeoverAt ? `| Takeover: ${new Date(conv.manualTakeoverAt).toLocaleTimeString()}` : ''}</p>
                </div>
                
                <div class="conv-header-actions">
                    <span class="mode-badge ${isManual ? 'manual' : 'ai'}">
                        ${isManual ? `👨‍⚕️ Manual Mode Active` : `🤖 AI Assistant Active`}
                    </span>
                    
                    ${isManual ? `
                        <button class="btn-action blue" onclick="returnToAIChat('${conv._id}')">
                            🤖 Return to AI
                        </button>
                    ` : `
                        <button class="btn-action orange" onclick="takeoverPatientChat('${conv._id}')">
                            ⚡ Take Over Manually
                        </button>
                    `}
                </div>
            </div>

            <div class="conversation-message-feed" id="adminConversationFeed">
                ${messages.length ? messages.map(msg => {
                    const sender = (msg.sender || 'PATIENT').toUpperCase();
                    let rowClass = 'patient';
                    let senderLabel = `👤 ${msg.senderName || 'Patient'}`;

                    if (sender === 'AI') {
                        rowClass = 'ai';
                        senderLabel = '🤖 Dr. Zaheer AI Assistant';
                    } else if (sender === 'DOCTOR') {
                        rowClass = 'doctor';
                        senderLabel = `👨‍⚕️ ${msg.senderName || 'Dr. Muhammad Zaheer Anjum'} (Doctor)`;
                    } else if (sender === 'STAFF') {
                        rowClass = 'system';
                        senderLabel = '⚙️ System';
                    }

                    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    return `
                        <div class="chat-msg-row ${rowClass}">
                            <div class="chat-msg-sender">${senderLabel}</div>
                            <div class="chat-msg-bubble">
                                ${msg.text}
                            </div>
                            <div class="chat-msg-time">${timeStr}</div>
                        </div>
                    `;
                }).join("") : `
                    <div class="empty-state" style="padding:20px;">
                        <div class="empty-state-icon">💬</div>
                        <strong>No messages yet in this conversation</strong>
                    </div>
                `}
            </div>

            <div class="conversation-composer-box">
                <div class="conversation-composer-row">
                    <input 
                        type="text" 
                        id="doctorReplyInput" 
                        placeholder="Type manual response to patient as Dr. Muhammad Zaheer Anjum..." 
                        autocomplete="off"
                        onkeydown="if(event.key==='Enter') sendDoctorReply('${conv._id}')"
                    >
                    <button class="btn-primary" onclick="sendDoctorReply('${conv._id}')" style="height:42px; padding:0 20px; white-space:nowrap;">
                        Send Reply ➤
                    </button>
                </div>
                <div class="conversation-hint">
                    ${isManual ? 
                        `⚡ <strong>Manual Mode is active:</strong> AI responses are paused for this patient. Only your manual replies are sent.` : 
                        `🤖 <strong>AI Mode is active:</strong> AI answers the patient automatically. Click <strong>Take Over Manually</strong> to take control.`}
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const feed = document.getElementById("adminConversationFeed");
        if (feed) feed.scrollTop = feed.scrollHeight;
        const input = document.getElementById("doctorReplyInput");
        if (input) input.focus();
    }, 50);
}

async function openStaffConversation(id) {
    try {
        const res = await adminFetch(`${API_BASE}/staff/inbox/${id}`, {
            headers: getAuthHeaders()
        });
        const resJson = await res.json();
        if (resJson.success && resJson.data) {
            state.activeStaffConversation = resJson.data;
            renderStaffInboxPage();

            // Auto-refresh active conversation every 3 seconds for live chat
            if (state.conversationPollInterval) clearInterval(state.conversationPollInterval);
            state.conversationPollInterval = setInterval(async () => {
                if (!state.activeStaffConversation) return;
                try {
                    const pollRes = await adminFetch(`${API_BASE}/staff/inbox/${id}`, { headers: getAuthHeaders() });
                    const pollJson = await pollRes.json();
                    if (pollJson.success && pollJson.data) {
                        const prevMsgCount = (state.activeStaffConversation.messages || []).length;
                        const newMsgCount = (pollJson.data.messages || []).length;
                        const prevMode = state.activeStaffConversation.mode;
                        const newMode = pollJson.data.mode;

                        state.activeStaffConversation = pollJson.data;
                        if (prevMsgCount !== newMsgCount || prevMode !== newMode) {
                            renderStaffConversationDetail();
                        }
                    }
                } catch (e) {}
            }, 3000);
        }
    } catch (e) {
        console.error("Failed to load conversation", e);
    }
}

function closeStaffConversation() {
    if (state.conversationPollInterval) {
        clearInterval(state.conversationPollInterval);
        state.conversationPollInterval = null;
    }
    state.activeStaffConversation = null;
    fetchStaffInbox().then(() => renderStaffInboxPage());
}

async function takeoverPatientChat(id) {
    try {
        const res = await adminFetch(`${API_BASE}/staff/inbox/${id}/takeover`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ adminName: "Dr. Muhammad Zaheer Anjum" })
        });
        const resJson = await res.json();
        if (resJson.success && resJson.data) {
            state.activeStaffConversation = resJson.data;
            renderStaffConversationDetail();
            await fetchStaffInbox();
        }
    } catch (e) {
        console.error("Failed to takeover conversation", e);
    }
}

async function returnToAIChat(id) {
    try {
        const res = await adminFetch(`${API_BASE}/staff/inbox/${id}/return-ai`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        const resJson = await res.json();
        if (resJson.success && resJson.data) {
            state.activeStaffConversation = resJson.data;
            renderStaffConversationDetail();
            await fetchStaffInbox();
        }
    } catch (e) {
        console.error("Failed to return conversation to AI", e);
    }
}

async function sendDoctorReply(id) {
    const input = document.getElementById("doctorReplyInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    try {
        input.value = "";
        const res = await adminFetch(`${API_BASE}/staff/inbox/${id}/reply`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                message: text,
                senderName: "Dr. Muhammad Zaheer Anjum"
            })
        });
        const resJson = await res.json();
        if (resJson.success && resJson.data) {
            state.activeStaffConversation = resJson.data;
            renderStaffConversationDetail();
            await fetchStaffInbox();
        }
    } catch (e) {
        console.error("Failed to send reply", e);
    }
}

async function completeStaffInboxSubmit(id) {
    await adminFetch(`${API_BASE}/staff/inbox/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'completed' })
    });
    await fetchStaffInbox();
    renderStaffInboxPage();
}

// Fetch Leads from Backend
async function fetchLeads() {
    try {
        const queryParams = new URLSearchParams();
        if (state.leadFilters.search) queryParams.set('search', state.leadFilters.search);
        if (state.leadFilters.source) queryParams.set('source', state.leadFilters.source);
        if (state.leadFilters.status) queryParams.set('status', state.leadFilters.status);
        if (state.leadFilters.mode) queryParams.set('mode', state.leadFilters.mode);
        if (state.leadFilters.priority) queryParams.set('priority', state.leadFilters.priority);

        const res = await adminFetch(`${API_BASE}/leads?${queryParams.toString()}`, {
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (json.success && json.data) {
            state.leads = json.data.leads || [];
            const countEl = document.getElementById("leadsNavCount");
            if (countEl) countEl.textContent = state.leads.length;
        }
    } catch (e) {
        console.error("fetchLeads error:", e);
    }
}

// Fetch Lead Statistics
async function fetchLeadStats() {
    try {
        const res = await adminFetch(`${API_BASE}/leads/stats`, {
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (json.success && json.data) {
            state.leadStats = json.data;
            const countEl = document.getElementById("leadsNavCount");
            if (countEl) countEl.textContent = json.data.newLeads || 0;
        }
    } catch (e) {
        console.error("fetchLeadStats error:", e);
    }
}

/* =========================================================
   15. ADS LEADS PAGE RENDERER
========================================================= */

function renderAdsLeadsPage() {
    if (pageTitle) pageTitle.textContent = "AI Ads Leads Automation";
    if (pageSubtitle) pageSubtitle.textContent = "Meta (Facebook / Instagram), WhatsApp & Website Ads Leads Automation & Manual Takeover";

    const s = state.leadStats || {
        totalLeads: 0,
        newLeads: 0,
        aiHandledLeads: 0,
        manualLeads: 0,
        qualifiedLeads: 0,
        appointmentsBooked: 0,
        convertedLeads: 0,
        pendingFollowUps: 0,
        conversionRate: "0.0%",
        platformBreakdown: {
            facebook_lead_ad: 0,
            instagram_lead_ad: 0,
            facebook_messenger: 0,
            instagram_dm: 0,
            whatsapp_ad: 0,
            website_chatbot: 0,
            manual_entry: 0
        }
    };

    dynamicAdminPage.innerHTML = `
        <!-- Actions & KPI Header -->
        <div class="leads-action-bar">
            <div>
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-dark);">Lead Automation Hub</h3>
                <p style="font-size: 12px; color: var(--text-secondary);">Manage automated AI qualification and staff manual takeover in one unified inbox.</p>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-action blue" onclick="openTestLeadModal()">⚡ Test Lead Simulator</button>
                <button class="btn-action green" onclick="openAddLeadModal()">+ Add New Lead</button>
                <button class="btn-action gray" onclick="refreshLeadsData()">🔄 Refresh</button>
            </div>
        </div>

        <!-- KPI Metric Cards Grid -->
        <div class="dashboard-statistics mb-3">
            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">Total Leads</span>
                    <span class="stat-icon-box blue">🎯</span>
                </div>
                <h3 class="stat-number">${s.totalLeads}</h3>
                <p class="stat-subtext">All channels combined</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">New Leads</span>
                    <span class="stat-icon-box orange">🔔</span>
                </div>
                <h3 class="stat-number">${s.newLeads}</h3>
                <p class="stat-subtext">Awaiting initial action</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">AI Handled</span>
                    <span class="stat-icon-box purple">🤖</span>
                </div>
                <h3 class="stat-number">${s.aiHandledLeads}</h3>
                <p class="stat-subtext">AI Mode active</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">Manual Active</span>
                    <span class="stat-icon-box green">👤</span>
                </div>
                <h3 class="stat-number">${s.manualLeads}</h3>
                <p class="stat-subtext">Staff takeover active</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">Qualified Leads</span>
                    <span class="stat-icon-box green">🩺</span>
                </div>
                <h3 class="stat-number">${s.qualifiedLeads}</h3>
                <p class="stat-subtext">Symptom qualified</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">Appointments Booked</span>
                    <span class="stat-icon-box blue">📅</span>
                </div>
                <h3 class="stat-number">${s.appointmentsBooked}</h3>
                <p class="stat-subtext">Tokens generated</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">Converted</span>
                    <span class="stat-icon-box green">🏆</span>
                </div>
                <h3 class="stat-number">${s.convertedLeads}</h3>
                <p class="stat-subtext">Patients attended</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">Conversion Rate</span>
                    <span class="stat-icon-box purple">📈</span>
                </div>
                <h3 class="stat-number">${s.conversionRate}</h3>
                <p class="stat-subtext">Booking & conversion</p>
            </div>
        </div>

        <!-- Platform Distribution Summary Bar -->
        <div class="platform-summary-bar">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); align-self: center;">Channels:</span>
            <div class="platform-pill fb">📘 Facebook: ${s.platformBreakdown?.facebook_lead_ad || 0}</div>
            <div class="platform-pill ig">📸 Instagram: ${(s.platformBreakdown?.instagram_lead_ad || 0) + (s.platformBreakdown?.instagram_dm || 0)}</div>
            <div class="platform-pill wa">💬 WhatsApp: ${s.platformBreakdown?.whatsapp_ad || 0}</div>
            <div class="platform-pill web">💻 Website: ${s.platformBreakdown?.website_chatbot || 0}</div>
            <div class="platform-pill manual">👤 Manual: ${s.platformBreakdown?.manual_entry || 0}</div>
        </div>

        <!-- Search & Filter Controls -->
        <div class="leads-filter-container">
            <div class="search-input-wrapper">
                <span style="color: var(--text-muted); font-size: 14px;">🔍</span>
                <input type="text" id="leadSearchInput" placeholder="Search by Patient Name, Phone, Email, Lead ID, Campaign or Treatment..." value="${state.leadFilters.search || ''}" oninput="handleLeadSearch(this.value)" />
            </div>

            <div class="filter-controls-row">
                <select class="filter-select" id="filterSource" onchange="handleLeadFilterChange('source', this.value)">
                    <option value="">All Channels / Sources</option>
                    <option value="facebook_lead_ad" ${state.leadFilters.source === 'facebook_lead_ad' ? 'selected' : ''}>Facebook Lead Ads</option>
                    <option value="instagram_lead_ad" ${state.leadFilters.source === 'instagram_lead_ad' ? 'selected' : ''}>Instagram Lead Ads</option>
                    <option value="whatsapp_ad" ${state.leadFilters.source === 'whatsapp_ad' ? 'selected' : ''}>WhatsApp Ads / Chat</option>
                    <option value="website_chatbot" ${state.leadFilters.source === 'website_chatbot' ? 'selected' : ''}>Website Chatbot</option>
                    <option value="facebook_messenger" ${state.leadFilters.source === 'facebook_messenger' ? 'selected' : ''}>Facebook Messenger</option>
                    <option value="instagram_dm" ${state.leadFilters.source === 'instagram_dm' ? 'selected' : ''}>Instagram DM</option>
                    <option value="manual_entry" ${state.leadFilters.source === 'manual_entry' ? 'selected' : ''}>Manual Staff Entry</option>
                </select>

                <select class="filter-select" id="filterStatus" onchange="handleLeadFilterChange('status', this.value)">
                    <option value="">All Statuses</option>
                    <option value="New" ${state.leadFilters.status === 'New' ? 'selected' : ''}>New</option>
                    <option value="AI Engaged" ${state.leadFilters.status === 'AI Engaged' ? 'selected' : ''}>AI Engaged</option>
                    <option value="Qualified" ${state.leadFilters.status === 'Qualified' ? 'selected' : ''}>Qualified</option>
                    <option value="Appointment Requested" ${state.leadFilters.status === 'Appointment Requested' ? 'selected' : ''}>Appointment Requested</option>
                    <option value="Appointment Booked" ${state.leadFilters.status === 'Appointment Booked' ? 'selected' : ''}>Appointment Booked</option>
                    <option value="Follow-Up" ${state.leadFilters.status === 'Follow-Up' ? 'selected' : ''}>Follow-Up</option>
                    <option value="Converted" ${state.leadFilters.status === 'Converted' ? 'selected' : ''}>Converted</option>
                    <option value="Closed" ${state.leadFilters.status === 'Closed' ? 'selected' : ''}>Closed</option>
                </select>

                <select class="filter-select" id="filterMode" onchange="handleLeadFilterChange('mode', this.value)">
                    <option value="">All Modes (AI & Manual)</option>
                    <option value="AI" ${state.leadFilters.mode === 'AI' ? 'selected' : ''}>🤖 AI Mode Only</option>
                    <option value="MANUAL" ${state.leadFilters.mode === 'MANUAL' ? 'selected' : ''}>👤 Manual Mode Only</option>
                </select>

                <select class="filter-select" id="filterPriority" onchange="handleLeadFilterChange('priority', this.value)">
                    <option value="">All Priorities</option>
                    <option value="urgent" ${state.leadFilters.priority === 'urgent' ? 'selected' : ''}>🚨 Urgent</option>
                    <option value="high" ${state.leadFilters.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" ${state.leadFilters.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" ${state.leadFilters.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>

                <button class="btn-action gray" style="padding: 6px 12px; font-size: 12px;" onclick="resetLeadFilters()">Reset Filters</button>
            </div>
        </div>

        <!-- Leads Data Table Panel -->
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Ads Leads Directory (${state.leads.length})</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Lead ID</th>
                            <th>Patient & Phone</th>
                            <th>Source / Campaign</th>
                            <th>Treatment</th>
                            <th>Mode</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Last Message</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="leadsTableBody">
                        ${renderLeadsTableRows()}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Render Table Rows
function renderLeadsTableRows() {
    if (!state.leads || state.leads.length === 0) {
        return `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon">🎯</div>
                        <strong>No leads found matching current criteria</strong>
                        <p>Simulate a test lead or click "+ Add New Lead" above to get started.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    return state.leads.map(lead => {
        const sourceLabel = formatSourceLabel(lead.source);
        const modeBadgeClass = lead.conversationMode === 'MANUAL' ? 'manual' : 'ai';
        const modeBadgeLabel = lead.conversationMode === 'MANUAL' ? '👤 MANUAL' : '🤖 AI';

        return `
            <tr>
                <td><code>${lead.leadId}</code></td>
                <td>
                    <strong>${lead.patientName}</strong>
                    <div style="font-size: 12px; color: var(--text-secondary);">${lead.phone}</div>
                </td>
                <td>
                    <span class="platform-pill ${getSourcePillClass(lead.source)}" style="padding: 2px 8px; font-size: 11px;">${sourceLabel}</span>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${lead.campaignName || 'General'}</div>
                </td>
                <td>
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-dark); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${lead.interestedTreatment || 'General Consultation'}
                    </div>
                </td>
                <td>
                    <span class="mode-badge ${modeBadgeClass}">${modeBadgeLabel}</span>
                </td>
                <td>
                    <span class="status-badge ${getLeadStatusBadgeClass(lead.leadStatus)}">${lead.leadStatus}</span>
                </td>
                <td>
                    <span class="priority-pill ${lead.priority || 'medium'}">${(lead.priority || 'medium').toUpperCase()}</span>
                </td>
                <td>
                    <div style="font-size: 11.5px; color: var(--text-secondary); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${lead.lastMessage || 'No messages yet'}
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted);">${formatTimeAgo(lead.lastMessageAt || lead.createdAt)}</div>
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-action blue" style="padding: 4px 8px; font-size: 11px;" onclick="openLeadConversationModal('${lead._id}')">💬 Chat / Manage</button>
                        <button class="btn-action gray" style="padding: 4px 6px; font-size: 11px;" title="Quick Toggle AI/Manual Mode" onclick="quickToggleLeadMode('${lead._id}', '${lead.conversationMode}')">⚡</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function formatSourceLabel(source) {
    switch (source) {
        case 'facebook_lead_ad': return 'Facebook Ad';
        case 'instagram_lead_ad': return 'Instagram Ad';
        case 'whatsapp_ad': return 'WhatsApp';
        case 'website_chatbot': return 'Web Bot';
        case 'facebook_messenger': return 'Messenger';
        case 'instagram_dm': return 'IG DM';
        case 'manual_entry': return 'Manual';
        default: return 'Ad Lead';
    }
}

function getSourcePillClass(source) {
    if (source.includes('facebook') || source.includes('fb')) return 'fb';
    if (source.includes('instagram') || source.includes('ig')) return 'ig';
    if (source.includes('whatsapp') || source.includes('wa')) return 'wa';
    if (source.includes('website')) return 'web';
    return 'manual';
}

function getLeadStatusBadgeClass(status) {
    switch (status) {
        case 'New': return 'pending';
        case 'AI Engaged': return 'confirmed';
        case 'Qualified': return 'confirmed';
        case 'Appointment Requested': return 'pending';
        case 'Appointment Booked': return 'completed';
        case 'Follow-Up': return 'pending';
        case 'Converted': return 'completed';
        case 'Closed': return 'cancelled';
        case 'Not Interested': return 'cancelled';
        default: return 'pending';
    }
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
}

// Search and Filter Handlers
let searchDebounce = null;
function handleLeadSearch(val) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        state.leadFilters.search = val.trim();
        refreshLeadsData();
    }, 300);
}

function handleLeadFilterChange(key, val) {
    state.leadFilters[key] = val;
    refreshLeadsData();
}

function resetLeadFilters() {
    state.leadFilters = { search: '', source: '', status: '', mode: '', priority: '' };
    refreshLeadsData();
}

async function refreshLeadsData() {
    await Promise.all([fetchLeads(), fetchLeadStats()]);
    if (state.currentPage === 'ads-leads') {
        const tbody = document.getElementById('leadsTableBody');
        if (tbody) tbody.innerHTML = renderLeadsTableRows();
    }
}

/* =========================================================
   16. UNIFIED LEAD CONVERSATION MODAL & ACTIONS
========================================================= */

let activeLeadPollInterval = null;

async function openLeadConversationModal(leadId) {
    const modal = document.getElementById("leadConversationModal");
    if (!modal) return;

    modal.style.display = "flex";

    // Set Loading State
    const container = document.getElementById("modalMessagesContainer");
    if (container) container.innerHTML = '<div class="loading-spinner">Loading conversation history...</div>';

    try {
        const res = await adminFetch(`${API_BASE}/leads/${leadId}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success || !json.data) return;

        state.currentLead = json.data;
        updateModalLeadUI(state.currentLead);

        await loadModalMessages(state.currentLead._id);

        // Start active message polling for open modal
        clearInterval(activeLeadPollInterval);
        activeLeadPollInterval = setInterval(() => {
            if (state.currentLead && modal.style.display === "flex") {
                loadModalMessages(state.currentLead._id, true);
            }
        }, 4000);
    } catch (e) {
        console.error("Error opening lead modal:", e);
    }
}

function closeLeadModal() {
    const modal = document.getElementById("leadConversationModal");
    if (modal) modal.style.display = "none";
    clearInterval(activeLeadPollInterval);
    state.currentLead = null;
    refreshLeadsData();
}

function updateModalLeadUI(lead) {
    if (!lead) return;

    setElText("modalPatientName", lead.patientName);
    setElText("modalLeadId", lead.leadId);
    setElText("modalPhone", lead.phone);
    setElText("modalEmail", lead.email || "No email provided");
    setElText("modalCity", lead.city || "Lahore");
    setElText("modalTreatment", lead.interestedTreatment || "General Consultation");
    setElText("modalCampaign", lead.campaignName || "General Campaign");
    setElText("modalPlatformId", lead.platformLeadId || "-");

    const badge = document.getElementById("modalSourceBadge");
    if (badge) {
        badge.textContent = formatSourceLabel(lead.source);
        badge.className = `lead-modal-badge ${getSourcePillClass(lead.source)}`;
    }

    const waLink = document.getElementById("modalWaLink");
    if (waLink) {
        const rawPhone = lead.phone.replace(/[^0-9]/g, '');
        waLink.href = `https://wa.me/${rawPhone}`;
    }

    const callLink = document.getElementById("modalCallLink");
    if (callLink) callLink.href = `tel:${lead.phone}`;

    // Mode Toggle Controls
    updateModalModeButtons(lead.conversationMode);

    // Form inputs
    const statusSelect = document.getElementById("modalLeadStatus");
    if (statusSelect) statusSelect.value = lead.leadStatus;

    const prioritySelect = document.getElementById("modalPriority");
    if (prioritySelect) prioritySelect.value = lead.priority || "medium";

    const assignedInput = document.getElementById("modalAssignedTo");
    if (assignedInput) assignedInput.value = lead.assignedTo || "";

    const notesInput = document.getElementById("modalNotes");
    if (notesInput) notesInput.value = lead.notes || "";

    if (lead.followUpAt) {
        const followUpInput = document.getElementById("modalFollowUpDate");
        if (followUpInput) {
            const d = new Date(lead.followUpAt);
            followUpInput.value = d.toISOString().slice(0, 16);
        }
    }

    // Appointment Section
    const apptBox = document.getElementById("modalApptDetails");
    if (apptBox) {
        if (lead.linkedAppointment) {
            const appt = lead.linkedAppointment;
            apptBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong>Token #${appt.tokenNumber}</strong>
                    <span class="status-badge ${appt.status}">${appt.status.toUpperCase()}</span>
                </div>
                <div><code>${appt.appointmentId}</code></div>
                <div style="margin-top: 4px;">📅 ${appt.date} | 🕒 ${appt.time}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${appt.clinic || 'Clinic not recorded'}</div>
            `;
        } else if (lead.linkedAppointmentId) {
            apptBox.innerHTML = `<div>Linked Appointment ID: <code>${lead.linkedAppointmentId}</code></div>`;
        } else {
            apptBox.innerHTML = `<p class="text-muted" style="margin: 0;">No appointment booked yet.</p>`;
        }
    }
}

function updateModalModeButtons(mode) {
    const isManual = mode === "MANUAL";

    const banner = document.getElementById("modalManualBanner");
    if (banner) banner.style.display = isManual ? "flex" : "none";

    const indicator = document.getElementById("modalModeIndicator");
    if (indicator) {
        indicator.textContent = isManual ? "Manual Takeover Active" : "AI Active";
        indicator.style.background = isManual ? "#FEF3C7" : "#ECFDF5";
        indicator.style.color = isManual ? "#B45309" : "#059669";
    }

    const desc = document.getElementById("modalModeDesc");
    if (desc) {
        desc.textContent = isManual
            ? "AI automatic replies are paused. Staff can reply directly."
            : "AI is automatically replying to patient messages.";
    }

    const btnAi = document.getElementById("btnToggleAi");
    const btnManual = document.getElementById("btnToggleManual");

    if (btnAi) {
        btnAi.className = `btn-mode-toggle ${!isManual ? 'active-ai' : ''}`;
    }
    if (btnManual) {
        btnManual.className = `btn-mode-toggle ${isManual ? 'active-manual' : ''}`;
    }
}

// Load Conversation Timeline from MongoDB
async function loadModalMessages(leadId, isSilent = false) {
    const container = document.getElementById("modalMessagesContainer");
    if (!container) return;

    try {
        const res = await adminFetch(`${API_BASE}/leads/${leadId}/messages`, {
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (json.success && json.data) {
            const msgs = json.data.messages || [];

            if (msgs.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                        <p style="font-size: 14px;">No messages recorded in database yet.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = msgs.map(m => {
                const senderType = m.sender; // 'lead', 'AI', 'admin', 'system'
                const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const senderName = m.sentBy || (senderType === 'AI' ? 'Dr. Zaheer AI Assistant' : (senderType === 'admin' ? 'Clinic Staff' : 'Patient'));

                return `
                    <div class="chat-msg-row ${senderType}">
                        ${senderType !== 'system' ? `<span class="msg-sender-tag">${senderType === 'AI' ? '🤖 ' : (senderType === 'admin' ? '👤 ' : '')}${senderName}</span>` : ''}
                        <div class="msg-bubble">
                            ${escapeHtml(m.message).replace(/\n/g, '<br/>')}
                        </div>
                        <span class="msg-time">${time}</span>
                    </div>
                `;
            }).join('');

            if (!isSilent) {
                container.scrollTop = container.scrollHeight;
            }
        }
    } catch (e) {
        console.error("Error loading messages:", e);
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Mode Switching Logic
async function toggleCurrentLeadMode(targetMode) {
    if (!state.currentLead) return;
    const leadId = state.currentLead._id;

    try {
        const res = await adminFetch(`${API_BASE}/leads/${leadId}/mode`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ mode: targetMode })
        });
        const json = await res.json();
        if (json.success) {
            state.currentLead.conversationMode = targetMode;
            updateModalModeButtons(targetMode);
            await loadModalMessages(leadId);
        }
    } catch (e) {
        console.error("Mode toggle error:", e);
    }
}

async function quickToggleLeadMode(leadId, currentMode) {
    const newMode = currentMode === 'MANUAL' ? 'AI' : 'MANUAL';
    try {
        await adminFetch(`${API_BASE}/leads/${leadId}/mode`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ mode: newMode })
        });
        await refreshLeadsData();
    } catch (e) {}
}

// Send Manual Admin Reply
async function sendModalAdminMessage() {
    if (!state.currentLead) return;
    const input = document.getElementById("modalComposerInput");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    const sendBtn = document.getElementById("btnSendLeadMessage");
    if (sendBtn) sendBtn.disabled = true;

    try {
        const res = await adminFetch(`${API_BASE}/leads/${state.currentLead._id}/messages`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                message,
                sender: "admin"
            })
        });

        const json = await res.json();
        if (json.success) {
            input.value = "";
            state.currentLead.conversationMode = "MANUAL";
            updateModalModeButtons("MANUAL");
            await loadModalMessages(state.currentLead._id);
        }
    } catch (e) {
        console.error("Send message error:", e);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function handleComposerKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendModalAdminMessage();
    }
}

// Quick Templates
async function insertQuickTemplate(type) {
    const input = document.getElementById('modalComposerInput');
    if (!input || !state.currentLead) return;
    let text = 'Verified information is temporarily unavailable. Please contact clinic staff.';
    try {
        const response = await adminFetch('/api/knowledge'); const result = await response.json(); if (!response.ok || !result.success) throw new Error();
        const k = result.data;
        if (type === 'welcome') text = `Hello ${state.currentLead.patientName || 'Patient'}, thank you for contacting ${k.organization.name}. How can our staff assist you?`;
        else if (type === 'symptoms') text = 'Please describe the concern you would like to discuss with clinic staff. Seek immediate professional emergency care for urgent symptoms.';
        else if (type === 'prp') text = k.services.length ? k.services.map(service => `${service.title}: ${service.description}`).join('\n') : 'Service information has not yet been verified. Please ask clinic staff.';
        else if (type === 'location') text = k.location.verified ? [k.organization.name,k.location.address,k.location.city].filter(Boolean).join(', ') : 'The medical complex address has not yet been verified. Please ask clinic staff.';
        else if (type === 'slots') text = 'Please select your preferred date to check current appointment availability. A booking is confirmed only after it has been saved.';
    } catch (_) {}
    input.value = text; input.focus();
}

// Lead Management Updates
async function updateModalLeadStatus(status) {
    if (!state.currentLead) return;
    await adminFetch(`${API_BASE}/leads/${state.currentLead._id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ leadStatus: status })
    });
}

async function updateModalPriority(priority) {
    if (!state.currentLead) return;
    await adminFetch(`${API_BASE}/leads/${state.currentLead._id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ priority })
    });
}

async function updateModalAssigned(assignedTo) {
    if (!state.currentLead) return;
    await adminFetch(`${API_BASE}/leads/${state.currentLead._id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ assignedTo })
    });
}

async function saveModalNotes() {
    if (!state.currentLead) return;
    const notes = document.getElementById("modalNotes")?.value || "";
    await adminFetch(`${API_BASE}/leads/${state.currentLead._id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes })
    });
    alert("Internal notes saved successfully.");
}

async function saveModalFollowUp() {
    if (!state.currentLead) return;
    const dateVal = document.getElementById("modalFollowUpDate")?.value;
    const noteVal = document.getElementById("modalFollowUpNote")?.value || "";

    if (!dateVal) {
        alert("Please select a valid follow-up date and time.");
        return;
    }

    await adminFetch(`${API_BASE}/leads/${state.currentLead._id}/follow-up`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ followUpAt: dateVal, notes: noteVal })
    });
    await loadModalMessages(state.currentLead._id);
    alert("Follow-up scheduled successfully.");
}

async function markModalLeadConverted() {
    if (!state.currentLead) return;
    const notes = prompt("Enter conversion details / treatment attended (optional):", "Attended initial consultation");
    if (notes === null) return;

    await adminFetch(`${API_BASE}/leads/${state.currentLead._id}/convert`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes })
    });
    state.currentLead.leadStatus = "Converted";
    updateModalLeadUI(state.currentLead);
    await loadModalMessages(state.currentLead._id);
}

async function deleteModalLead() {
    if (!state.currentLead) return;
    if (!confirm(`Are you sure you want to delete lead ${state.currentLead.leadId} and all associated chat records?`)) return;

    await adminFetch(`${API_BASE}/leads/${state.currentLead._id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    closeLeadModal();
}

/* =========================================================
   17. ADD LEAD MANUAL FORM
========================================================= */

function openAddLeadModal() {
    const m = document.getElementById("addLeadModal");
    if (m) m.style.display = "flex";
}

function closeAddLeadModal() {
    const m = document.getElementById("addLeadModal");
    if (m) m.style.display = "none";
}

async function submitAddLeadForm(e) {
    e.preventDefault();

    const data = {
        patientName: document.getElementById("newLeadName")?.value?.trim(),
        phone: document.getElementById("newLeadPhone")?.value?.trim(),
        email: document.getElementById("newLeadEmail")?.value?.trim(),
        city: document.getElementById("newLeadCity")?.value?.trim() || "Lahore",
        source: document.getElementById("newLeadSource")?.value || "manual_entry",
        interestedTreatment: document.getElementById("newLeadTreatment")?.value,
        conversationMode: document.getElementById("newLeadMode")?.value || "AI",
        priority: document.getElementById("newLeadPriority")?.value || "medium",
        leadMessage: document.getElementById("newLeadMessage")?.value?.trim()
    };

    try {
        const res = await adminFetch(`${API_BASE}/leads`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            closeAddLeadModal();
            document.getElementById("addLeadForm")?.reset();
            await refreshLeadsData();
            if (json.data?._id) {
                openLeadConversationModal(json.data._id);
            }
        } else {
            alert(json.message || "Could not save lead.");
        }
    } catch (err) {
        console.error("Add lead error:", err);
    }
}

/* =========================================================
   18. TEST LEAD & WEBHOOK SIMULATOR
========================================================= */

function openTestLeadModal() {
    const m = document.getElementById("testLeadModal");
    if (m) m.style.display = "flex";
}

function closeTestLeadModal() {
    const m = document.getElementById("testLeadModal");
    if (m) m.style.display = "none";
}

function fillTestPreset(preset) {
    const sourceEl = document.getElementById("simSource");
    const nameEl = document.getElementById("simName");
    const phoneEl = document.getElementById("simPhone");
    const campEl = document.getElementById("simCampaign");
    const msgEl = document.getElementById("simMessage");

    const rnd = Math.floor(1000 + Math.random() * 9000);

    switch (preset) {
        case "fb_knee":
            if (sourceEl) sourceEl.value = "facebook_lead_ad";
            if (nameEl) nameEl.value = "Kashif Riaz";
            if (phoneEl) phoneEl.value = `+92300${rnd}123`;
            if (campEl) campEl.value = "FB Knee PRP Regeneration 2026";
            if (msgEl) msgEl.value = "Hello, I have severe knee joint pain for 1 year. Can Dr. Zaheer help with PRP therapy? What is the consultation process?";
            break;
        case "ig_back":
            if (sourceEl) sourceEl.value = "instagram_dm";
            if (nameEl) nameEl.value = "Zainab Malik";
            if (phoneEl) phoneEl.value = `+92321${rnd}456`;
            if (campEl) campEl.value = "IG Spine & Back Pain Campaign";
            if (msgEl) msgEl.value = "Hi! I am suffering from severe lower back pain and sciatica. Do you do image-guided injections?";
            break;
        case "wa_book":
            if (sourceEl) sourceEl.value = "whatsapp_ad";
            if (nameEl) nameEl.value = "Muhammad Usman";
            if (phoneEl) phoneEl.value = `+92333${rnd}789`;
            if (campEl) campEl.value = "WhatsApp Click-to-Chat Ad";
            if (msgEl) msgEl.value = "Hello, please book an in-person appointment for me with Dr. Muhammad Zaheer Anjum for tomorrow at 2:00 PM.";
            break;
        case "emergency":
            if (sourceEl) sourceEl.value = "whatsapp_ad";
            if (nameEl) nameEl.value = "Emergency Test Patient";
            if (phoneEl) phoneEl.value = `+92345${rnd}999`;
            if (campEl) campEl.value = "Emergency Detection Check";
            if (msgEl) msgEl.value = "I am having sudden weakness and severe chest pain with numbness in my arm!";
            break;
        case "human":
            if (sourceEl) sourceEl.value = "facebook_messenger";
            if (nameEl) nameEl.value = "Bilal Siddiqui";
            if (phoneEl) phoneEl.value = `+92302${rnd}888`;
            if (campEl) campEl.value = "Messenger Ad Inquiries";
            if (msgEl) msgEl.value = "Can I please speak to a real human staff coordinator directly on the phone?";
            break;
    }
}

async function executeTestSimulation() {
    const data = {
        source: document.getElementById("simSource")?.value || "facebook_lead_ad",
        patientName: document.getElementById("simName")?.value || "Simulated Lead",
        phone: document.getElementById("simPhone")?.value || "+923000000000",
        campaignName: document.getElementById("simCampaign")?.value || "Ad Campaign",
        message: document.getElementById("simMessage")?.value || "Hello Dr. Zaheer Clinic",
        conversationMode: "AI"
    };

    try {
        const res = await adminFetch(`${API_BASE}/leads/incoming-test`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success && json.data?.lead?._id) {
            closeTestLeadModal();
            await refreshLeadsData();
            openLeadConversationModal(json.data.lead._id);
        }
    } catch (err) {
        console.error("Simulation error:", err);
    }
}

/* =========================================================
   19. DIRECT APPOINTMENT BOOKING FOR ACTIVE LEAD
========================================================= */

function openQuickBookModal() {
    if (!state.currentLead) return;
    const m = document.getElementById("leadBookingModal");
    if (!m) return;

    setElText("bookPatientName", state.currentLead.patientName);
    const pInput = document.getElementById("bookPatientName");
    if (pInput) pInput.value = `${state.currentLead.patientName} (${state.currentLead.phone})`;

    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    const dateInput = document.getElementById("bookDate");
    if (dateInput) {
        dateInput.value = tm.toISOString().slice(0, 10);
        loadQuickSlotsForDate(dateInput.value);
    }

    m.style.display = "flex";
}

function closeLeadBookingModal() {
    const m = document.getElementById("leadBookingModal");
    if (m) m.style.display = "none";
}

async function loadQuickSlotsForDate(dateStr) {
    const slotSelect = document.getElementById("bookTimeSlot");
    if (!slotSelect) return;
    slotSelect.innerHTML = "<option>Loading slots...</option>";

    try {
        const res = await adminFetch(`${API_BASE}/appointments/slots?date=${dateStr}`);
        const json = await res.json();
        if (json.success && json.data?.slots?.length > 0) {
            slotSelect.innerHTML = json.data.slots.map(s => `<option value="${s}">${s}</option>`).join('');
        } else {
            slotSelect.innerHTML = "<option value='12:30 PM'>12:30 PM (Default)</option><option value='02:00 PM'>02:00 PM</option><option value='04:30 PM'>04:30 PM</option>";
        }
    } catch (e) {
        slotSelect.innerHTML = "<option value='12:30 PM'>12:30 PM</option><option value='02:00 PM'>02:00 PM</option>";
    }
}

async function submitLeadBookingForm(e) {
    e.preventDefault();
    if (!state.currentLead) return;

    const data = {
        date: document.getElementById("bookDate")?.value,
        time: document.getElementById("bookTimeSlot")?.value,
        appointmentType: document.getElementById("bookApptType")?.value,
        notes: document.getElementById("bookNotes")?.value || ""
    };

    try {
        const res = await adminFetch(`${API_BASE}/leads/${state.currentLead._id}/book-appointment`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            closeLeadBookingModal();
            state.currentLead = json.data.lead;
            updateModalLeadUI(state.currentLead);
            await loadModalMessages(state.currentLead._id);
            await refreshLeadsData();
        } else {
            alert(json.message || "Failed to book appointment.");
        }
    } catch (err) {
        console.error("Booking error:", err);
    }
}


// All dashboard operations carry the existing admin session token.
function adminFetch(url, options = {}) {
    return window.fetch(url, { ...options, headers: { ...getAuthHeaders(), ...(options.headers || {}) } });
}
document.addEventListener('click', async (event) => {
    const link = event.target.closest('a[href*="/reports/"][href$="/download"]');
    if (!link) return;
    event.preventDefault();
    try {
        const response = await adminFetch(link.href);
        if (!response.ok) throw new Error('Unable to download report. Please sign in and retry.');
        const url = URL.createObjectURL(await response.blob());
        const download = document.createElement('a'); download.href = url; download.download = 'medical-report'; download.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { alert(error.message); }
});

async function rescheduleAdminAppointment(id) {
    document.getElementById('adminRescheduleForm')?.remove();
    const appointment=state.appointments.find(a=>a._id===id); if(!appointment)return;
    const form=document.createElement('form');form.id='adminRescheduleForm';form.className='dashboard-panel';form.style.padding='22px';
    const title=document.createElement('h3');title.textContent='Reschedule appointment';
    const date=document.createElement('input');date.type='date';date.className='form-input';date.required=true;date.setAttribute('aria-label','New appointment date');
    const times=document.createElement('select');times.className='form-input';times.required=true;times.setAttribute('aria-label','New appointment time');
    const save=document.createElement('button');save.type='submit';save.className='btn-primary';save.textContent='Save new date and time';save.disabled=true;
    const status=document.createElement('p');status.setAttribute('role','status');
    form.append(title,date,times,save,status);dynamicAdminPage.prepend(form);
    date.onchange=async()=>{save.disabled=true;times.replaceChildren();try{const response=await adminFetch('/api/appointments/slots?date='+encodeURIComponent(date.value)+'&doctorId='+encodeURIComponent(appointment.doctorId||''));const json=await response.json();if(!response.ok||!json.success)throw new Error();for(const time of json.data.slots){const option=document.createElement('option');option.value=time;option.textContent=time;times.append(option);}save.disabled=!times.options.length;status.textContent=times.options.length?'Select a time and save.':json.data.reason;}catch(_){status.textContent='Unable to load availability. Please retry.';}};
    form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{const response=await adminFetch('/api/appointments/'+encodeURIComponent(id)+'/reschedule',{method:'PATCH',body:JSON.stringify({date:date.value,time:times.value})});const json=await response.json();if(!response.ok||!json.success)throw new Error(json.message||'Rescheduling failed');await fetchAppointments();renderAppointmentsPage();}catch(error){status.textContent=error.message;save.disabled=false;}};
}
