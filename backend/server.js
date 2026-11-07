const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('./config/environment');

const { connectDB } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const appointmentRoutes = require('./routes/appointmentRoutes');
const patientRoutes = require('./routes/patientRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const clinicRoutes = require('./routes/clinicRoutes');
const treatmentRoutes = require('./routes/treatmentRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const staffRoutes = require('./routes/staffRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const leadRoutes = require('./routes/leadRoutes');
const { initFollowUpScheduler } = require('./services/leadFollowUpService');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// Initialize Automated Follow-Up Service
initFollowUpScheduler();

// Production Security & Utility Middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow cross-resource loading for local app development
}));
app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
}));
app.use(express.json({ limit: '10mb', verify: (req, res, buffer) => {
    if (req.originalUrl.split('?')[0] === '/api/leads/webhook') req.rawBody = Buffer.from(buffer);
} }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Static Frontend Routing
app.use('/patient', express.static(path.join(__dirname, '../frontend/patient')));
app.use('/admin', express.static(path.join(__dirname, '../frontend/admin')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root Redirect to Patient Portal
app.get('/', (req, res) => {
    res.redirect('/patient/index.html');
});

// API Routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/auth', adminRoutes);
app.use('/api/knowledge', require('./routes/knowledgeRoutes'));
app.use('/api/clinics', clinicRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        project: 'Nighat Medical Complex',
        timestamp: new Date().toISOString()
    });
});

// Central Error Handler Middleware
app.use(errorHandler);

// Start Express Server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` NIGHAT MEDICAL COMPLEX BACKEND SERVER `);
    console.log(` Server running on http://localhost:${PORT}`);
    console.log(` Patient Portal: http://localhost:${PORT}/patient/index.html`);
    console.log(` Admin Dashboard: http://localhost:${PORT}/admin/admin.html`);
    console.log(` Ads Leads API:  http://localhost:${PORT}/api/leads`);
    console.log(`=======================================================`);
});

module.exports = app;
