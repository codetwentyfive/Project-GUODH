"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteKeyword = exports.getKeywords = exports.addKeyword = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const addKeyword = async (req, res) => {
    var _a;
    try {
        const { patientId } = req.params;
        const { word } = req.body;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!caretakerId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Verify patient belongs to caretaker
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                caretakerId
            }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        const keyword = await prisma.keyword.create({
            data: {
                text: word,
                patientId
            }
        });
        res.status(201).json(keyword);
    }
    catch (error) {
        res.status(500).json({ error: 'Error adding keyword' });
    }
};
exports.addKeyword = addKeyword;
const getKeywords = async (req, res) => {
    var _a;
    try {
        const { patientId } = req.params;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!caretakerId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Verify patient belongs to caretaker
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                caretakerId
            }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        const keywords = await prisma.keyword.findMany({
            where: {
                patientId
            }
        });
        res.json(keywords);
    }
    catch (error) {
        res.status(500).json({ error: 'Error fetching keywords' });
    }
};
exports.getKeywords = getKeywords;
const deleteKeyword = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const caretakerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!caretakerId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Verify keyword belongs to patient of caretaker
        const keyword = await prisma.keyword.findFirst({
            where: {
                id,
                patient: {
                    caretakerId
                }
            }
        });
        if (!keyword) {
            return res.status(404).json({ error: 'Keyword not found' });
        }
        await prisma.keyword.delete({
            where: { id }
        });
        res.json({ message: 'Keyword deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error deleting keyword' });
    }
};
exports.deleteKeyword = deleteKeyword;
