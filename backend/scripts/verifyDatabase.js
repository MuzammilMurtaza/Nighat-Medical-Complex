const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { getMongoOptions } = require('../config/environment');
(async () => {
    const { uri, options } = getMongoOptions();
    const connection = await mongoose.createConnection(uri, options).asPromise();
    const db = connection.db;
    const collection = db.collection('_connection_verification');
    const id = 'connectivity-' + randomUUID();
    try {
        await db.command({ ping: 1 });
        await collection.insertOne({ _id: id, purpose: 'connectivity-only', expiresAt: new Date(Date.now() + 3600000) });
        if (!(await collection.findOne({ _id: id }))) throw new Error('Read check failed');
        await collection.updateOne({ _id: id }, { $set: { verified: true } });
        if (!(await collection.findOne({ _id: id })).verified) throw new Error('Update check failed');
        await collection.deleteOne({ _id: id });
        for (const file of fs.readdirSync(path.join(__dirname, '../models')).filter(file => file.endsWith('.js'))) {
            const model = require('../models/' + file);
            const scoped = connection.model(model.modelName, model.schema, model.collection.name);
            await scoped.createIndexes();
        }
        if (process.argv.includes('--initialize-knowledge')) {
            const KnowledgeBase = require('../models/KnowledgeBase');
            await db.collection(KnowledgeBase.collection.name).updateOne({ key: 'nighat_medical_complex' }, { $setOnInsert: new KnowledgeBase({}).toObject() }, { upsert: true });
        }
        const recovery = await mongoose.createConnection(uri, options).asPromise();
        try { await recovery.db.command({ ping: 1 }); } finally { await recovery.close(); }
        console.log(JSON.stringify({ connected: true, database: db.databaseName, ping: true, read: true, write: true, update: true, cleanup: true, modelIndexes: true, freshConnectionRecovery: true }));
    } finally { await collection.deleteOne({ _id: id }).catch(() => {}); await connection.close(); }
})().catch(error => { console.error(JSON.stringify({ connected: false, errorType: error.name, code: typeof error.code === 'number' ? error.code : 'CONNECTION_OR_CONFIGURATION_FAILED', message: 'Atlas verification did not complete. Check credentials, database permissions, DNS, and Atlas network allowlist.' })); process.exitCode = 1; });
