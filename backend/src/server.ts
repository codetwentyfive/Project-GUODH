import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import userRoutes from './routes/userRoutes';
import patientRoutes from './routes/patientRoutes';
import callRoutes from './routes/callRoutes';
import { Server } from 'socket.io';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const port = 3000;

// Configure CORS
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

// Add user socket mapping at the top level
const userSocketMap = new Map<string, string>();
const activeConnections = new Set<string>();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('register', (userId: string) => {
    console.log('👤 User registered:', userId, 'with socket', socket.id);
    socket.data.userId = userId;
    userSocketMap.set(userId, socket.id);
    activeConnections.add(userId);
    
    // Notify others that this user is now available
    socket.broadcast.emit('user-online', userId);
  });

  socket.on('call-offer', ({ targetId, offer }) => {
    console.log('📞 Call offer from', socket.data.userId, 'to', targetId);
    const targetSocketId = userSocketMap.get(targetId);
    
    if (!activeConnections.has(targetId)) {
      console.error('❌ Target user offline:', targetId);
      socket.emit('call-error', { message: 'User is offline' });
      return;
    }
    
    if (targetSocketId) {
      socket.to(targetSocketId).emit('call-offer', {
        from: socket.data.userId,
        offer
      });
      console.log('✅ Offer forwarded to:', targetId);
    } else {
      console.error('❌ Target socket not found:', targetId);
      socket.emit('call-error', { message: 'Failed to reach target user' });
    }
  });

  socket.on('call-answer', ({ targetId, answer }) => {
    console.log('📞 Call answer from', socket.data.userId, 'to', targetId);
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('call-answered', {
        from: socket.data.userId,
        answer
      });
      console.log('✅ Answer forwarded to:', targetId);
    } else {
      console.error('❌ Target socket not found for answer:', targetId);
    }
  });

  socket.on('call-rejected', ({ targetId }) => {
    console.log('📞 Call rejected by', socket.data.userId);
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('call-rejected', {
        from: socket.data.userId
      });
      console.log('✅ Rejection notification sent to:', targetId);
    }
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    console.log('🧊 ICE candidate from', socket.data.userId, 'to', targetId);
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('ice-candidate', {
        from: socket.data.userId,
        candidate
      });
      console.log('✅ ICE candidate forwarded');
    } else {
      console.error('❌ Target socket not found for ICE candidate:', targetId);
    }
  });

  socket.on('end-call', ({ targetId }) => {
    console.log('📞 Call ended by', socket.data.userId, 'to', targetId);
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('call-ended', {
        from: socket.data.userId
      });
      console.log('✅ Call end notification sent');
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.userId) {
      userSocketMap.delete(socket.data.userId);
      activeConnections.delete(socket.data.userId);
      // Notify others that this user is now offline
      socket.broadcast.emit('user-offline', socket.data.userId);
    }
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api', callRoutes);

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
  console.log(`🎙️ WebRTC enabled for real-time audio communication`);
  console.log('🎙️ WebRTC signaling server enabled');
}); 