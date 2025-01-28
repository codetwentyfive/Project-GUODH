'use client';

import { io, Socket } from 'socket.io-client';

interface CallbackData {
  from?: string;
  targetId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
  error?: string;
  roomId?: string;
  userId?: string;
  sessionId?: string;
}

interface EmitData {
  targetId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  sessionId?: string;
  error?: string;
  userId?: string;
  type?: 'patient' | 'caretaker';
  message?: string;
}

export class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private isRegistered = false;
  private currentUserId: string | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 2000;

  getSocket(): Socket {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    return this.socket;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected && this.isConnected) {
      console.log('[Socket] Already connected');
      return;
    }

    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
    
    try {
      // Clean up any existing socket
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }

      console.log('[Socket] Initializing connection...');
      this.socket = io(url, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      await new Promise<void>((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket not initialized'));

        const timeoutId = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket.on('connect', () => {
          console.log('[Socket] Connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          clearTimeout(timeoutId);
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('[Socket] Connection error:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('[Socket] Connection error:', error);
      this.handleReconnection();
      throw error;
    }
  }

  private async handleReconnection(): Promise<void> {
    this.reconnectAttempts++;
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`[Socket] Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
      await new Promise(resolve => setTimeout(resolve, this.RECONNECT_INTERVAL));
      return this.connect();
    }
    throw new Error('Failed to connect after maximum attempts');
  }

  async register(userId: string): Promise<void> {
    try {
      await this.connect();

      if (!this.socket?.connected) {
        throw new Error('Socket not connected');
      }

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Registration timeout'));
        }, 5000);

        this.socket!.emit('register', { 
          userId, 
          type: 'caretaker' // Explicitly specify type as caretaker
        }, (response: { success: boolean; error?: string }) => {
          clearTimeout(timeoutId);
          
          if (response.success) {
            this.isRegistered = true;
            this.currentUserId = userId;
            console.log('[Socket] Registration successful');
            resolve();
          } else {
            this.isRegistered = false;
            console.error('[Socket] Registration failed:', response.error);
            reject(new Error(response.error || 'Registration failed'));
          }
        });
      });
    } catch (error) {
      this.isRegistered = false;
      console.error('[Socket] Registration error:', error);
      throw error;
    }
  }

  // Caretaker-specific methods
  async initiateCall(targetId: string): Promise<string> {
    if (!this.socket?.connected || !this.isRegistered) {
      throw new Error('Not connected or registered');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Call initiation timeout'));
      }, 30000);

      this.socket!.emit('call-request', { targetId }, (response: { success: boolean; sessionId?: string; error?: string }) => {
        clearTimeout(timeoutId);
        
        if (response.success && response.sessionId) {
          resolve(response.sessionId);
        } else {
          reject(new Error(response.error || 'Failed to initiate call'));
        }
      });
    });
  }

  on(event: string, callback: (data: CallbackData) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback: (data: CallbackData) => void): void {
    this.socket?.off(event, callback);
  }

  emit(event: string, data: EmitData): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(event, data);
  }

  sendReject(targetId: string): void {
    this.emit('call-rejected', { targetId });
  }

  sendCallEnd(targetId: string): void {
    this.emit('call-ended', { targetId });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isRegistered = false;
    this.currentUserId = null;
    this.reconnectAttempts = 0;
  }
}

export const socketService = new SocketService();
export type { CallbackData, EmitData }; 