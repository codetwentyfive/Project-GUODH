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
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    // Handle incoming calls
    this.socket.on('call-offer', ({ from, offer }) => {
      this.emit('incomingCall', { from, offer });
    });

    // Handle ICE candidates
    this.socket.on('ice-candidate', ({ from, candidate }) => {
      this.emit('iceCandidate', { from, candidate });
    });

    // Handle call ended
    this.socket.on('call-ended', ({ from }) => {
      this.emit('callEnded', { from });
    });

    // Set up event handlers
    Object.keys(this.callbacks).forEach(event => {
      this.callbacks[event].forEach(callback => {
        this.socket?.on(event, callback);
      });
    });
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
    if (!this.socket?.connected) {
      console.error('[Socket] Cannot emit event: not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendAnswer(targetId: string, answer: RTCSessionDescriptionInit): void {
    this.emit('call-answer', { targetId, answer });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidate): void {
    this.emit('ice-candidate', { targetId, candidate });
  }
}

export const socketService = new SocketService(); 