'use client';

import { io, Socket } from 'socket.io-client';

interface CallbackData {
  from?: string;
  targetId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

type CallbackFunction = (data: CallbackData) => void;

class SocketService {
  private socket: Socket | null = null;
  private callbacks: { [key: string]: CallbackFunction[] } = {};
  private userId: string | null = null;

  connect(): void {
    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    this.socket = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to signaling server');
      if (this.userId) {
        this.register(this.userId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    // Handle call answered
    this.socket.on('call-answered', ({ from, answer }) => {
      console.log('[Socket] Received call answer from:', from);
      this.emit('callAnswered', { from, answer });
    });

    // Handle ICE candidates
    this.socket.on('ice-candidate', ({ from, candidate }) => {
      console.log('[Socket] Received ICE candidate from:', from);
      this.emit('iceCandidate', { from, candidate });
    });

    // Set up event handlers
    Object.keys(this.callbacks).forEach(event => {
      this.callbacks[event].forEach(callback => {
        this.socket?.on(event, callback);
      });
    });
  }

  register(userId: string): void {
    this.userId = userId;
    if (!this.socket?.connected) {
      console.log('[Socket] Not connected, will register after connection');
      this.socket?.once('connect', () => this.register(userId));
      return;
    }

    console.log('[Socket] Registering user:', userId);
    this.socket.emit('register', userId);
  }

  sendOffer(targetId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      console.error('[Socket] Not connected to server');
      return;
    }
    console.log('[Socket] Sending offer to:', targetId);
    this.socket.emit('call-offer', { targetId, offer });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidateInit): void {
    if (!this.socket?.connected) {
      console.error('[Socket] Not connected to server');
      return;
    }
    console.log('[Socket] Sending ICE candidate to:', targetId);
    this.socket.emit('ice-candidate', { targetId, candidate });
  }

  endCall(targetId: string): void {
    if (!this.socket?.connected) {
      console.error('[Socket] Not connected to server');
      return;
    }
    console.log('[Socket] Ending call with:', targetId);
    this.socket.emit('end-call', { targetId });
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
    }
  }
}

export const socketService = new SocketService(); 