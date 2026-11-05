const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
    requestId: {
        type: String,
        required: true,
        unique: true
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
    preferredDate: {
        type: String,
        required: true
    },
    preferredTime: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'completed', 'cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Consultation', consultationSchema);
