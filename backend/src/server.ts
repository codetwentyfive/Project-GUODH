import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import userRoutes from './routes/userRoutes';
import patientRoutes from './routes/patientRoutes';
import keywordRoutes from './routes/keywordRoutes';
import callRoutes from './routes/callRoutes';
import webrtcRoutes from './routes/webrtcRoutes';
import { Server } from 'socket.io';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3000;

// User mapping store
const connectedUsers = new Map<string, string>(); // userId -> socketId
const socketToUser = new Map<string, string>(); // socketId -> userId
const activeRooms = new Map<string, Set<string>>(); // roomId -> Set of userIds

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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle user registration
  socket.on('register', (userId: string) => {
    try {
      // Clean up any existing registrations for this user
      const existingSocketId = connectedUsers.get(userId);
      if (existingSocketId) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          existingSocket.disconnect();
        }
        socketToUser.delete(existingSocketId);
      }

      // Register new socket
      connectedUsers.set(userId, socket.id);
      socketToUser.set(socket.id, userId);
      socket.join(userId); // Join personal room

      console.log('User registered:', userId, 'with socket', socket.id);
      
      // Notify user of successful registration
      socket.emit('registration-success', { userId });
      
      // Broadcast user's online status
      socket.broadcast.emit('user-online', { userId });
    } catch (error) {
      console.error('Registration error:', error);
      socket.emit('registration-error', { error: 'Failed to register user' });
    }
  });

  // Handle call initiation
  socket.on('call-offer', ({ targetId, offer }) => {
    try {
      const callerId = socketToUser.get(socket.id);
      if (!callerId) {
        throw new Error('Caller not registered');
      }

      const targetSocketId = connectedUsers.get(targetId);
      if (!targetSocketId) {
        socket.emit('call-failed', { error: 'Target user not found or offline' });
        return;
      }

      console.log('Call offer from', callerId, 'to', targetId);

      // Create or join call room
      const roomId = `call:${callerId}:${targetId}`;
      socket.join(roomId);
      io.sockets.sockets.get(targetSocketId)?.join(roomId);

      // Store active call participants
      activeRooms.set(roomId, new Set([callerId, targetId]));

      // Send offer to target
      io.to(targetId).emit('call-offer', {
        from: callerId,
        offer,
        roomId
      });
    } catch (error) {
      console.error('Call offer error:', error);
      socket.emit('call-failed', { error: 'Failed to initiate call' });
    }
  });

  // Handle call answer
  socket.on('call-answer', ({ targetId, answer, roomId }) => {
    try {
      const responderId = socketToUser.get(socket.id);
      if (!responderId) {
        throw new Error('Responder not registered');
      }

      console.log('Call answer from', responderId, 'to', targetId);

      // Verify call room
      const participants = activeRooms.get(roomId);
      if (!participants?.has(responderId) || !participants?.has(targetId)) {
        throw new Error('Invalid call room');
      }

      // Send answer to caller
      io.to(targetId).emit('call-answered', {
        from: responderId,
        answer,
        roomId
      });
    } catch (error) {
      console.error('Call answer error:', error);
      socket.emit('call-failed', { error: 'Failed to answer call' });
    }
  });

  // Handle ICE candidates
  socket.on('ice-candidate', ({ targetId, candidate, roomId }) => {
    try {
      const senderId = socketToUser.get(socket.id);
      if (!senderId) {
        throw new Error('Sender not registered');
      }

      // Verify call room
      const participants = activeRooms.get(roomId);
      if (!participants?.has(senderId) || !participants?.has(targetId)) {
        throw new Error('Invalid call room');
      }

      console.log('ICE candidate from', senderId, 'to', targetId);

      // Send candidate to target
      io.to(targetId).emit('ice-candidate', {
        from: senderId,
        candidate,
        roomId
      });
    } catch (error) {
      console.error('ICE candidate error:', error);
    }
  });

  // Handle call end
  socket.on('end-call', ({ targetId, roomId }) => {
    try {
      const senderId = socketToUser.get(socket.id);
      if (!senderId) {
        throw new Error('Sender not registered');
      }

      console.log('Call ended by', senderId, 'to', targetId);

      // Clean up call room
      const participants = activeRooms.get(roomId);
      if (participants) {
        participants.forEach(participantId => {
          const participantSocket = io.sockets.sockets.get(connectedUsers.get(participantId)!);
          participantSocket?.leave(roomId);
          
          // Notify participant
          if (participantId !== senderId) {
            io.to(participantId).emit('call-ended', {
              from: senderId,
              roomId
            });
          }
        });
        activeRooms.delete(roomId);
      }
    } catch (error) {
      console.error('Call end error:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        // Clean up user mappings
        socketToUser.delete(socket.id);
        connectedUsers.delete(userId);

        // Clean up active calls
        for (const [roomId, participants] of activeRooms.entries()) {
          if (participants.has(userId)) {
            participants.forEach(participantId => {
              if (participantId !== userId) {
                io.to(participantId).emit('call-ended', {
                  from: userId,
                  roomId,
                  reason: 'disconnected'
                });
              }
            });
            activeRooms.delete(roomId);
          }
        }

        // Broadcast user's offline status
        socket.broadcast.emit('user-offline', { userId });
      }
      console.log('Client disconnected:', socket.id);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
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
  console.log('🎙️ WebRTC signaling server enabled');
}); 