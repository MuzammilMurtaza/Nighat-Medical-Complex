const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
function getMongoOptions() {
    const isolatedTest = process.env.NODE_ENV === 'test' && process.env.TEST_MONGODB_URI;
    if (isolatedTest && !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(isolatedTest)) throw new Error('Tests require an explicitly isolated local database.');
    let uri = isolatedTest || process.env.MONGODB_URI;
    if (!uri) throw Object.assign(new Error('MONGODB_URI is not configured.'), { code: 'DATABASE_NOT_CONFIGURED' });
    if (uri.includes('<URL_ENCODED_NEW_PASSWORD>')) {
        if (!process.env.MONGODB_PASSWORD) throw Object.assign(new Error('Atlas password is not configured.'), { code: 'DATABASE_PASSWORD_REQUIRED' });
        uri = uri.replace('<URL_ENCODED_NEW_PASSWORD>', encodeURIComponent(process.env.MONGODB_PASSWORD));
    }
    if (/[<>]/.test(uri)) throw Object.assign(new Error('Database configuration contains placeholders.'), { code: 'DATABASE_PLACEHOLDER' });
    return { uri, options: { dbName: isolatedTest ? new URL(isolatedTest).pathname.slice(1) : 'nighat_medical_complex', serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, socketTimeoutMS: 20000, maxPoolSize: 10 } };
}
module.exports = { getMongoOptions };
