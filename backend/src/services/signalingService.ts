import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';

export class SignalingService {
  private io: SocketServer;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: ['http://localhost:3001', 'http://localhost:3002'], // Patient and Caretaker frontends
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Register user (patient or caretaker)
      socket.on('register', (userId: string) => {
        this.userSockets.set(userId, socket.id);
        console.log(`User ${userId} registered with socket ${socket.id}`);
      });

      // Handle call offer from caretaker to patient
      socket.on('call-offer', ({ targetId, offer }) => {
        const targetSocketId = this.userSockets.get(targetId);
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('incoming-call', {
            from: socket.id,
            offer
          });
        }
      });

      // Handle call answer from patient to caretaker
      socket.on('call-answer', ({ targetId, answer }) => {
        const targetSocketId = this.userSockets.get(targetId);
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('call-answered', {
            from: socket.id,
            answer
          });
        }
      });

      // Handle ICE candidates
      socket.on('ice-candidate', ({ targetId, candidate }) => {
        const targetSocketId = this.userSockets.get(targetId);
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('ice-candidate', {
            from: socket.id,
            candidate
          });
        }
      });

      // Handle call end
      socket.on('end-call', ({ targetId }) => {
        const targetSocketId = this.userSockets.get(targetId);
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('call-ended', {
            from: socket.id
          });
        }
      });

      socket.on('disconnect', () => {
        // Remove user from userSockets map
        for (const [userId, socketId] of this.userSockets.entries()) {
          if (socketId === socket.id) {
            this.userSockets.delete(userId);
            break;
          }
        }
        console.log('Client disconnected:', socket.id);
      });
    });
  }
} 