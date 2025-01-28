import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { SignalingService } from './services/signalingService';
import userRoutes from './routes/userRoutes';
import callRoutes from './routes/callRoutes';
import patientRoutes from './routes/patientRoutes';

const app = express();
const httpServer = createServer(app);

// Configure CORS with WebSocket support
const allowedOrigins = process.env.FRONTEND_URL?.split(',') || ['http://localhost:3001', 'http://localhost:3002'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Middleware
app.use(express.json());

// Initialize WebSocket service
const signalingService = new SignalingService(httpServer);

// Routes
app.use('/api/auth', userRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/patients', patientRoutes);

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