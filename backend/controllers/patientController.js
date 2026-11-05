const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Report = require('../models/Report');
const { successResponse } = require('../utils/response');
const { memoryAppointments } = require('./appointmentController');

const getPatients = async (req, res, next) => {
    try {
        let patients = [];
        try {
            const rawPatients = await Patient.find().sort({ createdAt: -1 }).lean();
            const appointments = await Appointment.find({ status: { $nin: ['cancelled'] } }).sort({ date: -1, createdAt: -1 }).lean();

            const phoneToStats = {};
            appointments.forEach(app => {
                const cleanPhone = (app.phone || '').trim();
                if (!phoneToStats[cleanPhone]) {
                    phoneToStats[cleanPhone] = {
                        totalAppointments: 1,
                        latestAppointment: `${app.date} (${app.time})`
                    };
                } else {
                    phoneToStats[cleanPhone].totalAppointments += 1;
                }
            });

            patients = rawPatients.map(p => {
                const cleanPhone = (p.phone || '').trim();
                const stats = phoneToStats[cleanPhone] || {};
                return {
                    ...p,
                    totalAppointments: stats.totalAppointments || 0,
                    latestAppointment: stats.latestAppointment || 'None'
                };
            });
        } catch (e) {
            // Build aggregated patients from memoryAppointments
            const phoneMap = {};
            memoryAppointments.forEach(app => {
                if (!phoneMap[app.phone]) {
                    phoneMap[app.phone] = {
                        _id: `pat_${app.phone}`,
                        patientId: `PAT-${app.phone.slice(-4)}`,
                        name: app.patientName,
                        phone: app.phone,
                        totalAppointments: 1,
                        latestAppointment: app.date,
                        reportsCount: 0,
                        createdAt: app.createdAt
                    };
                } else {
                    phoneMap[app.phone].totalAppointments += 1;
                }
            });
            patients = Object.values(phoneMap);
        }

        return successResponse(res, 200, 'Patients retrieved successfully', patients);
    } catch (error) {
        next(error);
    }
};

module.exports = { getPatients };
