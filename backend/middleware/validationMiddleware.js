const { errorResponse } = require('../utils/response');

const validateBookingInput = (req, res, next) => {
    const { patientName, phone, date, time } = req.body;

    if (!patientName || typeof patientName !== 'string' || patientName.trim().length < 2) {
        return errorResponse(res, 400, 'Patient full name is required (at least 2 characters).');
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
        return errorResponse(res, 400, 'Valid phone number is required.');
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return errorResponse(res, 400, 'Valid date (YYYY-MM-DD) is required.');
    }

    if (!time || typeof time !== 'string') {
        return errorResponse(res, 400, 'Valid appointment time slot is required.');
    }

    next();
};

const validateAdminLogin = (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return errorResponse(res, 400, 'Username/Email and Password are required.');
    }

    next();
};

module.exports = { validateBookingInput, validateAdminLogin };
