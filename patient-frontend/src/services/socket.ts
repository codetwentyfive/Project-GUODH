'use client';

import { io, Socket } from 'socket.io-client';

interface CallbackData {
  from?: string;
  targetId?: string;
  userId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  roomId?: string;
  error?: string;
  reason?: string;
}

type CallbackFunction = (data: CallbackData) => void;

class SocketService {
  private socket: Socket | null = null;
  private callbacks: { [key: string]: CallbackFunction[] } = {};
  private currentRoomId: string | null = null;
  private connectionPromise: Promise<void> | null = null;
  private resolveConnection: ((value?: void | PromiseLike<void>) => void) | null = null;
  private isRegistered = false;
  private userId: string | null = null;
  private resolveRegistration: ((value?: void | PromiseLike<void>) => void) | null = null;

  connect(): Promise<void> {
    if (this.socket?.connected && this.isRegistered) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve) => {
      this.resolveConnection = resolve;
    });

    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      path: '/socket.io/',
      rejectUnauthorized: false
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to signaling server');
      if (this.userId && !this.isRegistered) {
        this.register(this.userId);
      }
      if (this.resolveConnection) {
        this.resolveConnection();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.connectionPromise = null;
      
      // Don't clear registration state on transport close
      if (reason !== 'transport close' && reason !== 'ping timeout') {
        this.isRegistered = false;
      }

      if (reason === 'io server disconnect') {
        // Server disconnected us, retry connection
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      // Attempt to fall back to polling if websocket fails
      if (this.socket?.io?.opts?.transports?.includes('polling')) {
        console.log('[Socket] Falling back to polling transport');
        this.socket.io.opts.transports = ['polling', 'websocket'];
      }
    });

    // Handle registration events
    this.socket.on('registration-success', ({ userId }) => {
      console.log('[Socket] Registration successful:', userId);
      this.isRegistered = true;
      if (this.resolveRegistration) {
        this.resolveRegistration();
      }
      this.emit('registrationSuccess', { userId });
    });

    return this.connectionPromise;
  }

  async waitForConnection(): Promise<void> {
    if (this.socket?.connected && this.isRegistered) {
      return;
    }

    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        await this.connect();
        if (this.socket?.connected) {
          if (!this.isRegistered && this.userId) {
            await this.register(this.userId);
          }
          return;
        }
      } catch (err) {
        console.error('[Socket] Connection attempt failed:', err);
        retries++;
        if (retries === maxRetries) {
          throw new Error('Failed to establish connection after multiple attempts');
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  register(userId: string): void {
    if (!this.socket?.connected) {
      console.log('[Socket] Not connected, will register after connection');
      this.socket?.once('connect', () => this.register(userId));
      return;
    }

    console.log('[Socket] Registering user:', userId);
    this.socket.emit('register', userId);
  }

  on(event: string, callback: CallbackFunction): void {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
    this.socket?.on(event, callback);
  }

  emit(event: string, data: CallbackData): void {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRoomId = null;
    }
  }

  sendAnswer(targetId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      console.error('[Socket] Cannot send answer: not connected');
      return;
    }
    if (!this.currentRoomId) {
      console.error('[Socket] Cannot send answer: no active room');
      return;
    }
    this.socket.emit('call-answer', { targetId, answer, roomId: this.currentRoomId });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidate): void {
    if (!this.socket?.connected) {
      console.error('[Socket] Cannot send ICE candidate: not connected');
      return;
    }
    if (!this.currentRoomId) {
      console.warn('[Socket] Cannot send ICE candidate: no active room');
      return;
    }
    this.socket.emit('ice-candidate', { targetId, candidate, roomId: this.currentRoomId });
  }

  sendReject(targetId: string): void {
    if (!this.socket?.connected) {
      console.error('[Socket] Cannot send reject: not connected');
      return;
    }
    if (!this.currentRoomId) {
      console.warn('[Socket] Cannot send reject: no active room');
      return;
    }
    this.socket.emit('call-rejected', { targetId, roomId: this.currentRoomId });
    this.currentRoomId = null;
  }
}

export const socketService = new SocketService(); 