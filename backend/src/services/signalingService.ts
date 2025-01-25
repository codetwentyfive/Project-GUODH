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
          : ['http://localhost:3001', 'http://localhost:3002'],
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle user registration
      socket.on('register', async (userId: string) => {
        try {
          // Determine user type from ID prefix
          const type = userId.startsWith('caretaker') ? 'caretaker' : 'patient';
          
          // Store user information
          this.users.set(userId, { socketId: socket.id, userId, type });
          this.socketToUser.set(socket.id, userId);
          
          console.log(`User ${userId} (${type}) registered with socket ${socket.id}`);
          
          socket.emit('registration-success', { userId });
        } catch (error) {
          console.error('Registration error:', error);
          socket.emit('registration-error', { 
            error: 'Failed to register user'
          });
        }
      });

      // Handle call offer
      socket.on('call-offer', ({ targetId, offer }) => {
        const caller = this.socketToUser.get(socket.id);
        const target = this.users.get(targetId);
        
        if (!caller || !target) {
          socket.emit('call-failed', { 
            error: 'User not found',
            targetId 
          });
          return;
        }

        console.log(`Call offer from ${caller} to ${targetId}`);
        this.io.to(target.socketId).emit('call-offer', {
          from: caller,
          offer
        });
      });

      // Handle call answer
      socket.on('call-answer', ({ targetId, answer }) => {
        const respondent = this.socketToUser.get(socket.id);
        const target = this.users.get(targetId);
        
        if (!respondent || !target) {
          socket.emit('call-failed', { 
            error: 'User not found',
            targetId 
          });
          return;
        }

        console.log(`Call answer from ${respondent} to ${targetId}`);
        this.io.to(target.socketId).emit('call-answered', {
          from: respondent,
          answer
        });
      });

      // Handle ICE candidates
      socket.on('ice-candidate', ({ targetId, candidate }) => {
        const sender = this.socketToUser.get(socket.id);
        const target = this.users.get(targetId);
        
        if (sender && target) {
          console.log(`ICE candidate from ${sender} to ${targetId}`);
          this.io.to(target.socketId).emit('ice-candidate', {
            from: sender,
            candidate
          });
        }
      });

      // Handle call rejection
      socket.on('call-reject', ({ targetId }) => {
        const sender = this.socketToUser.get(socket.id);
        const target = this.users.get(targetId);
        
        if (sender && target) {
          console.log(`Call rejected by ${sender}`);
          this.io.to(target.socketId).emit('call-rejected', {
            from: sender
          });
        }
      });

      // Handle call end
      socket.on('call-end', ({ targetId }) => {
        const sender = this.socketToUser.get(socket.id);
        const target = this.users.get(targetId);
        
        if (sender && target) {
          console.log(`Call ended by ${sender}`);
          this.io.to(target.socketId).emit('call-ended', {
            from: sender
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
          this.users.delete(userId);
          this.socketToUser.delete(socket.id);
          console.log(`User ${userId} disconnected`);
        }
      });
    });
  }
} 