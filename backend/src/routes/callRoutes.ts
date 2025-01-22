import express from 'express';
import { initiateCall, handleTwiML, handleCallStatus, handleTranscription, testTwilioConnection } from '../controllers/callController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Public routes (no authentication required)
router.post('/calls/test', testTwilioConnection);
router.post('/calls/twiml/:callLogId', handleTwiML);
router.post('/calls/status/:callLogId', handleCallStatus);
router.post('/calls/transcription/:callLogId', handleTranscription);

// Protected routes (require authentication)
router.post('/patients/:patientId/call', auth, initiateCall);

export default router; 