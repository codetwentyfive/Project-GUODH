import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Configure email transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

export async function initiateCall(req: AuthRequest, res: Response) {
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
      roomId: callLog.id,
      callLogId: callLog.id,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ error: 'Error initiating call' });
  }
}

export async function handleTranscription(req: Request, res: Response) {
  try {
    const { callLogId, transcription } = req.body;

    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      include: {
        patient: {
          include: {
            keywords: true,
            caretaker: true
          }
        }
      }
    });

    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    // Update call log with transcription
    await prisma.callLog.update({
      where: { id: callLogId },
      data: { 
        transcribedText: transcription
      }
    });

    // Check for keywords
    const detectedKeywords = callLog.patient.keywords.filter(keyword => 
      transcription.toLowerCase().includes(keyword.text.toLowerCase())
    );

    if (detectedKeywords.length > 0) {
      // Send email notification
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: callLog.patient.caretaker.email,
        subject: 'Alert: Keywords Detected in Patient Call',
        html: `
          <h2>Keywords Detected</h2>
          <p>Patient: ${callLog.patient.name}</p>
          <p>Detected Keywords: ${detectedKeywords.map(k => k.text).join(', ')}</p>
          <p>Transcription: ${transcription}</p>
        `
      });

      // Update call log to mark notification sent
      await prisma.callLog.update({
        where: { id: callLogId },
        data: { notificationSent: true }
      });
    }

    res.json({ 
      message: 'Transcription processed',
      detectedKeywords: detectedKeywords.map(k => k.text)
    });
  } catch (error) {
    console.error('Error handling transcription:', error);
    res.status(500).json({ error: 'Error processing transcription' });
  }
}

export async function endCall(req: Request, res: Response) {
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
    console.error('Error ending call:', error);
    res.status(500).json({ error: 'Error ending call' });
  }
} 