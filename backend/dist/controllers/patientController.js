"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePatient = exports.updatePatient = exports.getPatient = exports.getPatients = exports.createPatient = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createPatient = async (req, res) => {
    var _a;
    try {
        const { name, phoneNumber, recordCalls = false } = req.body;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
    }
    catch (error) {
        res.status(500).json({ error: 'Error creating patient' });
    }
};
exports.createPatient = createPatient;
const getPatients = async (req, res) => {
    var _a;
    try {
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
    }
    catch (error) {
        res.status(500).json({ error: 'Error fetching patients' });
    }
};
exports.getPatients = getPatients;
const getPatient = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
    }
    catch (error) {
        res.status(500).json({ error: 'Error fetching patient' });
    }
};
exports.getPatient = getPatient;
const updatePatient = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const { name, phoneNumber, recordCalls } = req.body;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating patient' });
    }
};
exports.updatePatient = updatePatient;
const deletePatient = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
    }
    catch (error) {
        res.status(500).json({ error: 'Error deleting patient' });
    }
};
exports.deletePatient = deletePatient;
