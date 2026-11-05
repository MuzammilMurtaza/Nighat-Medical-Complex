const mongoose = require('mongoose');
const { getMongoOptions } = require('./environment');
mongoose.set('bufferCommands', false);
let pending = null;
let retryTimer = null;
const getDBStatus = () => mongoose.connection.readyState === 1;
mongoose.connection.on('error', () => {}); // Never log driver messages containing connection details.
mongoose.connection.on('disconnected', () => console.warn('[Database] Disconnected; persistent operations unavailable.'));
mongoose.connection.on('reconnected', () => console.log('[Database] Reconnected: ' + mongoose.connection.name));
async function connectDB() {
    if (getDBStatus()) return true;
    if (pending) return pending;
    pending = (async () => {
        try {
            const { uri, options } = getMongoOptions();
            await mongoose.connect(uri, options);
            console.log('[Database] Connected: ' + mongoose.connection.name);
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
            return true;
        } catch (_) {
            console.warn('[Database] Connection unavailable. Check local credentials and Atlas network access. No alternate database is used.');
            if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; connectDB(); }, 15000).unref();
            return false;
        }
    })().finally(() => { pending = null; });
    return pending;
}
module.exports = { connectDB, getDBStatus };
