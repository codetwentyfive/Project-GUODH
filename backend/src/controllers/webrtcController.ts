import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

export const initiateWebRTCCall = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const caretakerId = req.user?.id;

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
  } catch (error) {
    console.error('Error initiating WebRTC call:', error);
    res.status(500).json({ error: 'Error initiating WebRTC call' });
  }
};

export const endWebRTCCall = async (req: Request, res: Response) => {
  try {
    const { callLogId } = req.params;

    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        endTime: new Date()
      }
    });

    res.json({ message: 'Call ended successfully' });
  } catch (error) {
    console.error('Error ending WebRTC call:', error);
    res.status(500).json({ error: 'Error ending call' });
  }
}; 