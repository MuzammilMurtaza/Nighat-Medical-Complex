const mongoose = require('mongoose');

const specialScheduleSchema = new mongoose.Schema({
    date: {
        type: String, // YYYY-MM-DD
        required: true,
        unique: true
    },
    openingTime: {
        type: String,
        required: true
    },
    closingTime: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        default: 'Special Working Hours'
    },
    slots: [{
        type: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('SpecialSchedule', specialScheduleSchema);
