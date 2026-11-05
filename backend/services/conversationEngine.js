/** Shared Nighat Medical Complex conversation engine for website and WhatsApp. */

const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const StaffMessage = require('../models/StaffMessage');
const EmergencyAlert = require('../models/EmergencyAlert');
const Treatment = require('../models/Treatment');

const { generateAppointmentId } = require('../utils/appointmentIdGenerator');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { generateSlotsForDate } = require('../utils/slotGenerator');
const {
    CLINIC_TIMEZONE,
    getClinicNow,
    formatDateToYYYYMMDD,
    getDayOfWeek,
    parseClinicDate,
    parseClinicTime,
    WEEKDAY_DISPLAY
} = require('../utils/clinicDateParser');

// In-memory fallback if MongoDB connection drops during development
const memorySessionStore = new Map();
const memoryBookedSlots = new Map();

const knowledge = require('./knowledgeService');
const CLINIC_INFO = new Proxy({}, { get: (_, key) => knowledge.info()[key] });

const MEDICAL_DISCLAIMER_EN = "⚠️ *Medical Notice: I am an AI Clinic Assistant. I provide clinic information and facilitate appointment scheduling. I do not provide definitive diagnoses or prescribe medications.*";
const MEDICAL_DISCLAIMER_UR = "⚠️ *طبی تنبیہ: میں ایک اے آئی اسسٹنٹ ہوں۔ میں کلینک کی معلومات اور اپائنٹمنٹ بکنگ میں مدد کرتا ہوں، لیکن ادویات تجویز نہیں کرتا۔*";

// Red Flag Emergency Keywords
const EMERGENCY_KEYWORDS = [
    'chest pain', 'heart attack', 'can\'t breathe', 'cant breathe', 'difficulty breathing',
    'breathlessness', 'paralysis', 'stroke', 'unconscious', 'fainted', 'loss of consciousness',
    'severe bleeding', 'coughing blood', 'vomiting blood', 'loss of bowel', 'loss of bladder',
    'incontinence', 'seizure', 'fits', 'سینے میں درد', 'سانس نہیں آرہا', 'بے ہوش', 'فالج'
];

// Human Handover Keywords
const HANDOVER_KEYWORDS = [
    'talk to human', 'speak to staff', 'call me', 'human agent', 'real person',
    'talk to doctor directly', 'receptionist', 'admin', 'operator', 'agent please',
    'human', 'staff', 'insan se baat', 'kisi se baat karwao', 'call karo', 'نمایندہ', 'عملہ'
];

const isDBConnected = () => mongoose.connection && mongoose.connection.readyState === 1;

/**
 * Generate unique message ID
 */
function createMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normalize Pakistani phone number:
 * 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX, 03XX-XXXXXXX -> '03XXXXXXXXX'
 */
function normalizePakistanPhone(phoneStr) {
    if (!phoneStr) return null;
    const digits = String(phoneStr).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('03')) {
        return digits;
    }
    if (digits.length === 12 && digits.startsWith('923')) {
        return '0' + digits.slice(2);
    }
    if (digits.length === 10 && digits.startsWith('3')) {
        return '0' + digits;
    }
    if (digits.length >= 10 && digits.length <= 13) {
        return digits;
    }
    return null;
}

/**
 * Get next upcoming valid clinic dates (Asia/Karachi, excluding Sundays and off-days)
 */
async function getUpcomingClinicDates(count = 5) {
    const dates = [];
    const now = getClinicNow();
    let curDate = new Date(Date.UTC(now.year, now.month - 1, now.day));

    const config = await knowledge.getKnowledge();
    if (!config.schedule.verified || !knowledge.bookingDoctor(config) || config.schedule.bookingEnabled === false || !isDBConnected()) return [];
    let inspected = 0;
    while (dates.length < count && inspected++ < 60) {
        curDate.setUTCDate(curDate.getUTCDate() + 1);
        const dayOfWeek = curDate.getUTCDay();
        const y = curDate.getUTCFullYear(), m = curDate.getUTCMonth() + 1, d = curDate.getUTCDate();
        const dateIso = formatDateToYYYYMMDD(y, m, d);
        const availability = await generateSlotsForDate({ dateStr: dateIso, AppointmentModel: Appointment, OffDayModel: OffDay, BlockedSlotModel: BlockedSlot, SpecialScheduleModel: SpecialSchedule, ClinicModel: Clinic });
        if (!availability.slots.length) continue;
        const dayName = WEEKDAY_DISPLAY[dayOfWeek];
        const monthShort = curDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
        const labelEn = `${dayName}, ${monthShort} ${d}`;
        
        const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
        const urduMonths = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
        const labelUr = `${urduDays[dayOfWeek]}، ${d} ${urduMonths[m - 1]}`;

        dates.push({
            dateIso,
            dayOfWeek,
            dayName,
            labelEn,
            labelUr
        });
    }

    return dates;
}

/**
 * Detect user language from text
 */
function detectLanguage(text) {
    if (!text) return 'english';
    if (/[\u0600-\u06FF]/.test(text)) return 'urdu';
    const lower = text.toLowerCase();
    if (lower.includes('apointment') || lower.includes('chahiye') || lower.includes('karni hai') ||
        lower.includes('mil sakta') || lower.includes('shukriya') || lower.includes('kab') ||
        lower.includes('kahan') || lower.includes('kia') || lower.includes('hai')) {
        return 'urdu'; // Roman Urdu detected
    }
    return 'english';
}

/**
 * Standardized responses for English and Urdu
 */
const MESSAGES = {
    WELCOME_GREETING: knowledge.GREETINGS,
    LANGUAGE_OPTIONS: [
        { label: "🇬🇧 English", value: "LANG_ENGLISH", action: "select_language" },
        { label: "🇵🇰 اردو (Urdu)", value: "LANG_URDU", action: "select_language" }
    ],
    MAIN_MENU_TITLE: knowledge.GREETINGS,
    MAIN_MENU_OPTIONS: {
        en: [
            { label: "📅 Book Appointment", value: "BOOK_APPOINTMENT", action: "start_booking" },
            { label: "🔍 Manage Existing Appointment", value: "MANAGE_APPOINTMENT", action: "manage_booking" },
            { label: 'Our Doctors', value: 'DOCTORS_INFO', action: 'doctor_info' },
            { label: "🏥 Clinic Information & Timings", value: "CLINIC_INFO", action: "clinic_info" },
            { label: "🩺 Treatments & Services", value: "TREATMENT_INFO", action: "treatment_info" },
            { label: "👤 Speak to Clinic Staff", value: "SPEAK_STAFF", action: "speak_staff" },
            { label: "🌐 Change Language", value: "CHANGE_LANGUAGE", action: "change_language" }
        ],
        ur: [
            { label: "📅 اپائنٹمنٹ بک کریں", value: "BOOK_APPOINTMENT", action: "start_booking" },
            { label: "🔍 موجودہ اپائنٹمنٹ چیک / تبدیل کریں", value: "MANAGE_APPOINTMENT", action: "manage_booking" },
            { label: 'ہمارے ڈاکٹرز', value: 'DOCTORS_INFO', action: 'doctor_info' },
            { label: "🏥 کلینک کی معلومات اور اوقات", value: "CLINIC_INFO", action: "clinic_info" },
            { label: "🩺 علاج اور طریقہ کار", value: "TREATMENT_INFO", action: "treatment_info" },
            { label: "👤 کلینک عملے سے بات کریں", value: "SPEAK_STAFF", action: "speak_staff" },
            { label: "🌐 زبان تبدیل کریں", value: "CHANGE_LANGUAGE", action: "change_language" }
        ]
    },
    STEP_NAME: {
        en: `Step 1 of 5 — Patient Name\n\nPlease enter the patient's full name to book an appointment:`,
        ur: `مرحلہ 1 از 5 — مریض کا نام\n\nاپائنٹمنٹ بک کرنے کے لیے اپنا مکمل نام لکھیں:`
    },
    STEP_PHONE: {
        en: (name) => `Step 2 of 5 — Mobile Number\n\nThank you, ${name}. Please enter your mobile number (e.g., 03XXXXXXXXX):`,
        ur: (name) => `مرحلہ 2 از 5 — موبائل نمبر\n\nشکریہ ${name} صاحب۔ اپنا موبائل نمبر درج کریں (مثلاً 03XXXXXXXXX):`
    },
    INVALID_PHONE: {
        en: `⚠️ Please enter a valid Pakistan mobile number (e.g., 03XXXXXXXXX or +923XXXXXXXXX):`,
        ur: `⚠️ براہ کرم درست پاکستانی موبائل نمبر درج کریں (مثلاً 03XXXXXXXXX یا 03001234567):`
    },
    STEP_DATE: {
        en: `Step 3 of 5 — Appointment Date\n\nPlease select your preferred appointment date:`,
        ur: `مرحلہ 3 از 5 — تاریخ\n\nاپائنٹمنٹ کی تاریخ منتخب کریں:`
    },
    STEP_SLOT: {
        en: (dateLabel) => `Step 4 of 5 — Appointment Time & Token\n\nPlease select your preferred appointment time for ${dateLabel}. Token number is shown below:`,
        ur: (dateLabel) => `مرحلہ 4 از 5 — وقت اور ٹوکن\n\n${dateLabel} کے لیے اپائنٹمنٹ کا وقت منتخب کریں۔ ٹوکن نیچے دکھایا گیا ہے:`
    },
    STEP_CONFIRM: {
        en: (data) => `Step 5 of 5 — Please confirm your appointment details:\n\n👤 Patient: ${data.patientName}\n📱 Phone: ${data.phone}\n👨‍⚕️ Doctor: ${CLINIC_INFO.doctor}\n🏥 Clinic: ${CLINIC_INFO.clinic}\n📅 Date: ${data.dateLabel || data.date}\n⏰ Time: ${data.timeSlot}\n🎟️ Token: #${data.tokenNumber || 'Assigned on Confirmation'}\n\nWould you like to confirm your appointment?`,
        ur: (data) => `مرحلہ 5 از 5 — براہ کرم اپائنٹمنٹ کی تفصیلات کی تصدیق کریں:\n\n👤 مریض: ${data.patientName}\n📱 فون: ${data.phone}\n👨‍⚕️ ڈاکٹر: ${CLINIC_INFO.doctor}\n🏥 کلینک: ${CLINIC_INFO.clinic}\n📅 تاریخ: ${data.dateLabel || data.date}\n⏰ وقت: ${data.timeSlot}\n🎟️ ٹوکن نمبر: #${data.tokenNumber || 'تصدیق پر جاری ہوگا'}\n\nکیا آپ یہ اپائنٹمنٹ کنفرم کرنا چاہتے ہیں؟`
    },
    CONFIRM_OPTIONS: {
        en: [
            { label: "✅ Confirm Appointment", value: "CONFIRM_BOOKING", action: "confirm_booking" },
            { label: "📅 Change Date", value: "CHANGE_DATE", action: "change_date" },
            { label: "⏰ Change Time", value: "CHANGE_TIME", action: "change_time" },
            { label: "❌ Cancel Booking", value: "CANCEL_BOOKING", action: "cancel_booking" }
        ],
        ur: [
            { label: "✅ تصدیق کریں (Confirm)", value: "CONFIRM_BOOKING", action: "confirm_booking" },
            { label: "📅 تاریخ تبدیل کریں", value: "CHANGE_DATE", action: "change_date" },
            { label: "⏰ وقت تبدیل کریں", value: "CHANGE_TIME", action: "change_time" },
            { label: "❌ منسوخ کریں", value: "CANCEL_BOOKING", action: "cancel_booking" }
        ]
    },
    COMMON_NAV: {
        en: [
            { label: "↩ Back", value: "NAV_BACK", action: "nav_back" },
            { label: "🏠 Main Menu", value: "NAV_MENU", action: "nav_menu" }
        ],
        ur: [
            { label: "↩ واپس", value: "NAV_BACK", action: "nav_back" },
            { label: "🏠 مین مینو", value: "NAV_MENU", action: "nav_menu" }
        ]
    }
};

/**
 * External LLM Adapter (Optional: Gemini / OpenAI)
 */
async function callOptionalLLM() { return null; }

/**
 * Main Entry Point: Process incoming message from Website or WhatsApp
 */
async function processConversationWithContext({
    sessionId,
    channel = 'website',
    messageText = '',
    action = null,
    payload = null,
    language = null,
    patientName = null,
    phone = null,
    existingSessionDoc = null,
    metadata = {}
}) {
    const sid = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const cleanMsg = (messageText || '').trim();
    const cleanPayload = (payload || '').trim();
    const cleanAction = (action || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. Use existing passed sessionDoc or load/initialize Conversation Session
    let sessionDoc = existingSessionDoc;
    if (!sessionDoc && isDBConnected()) {
        try {
            sessionDoc = await StaffMessage.findOne({ sessionId: sid });
            if (!sessionDoc && phone) {
                sessionDoc = await StaffMessage.findOne({ phone }).sort({ updatedAt: -1 });
                if (sessionDoc && !sessionDoc.sessionId) {
                    sessionDoc.sessionId = sid;
                }
            }
        } catch (e) {
            sessionDoc = null;
        }
    }

    if (!sessionDoc) {
        sessionDoc = memorySessionStore.get(sid) || null;
    }

    if (!sessionDoc) {
        const initialLang = language || detectLanguage(cleanMsg);
        const initData = {
            sessionId: sid,
            patientName: patientName || 'Patient',
            phone: phone || 'Not provided',
            message: cleanMsg,
            channel: channel,
            language: initialLang,
            mode: 'AI',
            activeWorkflow: null,
            workflowStep: null,
            workflowData: {},
            status: 'pending',
            messages: [],
            lastMessage: cleanMsg,
            lastSender: 'PATIENT'
        };

        if (isDBConnected()) {
            try {
                sessionDoc = await StaffMessage.create(initData);
            } catch (err) {
                sessionDoc = { ...initData, _id: `stf_${Date.now()}` };
                memorySessionStore.set(sid, sessionDoc);
            }
        } else {
            sessionDoc = { ...initData, _id: `stf_${Date.now()}` };
            memorySessionStore.set(sid, sessionDoc);
        }
    }

    // Ensure state integrity
    if (!sessionDoc.workflowData) sessionDoc.workflowData = {};
    if (language) sessionDoc.language = language;
    if (patientName && sessionDoc.patientName === 'Patient') sessionDoc.patientName = patientName;
    if (phone && (!sessionDoc.phone || sessionDoc.phone === 'Not provided')) sessionDoc.phone = phone;
    if (channel) sessionDoc.channel = channel;

    const currentLang = sessionDoc.language === 'urdu' ? 'ur' : 'en';

    // 2. Check if Human Staff Mode (MANUAL) is active
    if (sessionDoc.mode === 'MANUAL') {
        return {
            mode: 'MANUAL',
            activeWorkflow: sessionDoc.activeWorkflow,
            workflowStep: sessionDoc.workflowStep,
            aiResponded: false,
            replyText: currentLang === 'ur' 
                ? 'آپ کا پیغام موصول ہو گیا ہے۔ ہمارا عملہ جلد آپ سے رابطہ کرے گا۔'
                : 'Your message has been received. Our clinic staff will assist you shortly.',
            sessionId: sid,
            manualTakenBy: sessionDoc.manualTakenBy || 'Clinic staff',
            messages: sessionDoc.messages
        };
    }

    // 3. Emergency Detection (Red Flag Safety)
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lowerMsg.includes(k));
    if (isEmergency) {
        if (isDBConnected()) {
            try {
                await EmergencyAlert.create({
                    patientName: sessionDoc.patientName || 'Emergency Patient',
                    phone: sessionDoc.phone || 'Unknown',
                    message: `Emergency keyword triggered: "${cleanMsg}"`,
                    status: 'open',
                    priority: 'urgent',
                    source: `${channel === 'whatsapp' ? 'WhatsApp' : 'Website'} Assistant`
                });
            } catch (e) {}
        }

        const emergencyReply = currentLang === 'ur'
            ? 'یہ فوری طبی مسئلہ ہو سکتا ہے۔ فوراً مقامی ایمرجنسی سروس یا قریبی ہسپتال کے ایمرجنسی وارڈ سے رابطہ کریں۔ اے آئی چیٹ میں علاج کا انتظار نہ کریں۔'
            : 'This may require urgent medical attention. Contact your local emergency services or go to the nearest emergency department now. Do not wait for treatment through AI chat.';
        const emergencyOptions = [{ label: currentLang === 'ur' ? 'عملے سے رابطہ' : 'Contact clinic staff', value: 'SPEAK_STAFF', action: 'speak_staff' }];
        return recordAiMessage(sessionDoc, emergencyReply, emergencyOptions, 'SYSTEM_NOTICE', null, null);
    }

    // 4. Human Handover Request
    const isHandover = HANDOVER_KEYWORDS.some(k => lowerMsg.includes(k)) || cleanPayload === 'SPEAK_STAFF';
    if (isHandover) {
        sessionDoc.mode = 'MANUAL';
        sessionDoc.status = 'pending';
        sessionDoc.manualTakeoverAt = new Date();

        const handoverReply = currentLang === 'ur'
            ? 'آپ کی درخواست نگہت میڈیکل کمپلیکس کے عملے کے لیے درج کر دی گئی ہے۔'
            : 'Your request has been recorded for Nighat Medical Complex staff. A staff member can assist when available.';
        const handoverOptions = [{ label: currentLang === 'ur' ? 'مین مینو' : 'Main Menu', value: 'NAV_MENU', action: 'nav_menu' }];
        return recordAiMessage(sessionDoc, handoverReply, handoverOptions, 'TEXT', null, null);
    }

    // 5. Navigation / Back / Reset Triggers
    if (cleanPayload === 'NAV_MENU' || lowerMsg === 'main menu' || lowerMsg === 'menu' || lowerMsg === 'reset' || lowerMsg === 'cancel' || lowerMsg === 'start over' || cleanPayload === 'CANCEL_BOOKING') {
        sessionDoc.activeWorkflow = null;
        sessionDoc.workflowStep = null;
        sessionDoc.workflowData = {};

        const reply = currentLang === 'ur' ? MESSAGES.MAIN_MENU_TITLE.ur : MESSAGES.MAIN_MENU_TITLE.en;
        const options = currentLang === 'ur' ? MESSAGES.MAIN_MENU_OPTIONS.ur : MESSAGES.MAIN_MENU_OPTIONS.en;
        return recordAiMessage(sessionDoc, reply, options, 'OPTIONS', null, null);
    }

    if (cleanPayload === 'NAV_BACK' || lowerMsg === 'back' || lowerMsg === 'wapis' || lowerMsg === 'واپس') {
        return handleBackNavigation(sessionDoc, currentLang);
    }

    // 6. Language Selection & Switching
    if (cleanPayload === 'LANG_ENGLISH' || lowerMsg === 'english') {
        sessionDoc.language = 'english';
        const reply = MESSAGES.MAIN_MENU_TITLE.en;
        const options = MESSAGES.MAIN_MENU_OPTIONS.en;
        return recordAiMessage(sessionDoc, reply, options, 'OPTIONS', null, null);
    }
    if (cleanPayload === 'LANG_URDU' || lowerMsg === 'urdu' || lowerMsg === 'اردو') {
        sessionDoc.language = 'urdu';
        const reply = MESSAGES.MAIN_MENU_TITLE.ur;
        const options = MESSAGES.MAIN_MENU_OPTIONS.ur;
        return recordAiMessage(sessionDoc, reply, options, 'OPTIONS', null, null);
    }
    if (cleanPayload === 'CHANGE_LANGUAGE' || lowerMsg.includes('change language') || lowerMsg.includes('زبان تبدیل')) {
        const promptText = `Please select your preferred language / اپنی زبان منتخب کریں:`;
        return recordAiMessage(sessionDoc, promptText, MESSAGES.LANGUAGE_OPTIONS, 'OPTIONS', null, 'LANGUAGE_SELECTION');
    }

    // 7. General Greetings ("Hi", "Hello", "Salam", "Aoa", "Hey")
    const isGreeting = /^(hi|hy|hello|hey|salam|assalam|aoa|a\.o\.a|hola|start|السلام علیکم)(\s.*)?$/i.test(lowerMsg);
    if (isGreeting && !sessionDoc.activeWorkflow) {
        const welcomeText = MESSAGES.WELCOME_GREETING[currentLang];
        return recordAiMessage(sessionDoc, welcomeText, MESSAGES.LANGUAGE_OPTIONS, 'OPTIONS', null, 'LANGUAGE_SELECTION');
    }

    // 8. Direct Booking Trigger Check (English, Urdu, or Roman Urdu)
    const isDirectBooking = cleanPayload === 'BOOK_APPOINTMENT' ||
        lowerMsg.includes('book appointment') ||
        lowerMsg.includes('appointment book') ||
        lowerMsg.includes('i want an appointment') ||
        lowerMsg.includes('need appointment') ||
        lowerMsg.includes('appointment leni') ||
        lowerMsg.includes('appointment chahiye') ||
        lowerMsg.includes('doctor se milna') ||
        lowerMsg.includes('اپائنٹمنٹ بک');

    if (isDirectBooking && sessionDoc.activeWorkflow !== 'APPOINTMENT') {
        const approved = knowledge.currentKnowledge();
        if (!approved.schedule.verified || !knowledge.bookingDoctor(approved) || approved.schedule.bookingEnabled === false) {
            return recordAiMessage(sessionDoc, knowledge.unknown(currentLang), [{ label: currentLang === 'ur' ? 'عملے سے رابطہ' : 'Contact staff', value: 'SPEAK_STAFF', action: 'speak_staff' }], 'OPTIONS', null, null);
        }

        sessionDoc.activeWorkflow = 'APPOINTMENT';
        sessionDoc.workflowStep = 'AWAITING_NAME';
        sessionDoc.workflowData = {
            doctorId: knowledge.bookingDoctor(approved).id,
            consultationType: 'In-Person Appointment',
            clinic: CLINIC_INFO.clinic,
            city: CLINIC_INFO.city
        };

        const reply = currentLang === 'ur' ? `${CLINIC_INFO.doctor} کے ساتھ اپائنٹمنٹ بک کر سکتے ہیں۔ براہ کرم اپنا پورا نام بتائیں۔` : `Certainly! You can book an appointment with ${CLINIC_INFO.doctor}. May I have your full name?`;
        const options = currentLang === 'ur' ? MESSAGES.COMMON_NAV.ur.slice(1) : MESSAGES.COMMON_NAV.en.slice(1);
        return recordAiMessage(sessionDoc, reply, options, 'TEXT', 'APPOINTMENT', 'AWAITING_NAME');
    }

    // 9. Manage Appointment Triggers
    const isManageBooking = cleanPayload === 'MANAGE_APPOINTMENT' ||
        lowerMsg.includes('manage appointment') ||
        lowerMsg.includes('check appointment') ||
        lowerMsg.includes('my appointment') ||
        lowerMsg.includes('meri booking') ||
        lowerMsg.includes('booking confirm hai') ||
        lowerMsg.includes('reschedule') ||
        lowerMsg.includes('cancel my appointment');

    if (isManageBooking && sessionDoc.activeWorkflow !== 'MANAGE') {
        sessionDoc.activeWorkflow = 'MANAGE';
        sessionDoc.workflowStep = 'MANAGE_SEARCH';
        sessionDoc.workflowData = {};

        const reply = currentLang === 'ur'
            ? `🔍 **موجودہ اپائنٹمنٹ چیک یا تبدیل کریں**\n\nبراہ کرم اپنا اپائنٹمنٹ آئی ڈی (مثلاً NMC-2026-1001)، ٹوکن نمبر، یا اپنا رجسٹرڈ موبائل نمبر لکھیں:`
            : `🔍 **Manage Existing Appointment**\n\nPlease enter your Appointment ID (e.g., NMC-2026-1001), Token Number, or registered Mobile Number:`;

        const options = currentLang === 'ur' ? MESSAGES.COMMON_NAV.ur : MESSAGES.COMMON_NAV.en;
        return recordAiMessage(sessionDoc, reply, options, 'TEXT', 'MANAGE', 'MANAGE_SEARCH');
    }

    const topic = cleanPayload === 'DOCTORS_INFO' ? 'doctors' : knowledge.matchTopic(cleanMsg, cleanPayload);
    if (topic && !/^SLOT_|^DATE_/.test(cleanPayload || '')) {
        return recordAiMessage(sessionDoc, knowledge.answer(knowledge.currentKnowledge(), topic, currentLang), MESSAGES.MAIN_MENU_OPTIONS[currentLang], 'OPTIONS', sessionDoc.activeWorkflow, sessionDoc.workflowStep);
    }

    if (cleanPayload.startsWith('SLOT_PAGE_')) {
        const page=Number(cleanPayload.slice(10));
        return promptSlotSelection(sessionDoc,sessionDoc.workflowData.newDate || sessionDoc.workflowData.date,sessionDoc.workflowData.dateLabel,currentLang,null,sessionDoc.activeWorkflow,sessionDoc.workflowStep,Number.isInteger(page)&&page>=0?page:0);
    }

    // 10. Handle Active Workflow: APPOINTMENT
    if (sessionDoc.activeWorkflow === 'APPOINTMENT') {
        return handleAppointmentWorkflowStep(sessionDoc, cleanMsg, cleanPayload, lowerMsg, currentLang);
    }

    // 11. Handle Active Workflow: MANAGE
    if (sessionDoc.activeWorkflow === 'MANAGE') {
        return handleManageWorkflowStep(sessionDoc, cleanMsg, cleanPayload, lowerMsg, currentLang);
    }

    const faq = knowledge.currentKnowledge().faqs.find(item => item.question.trim().toLowerCase() === lowerMsg && item.language === (sessionDoc.language === 'roman_urdu' ? 'roman_urdu' : currentLang === 'ur' ? 'urdu' : 'english'));
    const defaultReply = faq ? faq.answer : knowledge.unknown(currentLang) + '\n\n' + (currentLang === 'ur' ? MEDICAL_DISCLAIMER_UR : MEDICAL_DISCLAIMER_EN);
    return recordAiMessage(sessionDoc, defaultReply, MESSAGES.MAIN_MENU_OPTIONS[currentLang], 'OPTIONS', sessionDoc.activeWorkflow, sessionDoc.workflowStep);

}

/**
 * Handle Appointment Workflow Steps
 */
async function handleAppointmentWorkflowStep(sessionDoc, cleanMsg, cleanPayload, lowerMsg, currentLang) {
    const step = sessionDoc.workflowStep;

    if (cleanPayload === 'RESUME_BOOKING' || lowerMsg === 'yes' || lowerMsg === 'haan' || lowerMsg === 'ہاں') {
        // Continue from current step
        if (step === 'AWAITING_PHONE') {
            const reply = MESSAGES.STEP_PHONE[currentLang](sessionDoc.workflowData.patientName || 'Patient');
            const options = MESSAGES.COMMON_NAV[currentLang];
            return recordAiMessage(sessionDoc, reply, options, 'TEXT', 'APPOINTMENT', 'AWAITING_PHONE');
        }
        if (step === 'AWAITING_DATE') {
            return promptDateSelection(sessionDoc, currentLang);
        }
        if (step === 'AWAITING_SLOT') {
            return promptSlotSelection(sessionDoc, sessionDoc.workflowData.date, sessionDoc.workflowData.dateLabel, currentLang);
        }
        if (step === 'AWAITING_CONFIRM') {
            return promptConfirmationReview(sessionDoc, currentLang);
        }
    }

    // Step 1: AWAITING_NAME
    if (step === 'AWAITING_NAME') {
        const nameCandidate = cleanMsg.replace(/[^\w\s\u0600-\u06FF]/gi, '').trim();
        if (nameCandidate.length < 2 || /^\d+$/.test(nameCandidate)) {
            const retryMsg = currentLang === 'ur'
                ? `⚠️ براہ کرم مریض کا درست نام درج کریں (کم از کم 2 حروف):`
                : `⚠️ Please enter a valid patient full name (at least 2 characters):`;
            return recordAiMessage(sessionDoc, retryMsg, MESSAGES.COMMON_NAV[currentLang], 'TEXT', 'APPOINTMENT', 'AWAITING_NAME');
        }

        sessionDoc.workflowData.patientName = nameCandidate;
        sessionDoc.patientName = nameCandidate;
        sessionDoc.workflowStep = 'AWAITING_PHONE';

        const reply = MESSAGES.STEP_PHONE[currentLang](nameCandidate);
        const options = MESSAGES.COMMON_NAV[currentLang];
        return recordAiMessage(sessionDoc, reply, options, 'TEXT', 'APPOINTMENT', 'AWAITING_PHONE');
    }

    // Step 2: AWAITING_PHONE
    if (step === 'AWAITING_PHONE') {
        const normalizedPhone = normalizePakistanPhone(cleanMsg);
        if (!normalizedPhone) {
            const reply = MESSAGES.INVALID_PHONE[currentLang];
            return recordAiMessage(sessionDoc, reply, MESSAGES.COMMON_NAV[currentLang], 'TEXT', 'APPOINTMENT', 'AWAITING_PHONE');
        }

        sessionDoc.workflowData.phone = normalizedPhone;
        sessionDoc.phone = normalizedPhone;
        sessionDoc.workflowStep = 'AWAITING_DATE';

        return promptDateSelection(sessionDoc, currentLang);
    }

    // Step 3: AWAITING_DATE
    if (step === 'AWAITING_DATE') {
        let selectedDateIso = null;
        let selectedDateLabel = null;

        if (cleanPayload && cleanPayload.startsWith('DATE_')) {
            selectedDateIso = cleanPayload.replace('DATE_', '');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanPayload)) {
            selectedDateIso = cleanPayload;
        } else {
            // Natural date parser
            const parsed = parseClinicDate(cleanMsg);
            if (parsed.hasExplicitDate && parsed.isValid) {
                selectedDateIso = parsed.dateStr;
                selectedDateLabel = `${parsed.weekday}, ${parsed.dateStr}`;
            } else if (parsed.reason === 'weekday_mismatch' || parsed.reason === 'past_date' || parsed.reason === 'sunday_closed') {
                const clarification = parsed.clarificationMessage || (currentLang === 'ur' ? 'یہ تاریخ دستیاب نہیں ہے۔ براہ کرم دوسری تاریخ منتخب کریں۔' : 'This date is not available.');
                return promptDateSelection(sessionDoc, currentLang, clarification);
            }
        }

        if (!selectedDateIso) {
            const notUnderstood = currentLang === 'ur'
                ? `براہ کرم دی گئی فہرست میں سے تاریخ منتخب کریں یا درست تاریخ لکھیں:`
                : `Please select a date from the options below or enter a valid date:`;
            return promptDateSelection(sessionDoc, currentLang, notUnderstood);
        }

        sessionDoc.workflowData.date = selectedDateIso;
        sessionDoc.workflowData.dateLabel = selectedDateLabel || selectedDateIso;
        sessionDoc.workflowStep = 'AWAITING_SLOT';

        return promptSlotSelection(sessionDoc, selectedDateIso, sessionDoc.workflowData.dateLabel, currentLang);
    }

    // Step 4: AWAITING_SLOT
    if (step === 'AWAITING_SLOT') {
        if (cleanPayload === 'CHANGE_DATE') {
            sessionDoc.workflowStep = 'AWAITING_DATE';
            return promptDateSelection(sessionDoc, currentLang);
        }

        let selectedSlot = null;
        if (cleanPayload && cleanPayload.startsWith('SLOT_')) {
            selectedSlot = cleanPayload.replace('SLOT_', '');
        } else {
            // Match time regex like 12:00 PM, 1:30 pm, 04:00 PM
            const timeMatch = cleanMsg.match(/\b(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)\b/i);
            if (timeMatch) {
                const hour = timeMatch[1].padStart(2, '0');
                const min = timeMatch[2];
                const ampm = timeMatch[3].toUpperCase();
                selectedSlot = `${hour}:${min} ${ampm}`;
            } else if (cleanPayload && cleanPayload !== 'NAV_BACK' && cleanPayload !== 'NAV_MENU') {
                selectedSlot = cleanPayload;
            }
        }

        if (!selectedSlot) {
            const retrySlot = currentLang === 'ur'
                ? `براہ کرم دیئے گئے دستیاب اوقات میں سے ایک وقت منتخب کریں:`
                : `Please select an available time slot from the options below:`;
            return promptSlotSelection(sessionDoc, sessionDoc.workflowData.date, sessionDoc.workflowData.dateLabel, currentLang, retrySlot);
        }

        sessionDoc.workflowData.timeSlot = selectedSlot;
        sessionDoc.workflowStep = 'AWAITING_CONFIRM';

        sessionDoc.workflowData.tokenNumber = null;

        return promptConfirmationReview(sessionDoc, currentLang);
    }

    // Step 5: AWAITING_CONFIRM
    if (step === 'AWAITING_CONFIRM') {
        if (cleanPayload === 'CHANGE_DATE') {
            sessionDoc.workflowStep = 'AWAITING_DATE';
            return promptDateSelection(sessionDoc, currentLang);
        }
        if (cleanPayload === 'CHANGE_TIME') {
            sessionDoc.workflowStep = 'AWAITING_SLOT';
            return promptSlotSelection(sessionDoc, sessionDoc.workflowData.date, sessionDoc.workflowData.dateLabel, currentLang);
        }
        if (cleanPayload === 'CANCEL_BOOKING' || lowerMsg === 'cancel' || lowerMsg === 'منسوخ') {
            sessionDoc.activeWorkflow = null;
            sessionDoc.workflowStep = null;
            sessionDoc.workflowData = {};

            const cancelMsg = currentLang === 'ur'
                ? `اپائنٹمنٹ کی بکنگ منسوخ کر دی گئی ہے۔ آپ کی کیا مزید مدد کر سکتا ہوں؟`
                : `Appointment booking cancelled. How else may I assist you today?`;
            const options = currentLang === 'ur' ? MESSAGES.MAIN_MENU_OPTIONS.ur : MESSAGES.MAIN_MENU_OPTIONS.en;
            return recordAiMessage(sessionDoc, cancelMsg, options, 'OPTIONS', null, null);
        }

        const isConfirmAction = cleanPayload === 'CONFIRM_BOOKING' ||
            lowerMsg === 'confirm' ||
            lowerMsg === 'yes' ||
            lowerMsg === 'haan' ||
            lowerMsg === 'جی ہاں' ||
            lowerMsg === 'کنفرم' ||
            lowerMsg.includes('confirm appointment');

        if (isConfirmAction) {
            return executeAtomicBooking(sessionDoc, currentLang);
        }

        return promptConfirmationReview(sessionDoc, currentLang);
    }

    // Fallback if step is undefined
    sessionDoc.workflowStep = 'AWAITING_NAME';
    const reply = currentLang === 'ur' ? MESSAGES.STEP_NAME.ur : MESSAGES.STEP_NAME.en;
    return recordAiMessage(sessionDoc, reply, MESSAGES.COMMON_NAV[currentLang], 'TEXT', 'APPOINTMENT', 'AWAITING_NAME');
}

/**
 * Handle Manage Existing Appointment Steps
 */
async function handleManageWorkflowStep(sessionDoc, cleanMsg, cleanPayload, lowerMsg, currentLang) {
    const step = sessionDoc.workflowStep;

    if (step === 'MANAGE_SEARCH') {
        const query = cleanMsg.trim();
        if (!query || query.length < 3) {
            const msg = currentLang === 'ur'
                ? `براہ کرم درست اپائنٹمنٹ آئی ڈی یا فون نمبر درج کریں:`
                : `Please enter a valid Appointment ID or Phone Number:`;
            return recordAiMessage(sessionDoc, msg, MESSAGES.COMMON_NAV[currentLang], 'TEXT', 'MANAGE', 'MANAGE_SEARCH');
        }

        let appointments = [];
        if (isDBConnected()) {
            try {
                const cleanQuery = query.replace(/[#\s]/g, '');
                appointments = await Appointment.find({
                    $or: [
                        { appointmentId: new RegExp(`^${cleanQuery}$`, 'i') },
                        { tokenNumber: cleanQuery },
                        { phone: cleanQuery },
                        { phone: new RegExp(`${cleanQuery.slice(-7)}$`) }
                    ]
                }).sort({ createdAt: -1 }).limit(3).lean();
            } catch (e) {}
        }

        if (!appointments || appointments.length === 0) {
            const notFound = currentLang === 'ur'
                ? `❌ اس نمبر یا آئی ڈی کے ساتھ کوئی فعال اپائنٹمنٹ نہیں ملی۔\n\nکیا آپ نئی اپائنٹمنٹ بک کرنا چاہتے ہیں یا دوبارہ سرچ کریں؟`
                : `❌ No active appointment found matching "${query}".\n\nWould you like to book a new appointment or try searching again?`;

            const options = currentLang === 'ur'
                ? [
                    { label: "📅 نئی اپائنٹمنٹ بک کریں", value: "BOOK_APPOINTMENT", action: "start_booking" },
                    { label: "🔍 دوبارہ سرچ کریں", value: "MANAGE_APPOINTMENT", action: "manage_booking" },
                    { label: "🏠 مین مینو", value: "NAV_MENU", action: "nav_menu" }
                ]
                : [
                    { label: "📅 Book New Appointment", value: "BOOK_APPOINTMENT", action: "start_booking" },
                    { label: "🔍 Try Search Again", value: "MANAGE_APPOINTMENT", action: "manage_booking" },
                    { label: "🏠 Main Menu", value: "NAV_MENU", action: "nav_menu" }
                ];

            return recordAiMessage(sessionDoc, notFound, options, 'OPTIONS', null, null);
        }

        const appt = appointments[0];
        sessionDoc.workflowData.doctorId = appt.doctorId;
        sessionDoc.workflowData.selectedAppointmentId = appt.appointmentId;
        sessionDoc.workflowData.selectedAppointmentMongoId = String(appt._id);
        sessionDoc.workflowStep = 'MANAGE_VIEW';

        const statusLabel = appt.status.toUpperCase();
        const cardText = currentLang === 'ur'
            ? `📋 **آپ کی اپائنٹمنٹ کی تفصیلات:**\n\n• **آئی ڈی:** ${appt.appointmentId}\n• **ٹوکن نمبر:** #${appt.tokenNumber}\n• **مریض:** ${appt.patientName}\n• **تاریخ:** ${appt.date}\n• **وقت:** ${appt.time}\n• **حیثیت (Status):** ${statusLabel}\n• **ہسپتال:** ${appt.clinic}`
            : `📋 **Your Appointment Details:**\n\n• **Appointment ID:** ${appt.appointmentId}\n• **Token:** #${appt.tokenNumber}\n• **Patient:** ${appt.patientName}\n• **Date:** ${appt.date}\n• **Time:** ${appt.time}\n• **Status:** ${statusLabel}\n• **Clinic:** ${appt.clinic}`;

        const options = currentLang === 'ur'
            ? [
                { label: "🔄 وقت تبدیل کریں (Reschedule)", value: "MANAGE_RESCHEDULE", action: "manage_reschedule" },
                { label: "❌ اپائنٹمنٹ منسوخ کریں", value: "MANAGE_CANCEL", action: "manage_cancel" },
                { label: "🏠 مین مینو", value: "NAV_MENU", action: "nav_menu" }
            ]
            : [
                { label: "🔄 Reschedule Appointment", value: "MANAGE_RESCHEDULE", action: "manage_reschedule" },
                { label: "❌ Cancel Appointment", value: "MANAGE_CANCEL", action: "manage_cancel" },
                { label: "🏠 Main Menu", value: "NAV_MENU", action: "nav_menu" }
            ];

        return recordAiMessage(sessionDoc, cardText, options, 'APPOINTMENT_CARD', 'MANAGE', 'MANAGE_VIEW', { appointment: appt });
    }

    if (step === 'MANAGE_VIEW') {
        if (cleanPayload === 'MANAGE_RESCHEDULE' || lowerMsg.includes('reschedule')) {
            sessionDoc.workflowStep = 'MANAGE_RESCHEDULE_DATE';
            return promptDateSelection(sessionDoc, currentLang, currentLang === 'ur' ? 'براہ کرم ری شیڈولنگ کے لیے نئی تاریخ منتخب کریں:' : 'Please select a new appointment date for rescheduling:', 'MANAGE', 'MANAGE_RESCHEDULE_DATE');
        }
        if (cleanPayload === 'MANAGE_CANCEL' || lowerMsg.includes('cancel')) {
            sessionDoc.workflowStep = 'MANAGE_CANCEL_CONFIRM';
            const confirmCancelMsg = currentLang === 'ur'
                ? `کیا آپ واقعی اپنی اپائنٹمنٹ (${sessionDoc.workflowData.selectedAppointmentId}) منسوخ کرنا چاہتے ہیں؟`
                : `Are you sure you want to cancel appointment ${sessionDoc.workflowData.selectedAppointmentId}?`;

            const options = currentLang === 'ur'
                ? [
                    { label: "ہاں، منسوخ کریں", value: "CONFIRM_CANCEL", action: "confirm_cancel" },
                    { label: "نہیں، واپس جائیں", value: "NAV_BACK", action: "nav_back" }
                ]
                : [
                    { label: "Yes, Cancel Booking", value: "CONFIRM_CANCEL", action: "confirm_cancel" },
                    { label: "No, Keep It", value: "NAV_BACK", action: "nav_back" }
                ];

            return recordAiMessage(sessionDoc, confirmCancelMsg, options, 'OPTIONS', 'MANAGE', 'MANAGE_CANCEL_CONFIRM');
        }
    }

    if (step === 'MANAGE_CANCEL_CONFIRM') {
        if (cleanPayload === 'CONFIRM_CANCEL' || lowerMsg === 'yes' || lowerMsg === 'جی ہاں') {
            const apptId = sessionDoc.workflowData.selectedAppointmentId;
            try {
                if (!isDBConnected()) throw new Error('Database unavailable');
                const saved = await Appointment.findOneAndUpdate({appointmentId:apptId},{$set:{status:'cancelled',cancelledAt:new Date()}},{new:true});
                if (!saved) throw new Error('Appointment not found');
            } catch (_) {
                return recordAiMessage(sessionDoc,currentLang === 'ur' ? 'منسوخی محفوظ نہیں ہو سکی۔ براہ کرم دوبارہ کوشش کریں۔' : 'Cancellation could not be saved. Please retry.',MESSAGES.COMMON_NAV[currentLang],'TEXT','MANAGE','MANAGE_CANCEL_CONFIRM');
            }

            sessionDoc.activeWorkflow = null;
            sessionDoc.workflowStep = null;
            sessionDoc.workflowData = {};

            const cancelDone = currentLang === 'ur'
                ? `✅ آپ کی اپائنٹمنٹ (${apptId}) کامیابی سے منسوخ کر دی گئی ہے۔`
                : `✅ Your appointment (${apptId}) has been successfully cancelled.`;

            const options = currentLang === 'ur' ? MESSAGES.MAIN_MENU_OPTIONS.ur : MESSAGES.MAIN_MENU_OPTIONS.en;
            return recordAiMessage(sessionDoc, cancelDone, options, 'OPTIONS', null, null);
        }
    }

    if (step === 'MANAGE_RESCHEDULE_DATE') {
        let newDateIso = null;
        if (cleanPayload && cleanPayload.startsWith('DATE_')) {
            newDateIso = cleanPayload.replace('DATE_', '');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanPayload)) {
            newDateIso = cleanPayload;
        } else {
            const parsed = parseClinicDate(cleanMsg);
            if (parsed.hasExplicitDate && parsed.isValid) {
                newDateIso = parsed.dateStr;
            }
        }

        if (!newDateIso) {
            return promptDateSelection(sessionDoc, currentLang, currentLang === 'ur' ? 'براہ کرم درست نئی تاریخ منتخب کریں:' : 'Please select a valid new date:');
        }

        sessionDoc.workflowData.newDate = newDateIso;
        sessionDoc.workflowStep = 'MANAGE_RESCHEDULE_SLOT';
        return promptSlotSelection(sessionDoc, newDateIso, newDateIso, currentLang, currentLang === 'ur' ? 'ری شیڈولنگ کے لیے نیا وقت منتخب کریں:' : 'Please select a new time slot:', 'MANAGE', 'MANAGE_RESCHEDULE_SLOT');
    }

    if (step === 'MANAGE_RESCHEDULE_SLOT') {
        let newSlot = null;
        if (cleanPayload && cleanPayload.startsWith('SLOT_')) {
            newSlot = cleanPayload.replace('SLOT_', '');
        } else if (cleanPayload && cleanPayload !== 'NAV_BACK' && cleanPayload !== 'NAV_MENU') {
            newSlot = cleanPayload;
        }

        if (!newSlot) {
            return promptSlotSelection(sessionDoc, sessionDoc.workflowData.newDate, sessionDoc.workflowData.newDate, currentLang);
        }

        const apptId = sessionDoc.workflowData.selectedAppointmentId;
        const newDate = sessionDoc.workflowData.newDate;

        try { await require('./bookingService').rescheduleBooking(apptId,{date:newDate,time:newSlot,doctorId:sessionDoc.workflowData.doctorId}); }
        catch(error){return promptSlotSelection(sessionDoc,newDate,newDate,currentLang,error.statusCode ? error.message : 'Rescheduling could not be saved. Please retry.','MANAGE','MANAGE_RESCHEDULE_SLOT');}

        sessionDoc.activeWorkflow = null;
        sessionDoc.workflowStep = null;
        sessionDoc.workflowData = {};

        const reschedDone = currentLang === 'ur'
            ? `✅ آپ کی اپائنٹمنٹ (${apptId}) کامیابی کے ساتھ **${newDate}** بوقت **${newSlot}** کے لیے ری شیڈول ہو گئی ہے۔`
            : `✅ Your appointment (${apptId}) has been successfully rescheduled to **${newDate}** at **${newSlot}**.`;

        const options = currentLang === 'ur' ? MESSAGES.MAIN_MENU_OPTIONS.ur : MESSAGES.MAIN_MENU_OPTIONS.en;
        return recordAiMessage(sessionDoc, reschedDone, options, 'OPTIONS', null, null);
    }

    return recordAiMessage(sessionDoc, MESSAGES.MAIN_MENU_TITLE[currentLang], MESSAGES.MAIN_MENU_OPTIONS[currentLang], 'OPTIONS', null, null);
}

/**
 * Prompt Date Selection with Real Upcoming Dates
 */
async function promptDateSelection(sessionDoc, currentLang, customPrompt = null, workflow = 'APPOINTMENT', step = 'AWAITING_DATE') {
    const dates = await getUpcomingClinicDates(5);
    const dateOptions = dates.map(d => ({
        label: currentLang === 'ur' ? d.labelUr : d.labelEn,
        value: `DATE_${d.dateIso}`,
        action: 'select_date'
    }));

    // Add back / menu buttons
    const navButtons = MESSAGES.COMMON_NAV[currentLang];
    const fullOptions = [...dateOptions, ...navButtons];

    const promptText = customPrompt || (currentLang === 'ur' ? MESSAGES.STEP_DATE.ur : MESSAGES.STEP_DATE.en) + '\n\n' + knowledge.answer(knowledge.currentKnowledge(), 'hours', currentLang);
    return recordAiMessage(sessionDoc, promptText, fullOptions, 'DATE_SELECTION', workflow, step);
}

/**
 * Prompt Time Slot Selection with Real Backend Slots
 */
async function promptSlotSelection(sessionDoc, dateIso, dateLabel, currentLang, customPrompt = null, workflow = 'APPOINTMENT', step = 'AWAITING_SLOT', page = 0) {
    let availableSlots = [];
    try {
        if (!isDBConnected()) throw new Error('Database unavailable');
        const gen = await generateSlotsForDate({ dateStr: dateIso, doctorId: sessionDoc.workflowData.doctorId, AppointmentModel: Appointment, OffDayModel: OffDay, BlockedSlotModel: BlockedSlot, SpecialScheduleModel: SpecialSchedule, ClinicModel: Clinic });
        availableSlots = gen.slots || [];
    } catch (error) {
        const notice = currentLang === 'ur' ? 'دستیاب اوقات معلوم نہیں ہو سکے۔ براہ کرم دوبارہ کوشش کریں۔' : 'Live availability could not be loaded. Please retry or contact clinic staff.';
        return recordAiMessage(sessionDoc, notice, MESSAGES.COMMON_NAV[currentLang], 'TEXT', workflow, 'AWAITING_DATE');
    }

    if (availableSlots.length === 0) {
        const noSlotMsg = currentLang === 'ur'
            ? `معذرت، **${dateLabel || dateIso}** کے تمام سلاٹس بک ہو چکے ہیں۔ براہ کرم کوئی دوسری تاریخ منتخب کریں۔`
            : `Sorry, all consultation slots for **${dateLabel || dateIso}** are fully booked. Please select another date.`;
        return promptDateSelection(sessionDoc, currentLang, noSlotMsg);
    }

    const slotOptions = availableSlots.slice(page * 6, page * 6 + 6).map((s, idx) => {
        const tokenNum = String(idx + 1).padStart(3, '0');
        const tokenLabel = currentLang === 'ur' ? `ٹوکن #${tokenNum}` : `Token #${tokenNum}`;
        return {
            label: `${s} (${tokenLabel})`,
            value: `SLOT_${s}`,
            action: 'select_slot'
        };
    });

    if (page > 0) slotOptions.push({ label: currentLang === 'ur' ? 'پچھلے اوقات' : 'Earlier times', value: `SLOT_PAGE_${page-1}`, action: 'select_slot_page' });
    if ((page+1)*6 < availableSlots.length) slotOptions.push({ label: currentLang === 'ur' ? 'مزید اوقات' : 'More times', value: `SLOT_PAGE_${page+1}`, action: 'select_slot_page' });
    slotOptions.push({
        label: currentLang === 'ur' ? "📅 دوسری تاریخ منتخب کریں" : "📅 Change Date",
        value: "CHANGE_DATE",
        action: "change_date"
    });
    slotOptions.push(MESSAGES.COMMON_NAV[currentLang][1]); // Main Menu

    const promptText = customPrompt || (currentLang === 'ur' ? MESSAGES.STEP_SLOT.ur(dateLabel || dateIso) : MESSAGES.STEP_SLOT.en(dateLabel || dateIso));
    return recordAiMessage(sessionDoc, promptText, slotOptions, 'TIME_SLOT_SELECTION', workflow, step);
}

/**
 * Prompt Confirmation Review Card
 */
function promptConfirmationReview(sessionDoc, currentLang) {
    const data = sessionDoc.workflowData || {};
    if (!data.patientName && sessionDoc.patientName) data.patientName = sessionDoc.patientName;
    if (!data.phone && sessionDoc.phone) data.phone = sessionDoc.phone;
    const reviewText = MESSAGES.STEP_CONFIRM[currentLang](data);
    const options = MESSAGES.CONFIRM_OPTIONS[currentLang];
    return recordAiMessage(sessionDoc, reviewText, options, 'OPTIONS', 'APPOINTMENT', 'AWAITING_CONFIRM', { reviewData: data });
}

/**
 * Atomic Double-Booking Safe Appointment Creation
 */
async function executeAtomicBooking(sessionDoc, currentLang) {
    const data = sessionDoc.workflowData || {};
    const phone = data.phone || sessionDoc.phone;
    const patientName = data.patientName || sessionDoc.patientName || 'Patient';
    const date = data.date || sessionDoc.workflowData?.date;
    const time = data.timeSlot || sessionDoc.workflowData?.timeSlot;
    const clinic = CLINIC_INFO.clinic;
    const city = CLINIC_INFO.city;
    const channel = sessionDoc.channel || 'website';
    const source = channel === 'whatsapp' ? 'whatsapp' : 'website_chat';

    let savedAppointment;
    try {
        savedAppointment = await require('./bookingService').bookAppointment({
            patientName, phone, date, time, clinic, city, source, doctorId: data.doctorId,
            appointmentType: 'In-Person Appointment'
        });
    } catch (err) {
        if (err.statusCode === 409 || err.statusCode === 400) {
            return promptSlotSelection(sessionDoc, date, data.dateLabel || date, currentLang, err.message);
        }
        const errMsg = currentLang === 'ur'
            ? 'بکنگ محفوظ نہیں ہو سکی۔ براہ کرم دوبارہ کوشش کریں یا کلینک کے عملے سے رابطہ کریں۔'
            : 'Your appointment could not be saved. Please retry or contact clinic staff.';
        return recordAiMessage(sessionDoc, errMsg, MESSAGES.COMMON_NAV[currentLang], 'TEXT', 'APPOINTMENT', 'AWAITING_CONFIRM');
    }

    // Save final details in session
    sessionDoc.workflowData.appointmentId = savedAppointment.appointmentId;
    sessionDoc.workflowData.tokenNumber = savedAppointment.tokenNumber;
    sessionDoc.workflowData.date = savedAppointment.date;
    sessionDoc.workflowData.timeSlot = savedAppointment.time;
    sessionDoc.activeWorkflow = null;
    sessionDoc.workflowStep = 'CONFIRMED';

    const confirmedText = currentLang === 'ur'
        ? `✅ **اپائنٹمنٹ کی تصدیق ہو گئی ہے!**\n\n• **اپائنٹمنٹ آئی ڈی:** ${savedAppointment.appointmentId}\n• **ٹوکن نمبر:** #${savedAppointment.tokenNumber}\n• **مریض کا نام:** ${savedAppointment.patientName}\n• **ڈاکٹر:** ${CLINIC_INFO.doctor}\n• **ہسپتال:** ${CLINIC_INFO.clinic}\n• **تاریخ:** ${savedAppointment.date}\n• **وقت:** ${savedAppointment.time}\n• **پتہ:** ${CLINIC_INFO.address}\n• **ریسپشن:** ${CLINIC_INFO.phone}`
        : `✅ **Appointment Confirmed!**\n\n• **Appointment ID:** ${savedAppointment.appointmentId}\n• **Token Number:** #${savedAppointment.tokenNumber}\n• **Patient:** ${savedAppointment.patientName}\n• **Doctor:** ${CLINIC_INFO.doctor}\n• **Clinic:** ${CLINIC_INFO.clinic}\n• **Date:** ${savedAppointment.date}\n• **Time:** ${savedAppointment.time}\n• **Address:** ${CLINIC_INFO.address}\n• **Reception:** ${CLINIC_INFO.phone}`;

    const nextOptions = currentLang === 'ur'
        ? [
            { label: "🔍 اپائنٹمنٹ کی تفصیلات", value: "MANAGE_APPOINTMENT", action: "manage_booking" },
            { label: "📍 کلینک کا نقشہ / لوکیشن", value: "NAV_MENU", action: "nav_menu" },
            { label: "🏠 مین مینو", value: "NAV_MENU", action: "nav_menu" }
        ]
        : [
            { label: "🔍 View Booking Details", value: "MANAGE_APPOINTMENT", action: "manage_booking" },
            { label: "📍 Clinic Directions", value: "NAV_MENU", action: "nav_menu" },
            { label: "🏠 Main Menu", value: "NAV_MENU", action: "nav_menu" }
        ];

    return recordAiMessage(sessionDoc, confirmedText, nextOptions, 'APPOINTMENT_CARD', null, 'CONFIRMED', {
        bookingData: {
            appointmentId: savedAppointment.appointmentId,
            tokenNumber: savedAppointment.tokenNumber,
            doctorId: savedAppointment.doctorId,
            doctorName: savedAppointment.doctorName,
            durationMinutes: savedAppointment.durationMinutes,
            patientName: savedAppointment.patientName,
            phone: savedAppointment.phone,
            clinic: savedAppointment.clinic,
            city: savedAppointment.city,
            date: savedAppointment.date,
            time: savedAppointment.time,
            appointmentType: savedAppointment.appointmentType,
            status: savedAppointment.status
        }
    });
}

/**
 * Handle Back Navigation
 */
function handleBackNavigation(sessionDoc, currentLang) {
    const step = sessionDoc.workflowStep;
    if (step === 'AWAITING_PHONE') {
        sessionDoc.workflowStep = 'AWAITING_NAME';
        return recordAiMessage(sessionDoc, MESSAGES.STEP_NAME[currentLang], MESSAGES.COMMON_NAV[currentLang].slice(1), 'TEXT', 'APPOINTMENT', 'AWAITING_NAME');
    }
    if (step === 'AWAITING_DATE') {
        sessionDoc.workflowStep = 'AWAITING_PHONE';
        const reply = MESSAGES.STEP_PHONE[currentLang](sessionDoc.workflowData.patientName || 'Patient');
        return recordAiMessage(sessionDoc, reply, MESSAGES.COMMON_NAV[currentLang], 'TEXT', 'APPOINTMENT', 'AWAITING_PHONE');
    }
    if (step === 'AWAITING_SLOT') {
        sessionDoc.workflowStep = 'AWAITING_DATE';
        return promptDateSelection(sessionDoc, currentLang);
    }
    if (step === 'AWAITING_CONFIRM') {
        sessionDoc.workflowStep = 'AWAITING_SLOT';
        return promptSlotSelection(sessionDoc, sessionDoc.workflowData.date, sessionDoc.workflowData.dateLabel, currentLang);
    }

    // Default back goes to main menu
    sessionDoc.activeWorkflow = null;
    sessionDoc.workflowStep = null;
    return recordAiMessage(sessionDoc, MESSAGES.MAIN_MENU_TITLE[currentLang], MESSAGES.MAIN_MENU_OPTIONS[currentLang], 'OPTIONS', null, null);
}

/**
 * Check if message is a question during mid-booking
 */
function isMidBookingQuestion(lowerMsg) {
    return lowerMsg.includes('sunday') || lowerMsg.includes('اتوار') ||
        lowerMsg.includes('timing') || lowerMsg.includes('time') || lowerMsg.includes('hours') || lowerMsg.includes('open') || lowerMsg.includes('schedule') ||
        lowerMsg.includes('fee') || lowerMsg.includes('cost') || lowerMsg.includes('charges') || lowerMsg.includes('فیس') ||
        lowerMsg.includes('address') || lowerMsg.includes('location') || lowerMsg.includes('where') || lowerMsg.includes('پتہ') ||
        lowerMsg.includes('doctor') || lowerMsg.includes('specialist') || lowerMsg.includes('prp') || lowerMsg.includes('prolotherapy');
}

/**
 * Record AI Message in Session & Persist
 */
async function recordAiMessage(sessionDoc, text, options = [], contentType = 'TEXT', workflow = null, workflowStep = null, metadata = {}) {
    const aiMsgId = createMessageId();
    const nextSeq = (sessionDoc.messages?.length || 0) + 1;

    const aiMsgItem = {
        messageId: aiMsgId,
        sequence: nextSeq,
        sender: 'AI',
        senderName: 'Nighat AI Assistant',
        contentType: contentType || 'TEXT',
        text: text,
        options: options || [],
        workflow: workflow,
        workflowStep: workflowStep,
        timestamp: new Date(),
        metadata: metadata || {}
    };

    if (!Array.isArray(sessionDoc.messages)) {
        sessionDoc.messages = [];
    }
    sessionDoc.messages.push(aiMsgItem);

    sessionDoc.lastMessage = text;
    sessionDoc.lastSender = 'AI';
    sessionDoc.activeWorkflow = workflow;
    sessionDoc.workflowStep = workflowStep;
    sessionDoc.updatedAt = new Date().toISOString();

    if (typeof sessionDoc.markModified === 'function') {
        sessionDoc.markModified('workflowData');
        sessionDoc.markModified('messages');
    }
    if (isDBConnected() && typeof sessionDoc.save === 'function') {
        await sessionDoc.save().catch(e => console.warn('[ConversationEngine] Save note:', e.message));
    } else {
        memorySessionStore.set(sessionDoc.sessionId, sessionDoc);
    }

    return {
        success: true,
        sessionId: sessionDoc.sessionId,
        channel: sessionDoc.channel,
        language: sessionDoc.language,
        mode: sessionDoc.mode || 'AI',
        activeWorkflow: sessionDoc.activeWorkflow,
        workflowStep: sessionDoc.workflowStep,
        aiResponded: true,
        reply: text,
        replyText: text,
        options: options,
        contentType: contentType,
        bookingData: sessionDoc.workflowData,
        messages: sessionDoc.messages,
        newMessage: aiMsgItem,
        lastSequence: nextSeq
    };
}

/**
 * WhatsApp Cloud API Adapter
 * Formats Unified Result into WhatsApp Cloud API interactive message schema
 */
function formatWhatsAppPayload(toPhone, engineResult) {
    const replyText = engineResult.replyText || engineResult.reply || '';
    const options = engineResult.options || [];

    // Case 1: 1 to 3 options -> WhatsApp Quick Reply Buttons
    if (options.length > 0 && options.length <= 3) {
        return {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: replyText },
                action: {
                    buttons: options.map((opt, i) => ({
                        type: 'reply',
                        reply: {
                            id: opt.value || `btn_${i}`,
                            title: opt.label.substring(0, 20) // WhatsApp 20 char max title
                        }
                    }))
                }
            }
        };
    }

    // Case 2: 4 to 10 options -> WhatsApp Interactive List Menu
    if (options.length > 3) {
        return {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: { type: 'text', text: 'Nighat AI Assistant' },
                body: { text: replyText },
                footer: { text: 'Nighat Medical Complex' },
                action: {
                    button: 'Choose an option',
                    sections: [
                        {
                            title: 'Options',
                            rows: options.slice(0, 10).map((opt, i) => ({
                                id: opt.value || `row_${i}`,
                                title: opt.label.substring(0, 24),
                                description: (opt.action || '').substring(0, 72)
                            }))
                        }
                    ]
                }
            }
        };
    }

    // Case 3: Plain text message
    return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'text',
        text: { body: replyText }
    };
}

async function processConversationMessage(input) { return knowledge.withKnowledge(() => processConversationWithContext(input)); }

module.exports = {
    processConversationMessage,
    formatWhatsAppPayload,
    CLINIC_INFO,
    MEDICAL_DISCLAIMER_EN,
    MEDICAL_DISCLAIMER_UR,
    normalizePakistanPhone,
    getUpcomingClinicDates
};
