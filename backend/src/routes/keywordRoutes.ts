import express from 'express';
import { addKeyword, getKeywords, deleteKeyword } from '../controllers/keywordController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Protected routes (require authentication)
router.post('/patients/:patientId/keywords', auth, addKeyword);
router.get('/patients/:patientId/keywords', auth, getKeywords);
router.delete('/keywords/:id', auth, deleteKeyword);

export default router; 