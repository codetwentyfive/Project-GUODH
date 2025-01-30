"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endWebRTCCall = exports.initiateWebRTCCall = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const initiateWebRTCCall = async (req, res) => {
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
            }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        // Create a unique room ID for this call
        const roomId = `${patientId}-${Date.now()}`;
        // Create call log entry
        const callLog = await prisma.callLog.create({
            data: {
                patientId,
                startTime: new Date(),
                isWebRTC: true
            }
        });
        res.json({
            message: 'WebRTC call initiated',
            roomId,
            callLogId: callLog.id
        });
    }
    catch (error) {
        console.error('Error initiating WebRTC call:', error);
        res.status(500).json({ error: 'Error initiating WebRTC call' });
    }
};
exports.initiateWebRTCCall = initiateWebRTCCall;
const endWebRTCCall = async (req, res) => {
    try {
        const { callLogId } = req.params;
        await prisma.callLog.update({
            where: { id: callLogId },
            data: {
                endTime: new Date()
            }
        });
        res.json({ message: 'Call ended successfully' });
    }
    catch (error) {
        console.error('Error ending WebRTC call:', error);
        res.status(500).json({ error: 'Error ending call' });
    }
};
exports.endWebRTCCall = endWebRTCCall;
