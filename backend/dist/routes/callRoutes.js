"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const callController_1 = require("../controllers/callController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Protected routes (require authentication)
router.post('/patients/:patientId/call', auth_1.auth, callController_1.initiateCall);
router.post('/calls/:callLogId/transcription', callController_1.handleTranscription);
router.post('/calls/:callLogId/end', callController_1.endCall);
exports.default = router;
