const mongoose = require('mongoose');

const blockedSlotSchema = new mongoose.Schema({
    date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    time: {
        type: String, // 12:00 PM
        required: true
    },
    reason: {
        type: String,
        default: 'Blocked by Clinic Administration'
    }
}, {
    timestamps: true
});

blockedSlotSchema.index({ date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('BlockedSlot', blockedSlotSchema);
