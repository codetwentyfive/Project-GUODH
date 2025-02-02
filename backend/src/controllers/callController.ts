import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

// Start a WebRTC call
export const startCall = async (req: AuthRequest, res: Response) => {
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

    // Create call log entry
    const callLog = await prisma.callLog.create({
      data: {
        patientId,
        startTime: new Date(),
        status: 'INITIATED',
        isWebRTC: true
      }
    });

    res.json({
      message: 'Call initiated',
      callLogId: callLog.id
    });
  } catch (error) {
    console.error('Error starting call:', error);
    res.status(500).json({ error: 'Failed to start call' });
  }
};

// End a WebRTC call
export const endCall = async (req: AuthRequest, res: Response) => {
  try {
    const { callLogId } = req.params;
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const callLog = await prisma.callLog.findFirst({
      where: {
        id: callLogId,
        patient: {
          caretakerId
        }
      }
    });

    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    const updatedCallLog = await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        endTime: new Date(),
        status: 'COMPLETED'
      }
    });

    res.json(updatedCallLog);
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
};

// Get call logs for a patient
export const getCallLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const callLogs = await prisma.callLog.findMany({
      where: {
        patientId,
        patient: {
          caretakerId
        }
      },
      orderBy: {
        startTime: 'desc'
      },
      include: {
        patient: true
      }
    });

    res.json(callLogs);
  } catch (error) {
    console.error('Error getting call logs:', error);
    res.status(500).json({ error: 'Failed to get call logs' });
  }
}; 