const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    appointmentId: {
        type: String,
        required: true,
        unique: true
    },
    tokenNumber: {
        type: String,
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    },
    doctorId: { type: String, index: true },
    doctorName: { type: String, default: '' },
    scheduleReviewRequired: { type: Boolean, default: false },
    scheduleReviewReason: { type: String, default: '' },
    durationMinutes: { type: Number, min: 1 },
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
    appointmentType: {
        type: String,
        enum: ['In-Person Appointment', 'Online Appointment'],
        default: 'In-Person Appointment'
    },
    clinic: {
        type: String,
        default: 'Nighat Medical Complex'
    },
    city: {
        type: String,
        default: ''
    },
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true
    },
    time: {
        type: String, // Format: 12:00 PM
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show', 'Pending', 'Confirmed', 'Cancelled', 'Rescheduled', 'rescheduled'],
        default: 'confirmed'
    },
    confirmedAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },
    rescheduledAt: {
        type: Date,
        default: null
    },
    cancellationReason: {
        type: String,
        default: ''
    },
    source: { type: String, default: 'website_chat' },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index to prevent duplicate active bookings for same clinic, date, time
appointmentSchema.index({ clinic: 1, date: 1, time: 1, status: 1 });

appointmentSchema.index({doctorId:1,date:1,time:1}, {name:'unique_active_doctor_slot',unique:true,partialFilterExpression:{doctorId:{$type:'string'},status:{$in:['pending','Pending','confirmed','Confirmed','completed','no-show','Rescheduled','rescheduled']}}});

module.exports = mongoose.model('Appointment', appointmentSchema);
