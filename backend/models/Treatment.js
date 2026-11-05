const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['PAIN MANAGEMENT', 'REGENERATIVE MEDICINE', 'WELLNESS & AESTHETICS'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Treatment', treatmentSchema);
