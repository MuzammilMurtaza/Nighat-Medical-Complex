const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
    console.error(`[Error Handler] ${err.name || 'Error'}`);
    if (/Mongo|Mongoose/.test(err.name || '') && err.name !== 'ValidationError' && err.code !== 11000) return errorResponse(res,503,'Database operation unavailable. Please retry.');

    // Multer file size error
    if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 400, 'File size exceeds maximum limit of 10MB.');
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'record';
        return errorResponse(res, 400, `A ${field} with this detail already exists.`);
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return errorResponse(res, 400, 'Validation Error', messages);
    }

    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message || 'Server error';

    return errorResponse(res, err.statusCode || 500, message);
};

module.exports = errorHandler;
