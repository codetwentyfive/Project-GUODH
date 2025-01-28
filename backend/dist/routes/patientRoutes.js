"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const patientController_1 = require("../controllers/patientController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.auth);
router.post('/', patientController_1.createPatient);
router.get('/', patientController_1.getPatients);
router.get('/:id', patientController_1.getPatient);
router.put('/:id', patientController_1.updatePatient);
router.delete('/:id', patientController_1.deletePatient);
exports.default = router;
