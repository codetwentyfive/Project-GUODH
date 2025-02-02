import express from 'express';
import { startCall, endCall, getCallLogs } from '../controllers/callController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Protected routes (require authentication)
router.post('/patients/:patientId/calls', auth, startCall);
router.post('/calls/:callLogId/end', auth, endCall);
router.get('/patients/:patientId/calls', auth, getCallLogs);

export default router; 