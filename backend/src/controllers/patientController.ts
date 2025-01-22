import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

export const createPatient = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phoneNumber, recordCalls = false } = req.body;
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        phoneNumber,
        recordCalls,
        caretakerId
      }
    });

    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Error creating patient' });
  }
};

export const getPatients = async (req: AuthRequest, res: Response) => {
  try {
    const caretakerId = req.user?.id;

    if (!caretakerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const patients = await prisma.patient.findMany({
      where: { caretakerId },
      include: {
        keywords: true,
        callLogs: {
          orderBy: { startTime: 'desc' },
          take: 5
        }
      }
    });

    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching patients' });
  }
};

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
        keywords: true,
        callLogs: {
          orderBy: { startTime: 'desc' },
          take: 5
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching patient' });
  }
};

export const updatePatient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, recordCalls } = req.body;
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
        phoneNumber,
        recordCalls
      }
    });

    res.json(updatedPatient);
  } catch (error) {
    res.status(500).json({ error: 'Error updating patient' });
  }
};

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
    res.status(500).json({ error: 'Error deleting patient' });
  }
}; 