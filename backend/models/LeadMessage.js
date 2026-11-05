const mongoose = require('mongoose');

const leadMessageSchema = new mongoose.Schema({
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdsLead',
        required: true,
        index: true
    },
    leadCode: {
        type: String,
        default: '',
        index: true
    },
    sender: {
        type: String,
        enum: ['lead', 'AI', 'admin', 'system'],
        required: true
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'document', 'audio', 'interactive'],
        default: 'text'
    },
    message: {
        type: String,
        required: true
    },
    mediaUrl: {
        type: String,
        default: ''
    },
    platformMessageId: {
        type: String,
        sparse: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    deliveryStatus: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    sentBy: {
        type: String,
        default: 'System',
        trim: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

leadMessageSchema.index({ leadId: 1, timestamp: 1 });
leadMessageSchema.index({ platformMessageId: 1 }, { sparse: true });

module.exports = mongoose.model('LeadMessage', leadMessageSchema);
