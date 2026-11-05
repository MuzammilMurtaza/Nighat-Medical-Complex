const Consultation = require('../models/Consultation');
const { successResponse, errorResponse } = require('../utils/response');

let memoryConsultations = [];

const createConsultationRequest = async (req, res, next) => {
    try {
        const { patientName, phone, preferredDate, preferredTime, reason } = req.body;
        if (!patientName || !phone || !preferredDate || !preferredTime) {
            return errorResponse(res, 400, 'Patient Name, Phone, Preferred Date, and Preferred Time are required.');
        }

        const requestId = `VRT-${Date.now().toString().slice(-6)}`;
        const consultationData = {
            requestId,
            patientName: patientName.trim(),
            phone: phone.trim(),
            preferredDate,
            preferredTime,
            reason: reason || '',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        let created;
        try {
            created = await Consultation.create(consultationData);
        } catch (e) {
            created = { ...consultationData, _id: `mem_vrt_${Date.now()}` };
            memoryConsultations.unshift(created);
        }

        return successResponse(res, 201, 'Virtual consultation request submitted successfully', created);
    } catch (error) {
        next(error);
    }
};

const getConsultations = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await Consultation.find().sort({ createdAt: -1 });
        } catch (e) {
            list = memoryConsultations;
        }
        return successResponse(res, 200, 'Virtual consultations fetched', list);
    } catch (error) {
        next(error);
    }
};

const updateConsultationStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let updated;

        try {
            updated = await Consultation.findByIdAndUpdate(id, { status }, { new: true });
        } catch (e) {
            const item = memoryConsultations.find(c => c._id === id || c.requestId === id);
            if (item) {
                item.status = status;
                updated = item;
            }
        }

        if (!updated) return errorResponse(res, 404, 'Consultation request not found.');
        return successResponse(res, 200, `Consultation request status updated to ${status}`, updated);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createConsultationRequest,
    getConsultations,
    updateConsultationStatus
};
