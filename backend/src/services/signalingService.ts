import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { callSessionManager } from './callSessionManager';
import { webRTCConfig } from '../config/webrtc.config';

interface User {
  socketId: string;
  userId: string;
  type: 'caretaker' | 'patient';
}

interface RegistrationData {
  userId: string;
  type: 'caretaker' | 'patient';
}

export class SignalingService {
  private io: SocketServer;
  private users: Map<string, User> = new Map(); // userId -> User
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId
  private initialized: boolean = false;

  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.CARETAKER_URL!, process.env.PATIENT_URL!]
          : ['http://localhost:3002', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket'],
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
      socket.emit('connection-success', { 
        socketId: socket.id,
        config: webRTCConfig
      });

      socket.on('register', async (data: RegistrationData, callback?: (response: any) => void) => {
        try {
          // Validate registration data
          if (!data.userId || !data.type) {
            throw new Error('Invalid registration data: missing userId or type');
          }

          if (!['patient', 'caretaker'].includes(data.type)) {
            throw new Error('Invalid user type');
          }

          // Clean up existing connection
          const existingUser = this.users.get(data.userId);
          if (existingUser) {
            console.log(`[SignalingService] Cleaning up existing connection for ${data.userId}`);
            const existingSocket = this.io.sockets.sockets.get(existingUser.socketId);
            if (existingSocket) {
              existingSocket.disconnect();
            }
            this.users.delete(data.userId);
            this.socketToUser.delete(existingUser.socketId);
          }

          const user: User = { 
            socketId: socket.id, 
            userId: data.userId, 
            type: data.type 
          };
          
          this.users.set(data.userId, user);
          this.socketToUser.set(socket.id, data.userId);
          
          console.log(`[SignalingService] Registered ${data.type}:`, data.userId);
          
          const response = { success: true, userId: data.userId, type: data.type };
          if (callback) callback(response);
          socket.emit('registration-success', response);

        } catch (error) {
          console.error('[SignalingService] Registration failed:', error);
          const response = { 
            success: false, 
            error: error instanceof Error ? error.message : 'Registration failed' 
          };
          if (callback) callback(response);
          socket.emit('registration-error', response);
        }
      });

      socket.on('call-request', async ({ targetId }, callback?: (response: any) => void) => {
        try {
          const callerId = this.socketToUser.get(socket.id);
          const caller = this.users.get(callerId!);
          const target = this.users.get(targetId);
          
          if (!caller || caller.type !== 'caretaker') {
            throw new Error('Only caretakers can initiate calls');
          }
          
          if (!target || target.type !== 'patient') {
            throw new Error('Invalid target: must be a patient');
          }

          if (callSessionManager.isUserInCall(callerId!) || callSessionManager.isUserInCall(targetId)) {
            throw new Error('One of the users is already in a call');
          }

          console.log(`[SignalingService] Call request from ${callerId} to ${targetId}`);
          
          const session = await callSessionManager.createSession(
            { id: callerId!, socketId: socket.id, type: 'caretaker' },
            { id: targetId, socketId: target.socketId, type: 'patient' }
          );

          // Notify target about incoming call request
          this.io.to(target.socketId).emit('incoming-call-request', {
            from: callerId,
            sessionId: session.id
          });

          // Send success response to caretaker
          if (callback) {
            callback({
              success: true,
              sessionId: session.id
            });
          }

        } catch (error: any) {
          console.error('[SignalingService] Call request error:', error);
          const errorResponse = { 
            success: false,
            error: error.message || 'Failed to initiate call request'
          };
          
          if (callback) {
            callback(errorResponse);
          }
          
          socket.emit('call-failed', { 
            ...errorResponse,
            targetId 
          });
        }
      });

      socket.on('media-ready', ({ sessionId }) => {
        try {
          const userId = this.socketToUser.get(socket.id);
          const session = callSessionManager.getSession(sessionId);
          
          if (!session || !userId) {
            throw new Error('Invalid session or user');
          }

          if (userId === session.caretaker.id) {
            this.io.to(session.patient.socketId).emit('media-ready', {
              from: userId,
              sessionId
            });
          } else if (userId === session.patient.id) {
            this.io.to(session.caretaker.socketId).emit('media-ready', {
              from: userId,
              sessionId
            });
          }
        } catch (error) {
          console.error('[SignalingService] Media ready error:', error);
        }
      });

      socket.on('media-error', async ({ sessionId, error }) => {
        try {
          const userId = this.socketToUser.get(socket.id);
          const session = callSessionManager.getSession(sessionId);
          
          if (!session || !userId) {
            throw new Error('Invalid session or user');
          }

          console.log(`[SignalingService] Media error from ${userId}:`, error);
          
          // Notify both parties about the media error
          const errorMessage = {
            type: 'media',
            message: 'Failed to access camera or microphone. Please check your permissions and device settings.'
          };
          
          this.io.to(session.caretaker.socketId).emit('call-error', errorMessage);
          this.io.to(session.patient.socketId).emit('call-error', errorMessage);
          
          await callSessionManager.endSession(sessionId, 'Media access denied');

        } catch (error) {
          console.error('[SignalingService] Media error handling failed:', error);
        }
      });

      socket.on('disconnect', () => {
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
          const sessions = Array.from(callSessionManager['sessions'].values())
            .filter(session => 
              session.caretaker.id === userId || 
              session.patient.id === userId
            );

          sessions.forEach(async session => {
            await callSessionManager.endSession(
              session.id, 
              `User ${userId} disconnected`
            );
          });

          this.users.delete(userId);
          this.socketToUser.delete(socket.id);
          this.io.emit('user-disconnected', { userId });
        }
      });
    });
  }

  public getUserById(userId: string): User | undefined {
    return this.users.get(userId);
  }

  public getUserBySocketId(socketId: string): User | undefined {
    const userId = this.socketToUser.get(socketId);
    return userId ? this.users.get(userId) : undefined;
  }
} 