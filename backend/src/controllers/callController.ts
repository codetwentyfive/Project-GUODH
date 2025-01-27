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

export const initiateCall = async (req: AuthRequest, res: Response) => {
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

    // Create a unique room ID for this call
    const roomId = `${patientId}-${Date.now()}`;

    // Create call log entry
    const callLog = await prisma.callLog.create({
      data: {
        patientId,
        startTime: new Date(),
        isWebRTC: true,
        roomId
      }
    });

    res.json({
      message: 'Call initiated',
      roomId,
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
};

export const handleTranscription = async (req: Request, res: Response) => {
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
      data: { transcribedText: transcription }
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
};

export const endCall = async (req: Request, res: Response) => {
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
};

// Test function to verify Twilio connectivity
export const testTwilioConnection = async (req: Request, res: Response) => {
  try {
    // Use Twilio test credentials and numbers
    const fromNumber = process.env.TWILIO_PHONE_NUMBER; // Should be +15005550006
    const toNumber = process.env.TEST_TO_NUMBER;       // Should be +15005550009

    if (!fromNumber || !toNumber) {
      return res.status(400).json({
        error: 'Missing test phone numbers',
        suggestion: 'Check your .env file for TWILIO_PHONE_NUMBER and TEST_TO_NUMBER'
      });
    }

    console.log(`Making test call from ${fromNumber} to ${toNumber}`);

    // Create test call with minimal parameters
    const call = await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml', // Twilio's test TwiML
      to: toNumber,
      from: fromNumber
    });

    res.json({
      message: 'Test call initiated successfully',
      callSid: call.sid,
      note: 'This is a test call using Twilio test credentials'
    });
  } catch (error: any) {
    console.error('Twilio test failed:', error);
    res.status(500).json({
      error: 'Twilio test failed',
      details: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      suggestion: 'Make sure you are using valid Twilio test phone numbers (+1500555XXXX)'
    });
  }
}; 