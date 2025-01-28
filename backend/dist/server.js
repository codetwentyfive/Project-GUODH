"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const patientRoutes_1 = __importDefault(require("./routes/patientRoutes"));
const keywordRoutes_1 = __importDefault(require("./routes/keywordRoutes"));
const callRoutes_1 = __importDefault(require("./routes/callRoutes"));
const webrtcRoutes_1 = __importDefault(require("./routes/webrtcRoutes"));
const signalingService_1 = require("./services/signalingService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const port = process.env.PORT || 3000;
// Configure CORS
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.CARETAKER_URL, process.env.PATIENT_URL]
        : ['http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));
// Initialize SignalingService
new signalingService_1.SignalingService(httpServer);
// Middleware
app.use(express_1.default.json());
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
// Routes
app.use('/api/users', userRoutes_1.default);
app.use('/api/patients', patientRoutes_1.default);
app.use('/api', keywordRoutes_1.default);
app.use('/api', callRoutes_1.default);
app.use('/api', webrtcRoutes_1.default);
// Test route
app.get('/', (req, res) => {
    res.json({ message: 'CareCall API is running' });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
// Start server
httpServer.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🎙️ WebRTC signaling server enabled');
});
