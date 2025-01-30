"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateCall = initiateCall;
exports.endCall = endCall;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function initiateCall(req, res) {
    var _a;
    try {
        const { patientId } = req.params;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!caretakerId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Verify patient belongs to caretaker
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                caretakerId
            },
            include: {
                caretaker: true
            }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        // Create call log entry
        const callLog = await prisma.callLog.create({
            data: {
                patientId,
                startTime: new Date(),
                isWebRTC: true
            }
        });
        res.json({
            message: 'Call initiated',
            callLogId: callLog.id,
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
    }
    catch (error) {
        console.error('Error initiating call:', error);
        res.status(500).json({ error: 'Error initiating call' });
    }
}
async function endCall(req, res) {
    try {
        const { callLogId } = req.params;
        const callLog = await prisma.callLog.findUnique({
            where: { id: callLogId }
        });
        if (!callLog) {
            return res.status(404).json({ error: 'Call log not found' });
        }
        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - callLog.startTime.getTime()) / 1000); // Duration in seconds
        await prisma.callLog.update({
            where: { id: callLogId },
            data: {
                endTime,
                duration
            }
        });
        res.json({ message: 'Call ended successfully' });
    }
    catch (error) {
        console.error('Error ending call:', error);
        res.status(500).json({ error: 'Error ending call' });
    }
}
