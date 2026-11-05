const Appointment = require('../models/Appointment');
const Report = require('../models/Report');
const Consultation = require('../models/Consultation');
const StaffMessage = require('../models/StaffMessage');
const EmergencyAlert = require('../models/EmergencyAlert');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const AdsLead = require('../models/AdsLead');
const { getDBStatus } = require('../config/database');
const { successResponse } = require('../utils/response');
const { memoryAppointments } = require('./appointmentController');
const { memoryReports } = require('./reportController');

const getDashboardStats = async (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        let todayAppointments = 0;
        let confirmed = 0;
        let completed = 0;
        let cancelled = 0;
        let noShows = 0;
        let pendingConsultations = 0;
        let humanHandovers = 0;
        let pendingEmergencyAlerts = 0;
        let pendingReportsReview = 0;
        let upcomingDoctorLeave = 0;
        let blockedSlotsCount = 0;
        let totalAdsLeads = 0;
        let newAdsLeads = 0;
        let aiEngagedAdsLeads = 0;
        let manualAdsLeads = 0;

        const dbConnected = getDBStatus();

        if (dbConnected) {
            try {
                todayAppointments = await Appointment.countDocuments({ date: todayStr });
                confirmed = await Appointment.countDocuments({ status: 'confirmed' });
                completed = await Appointment.countDocuments({ status: 'completed' });
                cancelled = await Appointment.countDocuments({ status: 'cancelled' });
                noShows = await Appointment.countDocuments({ status: 'no-show' });

                pendingConsultations = await Consultation.countDocuments({ status: 'pending' });
                humanHandovers = await StaffMessage.countDocuments({ status: 'pending' });
                pendingEmergencyAlerts = await EmergencyAlert.countDocuments({ status: 'open' });
                pendingReportsReview = await Report.countDocuments({ status: 'new' });

                upcomingDoctorLeave = await OffDay.countDocuments({ date: { $gte: todayStr } });
                blockedSlotsCount = await BlockedSlot.countDocuments();

                totalAdsLeads = await AdsLead.countDocuments();
                newAdsLeads = await AdsLead.countDocuments({ leadStatus: 'New' });
                aiEngagedAdsLeads = await AdsLead.countDocuments({ conversationMode: 'AI' });
                manualAdsLeads = await AdsLead.countDocuments({ conversationMode: 'MANUAL' });
            } catch (e) {
                // Ignore query error
            }
        } else {
            // Memory aggregated metrics for dev mode
            todayAppointments = memoryAppointments.filter(a => a.date === todayStr).length;
            confirmed = memoryAppointments.filter(a => a.status === 'confirmed').length;
            completed = memoryAppointments.filter(a => a.status === 'completed').length;
            cancelled = memoryAppointments.filter(a => a.status === 'cancelled').length;
            noShows = memoryAppointments.filter(a => a.status === 'no-show').length;
            pendingReportsReview = memoryReports.filter(r => r.status === 'new').length;
        }

        const totalDailyCapacity = 16;
        const availableSlotsToday = Math.max(0, totalDailyCapacity - todayAppointments);

        const integrations = {
            database: dbConnected ? "CONNECTED" : "DEVELOPMENT MODE",
            whatsapp: "CONFIGURED",
            appointmentApi: "ACTIVE",
            reminderSystem: "SIMULATION",
            fileStorage: "CONNECTED",
            aiAssistant: "ACTIVE",
            adsLeadAutomation: "ACTIVE"
        };

        const stats = {
            todayAppointments,
            confirmed,
            completed,
            cancelled,
            noShows,
            availableSlotsToday,
            blockedSlotsCount,
            upcomingDoctorLeave,
            pendingConsultations,
            humanHandovers,
            pendingEmergencyAlerts,
            pendingReportsReview,
            totalAdsLeads,
            newAdsLeads,
            aiEngagedAdsLeads,
            manualAdsLeads,
            integrations
        };

        return successResponse(res, 200, 'Dashboard statistics fetched successfully', stats);
    } catch (error) {
        next(error);
    }
};

module.exports = { getDashboardStats };
