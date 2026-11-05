const mongoose = require('mongoose');
const text = { type: String, default: '', maxlength: 5000 };
const doctor = new mongoose.Schema({ id: { type: String, required: true }, name: { type: String, required: true }, specialty: text, qualifications: [String], verified: { type: Boolean, default: false }, active: { type: Boolean, default: true }, consultationFee: { type: Number, min: 0, default: null }, currency: text }, { _id: false, strict: 'throw' });
const service = new mongoose.Schema({ title: { type: String, required: true }, description: text, category: text, verified: { type: Boolean, default: false }, active: { type: Boolean, default: true } }, { _id: false, strict: 'throw' });
const pause = new mongoose.Schema({ start: {type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/}, end: {type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/} }, {_id:false,strict:'throw'});
const day = new mongoose.Schema({ breaks: [pause], active: { type: Boolean, default: false }, open: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, close: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ } }, { _id: false, strict: 'throw' });
const weekly = Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(key => [key, day]));
const schema = new mongoose.Schema({
 key: { type: String, default: 'nighat_medical_complex', unique: true, enum: ['nighat_medical_complex'] },
 organization: { name: { type: String, default: 'Nighat Medical Complex', maxlength: 160 }, type: { type: String, default: 'Medical Complex' }, description: { type: String, default: 'Patient-focused medical facility', maxlength: 2000 } },
 location: { verified: { type: Boolean, default: false }, address: text, city: text, mapsUrl: text },
 contact: { verified: { type: Boolean, default: false }, phone: text, whatsapp: text, email: text },
 schedule: { doctorId: {type:String,default:''}, bookingEnabled: {type:Boolean,default:true}, verified: { type: Boolean, default: false }, timezone: { type: String, enum: ['Asia/Karachi'], default: 'Asia/Karachi' }, slotMinutes: { type: Number, min: 5, max: 240, default: 30 }, weekly: weekly },
 doctors: [doctor], services: [service], departments: [String],
 consultationFees: { verified: { type: Boolean, default: false }, description: text },
 faqs: [{ question: { type: String, maxlength: 500 }, answer: text, language: { type: String, enum: ['english','urdu','roman_urdu'], default: 'english' }, verified: { type: Boolean, default: false } }],
 bookingPolicies: { verified: { type: Boolean, default: false }, text: text },
 assistantInstructions: { type: String, default: '', maxlength: 4000 }
}, { timestamps: true, strict: 'throw', minimize: false });
module.exports = mongoose.model('KnowledgeBase', schema);
