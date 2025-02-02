import express from 'express';
import {
  createPatient,
  getPatients,
  getPatient,
  updatePatient,
  deletePatient,
  login,
  getProfile
} from '../controllers/patientController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes (require authentication)
router.get('/profile', auth, getProfile);

// Caretaker routes (require authentication)
router.post('/', auth, createPatient);
router.get('/', auth, getPatients);
router.get('/:id', auth, getPatient);
router.put('/:id', auth, updatePatient);
router.delete('/:id', auth, deletePatient);

export default router; 