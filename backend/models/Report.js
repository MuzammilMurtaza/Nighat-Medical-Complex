const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportId: {
        type: String,
        required: true,
        unique: true
    },
    patientName: {
        type: String,
        default: 'Patient'
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    appointmentId: {
        type: String,
        default: ''
    },
    token: {
        type: String,
        default: ''
    },
    reportType: {
        type: String,
        enum: ['MRI Scan', 'X-Ray', 'Prescription', 'Laboratory Report', 'Discharge Summary', 'Other Report', 'Medical Report'],
        default: 'Medical Report',
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    originalFileName: {
        type: String,
        required: true
    },
    storedFileName: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    storagePath: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['new', 'reviewed'],
        default: 'new'
    },
    reviewedAt: {
        type: Date
    },
    reviewedBy: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
