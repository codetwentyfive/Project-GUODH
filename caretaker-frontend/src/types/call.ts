export type CallStatus = 'idle' | 'calling' | 'connected' | 'reconnecting' | 'failed';

export type CallEventType = 'statusChange' | 'metricsUpdate';

export interface CallEventData {
  statusChange: CallState;
  metricsUpdate: CallMetrics;
}

export type CallEventCallback<T extends CallEventType = CallEventType> = 
  (event: T, data: CallEventData[T]) => void;

export interface CallParticipant {
  id: string;
  name: string;
  type: 'patient' | 'caretaker';
}

export interface CallState {
  status: CallStatus;
  participant?: CallParticipant;
  startTime?: Date;
  error?: string;
  reconnectionAttempts: number;
}

export interface CallMetrics {
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
  audioLevel: number;
} 