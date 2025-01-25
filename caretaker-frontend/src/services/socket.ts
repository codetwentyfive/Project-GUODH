'use client';

import { io, Socket } from 'socket.io-client';

export interface CallbackData {
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
  private userId: string | null = null;
  private connectionPromise: Promise<void> | null = null;
  private resolveConnection: (() => void) | null = null;
  private currentRoomId: string | null = null;
  private isRegistered: boolean = false;
  private registrationPromise: Promise<void> | null = null;
  private resolveRegistration: (() => void) | null = null;

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
      timeout: 20000
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
      this.currentRoomId = null;
      this.isRegistered = false;
      if (reason === 'io server disconnect') {
        // Server disconnected us, retry connection
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
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

    this.socket.on('registration-error', ({ error }) => {
      console.error('[Socket] Registration failed:', error);
      this.isRegistered = false;
      this.emit('registrationError', { error });
    });

    // Handle call events
    this.socket.on('call-answered', ({ from, answer, roomId }) => {
      console.log('[Socket] Received call answer from:', from);
      this.currentRoomId = roomId;
      this.emit('callAnswered', { from, answer, roomId });
    });

    this.socket.on('call-rejected', ({ from }) => {
      console.log('[Socket] Call rejected by:', from);
      this.emit('callRejected', { from });
    });

    this.socket.on('call-failed', ({ error }) => {
      console.error('[Socket] Call failed:', error);
      this.emit('callFailed', { error });
    });

    // Handle ICE candidates
    this.socket.on('ice-candidate', ({ from, candidate, roomId }) => {
      console.log('[Socket] Received ICE candidate from:', from);
      this.emit('iceCandidate', { from, candidate, roomId });
    });

    // Handle call end
    this.socket.on('call-ended', ({ from, roomId, reason }) => {
      console.log('[Socket] Call ended by:', from, reason ? `(${reason})` : '');
      this.currentRoomId = null;
      this.emit('callEnded', { from, roomId, reason });
    });

    // Set up event handlers
    Object.keys(this.callbacks).forEach(event => {
      this.callbacks[event].forEach(callback => {
        this.socket?.on(event, callback);
      });
    });

    return this.connectionPromise;
  }

  async waitForConnection(): Promise<void> {
    if (this.socket?.connected && this.isRegistered) {
      return;
    }
    await this.connect();
    if (!this.isRegistered && this.userId) {
      await this.register(this.userId);
    }
  }

  register(userId: string): Promise<void> {
    this.userId = userId;
    
    if (this.registrationPromise) {
      return this.registrationPromise;
    }

    this.registrationPromise = new Promise((resolve) => {
      this.resolveRegistration = resolve;
    });

    if (!this.socket?.connected) {
      console.log('[Socket] Not connected, will register after connection');
      this.socket?.connect();
      return this.registrationPromise;
    }

    console.log('[Socket] Registering user:', userId);
    this.socket.emit('register', userId);
    return this.registrationPromise;
  }

  async sendOffer(targetId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    await this.waitForConnection();
    if (!this.isRegistered) {
      throw new Error('Socket service not registered');
    }
    console.log('[Socket] Sending offer to:', targetId, 'from:', this.userId);
    this.socket!.emit('call-offer', { targetId, offer });
    this.currentRoomId = `${this.userId}-${targetId}`;
  }

  async sendIceCandidate(targetId: string, candidate: RTCIceCandidateInit): Promise<void> {
    await this.waitForConnection();
    if (!this.isRegistered) {
      console.error('[Socket] Cannot send ICE candidate: not registered');
      return;
    }
    if (!this.currentRoomId) {
      console.warn('[Socket] No active room for ICE candidate');
      return;
    }
    console.log('[Socket] Sending ICE candidate to:', targetId, 'from:', this.userId);
    this.socket!.emit('ice-candidate', { targetId, candidate, roomId: this.currentRoomId });
  }

  async endCall(targetId: string): Promise<void> {
    await this.waitForConnection();
    if (!this.isRegistered) {
      console.error('[Socket] Cannot end call: not registered');
      return;
    }
    if (!this.currentRoomId) {
      console.warn('[Socket] No active room to end call');
      return;
    }
    console.log('[Socket] Ending call with:', targetId, 'from:', this.userId);
    this.socket!.emit('end-call', { targetId, roomId: this.currentRoomId });
    this.currentRoomId = null;
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
      this.userId = null;
      this.connectionPromise = null;
      this.resolveConnection = null;
      this.currentRoomId = null;
      this.isRegistered = false;
      this.registrationPromise = null;
      this.resolveRegistration = null;
    }
  }
}

export const socketService = new SocketService(); 