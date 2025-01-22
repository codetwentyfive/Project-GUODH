import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';

const prisma = new PrismaClient();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Create call log entry
    const callLog = await prisma.callLog.create({
      data: {
        patientId,
        startTime: new Date()
      }
    });

    // Initiate call with Twilio
    const call = await client.calls.create({
      url: `${process.env.WEBHOOK_BASE_URL}/api/calls/twiml/${callLog.id}`,
      to: patient.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER!,
      record: patient.recordCalls,
      statusCallback: `${process.env.WEBHOOK_BASE_URL}/api/calls/status/${callLog.id}`,
      statusCallbackEvent: ['completed']
    });

    res.json({
      message: 'Call initiated',
      callSid: call.sid,
      callLogId: callLog.id
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ error: 'Error initiating call' });
  }
};

export const handleTwiML = async (req: Request, res: Response) => {
  const { callLogId } = req.params;
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    // Add basic voice message
    twiml.say(
      { voice: 'alice' },
      'Hello, this is CareCall checking in. How are you doing today?'
    );

    // Start recording if enabled for this patient
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      include: { patient: true }
    });

    if (callLog?.patient.recordCalls) {
      twiml.record({
        action: `${process.env.WEBHOOK_BASE_URL}/api/calls/recording/${callLogId}`,
        transcribe: true,
        transcribeCallback: `${process.env.WEBHOOK_BASE_URL}/api/calls/transcription/${callLogId}`
      });
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error generating TwiML:', error);
    res.status(500).json({ error: 'Error generating call instructions' });
  }
};

export const handleCallStatus = async (req: Request, res: Response) => {
  const { callLogId } = req.params;
  const { CallDuration, CallStatus } = req.body;

  try {
    if (CallStatus === 'completed') {
      await prisma.callLog.update({
        where: { id: callLogId },
        data: {
          endTime: new Date(),
          duration: parseInt(CallDuration) || 0
        }
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).json({ error: 'Error updating call status' });
  }
};

export const handleTranscription = async (req: Request, res: Response) => {
  const { callLogId } = req.params;
  const { TranscriptionText } = req.body;

  try {
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

    // Simple keyword detection
    const detectedKeywords = callLog.patient.keywords
      .filter(keyword => 
        TranscriptionText.toLowerCase().includes(keyword.word.toLowerCase())
      )
      .map(keyword => keyword.word);

    // Update call log with transcription and detected keywords
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        transcription: TranscriptionText,
        detectedKeywords
      }
    });

    // If keywords detected, notify caretaker
    if (detectedKeywords.length > 0) {
      // Send SMS notification using Twilio
      await client.messages.create({
        body: `Alert: Keywords detected in patient call: ${detectedKeywords.join(', ')}`,
        to: callLog.patient.caretaker.phone,
        from: process.env.TWILIO_PHONE_NUMBER!
      });

      await prisma.callLog.update({
        where: { id: callLogId },
        data: {
          notificationSent: true
        }
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling transcription:', error);
    res.status(500).json({ error: 'Error handling transcription' });
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