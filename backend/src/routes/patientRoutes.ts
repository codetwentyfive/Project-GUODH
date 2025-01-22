import express from 'express';
import { createPatient, getPatients, getPatient, updatePatient, deletePatient } from '../controllers/patientController';
import { auth } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(auth);

router.post('/', createPatient);
router.get('/', getPatients);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

export default router; 