"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callSessionManager = void 0;
const client_1 = require("@prisma/client");
const events_1 = require("events");
const webrtc_config_1 = require("../config/webrtc.config");
const prisma = new client_1.PrismaClient();
class CallSessionManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.sessions = new Map();
    }
    async createSession(caretaker, patient) {
        try {
            // Create call log entry
            const callLog = await prisma.callLog.create({
                data: {
                    patientId: patient.id,
                    startTime: new Date(),
                    status: client_1.CallStatus.INITIATED,
                    isWebRTC: true,
                    retryCount: 0
                }
            });
            const session = {
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
        }
        catch (error) {
            console.error('Error creating call session:', error);
            throw new Error('Failed to create call session');
        }
    }
    setupTimeouts(session) {
        // Call request timeout
        session.timeouts.request = setTimeout(async () => {
            if (session.status === client_1.CallStatus.INITIATED) {
                await this.handleTimeout(session.id, 'request');
            }
        }, webrtc_config_1.webRTCConfig.timeouts.callRequest);
        // Connection attempt timeout
        session.timeouts.connection = setTimeout(async () => {
            if (session.status === client_1.CallStatus.CONNECTING) {
                await this.handleTimeout(session.id, 'connection');
            }
        }, webrtc_config_1.webRTCConfig.timeouts.connectionAttempt);
    }
    async updateSessionStatus(sessionId, status, failureReason) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
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
    async handleTimeout(sessionId, type) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        await this.updateSessionStatus(sessionId, client_1.CallStatus.TIMEOUT, `Call ${type} timeout`);
        this.cleanupSession(sessionId);
    }
    async endSession(sessionId, reason) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
        await prisma.callLog.update({
            where: { id: sessionId },
            data: {
                endTime,
                duration,
                status: client_1.CallStatus.ENDED,
                failureReason: reason,
            }
        });
        this.cleanupSession(sessionId);
    }
    cleanupSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        // Clear all timeouts
        Object.values(session.timeouts).forEach(timeout => {
            if (timeout)
                clearTimeout(timeout);
        });
        this.sessions.delete(sessionId);
        this.emit('sessionEnded', { sessionId });
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    isUserInCall(userId) {
        for (const session of this.sessions.values()) {
            if (session.caretaker.id === userId || session.patient.id === userId) {
                return true;
            }
        }
        return false;
    }
}
exports.callSessionManager = new CallSessionManager();
