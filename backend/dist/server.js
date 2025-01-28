"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const signalingService_1 = require("./services/signalingService");
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const callRoutes_1 = __importDefault(require("./routes/callRoutes"));
const patientRoutes_1 = __importDefault(require("./routes/patientRoutes"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Configure CORS with WebSocket support
const allowedOrigins = ((_a = process.env.FRONTEND_URL) === null || _a === void 0 ? void 0 : _a.split(',')) || ['http://localhost:3001', 'http://localhost:3002'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
// Add WebSocket upgrade handling
httpServer.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
});
// Middleware
app.use(express_1.default.json());
// Initialize WebSocket service
const signalingService = new signalingService_1.SignalingService(httpServer);
// Routes
app.use('/api/auth', userRoutes_1.default);
app.use('/api/calls', callRoutes_1.default);
app.use('/api/patients', patientRoutes_1.default);
// Root route
app.get('/', (req, res) => {
    res.json({
        name: 'CareCall API',
        version: '1.0.0',
        status: 'running',
        websocket: signalingService.isInitialized() ? 'connected' : 'disconnected',
        endpoints: {
            auth: '/api/auth',
            calls: '/api/calls',
            patients: '/api/patients'
        }
    });
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('WebSocket server initialized');
    console.log('Allowed origins:', allowedOrigins);
});
