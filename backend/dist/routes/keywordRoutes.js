"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const keywordController_1 = require("../controllers/keywordController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Protected routes (require authentication)
router.post('/patients/:patientId/keywords', auth_1.auth, keywordController_1.addKeyword);
router.get('/patients/:patientId/keywords', auth_1.auth, keywordController_1.getKeywords);
router.delete('/keywords/:id', auth_1.auth, keywordController_1.deleteKeyword);
exports.default = router;
