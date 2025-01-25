import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';

interface User {
  socketId: string;
  userId: string;
  type: 'patient' | 'caretaker';
}

export class SignalingService {
  private io: SocketServer;
  private users: Map<string, User> = new Map(); // userId -> User
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId

  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.CARETAKER_URL!, process.env.PATIENT_URL!]
          : ['http://localhost:3002', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    console.log('[SignalingService] Initialized');
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('[SignalingService] Client connected:', socket.id);

      // Handle user registration
      socket.on('register', async (data: string | { userId: string }) => {
        try {
          // Handle both string and object formats
          const userId = typeof data === 'string' ? data : data.userId;
          
          // Clean up any existing registration for this user
          const existingUser = this.users.get(userId);
          if (existingUser) {
            console.log(`[SignalingService] User ${userId} already registered, cleaning up old connection`);
            const existingSocket = this.io.sockets.sockets.get(existingUser.socketId);
            if (existingSocket) {
              existingSocket.disconnect();
            }
            this.users.delete(userId);
            this.socketToUser.delete(existingUser.socketId);
          }

          // Determine user type from ID prefix
          const type = userId.startsWith('caretaker') ? 'caretaker' : 'patient';
          
          // Store user information
          this.users.set(userId, { socketId: socket.id, userId, type });
          this.socketToUser.set(socket.id, userId);
          
          console.log(`[SignalingService] User ${userId} (${type}) registered with socket ${socket.id}`);
          
          socket.emit('registration-success', { userId });
        } catch (error) {
          console.error('[SignalingService] Registration error:', error);
          socket.emit('registration-error', { 
            error: 'Failed to register user'
          });
        }
      });

      // Handle call offer
      socket.on('call-offer', ({ targetId, offer }) => {
        try {
          const caller = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!caller) {
            throw new Error('Caller not registered');
          }
          
          if (!target) {
            throw new Error('Target user not found or offline');
          }

          console.log(`[SignalingService] Call offer from ${caller} to ${targetId}`);
          this.io.to(target.socketId).emit('call-offer', {
            from: caller,
            offer
          });
        } catch (error: any) {
          console.error('[SignalingService] Call offer error:', error);
          socket.emit('call-failed', { 
            error: error.message || 'Failed to send call offer',
            targetId 
          });
        }
      });

      // Handle call answer
      socket.on('call-answer', ({ targetId, answer }) => {
        try {
          const respondent = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!respondent) {
            throw new Error('Respondent not registered');
          }
          
          if (!target) {
            throw new Error('Target user not found or offline');
          }

          console.log(`[SignalingService] Call answer from ${respondent} to ${targetId}`);
          this.io.to(target.socketId).emit('call-answered', {
            from: respondent,
            answer
          });
        } catch (error: any) {
          console.error('[SignalingService] Call answer error:', error);
          socket.emit('call-failed', { 
            error: error.message || 'Failed to send call answer',
            targetId 
          });
        }
      });

      // Handle ICE candidates
      socket.on('ice-candidate', ({ targetId, candidate }) => {
        try {
          const sender = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!sender || !target) {
            throw new Error('Invalid sender or target for ICE candidate');
          }

          console.log(`[SignalingService] ICE candidate from ${sender} to ${targetId}`);
          this.io.to(target.socketId).emit('ice-candidate', {
            from: sender,
            candidate
          });
        } catch (error) {
          console.error('[SignalingService] ICE candidate error:', error);
        }
      });

      // Handle call rejection
      socket.on('call-reject', ({ targetId }) => {
        try {
          const sender = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!sender || !target) {
            throw new Error('Invalid sender or target for call rejection');
          }

          console.log(`[SignalingService] Call rejected by ${sender}`);
          this.io.to(target.socketId).emit('call-rejected', {
            from: sender
          });
        } catch (error) {
          console.error('[SignalingService] Call rejection error:', error);
        }
      });

      // Handle call end (both event names for compatibility)
      const handleCallEnd = ({ targetId }: { targetId: string }) => {
        try {
          const sender = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!sender || !target) {
            throw new Error('Invalid sender or target for call end');
          }

          console.log(`[SignalingService] Call ended by ${sender}`);
          this.io.to(target.socketId).emit('call-ended', {
            from: sender
          });
        } catch (error) {
          console.error('[SignalingService] Call end error:', error);
        }
      };

      socket.on('end-call', handleCallEnd);
      socket.on('call-end', handleCallEnd);

      // Handle disconnection
      socket.on('disconnect', () => {
        try {
          const userId = this.socketToUser.get(socket.id);
          if (userId) {
            console.log(`[SignalingService] User ${userId} disconnected`);
            this.users.delete(userId);
            this.socketToUser.delete(socket.id);
            
            // Notify other users about the disconnection
            socket.broadcast.emit('user-offline', { userId });
          }
        } catch (error) {
          console.error('[SignalingService] Disconnect error:', error);
        }
      });
    });
  }
} 