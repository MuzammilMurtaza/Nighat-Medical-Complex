/**
 * Standardized API Response Helper
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = null) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

const errorResponse = (res, statusCode = 400, message = 'Error occurred', errors = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        errors
    });
};

module.exports = { successResponse, errorResponse };
