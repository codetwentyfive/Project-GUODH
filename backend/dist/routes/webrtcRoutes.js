"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webrtcController_1 = require("../controllers/webrtcController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Protected routes (require authentication)
router.post('/patients/:patientId/webrtc-call', auth_1.auth, webrtcController_1.initiateWebRTCCall);
router.post('/webrtc-calls/:callLogId/end', auth_1.auth, webrtcController_1.endWebRTCCall);
exports.default = router;
