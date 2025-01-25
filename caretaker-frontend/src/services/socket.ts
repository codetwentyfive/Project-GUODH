'use client';

import { io, Socket } from 'socket.io-client';

type CallbackData = {
  from?: string;
  targetId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  error?: string;
  roomId?: string;
  userId?: string;
};

type EmitData = {
  targetId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  roomId?: string;
};

export class SocketService {
  private socket: Socket | null = null;
  private connectionPromise: Promise<void> | null = null;

  async connect() {
    if (this.socket?.connected) {
      return;
    }

    if (!this.connectionPromise) {
      this.connectionPromise = new Promise((resolve, reject) => {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
        
        this.socket = io(socketUrl, {
          autoConnect: false,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          transports: ['websocket']
        });

        this.socket.on('connect', () => {
          console.log('Socket connected');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          reject(error);
        });

        this.socket.on('connect_timeout', (timeout) => {
          console.error('Socket connection timeout:', timeout);
          reject(new Error('Connection timeout'));
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
        });

        this.socket.connect();
      });
    }

    return this.connectionPromise;
  }

  async register(userId: string) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('register', { userId }, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Registration failed'));
        }
      });
    });
  }

  emit(event: string, data: EmitData) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(event, data);
  }

  sendReject(targetId: string) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('call-reject', { targetId });
  }

  sendCallEnd(targetId: string) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('call-end', { targetId });
  }

  on(event: string, callback: (data: CallbackData) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback: (data: CallbackData) => void) {
    this.socket?.off(event, callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionPromise = null;
    }
  }
}

export const socketService = new SocketService(); 