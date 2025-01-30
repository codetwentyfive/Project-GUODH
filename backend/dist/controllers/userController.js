"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const password_1 = require("../utils/password");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const register = async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        // Hash password and create user
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phone
            }
        });
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id }, JWT_SECRET);
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone
            },
            token
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Verify password
        const isPasswordValid = await (0, password_1.comparePassword)(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id }, JWT_SECRET);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone
            },
            token
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
};
exports.login = login;
