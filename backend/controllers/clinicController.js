const {getDBStatus}=require('../config/database');
const Clinic = require('../models/Clinic');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const { successResponse, errorResponse } = require('../utils/response');

const knowledge = require('../services/knowledgeService');

let memoryOffDays = [];
let memoryBlockedSlots = [];
let memorySpecialSchedules = [];

// GET /api/clinics
const getClinics = async (req, res, next) => {
    try {
        const k = await knowledge.getKnowledge();
        return successResponse(res, 200, 'Approved clinic details', { _id: knowledge.KEY, name: k.organization.name, city: k.location.city, address: k.location.address, phone: k.contact.phone, weeklySchedule: k.schedule.weekly, timezone: 'Asia/Karachi', verified: { location: k.location.verified, contact: k.contact.verified, schedule: k.schedule.verified } });
    } catch (error) { next(error); }
};
const updateClinic = async (req, res) => {
    return errorResponse(res, 409, 'Use authorized Knowledge Base settings to approve organization information. Historical clinic records remain unchanged.');
};

// GET /api/clinics/off-days
const getOffDays = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await OffDay.find().sort({ date: 1 });
        } catch (e) {
            list = memoryOffDays;
        }
        return successResponse(res, 200, 'Off-days fetched', list);
    } catch (error) {
        next(error);
    }
};

// POST /api/clinics/off-days
const addOffDay = async (req, res, next) => {
    if(!getDBStatus())return errorResponse(res,503,'Schedule changes could not be saved. Please retry when the database is available.');
    try {
        const { date, reason } = req.body;
        if (!date) return errorResponse(res, 400, 'Off-day date is required.');

        let created;
        try {
            created = await OffDay.create({ date, reason: reason || 'Doctor Leave' });
        } catch (e) {
            return errorResponse(res,409,'This off-day could not be saved. It may already exist.');
        }
        return successResponse(res, 201, 'Off-day added successfully', created);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/clinics/off-days/:id
const deleteOffDay = async (req, res, next) => {
    if(!getDBStatus())return errorResponse(res,503,'Schedule changes could not be saved. Please retry when the database is available.');
    try {
        const { id } = req.params;
        try {
            await OffDay.findByIdAndDelete(id);
        } catch (e) {
            memoryOffDays = memoryOffDays.filter(o => o._id !== id && o.date !== id);
        }
        return successResponse(res, 200, 'Off-day removed successfully');
    } catch (error) {
        next(error);
    }
};

// GET /api/clinics/blocked-slots
const getBlockedSlots = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await BlockedSlot.find().sort({ date: 1, time: 1 });
        } catch (e) {
            list = memoryBlockedSlots;
        }
        return successResponse(res, 200, 'Blocked slots fetched', list);
    } catch (error) {
        next(error);
    }
};

// POST /api/clinics/blocked-slots
const addBlockedSlot = async (req, res, next) => {
    if(!getDBStatus())return errorResponse(res,503,'Schedule changes could not be saved. Please retry when the database is available.');
    try {
        const { date, time, reason } = req.body;
        if (!date || !time) return errorResponse(res, 400, 'Date and Time slot are required to block slot.');

        let created;
        try {
            created = await BlockedSlot.create({ date, time, reason: reason || 'Blocked slot' });
        } catch (e) {
            return errorResponse(res,409,'This blocked time could not be saved. It may already exist.');
        }
        return successResponse(res, 201, 'Slot blocked successfully', created);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/clinics/blocked-slots/:id
const deleteBlockedSlot = async (req, res, next) => {
    if(!getDBStatus())return errorResponse(res,503,'Schedule changes could not be saved. Please retry when the database is available.');
    try {
        const { id } = req.params;
        try {
            await BlockedSlot.findByIdAndDelete(id);
        } catch (e) {
            memoryBlockedSlots = memoryBlockedSlots.filter(b => b._id !== id);
        }
        return successResponse(res, 200, 'Slot unblocked successfully');
    } catch (error) {
        next(error);
    }
};

// GET /api/clinics/special-schedules
const getSpecialSchedules = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await SpecialSchedule.find().sort({ date: 1 });
        } catch (e) {
            list = memorySpecialSchedules;
        }
        return successResponse(res, 200, 'Special schedules fetched', list);
    } catch (error) {
        next(error);
    }
};

// POST /api/clinics/special-schedules
const addSpecialSchedule = async (req, res, next) => {
    if(!getDBStatus())return errorResponse(res,503,'Schedule changes could not be saved. Please retry when the database is available.');
    try {
        const { date, openingTime, closingTime, reason } = req.body;
        if (!date || !openingTime || !closingTime) {
            return errorResponse(res, 400, 'Date, Opening Time, and Closing Time are required.');
        }

        let created;
        try {
            created = await SpecialSchedule.findOneAndUpdate({date}, {$set:{openingTime,closingTime,reason,slots: Array.isArray(req.body.slots) ? req.body.slots : []}}, {upsert:true,new:true,runValidators:true});
        } catch (e) {
            return errorResponse(res,409,'This schedule override could not be saved. It may already exist.');
        }
        return successResponse(res, 201, 'Special schedule override saved', created);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getClinics,
    updateClinic,
    getOffDays,
    addOffDay,
    deleteOffDay,
    getBlockedSlots,
    addBlockedSlot,
    deleteBlockedSlot,
    getSpecialSchedules,
    addSpecialSchedule
};
