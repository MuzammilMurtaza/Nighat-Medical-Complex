const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: 'Nighat Medical Complex'
    },
    city: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    },
    timezone: {
        type: String,
        default: 'Asia/Karachi'
    },
    weeklySchedule: {
        monday: { active: { type: Boolean, default: false }, open: { type: String, default: '' }, close: { type: String, default: '' } },
        tuesday: { active: { type: Boolean, default: false }, open: { type: String, default: '' }, close: { type: String, default: '' } },
        wednesday: { active: { type: Boolean, default: false }, open: { type: String, default: '' }, close: { type: String, default: '' } },
        thursday: { active: { type: Boolean, default: false }, open: { type: String, default: '' }, close: { type: String, default: '' } },
        friday: { active: { type: Boolean, default: false }, open: { type: String, default: '' }, close: { type: String, default: '' } },
        saturday: { active: { type: Boolean, default: false }, open: { type: String, default: '' }, close: { type: String, default: '' } },
        sunday: { active: { type: Boolean, default: false }, open: { type: String, default: '' }, close: { type: String, default: '' } }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Clinic', clinicSchema);
