var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback } from 'react';
const initialCallState = {
    isInCall: false,
    isMuted: false,
    isVideoEnabled: true,
    remoteStream: null,
    localStream: null,
};
const CallContext = createContext(null);
export const useCallContext = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCallContext must be used within a CallProvider');
    }
    return context;
};
export const CallProvider = ({ children, onStartCall, onEndCall, }) => {
    const [callState, setCallState] = useState(initialCallState);
    const startCall = useCallback((targetId) => __awaiter(void 0, void 0, void 0, function* () {
        if (onStartCall) {
            yield onStartCall(targetId);
        }
        setCallState(prev => (Object.assign(Object.assign({}, prev), { isInCall: true })));
    }), [onStartCall]);
    const endCall = useCallback(() => {
        if (onEndCall) {
            onEndCall();
        }
        setCallState(initialCallState);
    }, [onEndCall]);
    const toggleMute = useCallback(() => {
        setCallState(prev => (Object.assign(Object.assign({}, prev), { isMuted: !prev.isMuted })));
    }, []);
    const toggleVideo = useCallback(() => {
        setCallState(prev => (Object.assign(Object.assign({}, prev), { isVideoEnabled: !prev.isVideoEnabled })));
    }, []);
    const value = Object.assign(Object.assign({}, callState), { startCall,
        endCall,
        toggleMute,
        toggleVideo });
    return _jsx(CallContext.Provider, { value: value, children: children });
};
export default CallContext;
