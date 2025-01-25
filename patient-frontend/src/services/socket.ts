'use client';

import { io, Socket } from 'socket.io-client';

interface CallbackData {
  from?: string;
  targetId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  error?: string;
  roomId?: string;
  userId?: string;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private eventCallbacks: { [key: string]: ((data: CallbackData) => void)[] } = {};
  private connectionPromise: Promise<void> | null = null;
  private resolveConnection: (() => void) | null = null;
  private currentUserId: string | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 2000;
  private isRegistered = false;

  async connect(): Promise<void> {
    if (this.socket?.connected && this.isConnected) {
      console.log('[Socket] Already connected');
      return;
    }

    // If we're already trying to connect, return the existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.resolveConnection = resolve;
        
        // Clean up any existing socket
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
        }

        console.log('[Socket] Initializing connection...');
        this.socket = io(url, {
          autoConnect: false,
          transports: ['websocket'],
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        // Set up all event handlers before connecting
        this.setupSocketEventHandlers();
        
        // Explicitly connect the socket
        this.socket.connect();

      } catch (error) {
        console.error('[Socket] Setup error:', error);
        this.connectionPromise = null;
        this.handleReconnection(reject);
      }
    });

    return this.connectionPromise;
  }

  private handleReconnection(reject: (reason?: Error) => void) {
    this.reconnectAttempts++;
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`[Socket] Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(() => {
        this.connectionPromise = null;
        this.connect().catch(reject);
      }, this.RECONNECT_INTERVAL);
    } else {
      reject(new Error('Failed to connect after maximum attempts'));
    }
  }

  private setupSocketEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Only re-register if we were previously registered
      if (this.currentUserId && this.isRegistered) {
        this.register(this.currentUserId).catch(error => {
          console.error('[Socket] Failed to re-register after reconnection:', error);
        });
      }

      if (this.resolveConnection) {
        this.resolveConnection();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      if (this.resolveConnection) {
        this.resolveConnection();
      }
    });

    this.socket.on('connect_timeout', (error) => {
      console.error('[Socket] Connection timeout:', error);
      if (this.resolveConnection) {
        this.resolveConnection();
      }
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Socket error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.isConnected = false;
      this.connectionPromise = null;

      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        this.socket?.connect();
      }
    });

    // Set up event handlers
    this.socket.on('registration-success', (data) => {
      console.log('[Socket] Registration successful:', data);
      this.emit('registration-success', data);
    });

    this.socket.on('registration-error', (data) => {
      console.error('[Socket] Registration failed:', data);
      this.emit('registration-error', data);
    });

    this.socket.on('call-offer', (data: CallbackData) => {
      console.log('[Socket] Received call offer:', data);
      this.emit('call-offer', data);
    });

    this.socket.on('call-answer', (data: CallbackData) => {
      console.log('[Socket] Received call answer:', data);
      this.emit('call-answer', data);
    });

    this.socket.on('call-rejected', (data: CallbackData) => {
      console.log('[Socket] Call rejected:', data);
      this.emit('call-rejected', data);
    });

    this.socket.on('call-failed', (data: CallbackData) => {
      console.log('[Socket] Call failed:', data);
      this.emit('call-failed', data);
    });

    this.socket.on('call-ended', (data: CallbackData) => {
      console.log('[Socket] Call ended:', data);
      this.emit('call-ended', data);
    });

    this.socket.on('ice-candidate', (data: CallbackData) => {
      console.log('[Socket] Received ICE candidate');
      this.emit('ice-candidate', data);
    });

    this.socket.on('user-not-found', (data: CallbackData) => {
      console.error('[Socket] Target user not found:', data);
      this.emit('call-failed', { 
        error: 'User is offline or not found',
        ...data 
      });
    });

    this.socket.on('user-busy', (data: CallbackData) => {
      console.error('[Socket] Target user is busy:', data);
      this.emit('call-failed', { 
        error: 'User is busy in another call',
        ...data 
      });
    });
  }

  async register(userId: string): Promise<void> {
    // If already registered with this ID, don't register again
    if (this.isRegistered && this.currentUserId === userId) {
      console.log('[Socket] Already registered with this ID');
      return;
    }

    // Store the user ID for reconnection purposes
    this.currentUserId = userId;

    // Make sure we're connected first
    await this.connect();

    // Double check connection after waiting
    if (!this.socket?.connected) {
      console.log('[Socket] Waiting for connection to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.socket?.connected) {
        throw new Error('Socket not connected');
      }
    }

    return new Promise((resolve, reject) => {
      console.log('[Socket] Attempting to register user:', userId);
      
      // Set up one-time event handlers for registration response
      const handleSuccess = () => {
        console.log('[Socket] Registered successfully');
        this.isRegistered = true;
        cleanup();
        resolve();
      };

      const handleError = (error: { error: string }) => {
        console.error('[Socket] Registration failed:', error.error);
        this.isRegistered = false;
        cleanup();
        reject(new Error(error.error || 'Registration failed'));
      };

      const cleanup = () => {
        this.socket?.off('registration-success', handleSuccess);
        this.socket?.off('registration-error', handleError);
      };

      // Register event handlers
      this.socket!.on('registration-success', handleSuccess);
      this.socket!.on('registration-error', handleError);

      // Send registration request
      this.socket!.emit('register', userId);

      // Set timeout for registration
      setTimeout(() => {
        cleanup();
        reject(new Error('Registration timeout'));
      }, 5000);
    });
  }

  on(event: string, callback: (data: CallbackData) => void): void {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  private emit(event: string, data: CallbackData): void {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => callback(data));
    }
  }

  sendOffer(targetId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    console.log('[Socket] Sending call offer to:', targetId);
    this.socket.emit('call-offer', { targetId, offer }, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        console.error('[Socket] Failed to send offer:', response.error);
        this.emit('call-failed', { 
          error: response.error || 'Failed to reach user',
          targetId 
        });
      }
    });
  }

  sendAnswer(targetId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    console.log('[Socket] Sending call answer to:', targetId);
    this.socket.emit('call-answer', { targetId, answer }, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        console.error('[Socket] Failed to send answer:', response.error);
        this.emit('call-failed', { 
          error: response.error || 'Failed to send answer',
          targetId 
        });
      }
    });
  }

  sendReject(targetId: string): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('call-reject', { targetId });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidateInit): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('ice-candidate', { targetId, candidate });
  }

  sendCallEnd(targetId: string): void {
    if (!this.socket?.connected) {
      console.error('[Socket] Cannot end call: socket not connected');
      return;
    }
    this.socket.emit('call-end', { targetId });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isRegistered = false;
    this.eventCallbacks = {};
    this.connectionPromise = null;
    this.resolveConnection = null;
    this.currentUserId = null;
    this.reconnectAttempts = 0;
  }
}

export const socketService = new SocketService();
export type { CallbackData }; 