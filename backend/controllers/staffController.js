const { processConversationMessage } = require('../services/conversationEngine');
const mongoose = require('mongoose');
const StaffMessage = require('../models/StaffMessage');
const EmergencyAlert = require('../models/EmergencyAlert');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const Clinic = require('../models/Clinic');
const { generateAppointmentId } = require('../utils/appointmentIdGenerator');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { generateSlotsForDate } = require('../utils/slotGenerator');
const { successResponse, errorResponse } = require('../utils/response');

let memoryStaffMessages = [];
let memoryEmergencyAlerts = [];

const isDBConnected = () => {
    return mongoose.connection && mongoose.connection.readyState === 1;
};

const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const getNextSequence = (conversation) => {
    if (!conversation || !Array.isArray(conversation.messages) || conversation.messages.length === 0) {
        return 1;
    }
    const maxSeq = conversation.messages.reduce((max, m) => Math.max(max, m.sequence || 0), 0);
    return maxSeq + 1;
};

function getAvailableDates(count = 5) {
    const dates = [];
    let d = new Date();
    while (dates.length < count) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay(); // 0 is Sunday
        if (day !== 0) { // Mon - Sat
            const formatted = d.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const iso = d.toISOString().split('T')[0];
            dates.push({ label: formatted, value: iso, action: 'select_date' });
        }
    }
    return dates;
}

const AVAILABLE_SLOTS = [
    { label: '12:30 PM', value: '12:30 PM', action: 'select_slot' },
    { label: '01:30 PM', value: '01:30 PM', action: 'select_slot' },
    { label: '03:00 PM', value: '03:00 PM', action: 'select_slot' },
    { label: '04:30 PM', value: '04:30 PM', action: 'select_slot' },
    { label: '06:00 PM', value: '06:00 PM', action: 'select_slot' },
    { label: '07:00 PM', value: '07:00 PM', action: 'select_slot' }
];

// Ensure all messages in a conversation have stable sequence & messageId
const normalizeConversationMessages = (conversation) => {
    if (!conversation || !Array.isArray(conversation.messages)) return;
    let seq = 1;
    conversation.messages.forEach(m => {
        if (!m.messageId) {
            m.messageId = generateMessageId();
        }
        if (!m.sequence || m.sequence < 1) {
            m.sequence = seq;
        }
        if (!m.contentType) {
            m.contentType = 'TEXT';
        }
        seq = (m.sequence || seq) + 1;
    });
};

// POST /api/staff/chat/message (Patient sends chat message or selects option)
const handlePatientMessage = async (req, res, next) => {
    try {
        const { sessionId, patientName, phone, message, language, clientMessageId, payload, workflowAction } = req.body;
        if (!message || !message.trim()) {
            return errorResponse(res, 400, 'Message content is required.');
        }

        const sid = sessionId || `session_${phone || 'guest'}_${Date.now()}`;
        const pName = (patientName || 'Patient').trim();
        const pPhone = (phone || '').trim();
        const cleanMsg = message.trim();
        const cleanPayload = (payload || '').trim();
        const msgId = clientMessageId || generateMessageId();

        let conversation = null;

        // Find existing conversation by sessionId first, then phone fallback
        if (isDBConnected()) {
            try {
                if (sid) {
                    conversation = await StaffMessage.findOne({ sessionId: sid });
                }
                if (!conversation && pPhone) {
                    conversation = await StaffMessage.findOne({ phone: pPhone }).sort({ updatedAt: -1 });
                    if (conversation && sid) {
                        conversation.sessionId = sid;
                    }
                }
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            if (sid) conversation = memoryStaffMessages.find(m => m.sessionId === sid);
            if (!conversation && pPhone) {
                conversation = memoryStaffMessages.find(m => m.phone === pPhone);
                if (conversation && sid) conversation.sessionId = sid;
            }
        }

        if (!conversation) {
            // New conversation starts in default AI mode
            const initData = {
                sessionId: sid,
                patientName: pName,
                phone: pPhone || 'Not provided',
                message: cleanMsg,
                mode: 'AI',
                activeWorkflow: null,
                workflowStep: null,
                workflowData: {},
                status: 'pending',
                messages: [],
                lastMessage: cleanMsg,
                lastSender: 'PATIENT',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (isDBConnected()) {
                try {
                    conversation = await StaffMessage.create(initData);
                } catch (e) {
                    conversation = { ...initData, _id: `stf_${Date.now()}` };
                    memoryStaffMessages.unshift(conversation);
                }
            } else {
                conversation = { ...initData, _id: `stf_${Date.now()}` };
                memoryStaffMessages.unshift(conversation);
            }
        }

        normalizeConversationMessages(conversation);

        // Idempotency check
        const alreadyExists = Array.isArray(conversation.messages) && conversation.messages.some(m => m.messageId === msgId);
        if (alreadyExists) {
            const maxSeq = conversation.messages.reduce((max, m) => Math.max(max, m.sequence || 0), 0);
            return successResponse(res, 200, 'Message already processed', {
                mode: conversation.mode,
                activeWorkflow: conversation.activeWorkflow,
                workflowStep: conversation.workflowStep,
                aiResponded: false,
                reply: null,
                sessionId: conversation.sessionId || sid,
                conversationId: conversation._id,
                manualTakenBy: conversation.manualTakenBy || 'Clinic staff',
                messages: conversation.messages,
                lastSequence: maxSeq
            });
        }

        // Save patient message with sequence N
        const patientSeq = getNextSequence(conversation);
        const patientMsgItem = {
            messageId: msgId,
            sequence: patientSeq,
            sender: 'PATIENT',
            senderName: pName,
            contentType: 'TEXT',
            text: cleanMsg,
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(patientMsgItem);
        } else {
            conversation.messages = [patientMsgItem];
        }

        conversation.lastMessage = cleanMsg;
        conversation.lastSender = 'PATIENT';
        if (pName && conversation.patientName === 'Patient') conversation.patientName = pName;
        if (pPhone && (!conversation.phone || conversation.phone === 'Not provided')) conversation.phone = pPhone;

        // If in MANUAL mode, stop AI responses
        if (conversation.mode === 'MANUAL') {
            if (isDBConnected() && typeof conversation.save === 'function') {
                try { await conversation.save(); } catch (e) {}
            } else {
                conversation.updatedAt = new Date().toISOString();
            }

            return successResponse(res, 200, 'Message sent. Manual mode is active.', {
                mode: 'MANUAL',
                activeWorkflow: conversation.activeWorkflow,
                workflowStep: conversation.workflowStep,
                aiResponded: false,
                reply: null,
                sessionId: conversation.sessionId || sid,
                conversationId: conversation._id,
                manualTakenBy: conversation.manualTakenBy || 'Clinic staff',
                messages: conversation.messages,
                newMessage: patientMsgItem,
                lastSequence: patientSeq
            });
        }

        // =========================================================================
        // UNIFIED SHARED CONVERSATION ENGINE DELEGATION
        // =========================================================================
        const engineResult = await processConversationMessage({
            sessionId: sid,
            channel: 'website',
            messageText: cleanMsg,
            action: workflowAction,
            payload: cleanPayload,
            language: language || conversation.language,
            patientName: pName,
            phone: pPhone,
            existingSessionDoc: conversation
        });

        return successResponse(res, 200, 'AI response generated', {
            mode: conversation.mode || 'AI',
            activeWorkflow: conversation.activeWorkflow,
            workflowStep: conversation.workflowStep,
            aiResponded: true,
            reply: engineResult.replyText || engineResult.reply,
            sessionId: conversation.sessionId || sid,
            conversationId: conversation._id,
            manualTakenBy: conversation.manualTakenBy || 'Clinic staff',
            messages: conversation.messages,
            newMessage: engineResult.newMessage,
            lastSequence: engineResult.lastSequence,
            options: engineResult.options,
            contentType: engineResult.contentType,
            bookingData: engineResult.bookingData
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/chat/sync & GET /api/staff/chat/messages (Strictly Read-Only Cursor & History Polling)
const syncPatientChat = async (req, res, next) => {
    try {
        const { sessionId, phone, afterSequence, afterMessageId } = req.query;
        if (!sessionId && !phone) {
            return errorResponse(res, 400, 'Session ID or Phone number is required for chat synchronization.');
        }

        let conversation = null;
        if (isDBConnected()) {
            try {
                if (sessionId) {
                    conversation = await StaffMessage.findOne({ sessionId });
                }
                if (!conversation && phone) {
                    conversation = await StaffMessage.findOne({ phone }).sort({ updatedAt: -1 });
                }
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            if (sessionId) conversation = memoryStaffMessages.find(m => m.sessionId === sessionId);
            if (!conversation && phone) conversation = memoryStaffMessages.find(m => m.phone === phone);
        }

        if (!conversation) {
            return successResponse(res, 200, 'No active conversation found, default AI mode', {
                mode: 'AI',
                activeWorkflow: null,
                workflowStep: null,
                messages: [],
                lastSequence: 0,
                status: 'pending'
            });
        }

        normalizeConversationMessages(conversation);

        const allMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
        const highestSequence = allMessages.reduce((max, m) => Math.max(max, m.sequence || 0), 0);

        let returnMessages = allMessages;

        if (afterSequence !== undefined && afterSequence !== null && afterSequence !== '') {
            const afterSeqNum = parseInt(afterSequence, 10);
            if (!isNaN(afterSeqNum)) {
                returnMessages = allMessages.filter(m => (m.sequence || 0) > afterSeqNum);
            }
        } else if (afterMessageId) {
            const idx = allMessages.findIndex(m => m.messageId === afterMessageId);
            if (idx >= 0) {
                returnMessages = allMessages.slice(idx + 1);
            }
        }

        return successResponse(res, 200, 'Chat synchronized', {
            mode: conversation.mode || 'AI',
            activeWorkflow: conversation.activeWorkflow || null,
            workflowStep: conversation.workflowStep || null,
            manualTakeoverAt: conversation.manualTakeoverAt,
            aiResumedAt: conversation.aiResumedAt,
            manualTakenBy: conversation.manualTakenBy,
            status: conversation.status,
            messages: returnMessages,
            lastSequence: highestSequence,
            totalCount: allMessages.length,
            conversationId: conversation._id,
            sessionId: conversation.sessionId
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/handover (Patient requests staff handover)
const requestHandover = async (req, res, next) => {
    try {
        const { patientName, phone, message, sessionId } = req.body;
        if (!patientName || !phone || !message) {
            return errorResponse(res, 400, 'Patient Name, Phone Number, and Message details are required for staff handover.');
        }

        const sid = sessionId || `session_${phone.trim()}_${Date.now()}`;
        const pName = patientName.trim();
        const pPhone = phone.trim();
        const pMsg = message.trim();

        let conversation = null;
        if (isDBConnected()) {
            try {
                if (sid) conversation = await StaffMessage.findOne({ sessionId: sid });
                if (!conversation && pPhone) conversation = await StaffMessage.findOne({ phone: pPhone }).sort({ updatedAt: -1 });
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            if (sid) conversation = memoryStaffMessages.find(m => m.sessionId === sid);
            if (!conversation && pPhone) conversation = memoryStaffMessages.find(m => m.phone === pPhone);
        }

        const seq = getNextSequence(conversation);
        const handoverMsgItem = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'PATIENT',
            senderName: pName,
            contentType: 'TEXT',
            text: `[Handover Request] ${pMsg}`,
            timestamp: new Date()
        };

        if (conversation) {
            conversation.patientName = pName;
            conversation.phone = pPhone;
            conversation.message = pMsg;
            conversation.status = 'pending';
            if (Array.isArray(conversation.messages)) {
                conversation.messages.push(handoverMsgItem);
            } else {
                conversation.messages = [handoverMsgItem];
            }
            conversation.lastMessage = pMsg;
            conversation.lastSender = 'PATIENT';
            conversation.updatedAt = new Date().toISOString();
            if (isDBConnected() && typeof conversation.save === 'function') {
                try { await conversation.save(); } catch (e) {}
            }
        } else {
            const data = {
                sessionId: sid,
                patientName: pName,
                phone: pPhone,
                message: pMsg,
                mode: 'AI',
                status: 'pending',
                messages: [handoverMsgItem],
                lastMessage: pMsg,
                lastSender: 'PATIENT',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (isDBConnected()) {
                try {
                    conversation = await StaffMessage.create(data);
                } catch (e) {
                    conversation = { ...data, _id: `stf_${Date.now()}` };
                    memoryStaffMessages.unshift(conversation);
                }
            } else {
                conversation = { ...data, _id: `stf_${Date.now()}` };
                memoryStaffMessages.unshift(conversation);
            }
        }

        return successResponse(res, 201, 'Request transferred to clinic staff', conversation);
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/inbox (Doctor/Admin retrieves all conversations)
const getStaffInbox = async (req, res, next) => {
    try {
        let list = [];
        if (isDBConnected()) {
            try {
                list = await StaffMessage.find().sort({ updatedAt: -1, createdAt: -1 });
            } catch (e) {
                list = memoryStaffMessages;
            }
        } else {
            list = memoryStaffMessages;
        }
        list.forEach(c => normalizeConversationMessages(c));
        return successResponse(res, 200, 'Staff inbox messages retrieved', list);
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/inbox/:id (Retrieve single conversation details)
const getStaffConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        let conversation = null;

        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        normalizeConversationMessages(conversation);
        return successResponse(res, 200, 'Conversation retrieved', conversation);
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/inbox/:id/takeover (Doctor activates Manual Mode)
const takeoverConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const takenBy = (req.body && req.body.adminName) || (req.admin && req.admin.name) || 'Clinic staff';

        let conversation = null;
        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        if (conversation.mode === 'MANUAL') {
            return successResponse(res, 200, 'Manual Mode is already active for this patient.', conversation);
        }

        conversation.mode = 'MANUAL';
        conversation.manualTakeoverAt = new Date();
        conversation.manualTakenBy = takenBy;
        conversation.status = 'in-progress';

        const seq = getNextSequence(conversation);
        const takeoverNotice = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'STAFF',
            senderName: 'System',
            contentType: 'SYSTEM_NOTICE',
            text: `${takenBy} has taken over the conversation manually. AI responses are paused.`,
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(takeoverNotice);
        } else {
            conversation.messages = [takeoverNotice];
        }
        conversation.updatedAt = new Date().toISOString();

        if (isDBConnected() && typeof conversation.save === 'function') {
            try { await conversation.save(); } catch (e) {}
        }

        return successResponse(res, 200, 'Manual Mode activated. AI responses stopped for this patient.', conversation);
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/inbox/:id/return-ai (Doctor restores AI Mode)
const returnToAI = async (req, res, next) => {
    try {
        const { id } = req.params;

        let conversation = null;
        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        if (conversation.mode === 'AI') {
            return successResponse(res, 200, 'AI Mode is already active for this patient.', conversation);
        }

        conversation.mode = 'AI';
        conversation.aiResumedAt = new Date();

        const seq = getNextSequence(conversation);
        const resumeNotice = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'STAFF',
            senderName: 'System',
            contentType: 'SYSTEM_NOTICE',
            text: 'Conversation mode returned to AI Assistant. Automated responses resumed.',
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(resumeNotice);
        } else {
            conversation.messages = [resumeNotice];
        }
        conversation.updatedAt = new Date().toISOString();

        if (isDBConnected() && typeof conversation.save === 'function') {
            try { await conversation.save(); } catch (e) {}
        }

        return successResponse(res, 200, 'AI Assistant mode restored. AI replies will resume for this patient.', conversation);
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/inbox/:id/reply (Doctor/Staff sends manual reply)
const sendManualReply = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message, senderName } = req.body;

        if (!message || !message.trim()) {
            return errorResponse(res, 400, 'Reply message is required.');
        }

        let conversation = null;
        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        const doctorName = senderName || (req.admin && req.admin.name) || 'Clinic staff';
        const seq = getNextSequence(conversation);
        const replyItem = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'DOCTOR',
            senderName: doctorName,
            contentType: 'TEXT',
            text: message.trim(),
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(replyItem);
        } else {
            conversation.messages = [replyItem];
        }

        conversation.lastMessage = message.trim();
        conversation.lastSender = 'DOCTOR';
        conversation.status = 'in-progress';
        conversation.updatedAt = new Date().toISOString();

        if (isDBConnected() && typeof conversation.save === 'function') {
            try { await conversation.save(); } catch (e) {}
        }

        return successResponse(res, 200, 'Manual reply sent to patient successfully', conversation);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/staff/inbox/:id (Update conversation status)
const updateStaffMessageStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let updated;

        if (isDBConnected()) {
            try {
                updated = await StaffMessage.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true });
            } catch (e) {
                updated = null;
            }
        }

        if (!updated) {
            const item = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
            if (item) {
                item.status = status;
                item.updatedAt = new Date().toISOString();
                updated = item;
            }
        }

        if (!updated) return errorResponse(res, 404, 'Handover message not found.');
        return successResponse(res, 200, `Staff message status updated to ${status}`, updated);
    } catch (error) {
        next(error);
    }
};

// Emergency alerts
const createEmergencyAlert = async (req, res, next) => {
    try {
        const { patientName, phone, message, priority } = req.body;
        if (!patientName || !phone || !message) {
            return errorResponse(res, 400, 'Patient Name, Phone, and Alert details are required.');
        }

        const data = {
            patientName: patientName.trim(),
            phone: phone.trim(),
            message: message.trim(),
            priority: priority || 'high',
            status: 'open',
            createdAt: new Date().toISOString()
        };

        let created;
        if (isDBConnected()) {
            try {
                created = await EmergencyAlert.create(data);
            } catch (e) {
                created = { ...data, _id: `emg_${Date.now()}` };
                memoryEmergencyAlerts.unshift(created);
            }
        } else {
            created = { ...data, _id: `emg_${Date.now()}` };
            memoryEmergencyAlerts.unshift(created);
        }

        return successResponse(res, 201, 'Emergency alert registered', created);
    } catch (error) {
        next(error);
    }
};

const getEmergencyAlerts = async (req, res, next) => {
    try {
        let list = [];
        if (isDBConnected()) {
            try {
                list = await EmergencyAlert.find().sort({ createdAt: -1 });
            } catch (e) {
                list = memoryEmergencyAlerts;
            }
        } else {
            list = memoryEmergencyAlerts;
        }
        return successResponse(res, 200, 'Emergency alerts retrieved', list);
    } catch (error) {
        next(error);
    }
};

const updateEmergencyAlertStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let updated;

        if (isDBConnected()) {
            try {
                updated = await EmergencyAlert.findByIdAndUpdate(id, { status }, { new: true });
            } catch (e) {
                updated = null;
            }
        }

        if (!updated) {
            const item = memoryEmergencyAlerts.find(e => e._id === id);
            if (item) {
                item.status = status;
                updated = item;
            }
        }

        if (!updated) return errorResponse(res, 404, 'Emergency alert not found.');
        return successResponse(res, 200, `Emergency alert status updated to ${status}`, updated);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    handlePatientMessage,
    syncPatientChat,
    requestHandover,
    getStaffInbox,
    getStaffConversation,
    takeoverConversation,
    returnToAI,
    sendManualReply,
    updateStaffMessageStatus,
    createEmergencyAlert,
    getEmergencyAlerts,
    updateEmergencyAlertStatus
};
