const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema({
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
        required: true
    },
    priority: {
        type: String,
        enum: ['normal', 'high', 'critical'],
        default: 'high'
    },
    status: {
        type: String,
        enum: ['open', 'resolved', 'assigned'],
        default: 'open'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
