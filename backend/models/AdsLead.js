const mongoose = require('mongoose');

const adsLeadSchema = new mongoose.Schema({
    leadId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    platformLeadId: {
        type: String,
        sparse: true,
        index: true
    },
    source: {
        type: String,
        enum: [
            'facebook_lead_ad',
            'instagram_lead_ad',
            'facebook_messenger',
            'instagram_dm',
            'whatsapp_ad',
            'website_chatbot',
            'manual_entry'
        ],
        default: 'facebook_lead_ad',
        required: true
    },
    campaignId: {
        type: String,
        default: ''
    },
    campaignName: {
        type: String,
        default: 'General Clinic Campaign'
    },
    adSetId: {
        type: String,
        default: ''
    },
    adSetName: {
        type: String,
        default: ''
    },
    adId: {
        type: String,
        default: ''
    },
    adName: {
        type: String,
        default: ''
    },
    patientName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true
    },
    city: {
        type: String,
        default: 'Lahore',
        trim: true
    },
    interestedTreatment: {
        type: String,
        default: 'Pain Management Consultation',
        trim: true
    },
    leadMessage: {
        type: String,
        default: ''
    },
    appointmentPreference: {
        type: String,
        default: ''
    },
    leadStatus: {
        type: String,
        enum: [
            'New',
            'AI Engaged',
            'Qualified',
            'Appointment Requested',
            'Appointment Booked',
            'Follow-Up',
            'Not Interested',
            'Converted',
            'Closed'
        ],
        default: 'New',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    assignedTo: {
        type: String,
        default: 'Unassigned',
        trim: true
    },
    conversationMode: {
        type: String,
        enum: ['AI', 'MANUAL'],
        default: 'AI',
        index: true
    },
    manualTakenOverAt: {
        type: Date,
        default: null
    },
    manualTakenOverBy: {
        type: String,
        default: ''
    },
    aiResumedAt: {
        type: Date,
        default: null
    },
    aiResumedBy: {
        type: String,
        default: ''
    },
    lastMessage: {
        type: String,
        default: ''
    },
    lastMessageAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    followUpAt: {
        type: Date,
        default: null
    },
    followUpStatus: {
        type: String,
        enum: ['none', 'scheduled', 'sent', 'cancelled', 'completed'],
        default: 'none'
    },
    followUpNotes: {
        type: String,
        default: ''
    },
    tags: {
        type: [String],
        default: []
    },
    notes: {
        type: String,
        default: ''
    },
    linkedAppointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        default: null
    },
    linkedAppointmentId: {
        type: String,
        default: ''
    },
    qualificationAnswers: {
        painLocation: { type: String, default: '' },
        duration: { type: String, default: '' },
        severity: { type: String, default: '' },
        priorTreatments: { type: String, default: '' },
        treatmentInterest: { type: String, default: '' }
    },
    pendingBooking: {
        requestedDate: { type: String, default: '' },
        requestedWeekday: { type: String, default: '' },
        requestedAppointmentType: { type: String, default: 'In-Person Appointment' },
        originallyRequestedTime: { type: String, default: '' },
        offeredAlternativeSlots: { type: [String], default: [] },
        bookingStage: {
            type: String,
            enum: ['none', 'awaiting_alternative_slot_selection', 'awaiting_time_selection', 'completed'],
            default: 'none'
        },
        updatedAt: { type: Date, default: null }
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes for high performance querying & analytics
adsLeadSchema.index({ phone: 1, source: 1 });
adsLeadSchema.index({ leadStatus: 1, createdAt: -1 });
adsLeadSchema.index({ conversationMode: 1, lastMessageAt: -1 });
adsLeadSchema.index({ campaignName: 1 });

module.exports = mongoose.model('AdsLead', adsLeadSchema);
