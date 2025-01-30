import { PrismaClient, CallStatus } from '@prisma/client';
import { EventEmitter } from 'events';
import { webRTCConfig } from '../config/webrtc.config';

const prisma = new PrismaClient();

interface CallParticipant {
  id: string;
  socketId: string;
  type: 'caretaker' | 'patient';
}

interface CallSession {
  id: string;
  caretaker: CallParticipant;
  patient: CallParticipant;
  startTime: Date;
  status: CallStatus;
  retryCount: number;
  timeouts: {
    request?: NodeJS.Timeout;
    connection?: NodeJS.Timeout;
    ice?: NodeJS.Timeout;
  };
}

class CallSessionManager extends EventEmitter {
  private sessions: Map<string, CallSession> = new Map();
  
  async createSession(caretaker: CallParticipant, patient: CallParticipant): Promise<CallSession> {
    try {
      // Create call log entry
      const callLog = await prisma.callLog.create({
        data: {
          patientId: patient.id,
          startTime: new Date(),
          status: CallStatus.INITIATED,
          isWebRTC: true,
          retryCount: 0
        }
      });

      const session: CallSession = {
        id: callLog.id,
        caretaker,
        patient,
        startTime: callLog.startTime,
        status: callLog.status,
        retryCount: 0,
        timeouts: {}
      };

      this.sessions.set(session.id, session);
      this.setupTimeouts(session);

      return session;
    } catch (error) {
      console.error('Error creating call session:', error);
      throw new Error('Failed to create call session');
    }
  }

  private setupTimeouts(session: CallSession) {
    // Call request timeout
    session.timeouts.request = setTimeout(async () => {
      if (session.status === CallStatus.INITIATED) {
        await this.handleTimeout(session.id, 'request');
      }
    }, webRTCConfig.timeouts.callRequest);

    // Connection attempt timeout
    session.timeouts.connection = setTimeout(async () => {
      if (session.status === CallStatus.CONNECTING) {
        await this.handleTimeout(session.id, 'connection');
      }
    }, webRTCConfig.timeouts.connectionAttempt);
  }

  async updateSessionStatus(sessionId: string, status: CallStatus, failureReason?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;
    
    await prisma.callLog.update({
      where: { id: sessionId },
      data: { 
        status,
        failureReason,
        updatedAt: new Date()
      }
    });

    this.emit('statusChange', { sessionId, status, failureReason });
  }

  async handleTimeout(sessionId: string, type: 'request' | 'connection' | 'ice') {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await this.updateSessionStatus(
      sessionId, 
      CallStatus.TIMEOUT,
      `Call ${type} timeout`
    );

    this.cleanupSession(sessionId);
  }

  async endSession(sessionId: string, reason?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    await prisma.callLog.update({
      where: { id: sessionId },
      data: {
        endTime,
        duration,
        status: CallStatus.ENDED,
        failureReason: reason,
      }
    });

    this.cleanupSession(sessionId);
  }

  private cleanupSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear all timeouts
    Object.values(session.timeouts).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });

    this.sessions.delete(sessionId);
    this.emit('sessionEnded', { sessionId });
  }

  getSession(sessionId: string): CallSession | undefined {
    return this.sessions.get(sessionId);
  }

  isUserInCall(userId: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.caretaker.id === userId || session.patient.id === userId) {
        return true;
      }
    }
    return false;
  }
}

export const callSessionManager = new CallSessionManager(); 