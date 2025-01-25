'use client';

import { webRTCService } from './webrtc';
import { socketService } from './socket';
import { CallState, CallEventType, CallEventCallback, CallMetrics, CallParticipant, CallEventData } from '../types/call';

export class CallManager {
  private state: CallState = {
    status: 'idle',
    reconnectionAttempts: 0
  };
  private eventListeners: Map<CallEventType, Set<CallEventCallback<CallEventType>>> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECTION_ATTEMPTS = 3;
  private readonly METRICS_INTERVAL = 2000;
  private isHandlingEvent = false;

  constructor() {
    this.setupEventListeners();
  }

  getCurrentState(): CallState {
    return { ...this.state };
  }

  async startCall(participant: CallParticipant): Promise<void> {
    if (this.isHandlingEvent) return;
    this.isHandlingEvent = true;

    try {
      console.log('[CallManager] Starting call to:', participant.id);
      
      // Only update state if we're not already in a call
      if (this.state.status === 'idle') {
        this.updateState({
          status: 'calling',
          participant,
          reconnectionAttempts: 0,
          startTime: undefined,
          error: undefined
        });
      }

      await webRTCService.startCall(participant.id);
      console.log('[CallManager] Call initiated successfully');
    } catch (error) {
      console.error('[CallManager] Failed to start call:', error);
      this.handleFailure('Failed to start call');
    } finally {
      this.isHandlingEvent = false;
    }
  }

  async endCall(): Promise<void> {
    if (this.isHandlingEvent) return;
    this.isHandlingEvent = true;

    try {
      webRTCService.endCall();
      this.cleanup();
      this.updateState({
        status: 'idle',
        participant: undefined,
        startTime: undefined,
        error: undefined,
        reconnectionAttempts: 0
      });
    } finally {
      this.isHandlingEvent = false;
    }
  }

  addEventListener<T extends CallEventType>(event: T, callback: CallEventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback as CallEventCallback<CallEventType>);
  }

  removeEventListener<T extends CallEventType>(event: T, callback: CallEventCallback<T>): void {
    this.eventListeners.get(event)?.delete(callback as CallEventCallback<CallEventType>);
  }

  private setupEventListeners(): void {
    webRTCService.onConnectionStateChange((state) => {
      if (this.isHandlingEvent) return;
      this.isHandlingEvent = true;

      try {
        switch (state) {
          case 'connected':
            if (this.state.status !== 'connected') {
              this.updateState({ 
                status: 'connected', 
                startTime: new Date(),
                error: undefined
              });
              this.startMetricsCollection();
            }
            break;
          case 'disconnected':
            if (this.state.status === 'connected') {
              this.handleDisconnection();
            }
            break;
          case 'failed':
            this.handleFailure('Connection failed');
            break;
          case 'closed':
            if (this.state.status !== 'idle') {
              this.cleanup();
              this.updateState({
                status: 'idle',
                participant: undefined,
                error: undefined,
                startTime: undefined,
                reconnectionAttempts: 0
              });
            }
            break;
        }
      } finally {
        this.isHandlingEvent = false;
      }
    });

    socketService.on('callRejected', () => {
      if (this.isHandlingEvent) return;
      this.isHandlingEvent = true;

      try {
        if (this.state.status !== 'idle') {
          this.updateState({ 
            status: 'idle',
            participant: undefined,
            error: 'Call was rejected',
            startTime: undefined
          });
          this.cleanup();
        }
      } finally {
        this.isHandlingEvent = false;
      }
    });

    socketService.on('call-ended', ({ reason }) => {
      if (this.isHandlingEvent) return;
      this.isHandlingEvent = true;

      try {
        if (this.state.status !== 'idle') {
          this.updateState({ 
            status: 'idle',
            participant: undefined,
            error: reason ? `Call ended: ${reason}` : undefined,
            startTime: undefined
          });
          this.cleanup();
        }
      } finally {
        this.isHandlingEvent = false;
      }
    });
  }

  private updateState(partial: Partial<CallState>): void {
    const prevState = { ...this.state };
    // Only update if there's an actual change
    if (JSON.stringify(this.state) === JSON.stringify({ ...this.state, ...partial })) {
      return;
    }
    this.state = { ...this.state, ...partial };
    console.log('[CallManager] State updated:', {
      from: prevState.status,
      to: this.state.status,
      participant: this.state.participant?.name
    });
    this.notifyListeners('statusChange', this.state);
  }

  private async handleDisconnection(): Promise<void> {
    if (this.state.reconnectionAttempts >= this.MAX_RECONNECTION_ATTEMPTS) {
      this.handleFailure('Maximum reconnection attempts reached');
      return;
    }

    this.updateState({
      status: 'reconnecting',
      reconnectionAttempts: this.state.reconnectionAttempts + 1
    });

    try {
      await this.attemptReconnection();
    } catch {
      this.handleFailure('Reconnection failed');
    }
  }

  private async attemptReconnection(): Promise<void> {
    if (!this.state.participant) return;
    
    try {
      await webRTCService.startCall(this.state.participant.id);
    } catch {
      throw new Error('Failed to reconnect');
    }
  }

  private handleFailure(error: string): void {
    this.updateState({
      status: 'failed',
      error
    });
    this.cleanup();
  }

  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      const stats = await webRTCService.getConnectionStats();
      if (stats) {
        const metrics: CallMetrics = {
          packetsLost: stats.packetsLost || 0,
          jitter: stats.jitter || 0,
          roundTripTime: stats.roundTripTime || 0,
          audioLevel: stats.audioLevel || 0
        };
        this.notifyListeners('metricsUpdate', metrics);
      }
    }, this.METRICS_INTERVAL);
  }

  private cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private notifyListeners<T extends CallEventType>(event: T, data: CallEventData[T]): void {
    if (this.isHandlingEvent) return;
    
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        (callback as CallEventCallback<T>)(event, data);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }
} 