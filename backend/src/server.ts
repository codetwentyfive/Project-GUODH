import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import userRoutes from './routes/userRoutes';
import patientRoutes from './routes/patientRoutes';
import keywordRoutes from './routes/keywordRoutes';
import callRoutes from './routes/callRoutes';
import webrtcRoutes from './routes/webrtcRoutes';
import { WebRTCService } from './services/webrtc';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3000;

// Initialize WebRTC service
const webRTCService = new WebRTCService(httpServer);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api', keywordRoutes);
app.use('/api', callRoutes);
app.use('/api', webrtcRoutes);

// Test route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'CareCall API is running' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
httpServer.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  console.log(`🌍 Region: de1 (Frankfurt)`);
  console.log(`🎙️ WebRTC enabled for real-time audio communication`);
}); 