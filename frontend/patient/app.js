/* =========================================================
   DR. MUHAMMAD ZAHEER ANJUM
   AI CLINIC ASSISTANT

   FRONTEND JAVASCRIPT
   METHODS / FUNCTIONS BASED STRUCTURE
========================================================= */


/* =========================================================
   1. APPLICATION CONFIGURATION
========================================================= */

const CONFIG = {
    doctor: { name: 'Doctor not yet verified', shortName: 'NMC', specialty: '' },
    clinic: { name: 'Nighat Medical Complex', city: '', address: '', schedule: '', phone: '' }
};


/* =========================================================
   2. APPLICATION STATE

   This stores temporary frontend data.

   Later this will be connected with backend + MongoDB.
========================================================= */

const renderedMessageIds = new Set();
let chatInitialized = false;
let chatPollingInterval = null;
let isSyncing = false;
let isSending = false;
let activeChatRequestController = null;
let lastFailedChatMessage = null;
let isLanguageSelecting = false;
let isUploading = false;
let lastSequence = 0;
const CHAT_REQUEST_TIMEOUT_MS = 20000;

const state = {

    language: (() => { try { return localStorage.getItem('nmc_patient_language') === 'urdu' ? 'urdu' : 'english'; } catch (_) { return 'english'; } })(),

    currentStep: null,

    sessionId: (() => {
        const createSessionId = () => "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        try {
            let sid = localStorage.getItem("mza_patient_session_id");
            if (!sid) {
                sid = createSessionId();
                localStorage.setItem("mza_patient_session_id", sid);
            }
            return sid;
        } catch (error) {
            console.error("Patient chat session storage is unavailable:", error);
            return createSessionId();
        }
    })(),

    conversationMode: "AI",

    renderedMessageKeys: renderedMessageIds,

    booking: {

        patientName: "",

        phone: "",

        appointmentType: "",

        clinic: "",

        date: "",

        time: "",

        token: "",

        appointmentId: ""

    },

    report: {

        type: "",

        phone: "",

        token: "",

        description: "",

        file: null

    }

};


/* =========================================================
   3. DOM REFERENCES
========================================================= */

const chatContent =
    document.getElementById("chatContent");

const dynamicContent =
    document.getElementById("dynamicContent");

const mainMenu =
    document.getElementById("mainMenu");

const welcomeCard =
    document.getElementById("welcomeCard");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const attachButton =
    document.getElementById("attachButton");

const medicalFileInput =
    document.getElementById("medicalFileInput");

const languageButton =
    document.getElementById("languageButton");

const staffDashboardButton =
    document.getElementById("staffDashboardButton");

const directionsButton =
    document.getElementById("directionsButton");

const callClinicButton =
    document.getElementById("callClinicButton");

const toast =
    document.getElementById("toast");

const toastText =
    document.getElementById("toastText");

const patientChatModeLabel =
    document.getElementById("patientChatModeLabel");

const patientOnlineStatus =
    document.getElementById("patientOnlineStatus");

const chatMessagesFeed =
    document.getElementById("chatMessagesFeed");


/* =========================================================
   4. INITIALIZE APPLICATION
========================================================= */

function initializeApp() {

    setupLanguageButtons();

    setupMenuButtons();

    setupMessageComposer();

    setupUtilityButtons();

    setupFileUpload();

    initChatSync();

    scrollChatToBottom();

}


/* =========================================================
   5. LANGUAGE BUTTONS
========================================================= */

function setupLanguageButtons() {

    const buttons =
        document.querySelectorAll("[data-language]");

    buttons.forEach((button) => {
        if (button.dataset.listenerAttached) return;
        button.dataset.listenerAttached = "true";

        button.addEventListener("click", () => {
            if (isLanguageSelecting) return;

            // Immediately disable language buttons to prevent rapid double-clicks
            buttons.forEach(b => {
                b.disabled = true;
                b.style.pointerEvents = "none";
                b.style.opacity = "0.7";
            });

            const selectedLanguage =
                button.dataset.language;

            selectLanguage(selectedLanguage);
        });

    });


    if (languageButton && !languageButton.dataset.listenerAttached) {
        languageButton.dataset.listenerAttached = "true";

        languageButton.addEventListener("click", () => {
            if (isLanguageSelecting) return;

            if (state.language === "english") {
                selectLanguage("urdu");
            } else {
                selectLanguage("english");
            }
        });
    }

}


/* =========================================================
   6. SELECT LANGUAGE
========================================================= */

async function selectLanguage(language) {

    if (isLanguageSelecting) return;
    isLanguageSelecting = true;

    state.language = language;
    try { localStorage.setItem('nmc_patient_language',language); } catch (_) {}

    if (welcomeCard) welcomeCard.classList.add("hidden");
    if (mainMenu) mainMenu.classList.remove("hidden");

    try {
        if (language === "urdu") {
            if (languageButton) languageButton.textContent = "🌐 English";
            await sendPatientMessageToBackend("اردو", "LANG_URDU");
        } else {
            if (languageButton) languageButton.textContent = "🌐 اردو";
            await sendPatientMessageToBackend("English", "LANG_ENGLISH");
        }
    } finally {
        isLanguageSelecting = false;
    }

}


/* =========================================================
   7. SHOW MAIN MENU
========================================================= */

function showMainMenu() {

    clearDynamicContent();

    state.currentFlow = "mainMenu";
    state.currentStep = "main-menu";

    if (welcomeCard) welcomeCard.classList.add("hidden");
    if (mainMenu) mainMenu.classList.remove("hidden");

    scrollChatToBottom();

}


/* =========================================================
   8. HIDE MAIN MENU
========================================================= */

function hideMainMenu() {

    if (mainMenu) mainMenu.classList.add("hidden");

}


/* =========================================================
   9. SETUP MENU BUTTONS
========================================================= */

function setupMenuButtons() {

    if (mainMenu && !mainMenu.dataset.listenerAttached) {
        mainMenu.dataset.listenerAttached = "true";

        mainMenu.addEventListener("click", (event) => {
            const button = event.target.closest(".service-option");
            if (!button) return;

            const action = button.dataset.action;
            if (action) {
                handleMenuAction(action);
            }
        });
    }

}


/* =========================================================
   10. HANDLE MENU ACTION
========================================================= */

function handleMenuAction(action) {

    switch (action) {

        case "bookAppointment":
            sendPatientMessageToBackend("📅 Book Appointment", "BOOK_APPOINTMENT");
            break;

        case "onlineConsultation":
            sendPatientMessageToBackend("💻 Online Consultation", "START_CONSULTATION");
            break;

        case "clinicInformation":
            sendPatientMessageToBackend("🏥 Clinic Timings & Location");
            break;

        case "treatmentInformation":
            sendPatientMessageToBackend("🩺 Treatment & Pain Management Information");
            break;

        case "doctorProfile":
            sendPatientMessageToBackend("👨‍⚕️ Doctor Profile & Qualifications");
            break;

        case "manageAppointment":
            showManageAppointmentSearchStep();
            break;

        case "uploadReports":
            startReportUpload();
            break;

        case "speakToStaff":
            sendPatientMessageToBackend("🎧 Speak to Clinic Staff");
            break;

        default:
            if (action) sendPatientMessageToBackend(action);
            break;
    }

}


function syncInputStateForWorkflow(workflow, step) {
    if (!messageInput) return;
    if (workflow === 'APPOINTMENT') {
        if (step === 'AWAITING_NAME') {
            messageInput.placeholder = "Enter patient's full name...";
            messageInput.disabled = false;
            messageInput.focus();
        } else if (step === 'AWAITING_PHONE') {
            messageInput.placeholder = "Enter phone number (e.g. 03001234567)...";
            messageInput.disabled = false;
            messageInput.focus();
        } else if (step === 'AWAITING_DATE' || step === 'AWAITING_SLOT') {
            messageInput.placeholder = step === 'AWAITING_DATE' ? 'Enter a date, e.g. tomorrow, or choose an option...' : 'Choose an available time or enter it here...';
            messageInput.disabled = false;
        } else if (step === 'AWAITING_TYPE' || step === 'AWAITING_CITY') {
            messageInput.placeholder = "Please choose an option above 👆";
            messageInput.disabled = true;
        } else {
            messageInput.placeholder = "Type your message...";
            messageInput.disabled = false;
        }
    } else {
        messageInput.placeholder = "Type your message...";
        messageInput.disabled = false;
    }
}


/* =========================================================
   11. GET MESSAGES FEED & RENDER MESSAGE ITEM
========================================================= */

function getMessagesFeed() {
    const feed = document.getElementById("chatMessagesFeed");
    if (!feed) {
        console.error("Chat messages feed not found. Expected element: #chatMessagesFeed");
        return null;
    }
    return feed;
}

function formatWAText(rawText) {
    if (!rawText) return '';
    let escaped = String(rawText)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Bold **text** or *text*
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/(^|[^\*])\*(.*?)\*(?![\*])/g, '$1<em>$2</em>');
    return escaped;
}

function formatMessageTime(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function showTypingIndicator() {
    removeTypingIndicator();
    const feed = getMessagesFeed();
    if (!feed) return;
    const ind = document.createElement("div");
    ind.id = "waTypingIndicator";
    ind.className = "wa-message-row incoming";
    ind.innerHTML = `
        <div class="wa-typing-indicator">
            <span class="wa-dot"></span><span class="wa-dot"></span><span class="wa-dot"></span>
            <span style="font-size:11px; color:#64748B; margin-left:4px;">Nighat AI Assistant is typing...</span>
        </div>
    `;
    feed.appendChild(ind);
    scrollChatToBottom();
}

function removeTypingIndicator() {
    const ind = document.getElementById("waTypingIndicator");
    if (ind) ind.remove();
}

function removeChatRequestErrors() {
    document.querySelectorAll('[data-message-id^="chat_error_"]').forEach(row => {
        renderedMessageIds.delete(row.dataset.messageId);
        row.remove();
    });
}

function renderMessageItem(msg) {
    if (!msg || (!msg.text && !msg.options && !msg.metadata)) return;
    const msgId = msg.messageId || `${msg.sender}_${msg.sequence || ''}_${msg.text || ''}`;
    if (renderedMessageIds.has(msgId)) return;
    renderedMessageIds.add(msgId);

    const feed = getMessagesFeed();
    if (!feed) return;

    // Hide initial static cards once chat messages begin
    if (welcomeCard) welcomeCard.classList.add("hidden");
    if (mainMenu) mainMenu.classList.add("hidden");

    const sender = (msg.sender || 'PATIENT').toUpperCase();
    const text = sender === 'AI' ? (msg.text || '').replace(/\bDr\.?\s+(Nighat\b)/g, '$1') : (msg.text || '');
    const senderName = sender === 'AI' ? 'Nighat AI Assistant' : (msg.senderName || '');
    const contentType = msg.contentType || 'TEXT';
    const isUrdu = /[؀-ۿ]/.test(text);
    const timeStr = formatMessageTime(msg.timestamp);

    const row = document.createElement("div");
    row.dataset.messageId = msgId;

    if (sender === 'PATIENT') {
        row.className = "wa-message-row outgoing";
        row.innerHTML = `
            <div class="wa-bubble outgoing ${isUrdu ? 'wa-rtl' : ''}">
                <div class="wa-text">${formatWAText(text)}</div>
                <div class="wa-time-meta">
                    <span>${timeStr}</span>
                    <span class="wa-ticks">✓✓</span>
                </div>
            </div>
        `;
    } else if (sender === 'AI') {
        row.className = "wa-message-row incoming";
        const bubble = document.createElement("div");
        bubble.className = `wa-bubble incoming ${isUrdu ? 'wa-rtl' : ''}`;

        let innerContent = `
            <div class="wa-sender-name">
                <span>🩺</span>
                <span>${senderName || 'Nighat AI Assistant'}</span>
            </div>
            <div class="wa-text">${formatWAText(text)}</div>
        `;

        if (contentType === 'APPOINTMENT_CARD' && msg.metadata && msg.metadata.bookingData) {
            const b = msg.metadata.bookingData;
            innerContent += `
                <div class="wa-card-box success">
                    <div style="font-size:14px; font-weight:700; margin-bottom:4px; color:#15803D;">✅ Appointment Confirmed</div>
                    <div><strong>🎟️ Token Number:</strong> #${formatWAText(b.tokenNumber || 'Not available')}</div>
                    <div><strong>🆔 Appointment ID:</strong> ${formatWAText(b.appointmentId || 'Not available')}</div>
                    <div><strong>👤 Patient:</strong> ${formatWAText(b.patientName || 'Patient')}</div>
                    <div><strong>📞 Contact:</strong> ${b.phone || 'Provided'}</div>
                    <div><strong>📅 Date:</strong> ${b.date || 'Scheduled'}</div>
                    <div><strong>⏰ Time Slot:</strong> ${formatWAText(b.time || b.timeSlot || 'Not available')}</div>
                    <div><strong>🏥 Clinic:</strong> Nighat Medical Complex</div>
                    <div><strong>📍 Location:</strong> ${CONFIG.clinic.address || "Address not yet verified"}</div>
                    <div><strong>👨‍⚕️ Doctor:</strong> ${formatWAText(b.doctorName || CONFIG.doctor.name)}</div>
                </div>
            `;
        }

        bubble.innerHTML = innerContent;

        // Render interactive option buttons / quick replies
        if (Array.isArray(msg.options) && msg.options.length > 0) {
            const optWrap = document.createElement("div");
            optWrap.className = "wa-options-wrap";

            msg.options.forEach(opt => {
                if (opt.action === 'url') {
                    const link = document.createElement("a");
                    link.className = "wa-quick-btn secondary";
                    link.href = opt.value;
                    link.target = "_blank";
                    link.textContent = opt.label;
                    optWrap.appendChild(link);
                } else if (opt.action === 'phone_call') {
                    const link = document.createElement("a");
                    link.className = "wa-quick-btn secondary";
                    link.href = opt.value;
                    link.textContent = opt.label;
                    optWrap.appendChild(link);
                } else {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "wa-quick-btn";
                    btn.textContent = opt.label;
                    btn.addEventListener("click", () => {
                        optWrap.querySelectorAll("button").forEach(b => {
                            b.disabled = true;
                            b.style.opacity = "0.5";
                            b.style.cursor = "not-allowed";
                        });
                        btn.classList.add("active-choice");
                        if (opt.action === 'retry_message') {
                            if (lastFailedChatMessage) {
                                const retry = lastFailedChatMessage;
                                sendPatientMessageToBackend(retry.text, retry.payload, retry.action, retry.clientMessageId);
                            }
                            return;
                        }
                        if (opt.value === 'LANG_URDU' || opt.value === 'LANG_ENGLISH') { selectLanguage(opt.value === 'LANG_URDU' ? 'urdu' : 'english'); return; }
                        sendPatientMessageToBackend(opt.label, opt.value, opt.action);
                    });
                    optWrap.appendChild(btn);
                }
            });

            bubble.appendChild(optWrap);
        }

        const timeMeta = document.createElement("div");
        timeMeta.className = "wa-time-meta";
        timeMeta.innerHTML = `<span>${timeStr}</span>`;
        bubble.appendChild(timeMeta);

        row.appendChild(bubble);
    } else if (sender === 'DOCTOR') {
        row.className = "wa-message-row incoming";
        row.innerHTML = `
            <div class="wa-bubble incoming ${isUrdu ? 'wa-rtl' : ''}" style="border-left:3px solid #0284C7;">
                <div class="wa-sender-name"><span>👨‍⚕️</span> <span>the selected care provider (Doctor)</span></div>
                <div class="wa-text">${formatWAText(text)}</div>
                <div class="wa-time-meta"><span>${timeStr}</span></div>
            </div>
        `;
    } else {
        row.className = "wa-message-row incoming";
        row.innerHTML = `
            <div class="wa-bubble incoming" style="background:#F1F5F9; border-color:#CBD5E1;">
                <div class="wa-text" style="font-size:12px; color:#475569;">${formatWAText(text)}</div>
                <div class="wa-time-meta"><span>${timeStr}</span></div>
            </div>
        `;
    }

    feed.appendChild(row);

    if (msg.workflow !== undefined) {
        syncInputStateForWorkflow(msg.workflow, msg.workflowStep);
    }
}

function renderConversationHistory(messagesList) {
    if (!Array.isArray(messagesList)) return;
    const sorted = [...messagesList].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    sorted.forEach(msg => {
        renderMessageItem(msg);
    });
}

function addBotMessage(message) {
    renderMessageItem({
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        sender: 'AI',
        senderName: 'Nighat AI Assistant',
        text: message,
        timestamp: new Date()
    });
}

function addUserMessage(message) {
    renderMessageItem({
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        sender: 'PATIENT',
        senderName: state.booking.patientName || 'Patient',
        text: message,
        timestamp: new Date()
    });
}


/* =========================================================
   13. CREATE CHAT CARD
========================================================= */

function createChatCard(title, htmlContent = "") {

    const card =
        document.createElement("article");

    card.className =
        "chat-card";

    card.innerHTML = `

        <h4>${title}</h4>

        ${htmlContent}

    `;

    dynamicContent.appendChild(card);

    scrollChatToBottom();

    return card;

}


/* =========================================================
   14. CREATE ACTION BUTTON
========================================================= */

function createActionButton(
    text,
    onClick,
    className = "chat-option"
) {

    const button =
        document.createElement("button");

    button.type =
        "button";

    button.className =
        className;

    button.textContent =
        text;

    button.addEventListener(
        "click",
        onClick
    );

    return button;

}


/* =========================================================
   15. CLEAR DYNAMIC CONTENT
========================================================= */

function clearDynamicContent() {

    dynamicContent.innerHTML = "";

}


/* =========================================================
   16. SCROLL CHAT
========================================================= */

function scrollChatToBottom() {

    setTimeout(() => {

        chatContent.scrollTop =
            chatContent.scrollHeight;

    }, 50);

}


/* =========================================================
   17. START BOOKING
========================================================= */

function startBooking() {

    resetBooking();

    state.currentStep =
        "patient-name";

    createChatCard(
        "Book Appointment",
        `
            <p>
                Please enter the patient's full name.
            </p>
        `
    );

    messageInput.placeholder =
        "Enter patient's full name...";

    messageInput.focus();

}


/* =========================================================
   18. HANDLE PATIENT NAME
========================================================= */

function collectPatientName(name) {

    state.booking.patientName =
        name.trim();

    addUserMessage(
        state.booking.patientName
    );

    state.currentStep =
        "patient-phone";

    addBotMessage(
        "Thank you. Please enter your phone number."
    );

    messageInput.placeholder =
        "Enter phone number...";

}


/* =========================================================
   19. HANDLE PHONE NUMBER
========================================================= */

function collectPhoneNumber(phone) {

    state.booking.phone =
        phone.trim();

    addUserMessage(
        state.booking.phone
    );

    showConsultationType();

}


/* =========================================================
   20. CONSULTATION TYPE
========================================================= */

function showConsultationType() {

    state.currentStep =
        "consultation-type";

    const card =
        createChatCard(

            "Consultation Type",

            `
                <p>
                    How would you like to consult
                    the selected care provider?
                </p>
            `
        );


    const inPerson =
        createActionButton(

            "🏥 In-Person Appointment",

            () => {

                selectConsultationType(
                    "In-Person Appointment"
                );

            }

        );


    const online =
        createActionButton(

            "💻 Online Appointment",

            () => {

                selectConsultationType(
                    "Online Appointment"
                );

            }

        );


    card.appendChild(inPerson);

    card.appendChild(online);

}


/* =========================================================
   21. SELECT CONSULTATION TYPE
========================================================= */

function selectConsultationType(type) {

    state.booking.appointmentType =
        type;

    addUserMessage(type);

    if (
        type ===
        "Online Appointment"
    ) {

        showOnlineAppointmentInformation();

        return;

    }

    showClinicSelection();

}


/* =========================================================
   22. ONLINE APPOINTMENT INFO
========================================================= */

function showOnlineAppointmentInformation() {

    const card =
        createChatCard(

            "Online Consultation",

            `
                <p>
                    Your appointment will be registered
                    as an online consultation request.
                </p>
            `
        );


    const continueButton =
        createActionButton(

            "Continue",

            () => {

                showAppointmentDates();

            }

        );


    card.appendChild(
        continueButton
    );

}


/* =========================================================
   23. CLINIC SELECTION
========================================================= */

function showClinicSelection() { if (!CONFIG.clinic.address) { showToast('Clinic location is not yet verified. Please contact staff.'); return; } selectClinic(CONFIG.clinic.city, CONFIG.clinic.name, CONFIG.clinic.address); }

/* =========================================================
   24. SELECT CLINIC
========================================================= */

function selectClinic(cityName, clinicLabel, address) {
    state.booking.city = cityName || CONFIG.clinic.city;
    state.booking.clinic = clinicLabel || "Nighat Medical Complex";

    addUserMessage(clinicLabel || "Nighat Medical Complex");

    createChatCard(
        clinicLabel || "Nighat Medical Complex",
        `
            <p><strong>Address:</strong> ${address || CONFIG.clinic.address}</p>
            <p><strong>Schedule:</strong> ${CONFIG.clinic.schedule}</p>
        `
    );

    showAppointmentDates();
}


/* =========================================================
   25. APPOINTMENT DATES
========================================================= */

function showAppointmentDates() {

    state.currentStep =
        "appointment-date";

    const card =
        createChatCard(

            "Select Appointment Date",

            `
                <p>
                    Please select your preferred
                    appointment date.
                </p>
            `
        );


    const dates =
        generateAvailableDates();


    dates.forEach((date) => {

        const button =
            createActionButton(

                `📅 ${date.label}`,

                () => {

                    selectAppointmentDate(
                        date.value,
                        date.label
                    );

                }

            );


        card.appendChild(
            button
        );

    });

}


/* =========================================================
   26. GENERATE FRONTEND DEMO DATES

   Backend will later replace this method.
========================================================= */

function generateAvailableDates() {

    const dates = [];

    const currentDate =
        new Date();


    for (
        let dayOffset = 1;
        dayOffset <= 7;
        dayOffset++
    ) {

        const date =
            new Date(currentDate);

        date.setDate(
            currentDate.getDate() +
            dayOffset
        );


        /*
         Clinic is Monday-Saturday.
         Skip Sunday.
        */

        if (
            date.getDay() === 0
        ) {

            continue;

        }


        const label =
            date.toLocaleDateString(
                "en-GB",
                {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );


        dates.push({

            value:
                date.toISOString()
                    .split("T")[0],

            label

        });

    }


    return dates;

}


/* =========================================================
   27. SELECT DATE
========================================================= */

function selectAppointmentDate(
    value,
    label
) {

    state.booking.date =
        value;

    addUserMessage(
        `📅 ${label}`
    );

    showAppointmentTimes();

}


/* =========================================================
   28. SHOW AVAILABLE TIMES

   These are FRONTEND DEMO slots only.

   Backend will later return actual available,
   blocked and booked slots.
========================================================= */

async function showAppointmentTimes() {

    state.currentStep =
        "appointment-time";

    const card =
        createChatCard(

            "Select Appointment Time",

            `
                <p>
                    Please select an available
                    consultation time.
                </p>
            `
        );

    let timeSlots = [];
    try {
        const res = await fetch(`/api/appointments/slots?date=${state.booking.date}`, { signal: AbortSignal.timeout(15000) });
        const json = await res.json();
        if (!res.ok || !json.success || !Array.isArray(json.data?.slots)) throw new Error('Availability unavailable');
        timeSlots = json.data.slots;
    } catch (e) {
        const notice = document.createElement('p');
        notice.textContent = 'We could not load availability. Please retry or select another date.';
        card.appendChild(notice);
        card.appendChild(createActionButton('Retry availability', showAppointmentTimes));
        return;
    }

    if (timeSlots.length === 0) {
        const p = document.createElement("p");
        p.style.color = "var(--danger)";
        p.textContent = "No available slots for this date. Please select another date.";
        card.appendChild(p);
        return;
    }

    timeSlots.forEach((time) => {

        const button =
            createActionButton(

                `🕒 ${time}`,

                () => {

                    selectAppointmentTime(
                        time
                    );

                }

            );

        card.appendChild(
            button
        );

    });

}


/* =========================================================
   29. SELECT APPOINTMENT TIME
========================================================= */

function selectAppointmentTime(time) {

    state.booking.time =
        time;

    addUserMessage(
        `🕒 ${time}`
    );

    showBookingReview();

}


/* =========================================================
   30. BOOKING REVIEW
========================================================= */

function showBookingReview() {

    state.currentStep =
        "booking-review";


    const clinicText =

        state.booking.appointmentType ===
        "Online Appointment"

            ? "Online Consultation"

            : state.booking.clinic;


    const card =
        createChatCard(

            "Please Confirm Your Appointment",

            `

                <div class="booking-review">

                    <p>
                        <strong>Patient:</strong>
                        ${state.booking.patientName}
                    </p>

                    <p>
                        <strong>Phone Number:</strong>
                        ${state.booking.phone}
                    </p>

                    <p>
                        <strong>Appointment Type:</strong>
                        ${state.booking.appointmentType}
                    </p>

                    <p>
                        <strong>Clinic:</strong>
                        ${clinicText}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            state.booking.date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${state.booking.time}
                    </p>

                </div>

            `
        );


    const confirmButton =
        createActionButton(

            "✅ Confirm Appointment",

            confirmAppointment

        );


    const changeButton =
        createActionButton(

            "✏️ Change Details",

            restartBooking

        );


    const cancelButton =
        createActionButton(

            "❌ Cancel",

            cancelCurrentBooking

        );


    card.appendChild(
        confirmButton
    );

    card.appendChild(
        changeButton
    );

    card.appendChild(
        cancelButton
    );

}


/* =========================================================
   31. CONFIRM APPOINTMENT

   For now this is FRONTEND simulation.
   Backend API will replace saving later.
========================================================= */

async function confirmAppointment(btnEvent) {
    const btn = (btnEvent && btnEvent.target) ? btnEvent.target : document.querySelector('.action-btn-confirm');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Confirming...";
    }

    try {
        const response = await fetch("/api/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientName: state.booking.patientName,
                phone: state.booking.phone,
                appointmentType: state.booking.appointmentType,
                clinic: state.booking.clinic || CONFIG.clinic.name,
                city: CONFIG.clinic.city,
                date: state.booking.date,
                time: state.booking.time
            })
        });

        const json = await response.json();

        if (json.success && json.data) {
            state.booking.token = json.data.tokenNumber;
            state.booking.appointmentId = json.data.appointmentId;
        } else {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "✅ Confirm Appointment";
            }
            showToast(json.message || "Selected appointment slot is no longer available. Please choose another time.");
            showAppointmentTimes();
            return;
        }
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "✅ Confirm Appointment";
        }
        showToast("Unable to confirm your appointment. Please try again or contact clinic staff.");
        return;
    }

    state.currentStep = "booking-confirmed";

    clearDynamicContent();

    const card = createChatCard(
        "✅ Appointment Confirmed",
        `
            <p>
                Your appointment with the selected care provider has been confirmed successfully.
            </p>
            <br>
            <p><strong>Patient:</strong> ${state.booking.patientName}</p>
            <p><strong>Phone Number:</strong> ${state.booking.phone}</p>
            <p><strong>Appointment Type:</strong> ${state.booking.appointmentType}</p>
            <p><strong>Clinic:</strong> ${state.booking.clinic || "Nighat Medical Complex"}</p>
            <p><strong>Date:</strong> ${formatDate(state.booking.date)}</p>
            <p><strong>Time:</strong> ${state.booking.time}</p>
            <p><strong>Token Number:</strong> ${state.booking.token}</p>
            <p><strong>Appointment ID:</strong> ${state.booking.appointmentId}</p>
        `
    );

    card.classList.add("success-card");

    const viewButton = createActionButton("📋 View Appointment", viewCurrentAppointment);
    const mainMenuButton = createActionButton("🏠 Main Menu", showMainMenu);

    card.appendChild(viewButton);
    card.appendChild(mainMenuButton);

    showToast("Appointment Confirmed & Saved Successfully!");
}


/* =========================================================
   32. GENERATE TOKEN
========================================================= */

function generateTokenNumber() {

    const number =
        Math.floor(
            Math.random() * 999
        ) + 1;


    return String(number)
        .padStart(3, "0");

}


/* =========================================================
   33. GENERATE APPOINTMENT ID
========================================================= */

function generateAppointmentId() {

    const year =
        new Date().getFullYear();


    const random =
        Math.floor(
            1000 +
            Math.random() * 9000
        );


    return `MZA-${year}-${random}`;

}


/* =========================================================
   34. VIEW CURRENT APPOINTMENT
========================================================= */

function viewCurrentAppointment() {

    clearDynamicContent();


    const card =
        createChatCard(

            "Appointment Details",

            `

                <p>
                    <strong>Token:</strong>
                    ${state.booking.token}
                </p>

                <p>
                    <strong>Appointment ID:</strong>
                    ${state.booking.appointmentId}
                </p>

                <p>
                    <strong>Patient:</strong>
                    ${state.booking.patientName}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${state.booking.phone}
                </p>

                <p>
                    <strong>Type:</strong>
                    ${state.booking.appointmentType}
                </p>

                <p>
                    <strong>Date:</strong>
                    ${formatDate(
                        state.booking.date
                    )}
                </p>

                <p>
                    <strong>Time:</strong>
                    ${state.booking.time}
                </p>

            `
        );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   35. RESTART BOOKING
========================================================= */

function restartBooking() {

    clearDynamicContent();

    startBooking();

}


/* =========================================================
   36. CANCEL BOOKING
========================================================= */

function cancelCurrentBooking() {

    resetBooking();

    clearDynamicContent();


    addBotMessage(
        "Your appointment booking has been cancelled."
    );


    const card =
        createChatCard(
            "What would you like to do next?"
        );


    card.appendChild(

        createActionButton(

            "📅 Book Appointment",

            startBooking

        )

    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   37. RESET BOOKING
========================================================= */

function resetBooking() {

    state.booking = {

        patientName: "",

        phone: "",

        appointmentType: "",

        clinic: "",

        date: "",

        time: "",

        token: "",

        appointmentId: ""

    };

}


/* =========================================================
   38. MANAGE APPOINTMENT (STEP-BY-STEP FLOW)
========================================================= */

function showManageAppointment() {
    showManageAppointmentSearchStep();
}


/* =========================================================
   39. STEP 1: SEARCH APPOINTMENT
========================================================= */

function showManageAppointmentSearchStep() {
    state.currentFlow = "manageAppointmentSearch";
    state.currentStep = "manage-appointment-search";
    hideMainMenu();
    clearDynamicContent();

    const prefilled = state.booking.token || state.booking.appointmentId || state.booking.phone || "";

    const card = createChatCard(
        "🔍 Search Appointment",
        `
            <p style="color:#475569; font-size:13px; line-height:1.6; margin-bottom:12px;">
                Please enter your Token Number, Appointment ID, or registered phone number to search your appointment.
            </p>
            <form class="chat-form" id="manageSearchForm" onsubmit="return false;" style="margin-top:8px;">
                <input type="text" id="manageSearchQueryInput" value="${prefilled}" placeholder="Enter Token Number / Appointment ID / Phone" required style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:10px; padding:0 12px; font-size:13px; margin-bottom:10px;">
            </form>
        `
    );

    // Primary Search Button
    card.appendChild(
        createActionButton(
            "🔍 Search Appointment",
            () => {
                const queryInput = document.getElementById("manageSearchQueryInput");
                const query = queryInput ? queryInput.value.trim() : "";
                if (!query) {
                    showToast("Please enter a Token Number, Appointment ID, or Phone Number.");
                    queryInput?.focus();
                    return;
                }
                executeAppointmentSearch(query);
            },
            "primary-action"
        )
    );

    // Main Menu Button
    card.appendChild(
        createActionButton(
            "🏠 Main Menu",
            showMainMenu
        )
    );

    // Enable Enter key submission inside input
    setTimeout(() => {
        const queryInput = document.getElementById("manageSearchQueryInput");
        if (queryInput) {
            queryInput.focus();
            queryInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const query = queryInput.value.trim();
                    if (!query) {
                        showToast("Please enter a Token Number, Appointment ID, or Phone Number.");
                        return;
                    }
                    executeAppointmentSearch(query);
                }
            });
        }
    }, 100);

    scrollChatToBottom();
}

async function executeAppointmentSearch(query) {
    addUserMessage(`🔍 Search: ${query}`);
    showToast("Searching clinic records...");

    try {
        const res = await fetch(`/api/appointments/search?query=${encodeURIComponent(query)}`);
        const json = await res.json();

        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            if (json.data.length === 1) {
                const appointment = json.data[0];
                state.managedAppointment = appointment;
                renderAppointmentFoundCard(appointment);
            } else {
                renderMultipleAppointmentsCard(json.data);
            }
        } else {
            renderAppointmentNotFoundCard(query);
        }
    } catch (e) {
        console.error("Search error:", e);
        renderAppointmentNotFoundCard(query);
    }
}

function renderMultipleAppointmentsCard(appointments) {
    clearDynamicContent();

    addBotMessage(`📋 Found ${appointments.length} appointments for your search. Please choose which appointment you would like to manage.`);

    const card = createChatCard(
        `📋 ${appointments.length} Appointments Found`,
        `
            <p style="color:#475569; font-size:13px; line-height:1.6; margin-bottom:12px;">
                Multiple appointments were found. Please select which appointment you would like to manage:
            </p>
        `
    );

    appointments.forEach((appt) => {
        const statusUpper = (appt.status || "CONFIRMED").toUpperCase();
        card.appendChild(
            createActionButton(
                `Token #${appt.tokenNumber} | ${appt.date} (${appt.time}) - ${statusUpper}`,
                () => {
                    state.managedAppointment = appt;
                    renderAppointmentFoundCard(appt);
                }
            )
        );
    });

    card.appendChild(
        createActionButton(
            "🏠 Main Menu",
            showMainMenu
        )
    );

    scrollChatToBottom();
}

function renderAppointmentNotFoundCard(query) {
    clearDynamicContent();

    addBotMessage(`❌ No appointment found.\n\nPlease check your Token Number, Appointment ID, or phone number and try again.`);

    const card = createChatCard(
        "❌ No Appointment Found",
        `
            <p style="color:#475569; font-size:13px; line-height:1.6; margin-bottom:10px;">
                No appointment record was found matching <strong>${query}</strong>.
            </p>
            <p style="color:#64748b; font-size:12px; line-height:1.5; margin-bottom:12px;">
                Please check your Token Number, Appointment ID, or registered phone number and try again.
            </p>
        `
    );

    card.appendChild(
        createActionButton(
            "🔍 Try Searching Again",
            showManageAppointmentSearchStep,
            "primary-action"
        )
    );

    card.appendChild(
        createActionButton(
            "🏠 Main Menu",
            showMainMenu
        )
    );

    scrollChatToBottom();
}

function renderAppointmentFoundCard(appt) {
    clearDynamicContent();

    const statusUpper = (appt.status || "CONFIRMED").toUpperCase();
    const statusClass = (appt.status || "confirmed").toLowerCase();

    addBotMessage(`✅ Appointment Found!\n\nPatient Name: ${appt.patientName}\nAppointment ID: ${appt.appointmentId}\nToken Number: #${appt.tokenNumber}\nDoctor: the selected care provider\nDate: ${appt.date}\nTime: ${appt.time}\nStatus: ${statusUpper}`);

    const card = createChatCard(
        "✅ Appointment Found",
        `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:12px; font-size:13px; line-height:1.7;">
                <p><strong>Patient Name:</strong> ${appt.patientName}</p>
                <p><strong>Appointment ID:</strong> <code>${appt.appointmentId}</code></p>
                <p><strong>Token Number:</strong> <strong>#${appt.tokenNumber}</strong></p>
                <p><strong>Doctor:</strong> the selected care provider</p>
                <p><strong>Appointment Date:</strong> ${appt.date}</p>
                <p><strong>Appointment Time:</strong> ${appt.time}</p>
                <p><strong>Appointment Type:</strong> ${appt.appointmentType || "In-Person Appointment"}</p>
                <p><strong>Appointment Status:</strong> <span class="status-badge ${statusClass}">${statusUpper}</span></p>
            </div>
            <p style="font-weight:600; margin-bottom:8px; font-size:13px; color:#334155;">What would you like to do?</p>
        `
    );

    // 1. ❌ Cancel Appointment (Red button)
    card.appendChild(
        createActionButton(
            "❌ Cancel Appointment",
            () => showCancelConfirmation(appt),
            "chat-btn-cancel"
        )
    );

    // 2. ✅ Confirm Booking (Green button)
    card.appendChild(
        createActionButton(
            "✅ Confirm Booking",
            () => showConfirmBookingStep(appt),
            "chat-btn-confirm"
        )
    );

    // 3. 🔄 Reschedule Appointment (Blue button)
    card.appendChild(
        createActionButton(
            "🔄 Reschedule Appointment",
            () => showRescheduleStep1(appt),
            "chat-btn-reschedule"
        )
    );

    // Main Menu navigation
    card.appendChild(
        createActionButton(
            "🏠 Main Menu",
            showMainMenu
        )
    );

    scrollChatToBottom();
}


/* =========================================================
   39B. OPTION 1: CANCEL APPOINTMENT
========================================================= */

function showCancelConfirmation(appt) {
    if ((appt.status || "").toLowerCase() === "cancelled") {
        clearDynamicContent();
        const card = createChatCard(
            "ℹ️ Appointment Already Cancelled",
            `
                <p style="color:#475569; font-size:13px; line-height:1.6; margin-bottom:12px;">
                    This appointment (ID: <strong>${appt.appointmentId}</strong>, Token #${appt.tokenNumber}) is already cancelled.
                </p>
            `
        );
        card.appendChild(createActionButton("📅 Book New Appointment", () => sendPatientMessageToBackend("📅 Book Appointment", "BOOK_APPOINTMENT"), "chat-btn-confirm"));
        card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));
        scrollChatToBottom();
        return;
    }

    clearDynamicContent();

    const card = createChatCard(
        "Cancel Appointment",
        `
            <p style="font-weight:600; color:#b91c1c; margin-bottom:10px; font-size:13px;">
                Are you sure you want to cancel this appointment?
            </p>
            <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:10px; padding:12px; font-size:13px; line-height:1.7; margin-bottom:12px;">
                <p><strong>Patient:</strong> ${appt.patientName}</p>
                <p><strong>Appointment ID:</strong> ${appt.appointmentId}</p>
                <p><strong>Token Number:</strong> #${appt.tokenNumber}</p>
                <p><strong>Date & Time:</strong> ${appt.date} at ${appt.time}</p>
            </div>
        `
    );

    card.appendChild(
        createActionButton(
            "YES - Cancel Appointment",
            () => executeAppointmentCancellation(appt),
            "chat-btn-cancel"
        )
    );

    card.appendChild(
        createActionButton(
            "NO - Keep Appointment",
            () => renderAppointmentFoundCard(appt)
        )
    );

    scrollChatToBottom();
}

async function executeAppointmentCancellation(appt) {
    showToast("Cancelling appointment...");
    try {
        const targetId = appt.appointmentId || appt._id;
        const res = await fetch(`/api/appointments/${targetId}/cancel`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Patient Request" })
        });
        const json = await res.json();

        if (json.success) {
            appt.status = "cancelled";
            clearDynamicContent();

            addBotMessage(`❌ Your appointment has been cancelled successfully.\n\nAppointment Details:\nAppointment ID: ${appt.appointmentId}\nToken Number: #${appt.tokenNumber}\nDate: ${appt.date}\nTime: ${appt.time}`);

            const card = createChatCard(
                "❌ Appointment Cancelled",
                `
                    <p style="color:#b91c1c; font-weight:600; margin-bottom:10px; font-size:13px;">
                        ❌ Your appointment has been cancelled successfully.
                    </p>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; font-size:13px; line-height:1.7; margin-bottom:12px;">
                        <p><strong>Appointment ID:</strong> ${appt.appointmentId}</p>
                        <p><strong>Token Number:</strong> #${appt.tokenNumber}</p>
                        <p><strong>Date:</strong> ${appt.date}</p>
                        <p><strong>Time:</strong> ${appt.time}</p>
                    </div>
                    <p style="font-size:12px; color:#64748b; margin-bottom:12px;">The appointment slot has been released back to clinic availability.</p>
                `
            );

            card.appendChild(createActionButton("📅 Book New Appointment", () => sendPatientMessageToBackend("📅 Book Appointment", "BOOK_APPOINTMENT"), "chat-btn-confirm"));
            card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));

            showToast("Appointment Cancelled & Slot Released");
            scrollChatToBottom();
        } else {
            showToast(json.message || "Unable to cancel appointment.");
        }
    } catch (e) {
        console.error("Cancel error:", e);
        showToast("Unable to cancel appointment. Please check connection.");
    }
}


/* =========================================================
   39C. OPTION 2: CONFIRM BOOKING
========================================================= */

function showConfirmBookingStep(appt) {
    const currentStatus = (appt.status || "").toLowerCase();

    // If appointment is already confirmed:
    if (currentStatus === "confirmed") {
        clearDynamicContent();
        addBotMessage("✅ Your appointment is already confirmed.");

        const card = createChatCard(
            "✅ Appointment Already Confirmed",
            `
                <p style="color:#166534; font-size:13px; line-height:1.6; margin-bottom:12px; font-weight:600;">
                    ✅ Your appointment is already confirmed.
                </p>
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; font-size:13px; line-height:1.7; margin-bottom:12px;">
                    <p><strong>Patient:</strong> ${appt.patientName}</p>
                    <p><strong>Doctor:</strong> the selected care provider</p>
                    <p><strong>Date:</strong> ${appt.date}</p>
                    <p><strong>Time:</strong> ${appt.time}</p>
                    <p><strong>Token Number:</strong> #${appt.tokenNumber}</p>
                    <p><strong>Appointment ID:</strong> ${appt.appointmentId}</p>
                </div>
            `
        );
        card.appendChild(createActionButton("❌ Cancel Appointment", () => showCancelConfirmation(appt), "chat-btn-cancel"));
        card.appendChild(createActionButton("🔄 Reschedule Appointment", () => showRescheduleStep1(appt), "chat-btn-reschedule"));
        card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));
        scrollChatToBottom();
        return;
    }

    clearDynamicContent();

    const card = createChatCard(
        "Confirm Booking",
        `
            <p style="font-weight:600; margin-bottom:10px; font-size:13px;">Appointment Details:</p>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; font-size:13px; line-height:1.7; margin-bottom:12px;">
                <p><strong>Patient:</strong> ${appt.patientName}</p>
                <p><strong>Doctor:</strong> the selected care provider</p>
                <p><strong>Date:</strong> ${appt.date}</p>
                <p><strong>Time:</strong> ${appt.time}</p>
                <p><strong>Token Number:</strong> #${appt.tokenNumber}</p>
                <p><strong>Appointment ID:</strong> ${appt.appointmentId}</p>
            </div>
            <p style="font-weight:600; color:#0f766e; font-size:13px; margin-bottom:12px;">Do you want to confirm this appointment?</p>
        `
    );

    card.appendChild(
        createActionButton(
            "✅ Confirm Appointment",
            () => executeAppointmentConfirmation(appt),
            "chat-btn-confirm"
        )
    );

    card.appendChild(
        createActionButton(
            "Cancel",
            () => renderAppointmentFoundCard(appt)
        )
    );

    scrollChatToBottom();
}

async function executeAppointmentConfirmation(appt) {
    showToast("Confirming appointment...");
    try {
        const targetId = appt.appointmentId || appt._id;
        const res = await fetch(`/api/appointments/${targetId}/confirm`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" }
        });
        const json = await res.json();

        if (json.success) {
            appt.status = "confirmed";
            clearDynamicContent();

            addBotMessage(`✅ Your appointment has been confirmed successfully.\n\nAppointment Details:\nPatient: ${appt.patientName}\nDoctor: the selected care provider\nDate: ${appt.date}\nTime: ${appt.time}\nToken Number: #${appt.tokenNumber}\nAppointment ID: ${appt.appointmentId}`);

            const card = createChatCard(
                "✅ Appointment Confirmed",
                `
                    <p style="color:#0f766e; font-weight:600; margin-bottom:10px; font-size:13px;">
                        ✅ Your appointment has been confirmed successfully.
                    </p>
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; font-size:13px; line-height:1.7; margin-bottom:12px;">
                        <p><strong>Patient:</strong> ${appt.patientName}</p>
                        <p><strong>Doctor:</strong> the selected care provider</p>
                        <p><strong>Date:</strong> ${appt.date}</p>
                        <p><strong>Time:</strong> ${appt.time}</p>
                        <p><strong>Token Number:</strong> #${appt.tokenNumber}</p>
                        <p><strong>Appointment ID:</strong> ${appt.appointmentId}</p>
                    </div>
                `
            );

            card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));

            showToast("Appointment Confirmed & Saved");
            scrollChatToBottom();
        } else {
            showToast(json.message || "Unable to confirm appointment.");
        }
    } catch (e) {
        console.error("Confirm error:", e);
        showToast("Unable to confirm appointment. Please check connection.");
    }
}


/* =========================================================
   39D. OPTION 3: RESCHEDULE APPOINTMENT
========================================================= */

function showRescheduleStep1(appt) {
    clearDynamicContent();

    addBotMessage(`🔄 Reschedule Appointment\n\nCurrent Appointment:\n• Appointment ID: ${appt.appointmentId}\n• Token Number: #${appt.tokenNumber}\n• Current Date: ${appt.date}\n• Current Time: ${appt.time}\n\nPlease select your new preferred appointment date.`);

    const card = createChatCard(
        "🔄 Reschedule Appointment",
        `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:12px; font-size:13px; line-height:1.7;">
                <p><strong>Appointment ID:</strong> <code>${appt.appointmentId}</code></p>
                <p><strong>Token Number:</strong> <strong>#${appt.tokenNumber}</strong></p>
                <p><strong>Current Date:</strong> ${appt.date}</p>
                <p><strong>Current Time:</strong> ${appt.time}</p>
            </div>
            <p style="font-weight:600; color:#1e293b; margin-bottom:8px; font-size:13px;">
                Please select your new preferred appointment date:
            </p>
        `
    );

    const dates = generateAvailableDates();

    dates.forEach((date) => {
        card.appendChild(
            createActionButton(
                `📅 ${date.label}`,
                () => showRescheduleTimes(appt, date.value, date.label)
            )
        );
    });

    card.appendChild(
        createActionButton(
            "Cancel",
            () => renderAppointmentFoundCard(appt)
        )
    );

    scrollChatToBottom();
}

async function showRescheduleTimes(appt, dateValue, dateLabel) {
    clearDynamicContent();

    addUserMessage(`📅 ${dateLabel}`);
    addBotMessage(`Please select an available consultation time slot for ${dateLabel}.`);

    const card = createChatCard(
        "Select New Time Slot",
        `
            <p style="font-size:13px; color:#475569; margin-bottom:12px;">
                Selected Date: <strong>${dateLabel}</strong> (${dateValue})<br>
                Please select your preferred time slot:
            </p>
        `
    );

    let timeSlots = [];
    try {
        const res = await fetch(`/api/appointments/slots?date=${dateValue}`, { signal: AbortSignal.timeout(15000) });
        const json = await res.json();
        if (!res.ok || !json.success || !Array.isArray(json.data?.slots)) throw new Error('Availability unavailable');
        timeSlots = json.data.slots;
    } catch (error) {
        const notice = document.createElement('p');
        notice.textContent = 'We could not load available times. Please retry.';
        card.appendChild(notice);
        card.appendChild(createActionButton('Retry availability', () => showRescheduleTimes(appt, dateValue, dateLabel)));
        return;
    }

    if (timeSlots.length === 0) {
        const p = document.createElement("p");
        p.style.color = "#dc2626";
        p.style.fontSize = "13px";
        p.style.fontWeight = "600";
        p.textContent = "No available slots for this date. Please select another date.";
        card.appendChild(p);

        card.appendChild(
            createActionButton(
                "📅 Choose Another Date",
                () => showRescheduleStep1(appt),
                "chat-btn-reschedule"
            )
        );
        card.appendChild(
            createActionButton(
                "Cancel",
                () => renderAppointmentFoundCard(appt)
            )
        );
        scrollChatToBottom();
        return;
    }

    timeSlots.forEach((time) => {
        card.appendChild(
            createActionButton(
                `🕒 ${time}`,
                () => showRescheduleConfirmation(appt, dateValue, time, dateLabel)
            )
        );
    });

    card.appendChild(
        createActionButton(
            "⬅️ Back to Date Selection",
            () => showRescheduleStep1(appt)
        )
    );

    card.appendChild(
        createActionButton(
            "Cancel",
            () => renderAppointmentFoundCard(appt)
        )
    );

    scrollChatToBottom();
}

function showRescheduleConfirmation(appt, newDate, newTime, dateLabel) {
    clearDynamicContent();

    addUserMessage(`🕒 ${newTime}`);

    const card = createChatCard(
        "Confirm Reschedule",
        `
            <p style="font-weight:600; color:#1e3a8a; margin-bottom:10px; font-size:13px;">
                Do you want to reschedule your appointment to:
            </p>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px; font-size:13px; line-height:1.7; margin-bottom:12px;">
                <p><strong>Appointment ID:</strong> ${appt.appointmentId}</p>
                <p><strong>Token Number:</strong> #${appt.tokenNumber}</p>
                <p><strong>Patient Name:</strong> ${appt.patientName}</p>
                <p><strong>New Date:</strong> ${newDate} ${dateLabel ? `(${dateLabel})` : ''}</p>
                <p><strong>New Time:</strong> ${newTime}</p>
            </div>
        `
    );

    card.appendChild(
        createActionButton(
            "Confirm Reschedule",
            () => executeReschedule(appt, newDate, newTime, dateLabel),
            "chat-btn-reschedule"
        )
    );

    card.appendChild(
        createActionButton(
            "Cancel",
            () => renderAppointmentFoundCard(appt)
        )
    );

    scrollChatToBottom();
}

async function executeReschedule(appt, newDate, newTime, dateLabel) {
    showToast("Rescheduling appointment...");
    try {
        const targetId = appt.appointmentId || appt._id;
        const res = await fetch(`/api/appointments/${targetId}/reschedule`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: newDate,
                time: newTime
            })
        });
        const json = await res.json();

        if (json.success) {
            appt.date = newDate;
            appt.time = newTime;
            appt.status = "confirmed";
            if (json.data && json.data.rescheduledAt) {
                appt.rescheduledAt = json.data.rescheduledAt;
            }

            clearDynamicContent();

            addBotMessage(`✅ Your appointment has been rescheduled successfully.\n\nNew Appointment Details:\nAppointment ID: ${appt.appointmentId}\nToken Number: #${appt.tokenNumber}\nNew Date: ${newDate}\nNew Time: ${newTime}`);

            const card = createChatCard(
                "✅ Appointment Rescheduled",
                `
                    <p style="color:#1e40af; font-weight:600; margin-bottom:10px; font-size:13px;">
                        ✅ Your appointment has been rescheduled successfully.
                    </p>
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px; font-size:13px; line-height:1.7; margin-bottom:12px;">
                        <p><strong>Appointment ID:</strong> ${appt.appointmentId}</p>
                        <p><strong>Token Number:</strong> #${appt.tokenNumber}</p>
                        <p><strong>New Date:</strong> ${newDate}</p>
                        <p><strong>New Time:</strong> ${newTime}</p>
                    </div>
                `
            );

            card.appendChild(
                createActionButton(
                    "📋 View Appointment",
                    () => renderAppointmentFoundCard(appt),
                    "chat-btn-reschedule"
                )
            );

            card.appendChild(
                createActionButton(
                    "🏠 Main Menu",
                    showMainMenu
                )
            );

            showToast("Appointment Rescheduled Successfully");
            scrollChatToBottom();
        } else {
            const errorMsg = json.message || "Selected time slot is not available. Please choose another slot.";
            showToast(errorMsg);
            addBotMessage(`⚠️ ${errorMsg}`);

            clearDynamicContent();
            const card = createChatCard(
                "⚠️ Slot Unavailable",
                `
                    <p style="color:#b91c1c; font-weight:600; margin-bottom:10px; font-size:13px;">
                        ${errorMsg}
                    </p>
                `
            );
            card.appendChild(
                createActionButton(
                    "🔄 Try Another Date or Time",
                    () => showRescheduleStep1(appt),
                    "chat-btn-reschedule"
                )
            );
            card.appendChild(
                createActionButton(
                    "Cancel",
                    () => renderAppointmentFoundCard(appt)
                )
            );
            scrollChatToBottom();
        }
    } catch (e) {
        console.error("Reschedule error:", e);
        showToast("Unable to reschedule. Please check connection.");
    }
}


/* =========================================================
   40. CLINIC INFORMATION
========================================================= */

function showClinicInformation() { sendPatientMessageToBackend('Clinic information'); }


/* =========================================================
   41. TREATMENT INFORMATION
========================================================= */

function showTreatmentInformation() { sendPatientMessageToBackend('Medical services'); }


/* =========================================================
   42. DOCTOR PROFILE
========================================================= */

function showDoctorProfile() { sendPatientMessageToBackend('Doctor profile'); }


/* =========================================================
   43. ONLINE CONSULTATION
========================================================= */

function startOnlineConsultation() {

    resetBooking();

    state.booking.appointmentType =
        "Online Appointment";

    state.currentStep =
        "patient-name";


    createChatCard(

        "Online Consultation",

        `

            <p>
                Please enter the patient's
                full name to start your
                virtual clinic request.
            </p>

        `
    );


    messageInput.placeholder =
        "Enter patient's full name...";

    messageInput.focus();

}


/* =========================================================
   44. REPORT UPLOAD START
========================================================= */

function startReportUpload() {

    showReportUploadForm();

    if (medicalFileInput) {
        medicalFileInput.click();
    }

}


/* =========================================================
   45. SELECT REPORT TYPE
========================================================= */

function selectReportType(type) {

    state.report.type =
        type;

    addUserMessage(type);

    showReportUploadForm(type);

}


/* =========================================================
   46. REPORT UPLOAD FORM
========================================================= */

function showReportUploadForm(selectedType) {

    clearDynamicContent();

    state.currentStep = "report-upload";
    if (selectedType) {
        state.report.type = selectedType;
    } else if (!state.report.type) {
        state.report.type = "MRI Scan";
    }

    const defaultPhone = state.report.phone || state.booking.phone || "";
    const defaultToken = state.report.token || state.booking.token || "";
    const defaultApptId = state.booking.appointmentId || "";
    const currentFileName = state.report.file
        ? `Selected: ${state.report.file.name} (${(state.report.file.size / 1024).toFixed(1)} KB)`
        : "No file selected";

    const reportOptions = [
        "MRI Scan",
        "X-Ray",
        "Prescription",
        "Laboratory Report",
        "Discharge Summary",
        "Other Report"
    ];

    const categoryOptionsHtml = reportOptions.map(opt => `
        <option value="${opt}" ${state.report.type === opt ? 'selected' : ''}>${opt}</option>
    `).join("");

    const card =
        createChatCard(

            "Upload Medical Report",

            `
                <form class="chat-form" id="reportForm" onsubmit="return false;">
                    <label>Report Category</label>
                    <select id="reportCategorySelect" style="width:100%; height:40px; border:1px solid #DCE7E3; border-radius:10px; padding:0 10px; margin-bottom:12px; background:#fff; font-size:14px; font-family:inherit;">
                        ${categoryOptionsHtml}
                    </select>

                    <label>Patient Contact Phone Number</label>
                    <input type="text" id="reportPhone" value="${defaultPhone}" placeholder="03001234567" required style="margin-bottom:12px;">

                    <label>Token Number / Appointment ID (Optional)</label>
                    <input type="text" id="reportToken" value="${defaultToken || defaultApptId}" placeholder="Token Number (e.g. 001) or ID" style="margin-bottom:12px;">

                    <label>Medical Document (PDF, JPG, JPEG, PNG)</label>
                    <button type="button" class="chat-option" id="chooseReportFile" style="text-align:center; justify-content:center; margin-bottom:6px;">
                        📎 Choose PDF / JPG / JPEG / PNG
                    </button>
                    <p id="selectedFileName" style="margin-top:4px; margin-bottom:10px; font-size:13px; font-weight:600; color:${state.report.file ? '#0f766e' : '#64748b'};">${currentFileName}</p>
                </form>
            `
        );

    const categorySelect = document.getElementById("reportCategorySelect");
    if (categorySelect) {
        categorySelect.addEventListener("change", (e) => {
            state.report.type = e.target.value;
        });
    }

    const uploadButton = createActionButton("Upload Document Now", () => {
        if (state.report.file) {
            uploadSelectedReportFile(state.report.file);
        } else {
            medicalFileInput?.click();
        }
    }, "primary-action");
    uploadButton.id = "submitReportUploadButton";
    card.appendChild(uploadButton);
    card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));

    document.getElementById("chooseReportFile")?.addEventListener("click", (e) => {
        e.preventDefault();
        medicalFileInput.click();
    });

    scrollChatToBottom();
}

/* =========================================================
   47. PROCESS & UPLOAD REPORT FILE
========================================================= */

async function uploadSelectedReportFile(file) {
    if (isUploading) return;

    if (!file) {
        showToast("Please select a medical report file (PDF, JPG, JPEG, PNG).");
        medicalFileInput?.click();
        return;
    }

    // Validate file extension
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];
    const fileName = file.name.toLowerCase();
    const isAllowed = allowedExts.some(ext => fileName.endsWith(ext));
    if (!isAllowed) {
        addUserMessage(`📎 ${file.name}`);
        addBotMessage("❌ Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.");
        showToast("Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.");
        if (medicalFileInput) medicalFileInput.value = "";
        return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        addUserMessage(`📎 ${file.name}`);
        addBotMessage("❌ File size exceeds 10MB limit. Please upload a smaller file.");
        showToast("File size exceeds 10MB limit. Please upload a smaller file.");
        if (medicalFileInput) medicalFileInput.value = "";
        return;
    }

    isUploading = true;

    // 1. Show file in chat UI
    addUserMessage(`📎 ${file.name}`);
    addBotMessage(`⏳ Uploading ${file.name}... Please wait.`);

    const phoneInput = document.getElementById("reportPhone");
    const tokenInput = document.getElementById("reportToken");
    const categorySelect = document.getElementById("reportCategorySelect");

    const phone = phoneInput ? phoneInput.value.trim() : (state.report.phone || state.booking.phone || "Chat Patient");
    const token = tokenInput ? tokenInput.value.trim() : (state.report.token || state.booking.token || "");
    const appointmentId = token || state.booking.appointmentId || "";
    const reportCategory = categorySelect ? categorySelect.value : (state.report.type || "MRI Scan");

    state.report.phone = phone;
    state.report.token = token;
    state.report.type = reportCategory;

    const submitBtn = document.getElementById("submitReportUploadButton");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Uploading Report...";
        submitBtn.style.opacity = "0.7";
        submitBtn.style.cursor = "not-allowed";
    }

    const formData = new FormData();
    formData.append("phone", phone);
    formData.append("token", token);
    formData.append("appointmentId", appointmentId);
    formData.append("reportType", reportCategory);
    formData.append("patientName", state.booking.patientName || "Patient");
    formData.append("reportFile", file);

    try {
        const response = await fetch("/api/reports", {
            method: "POST",
            body: formData
        });
        const json = await response.json();
        if (json.success && (json.data || json.report)) {
            const reportInfo = json.data || json.report;
            addBotMessage("✅ Your medical report has been uploaded successfully.\n\nOur team will review your report and contact you if required.");
            showReportUploadSuccess(reportInfo);
            state.report.file = null;
            if (medicalFileInput) medicalFileInput.value = "";
            showToast("Report Uploaded & Synced with Admin Panel");
        } else {
            addBotMessage("❌ Unable to upload your report. Please try again.");
            showToast(json.message || "Unable to upload report. Please try again.");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Upload Document Now";
                submitBtn.style.opacity = "1";
                submitBtn.style.cursor = "pointer";
            }
        }
    } catch (e) {
        console.error("Upload error:", e);
        addBotMessage("❌ Unable to upload your report. Please try again.");
        showToast("Unable to upload medical report. Please check server connection.");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Upload Document Now";
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
        }
    } finally {
        isUploading = false;
    }
}

async function submitReportUpload() {
    if (state.report.file) {
        await uploadSelectedReportFile(state.report.file);
    } else {
        medicalFileInput?.click();
    }
}

/* =========================================================
   48. REPORT SUCCESS
========================================================= */

function showReportUploadSuccess(reportData) {
    clearDynamicContent();

    const reportTypeName = (reportData && reportData.reportType) || state.report.type || "Medical Report";
    const fileName = (reportData && (reportData.originalFileName || reportData.fileName || reportData.storedFileName)) || (state.report.file ? state.report.file.name : "Document");
    const repId = (reportData && (reportData.reportId || reportData._id)) || "";

    const card = createChatCard(
        "✅ Report Uploaded Successfully",
        `
            <p>
                Your medical report has been securely uploaded and saved to the selected care provider's clinic record.
            </p>
            <br>
            <p><strong>Report ID:</strong> ${repId || 'Generated'}</p>
            <p><strong>Report Type:</strong> ${reportTypeName}</p>
            <p><strong>File Name:</strong> ${fileName}</p>
            <p><strong>Status:</strong> Under Doctor / Staff Review</p>
        `
    );

    card.classList.add("success-card");

    card.appendChild(createActionButton("📎 Upload Another Report", startReportUpload));
    card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));

    scrollChatToBottom();
}


/* =========================================================
   49. FILE UPLOAD SETUP
========================================================= */

function setupFileUpload() {

    if (medicalFileInput && !medicalFileInput.dataset.listenerAttached) {
        medicalFileInput.dataset.listenerAttached = "true";

        medicalFileInput.addEventListener(
            "change",
            () => {
                const file = medicalFileInput.files[0];
                if (!file) return;

                state.report.file = file;
                uploadSelectedReportFile(file);
            }
        );
    }

    if (attachButton && !attachButton.dataset.listenerAttached) {
        attachButton.dataset.listenerAttached = "true";

        attachButton.addEventListener(
            "click",
            (e) => {
                e.preventDefault();
                startReportUpload();
            }
        );
    }

}


/* =========================================================
   50. STAFF HANDOVER
========================================================= */

function requestStaffHandover() {

    const card =
        createChatCard(

            "Speak to Staff",

            `

                <p>
                    Your request can be transferred
                    to a human clinic assistant or the selected care provider.
                </p>

            `
        );


    card.appendChild(

        createActionButton(

            "Request Human Assistant",

            async () => {

                addUserMessage(
                    "Request Human Assistant"
                );

                showToast(
                    "Staff handover requested."
                );

                try {
                    const response = await fetch("/api/staff/handover", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            sessionId: state.sessionId,
                            patientName: state.booking.patientName || "Patient",
                            phone: state.booking.phone || "",
                            message: "Patient requested human clinic staff assistant."
                        })
                    });
                    const resJson = await response.json();
                    if (resJson.success && resJson.data && resJson.data.mode) {
                        updateModeHeader(resJson.data.mode);
                    }
                    addBotMessage(
                        "Your staff assistance request has been recorded. clinic staff or a clinic assistant will review it shortly."
                    );
                } catch (e) {
                    addBotMessage(
                        "Your staff assistance request has been recorded."
                    );
                }

            }

        )

    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   51. MESSAGE COMPOSER & BACKEND AI/MANUAL INTEGRATION
========================================================= */

function updateModeHeader(mode, takenBy) {
    state.conversationMode = mode || "AI";
    if (patientChatModeLabel && patientOnlineStatus) {
        if (mode === "MANUAL") {
            patientOnlineStatus.classList.add("manual");
            patientChatModeLabel.textContent = "Manual Mode Active (Doctor Responding)";
        } else {
            patientOnlineStatus.classList.remove("manual");
            patientChatModeLabel.textContent = "AI Assistant Active";
        }
    }
}

function addDoctorMessage(message, senderName = "the selected care provider") {
    renderMessageItem({
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        sender: 'DOCTOR',
        senderName: senderName,
        text: message,
        timestamp: new Date()
    });
}

function addSystemNotice(message) {
    renderMessageItem({
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        sender: 'SYSTEM',
        senderName: 'System',
        text: message,
        timestamp: new Date()
    });
}

async function sendPatientMessageToBackend(text, payload = null, action = null, existingClientMessageId = null) {
    if (isSending) return;
    isSending = true;
    if (sendButton) sendButton.disabled = true;
    showTypingIndicator();
    const requestController = new AbortController();
    const clientMessageId = existingClientMessageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const requestMessage = { text, payload, action, clientMessageId };
    activeChatRequestController = requestController;
    const timeoutId = window.setTimeout(() => {
        requestController.abort(new DOMException("Chat request timed out.", "TimeoutError"));
    }, CHAT_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch("/api/staff/chat/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: state.sessionId,
                patientName: state.booking.patientName || "Patient",
                phone: state.booking.phone || "",
                message: text,
                payload: payload || text,
                workflowAction: action,
                language: state.language,
                clientMessageId: clientMessageId
            }),
            signal: requestController.signal
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to send message`);
        }

        const resJson = await response.json();
        if (!resJson.success || !resJson.data || !Array.isArray(resJson.data.messages)) {
            throw new Error(resJson.message || "The assistant returned an invalid response.");
        }

        updateModeHeader(resJson.data.mode, resJson.data.manualTakenBy);

        const sorted = [...resJson.data.messages].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        let renderedAny = false;
        sorted.forEach(msg => {
            const msgId = msg.messageId || `${msg.sender}_${msg.sequence || ''}_${msg.text || ''}`;
            if (!renderedMessageIds.has(msgId)) {
                renderMessageItem(msg);
                renderedAny = true;
            }
        });
        if (resJson.data.lastSequence) {
            lastSequence = Math.max(lastSequence, resJson.data.lastSequence);
        }
        if (renderedAny) {
            scrollChatToBottom();
        }

        removeChatRequestErrors();
        lastFailedChatMessage = null;
        syncInputStateForWorkflow(resJson.data.activeWorkflow, resJson.data.workflowStep);
    } catch (error) {
        console.error("Message send error:", error);
        lastFailedChatMessage = requestMessage;
        const isTimeout = requestController.signal.aborted && requestController.signal.reason?.name === "TimeoutError";
        const message = isTimeout
            ? "The assistant is taking longer than expected. Please try again."
            : "I couldn't send your message. Please check your connection and try again.";
        renderMessageItem({
            messageId: `chat_error_${Date.now()}`,
            sender: "AI",
            senderName: "Nighat AI Assistant",
            text: message,
            options: [{
                label: state.language === "urdu" ? "دوبارہ کوشش کریں" : "↻ Try again",
                value: "RETRY_MESSAGE",
                action: "retry_message"
            }],
            timestamp: new Date()
        });
    } finally {
        window.clearTimeout(timeoutId);
        removeTypingIndicator();
        if (activeChatRequestController === requestController) {
            activeChatRequestController = null;
        }
        isSending = false;
        if (sendButton) sendButton.disabled = false;
        if (messageInput && !messageInput.disabled) messageInput.focus();
    }
}

async function loadInitialChatHistory() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        const phoneParam = encodeURIComponent(state.booking.phone || "");
        const res = await fetch(`/api/staff/chat/messages?sessionId=${state.sessionId}&phone=${phoneParam}`);
        const resJson = await res.json();
        if (resJson.success && resJson.data) {
            const data = resJson.data;
            updateModeHeader(data.mode, data.manualTakenBy);
            
            // Clean previously rendered dynamic message items from feed once
            const feed = getMessagesFeed();
            if (feed) {
                feed.innerHTML = "";
            }
            renderedMessageIds.clear();

            if (Array.isArray(data.messages) && data.messages.length > 0) {
                if (welcomeCard) welcomeCard.classList.add("hidden");
                if (mainMenu) mainMenu.classList.remove("hidden");

                const sorted = [...data.messages].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                sorted.forEach(msg => renderMessageItem(msg));
                lastSequence = data.lastSequence || sorted[sorted.length - 1].sequence || 0;
                scrollChatToBottom();
            } else {
                lastSequence = 0;
            }
        }
    } catch (e) {
        console.warn("Initial chat load error:", e);
    } finally {
        isSyncing = false;
    }
}

async function pollNewMessages() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        const phoneParam = encodeURIComponent(state.booking.phone || "");
        const res = await fetch(`/api/staff/chat/messages?sessionId=${state.sessionId}&phone=${phoneParam}&afterSequence=${lastSequence}`);
        const resJson = await res.json();
        if (resJson.success && resJson.data) {
            const data = resJson.data;
            updateModeHeader(data.mode, data.manualTakenBy);

            const newMessages = Array.isArray(data.messages) ? data.messages : [];
            if (newMessages.length > 0) {
                const sorted = [...newMessages].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                let renderedAny = false;
                sorted.forEach(msg => {
                    const msgId = msg.messageId || `${msg.sender}_${msg.sequence || ''}_${msg.text}`;
                    if (!renderedMessageIds.has(msgId)) {
                        renderMessageItem(msg);
                        renderedAny = true;
                    }
                });
                lastSequence = data.lastSequence || sorted[sorted.length - 1].sequence || lastSequence;
                if (renderedAny) {
                    scrollChatToBottom();
                }
            }
        }
    } catch (e) {
    } finally {
        isSyncing = false;
    }
}

async function initChatSync() {
    if (chatInitialized) return;
    chatInitialized = true;

    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }

    await loadInitialChatHistory();
    chatPollingInterval = setInterval(pollNewMessages, 2500);
}

window.addEventListener("beforeunload", () => {
    if (activeChatRequestController) {
        activeChatRequestController.abort();
    }
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
});

async function handleMessageSubmit(event) {
    if (event) event.preventDefault();

    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text || isSending) return;

    // Check if user is currently searching in Manage Appointment flow
    if (state.currentFlow === "manageAppointmentSearch" || state.currentStep === "manage-appointment-search") {
        messageInput.value = "";
        executeAppointmentSearch(text);
        return;
    }

    // Check if user typed 'manage appointment' into chat input
    const lowerText = text.toLowerCase();
    if (lowerText === "manage appointment" || lowerText === "manage my appointment" || lowerText === "manage" || lowerText.includes("manage appointment")) {
        messageInput.value = "";
        showManageAppointmentSearchStep();
        return;
    }

    messageInput.value = "";
    await sendPatientMessageToBackend(text);
}

function setupMessageComposer() {
    const messageForm = document.getElementById("messageForm");
    if (messageForm && !messageForm.dataset.listenerAttached) {
        messageForm.addEventListener("submit", handleMessageSubmit);
        messageForm.dataset.listenerAttached = "true";
    }

    sendButton?.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            handleMessageSubmit(event);
        }
    );

    messageInput?.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleMessageSubmit(event);
            }
        }
    );
}


/* =========================================================
   53. UTILITY BUTTONS
========================================================= */

function setupUtilityButtons() {

    directionsButton
        ?.addEventListener(
            "click",
            openClinicDirections
        );


    callClinicButton
        ?.addEventListener(
            "click",
            callClinic
        );


    staffDashboardButton
        ?.addEventListener(
            "click",
            () => {
                window.location.href = "../admin/admin.html";
            }
        );

}


/* =========================================================
   54. DIRECTIONS
========================================================= */

function openClinicDirections() {
    if (!CONFIG.clinic.address) { showToast('Address not yet verified. Please contact clinic staff.'); return; }

    const location =
        encodeURIComponent(
            CONFIG.clinic.address
        );


    window.open(

        `https://www.google.com/maps/search/?api=1&query=${location}`,

        "_blank"

    );

}


/* =========================================================
   55. CALL CLINIC
========================================================= */

function callClinic() {
    if (!CONFIG.clinic.phone) { showToast('Phone number not yet verified. Please contact clinic staff.'); return; }

    window.location.href =
        `tel:${CONFIG.clinic.phone}`;

}


/* =========================================================
   56. FORMAT DATE
========================================================= */

function formatDate(dateString) {

    if (!dateString) {

        return "";

    }


    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    return date.toLocaleDateString(

        "en-GB",

        {

            weekday: "long",

            day: "2-digit",

            month: "long",

            year: "numeric"

        }

    );

}


/* =========================================================
   57. SHOW TOAST
========================================================= */

function showToast(message) {

    toastText.textContent =
        message;


    toast.classList.remove(
        "hidden"
    );


    clearTimeout(
        showToast.timer
    );


    showToast.timer =
        setTimeout(
            () => {

                toast.classList.add(
                    "hidden"
                );

            },
            2800
        );

}


/* =========================================================
   58. START APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);
