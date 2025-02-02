import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

// Create a new patient
export const createPatient = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phoneNumber } = req.body;
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        phoneNumber,
        caretakerId
      },
      include: {
        caretaker: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

// Get all patients for a caretaker
export const getPatients = async (req: AuthRequest, res: Response) => {
  try {
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patients = await prisma.patient.findMany({
      where: {
        caretakerId
      },
      include: {
        callLogs: {
          orderBy: {
            startTime: 'desc'
          },
          take: 5
        }
      }
    });

    res.json(patients);
  } catch (error) {
    console.error('Error getting patients:', error);
    res.status(500).json({ error: 'Failed to get patients' });
  }
};

// Get a single patient
export const getPatient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        caretakerId
      },
      include: {
        callLogs: {
          orderBy: {
            startTime: 'desc'
          },
          take: 5
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    console.error('Error getting patient:', error);
    res.status(500).json({ error: 'Failed to get patient' });
  }
};

// Update a patient
export const updatePatient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber } = req.body;
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        caretakerId
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        name,
        phoneNumber
      },
      include: {
        caretaker: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(updatedPatient);
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

// Delete a patient
export const deletePatient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        caretakerId
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await prisma.patient.delete({
      where: { id }
    });

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
};

// Login patient with phone number
export const login = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Find patient by phone number
    const patient = await prisma.patient.findFirst({
      where: { phoneNumber },
      include: {
        caretaker: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!patient) {
      return res.status(401).json({ error: 'Invalid phone number' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: patient.id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      patient: {
        id: patient.id,
        name: patient.name,
        phoneNumber: patient.phoneNumber,
        caretaker: patient.caretaker
      }
    });
  } catch (error) {
    console.error('Error logging in patient:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
};

// Get patient profile
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.id;

    if (!patientId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        caretaker: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        callLogs: {
          orderBy: {
            startTime: 'desc'
          },
          take: 5
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    console.error('Error getting patient profile:', error);
    res.status(500).json({ error: 'Failed to get patient profile' });
  }
}; 