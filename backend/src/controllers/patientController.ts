import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';

// Create a new patient
export const createPatient = async (req: Request, res: Response) => {
  try {
    const { name, phoneNumber, caretakerId, recordCalls } = req.body;

    if (!name || !phoneNumber || !caretakerId) {
      return res.status(400).json({ error: 'Name, phone number, and caretaker ID are required' });
    }

    const caretaker = await prisma.user.findUnique({
      where: { id: caretakerId }
    });

    if (!caretaker) {
      return res.status(404).json({ error: 'Caretaker not found' });
    }

    const newPatient = await prisma.patient.create({
      data: {
        name,
        phoneNumber,
        caretakerId,
        recordCalls: recordCalls || false
      },
      include: {
        caretaker: true
      }
    });

    res.status(201).json(newPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

// Get all patients for a caretaker
export const getPatients = async (req: Request, res: Response) => {
  try {
    const { caretakerId } = req.params;

    const patients = await prisma.patient.findMany({
      where: { caretakerId },
      include: {
        caretaker: true,
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

// Get a single patient by ID
export const getPatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        caretaker: true,
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
export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, recordCalls } = req.body;

    const patient = await prisma.patient.findUnique({
      where: { id }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        name,
        phoneNumber,
        recordCalls
      },
      include: {
        caretaker: true
      }
    });

    res.json(updatedPatient);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Phone number already in use' });
      }
    }
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

// Delete a patient
export const deletePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await prisma.patient.delete({
      where: { id }
    });

    res.sendStatus(204);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Cannot delete patient with existing call logs' });
      }
    }
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
}; 