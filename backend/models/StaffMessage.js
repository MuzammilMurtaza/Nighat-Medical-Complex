const mongoose = require('mongoose');

const messageOptionSchema = new mongoose.Schema({
    label: { type: String, required: true },
    value: { type: String, required: true },
    action: { type: String, default: 'send_option' }
}, { _id: false });

const messageItemSchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        default: () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    },
    sequence: {
        type: Number,
        default: 1
    },
    sender: {
        type: String,
        enum: ['PATIENT', 'AI', 'DOCTOR', 'STAFF', 'SYSTEM'],
        required: true
    },
    senderName: {
        type: String,
        default: ''
    },
    contentType: {
        type: String,
        enum: ['TEXT', 'OPTIONS', 'APPOINTMENT_CARD', 'DATE_SELECTION', 'TIME_SLOT_SELECTION', 'SYSTEM_NOTICE'],
        default: 'TEXT'
    },
    text: {
        type: String,
        required: true
    },
    options: [messageOptionSchema],
    workflow: {
        type: String,
        default: null
    },
    workflowStep: {
        type: String,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Object,
        default: {}
    }
}, { _id: false });

const staffMessageSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        index: true
    },
    patientName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        default: ''
    },
    language: { type: String, default: 'english' },
    channel: { type: String, default: 'website' },
    mode: {
        type: String,
        enum: ['AI', 'MANUAL'],
        default: 'AI'
    },
    activeWorkflow: {
        type: String,
        
        default: null
    },
    workflowStep: {
        type: String,
        default: null
    },
    workflowData: {
        type: Object,
        default: {}
    },
    manualTakeoverAt: {
        type: Date,
        default: null
    },
    aiResumedAt: {
        type: Date,
        default: null
    },
    manualTakenBy: {
        type: String,
        default: null
    },
    messages: [messageItemSchema],
    lastMessage: {
        type: String,
        default: ''
    },
    lastSender: {
        type: String,
        enum: ['PATIENT', 'AI', 'DOCTOR', 'STAFF', 'SYSTEM'],
        default: 'PATIENT'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('StaffMessage', staffMessageSchema);
