import express from 'express';
import { initiateWebRTCCall, endWebRTCCall } from '../controllers/webrtcController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Protected routes (require authentication)
router.post('/patients/:patientId/webrtc-call', auth, initiateWebRTCCall);
router.post('/webrtc-calls/:callLogId/end', auth, endWebRTCCall);

export default router; 