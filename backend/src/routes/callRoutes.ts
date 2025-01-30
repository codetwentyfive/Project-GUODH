import express from 'express';
import { initiateCall, endCall } from '../controllers/callController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Protected routes (require authentication)
router.post('/patients/:patientId/call', auth, initiateCall);
router.post('/calls/:callLogId/end', auth, endCall);

export default router; 