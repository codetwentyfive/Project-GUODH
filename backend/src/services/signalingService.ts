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
  private initialized: boolean = false;
  private activeCallSessions: Map<string, string> = new Map(); // userId -> targetId

  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.CARETAKER_URL!, process.env.PATIENT_URL!]
          : ['http://localhost:3002', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'], // Allow both for better compatibility
      pingTimeout: 20000,
      pingInterval: 10000
    });

    this.setupSocketHandlers();
    this.initialized = true;
    console.log('[SignalingService] Initialized and ready for connections');
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('[SignalingService] New connection:', socket.id);

      // Send immediate connection acknowledgment
      socket.emit('connection-success', { socketId: socket.id });

      socket.on('register', async (data: string | { userId: string }, callback?: (response: any) => void) => {
        try {
          const userId = typeof data === 'string' ? data : data.userId;
          
          // Clean up existing connection
          const existingUser = this.users.get(userId);
          if (existingUser) {
            console.log(`[SignalingService] Cleaning up existing connection for ${userId}`);
            const existingSocket = this.io.sockets.sockets.get(existingUser.socketId);
            if (existingSocket) {
              existingSocket.disconnect();
            }
            this.users.delete(userId);
            this.socketToUser.delete(existingUser.socketId);
          }

          const type = userId.startsWith('caretaker') ? 'caretaker' : 'patient';
          
          this.users.set(userId, { socketId: socket.id, userId, type });
          this.socketToUser.set(socket.id, userId);
          
          console.log(`[SignalingService] Registered ${type}:`, userId);
          
          // Send success response
          const response = { success: true, userId, type };
          if (callback) {
            callback(response);
          }
          socket.emit('registration-success', response);
        } catch (error) {
          console.error('[SignalingService] Registration failed:', error);
          const response = { success: false, error: 'Registration failed' };
          if (callback) {
            callback(response);
          }
          socket.emit('registration-error', response);
        }
      });

      // Request to initiate call
      socket.on('call-request', ({ targetId }) => {
        try {
          const callerId = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!callerId) {
            throw new Error('Caller not registered');
          }
          
          if (!target) {
            throw new Error('Target user not found or offline');
          }

          if (this.activeCallSessions.has(callerId) || this.activeCallSessions.has(targetId)) {
            throw new Error('One of the users is already in a call');
          }

          console.log(`[SignalingService] Call request from ${callerId} to ${targetId}`);
          
          // Notify target about incoming call request
          this.io.to(target.socketId).emit('incoming-call-request', {
            from: callerId
          });

          // Set temporary call session
          this.activeCallSessions.set(callerId, targetId);
          this.activeCallSessions.set(targetId, callerId);

          // Auto-cancel call request after 30 seconds if not answered
          setTimeout(() => {
            if (this.activeCallSessions.get(callerId) === targetId) {
              this.cancelCallRequest(callerId, targetId);
            }
          }, 30000);

        } catch (error: any) {
          console.error('[SignalingService] Call request error:', error);
          socket.emit('call-failed', { 
            error: error.message || 'Failed to initiate call request',
            targetId 
          });
        }
      });

      // Handle call acceptance
      socket.on('accept-call', ({ targetId }) => {
        try {
          const accepterId = this.socketToUser.get(socket.id);
          const caller = this.users.get(targetId);
          
          if (!accepterId || !caller || this.activeCallSessions.get(accepterId) !== targetId) {
            throw new Error('Invalid call acceptance');
          }

          console.log(`[SignalingService] Call accepted by ${accepterId}`);
          
          // Notify caller that call was accepted
          this.io.to(caller.socketId).emit('call-accepted', {
            from: accepterId
          });

        } catch (error: any) {
          console.error('[SignalingService] Call acceptance error:', error);
          socket.emit('call-failed', { 
            error: error.message || 'Failed to accept call',
            targetId 
          });
        }
      });

      // Handle call offer (only after call is accepted)
      socket.on('call-offer', ({ targetId, offer }) => {
        try {
          const callerId = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!callerId || !target || this.activeCallSessions.get(callerId) !== targetId) {
            throw new Error('Invalid call state for offer');
          }

          console.log(`[SignalingService] Call offer from ${callerId} to ${targetId}`);
          this.io.to(target.socketId).emit('call-offer', {
            from: callerId,
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

      // Handle media errors more gracefully
      socket.on('media-error', ({ targetId, error }) => {
        try {
          const userId = this.socketToUser.get(socket.id);
          const target = this.users.get(targetId);
          
          if (!userId || !target) {
            throw new Error('Invalid user or target for media error');
          }

          console.log(`[SignalingService] Media error from ${userId}:`, error);
          
          // Notify both parties about the media error
          const errorMessage = {
            type: 'media',
            message: 'Failed to access camera or microphone. Please check your permissions and device settings.'
          };
          
          socket.emit('call-error', errorMessage);
          this.io.to(target.socketId).emit('call-error', errorMessage);
          
          // Clean up call session
          this.cleanupCallSession(userId, targetId);

        } catch (error) {
          console.error('[SignalingService] Media error handling failed:', error);
        }
      });

      // Enhanced call end handling
      socket.on('end-call', ({ targetId }) => {
        try {
          const userId = this.socketToUser.get(socket.id);
          if (userId) {
            this.cleanupCallSession(userId, targetId);
          }
        } catch (error) {
          console.error('[SignalingService] Call end error:', error);
        }
      });

      // Handle disconnection with call cleanup
      socket.on('disconnect', () => {
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
          const targetId = this.activeCallSessions.get(userId);
          if (targetId) {
            this.cleanupCallSession(userId, targetId);
          }
          this.users.delete(userId);
          this.socketToUser.delete(socket.id);
          this.io.emit('user-disconnected', { userId });
        }
      });
    });
  }

  private cleanupCallSession(userId: string, targetId: string) {
    console.log(`[SignalingService] Cleaning up call session between ${userId} and ${targetId}`);
    
    this.activeCallSessions.delete(userId);
    this.activeCallSessions.delete(targetId);
    
    const target = this.users.get(targetId);
    if (target) {
      this.io.to(target.socketId).emit('call-ended', { from: userId });
    }
    
    const user = this.users.get(userId);
    if (user) {
      this.io.to(user.socketId).emit('call-ended', { from: targetId });
    }
  }

  private cancelCallRequest(callerId: string, targetId: string) {
    console.log(`[SignalingService] Canceling call request from ${callerId} to ${targetId}`);
    
    this.activeCallSessions.delete(callerId);
    this.activeCallSessions.delete(targetId);
    
    const caller = this.users.get(callerId);
    const target = this.users.get(targetId);
    
    if (caller) {
      this.io.to(caller.socketId).emit('call-request-timeout', { targetId });
    }
    
    if (target) {
      this.io.to(target.socketId).emit('call-request-canceled', { from: callerId });
    }
  }
} 