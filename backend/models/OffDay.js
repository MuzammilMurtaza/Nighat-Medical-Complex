const mongoose = require('mongoose');

const offDaySchema = new mongoose.Schema({
    date: {
        type: String, // YYYY-MM-DD
        required: true,
        unique: true
    },
    reason: {
        type: String,
        default: 'Doctor Leave'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('OffDay', offDaySchema);
