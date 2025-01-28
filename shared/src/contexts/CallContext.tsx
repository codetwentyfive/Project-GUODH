import React, { createContext, useContext, useState, useCallback } from 'react';
import { CallContextType, CallState } from '../types/call.types';

const initialCallState: CallState = {
  isInCall: false,
  isMuted: false,
  isVideoEnabled: true,
  remoteStream: null,
  localStream: null,
};

const CallContext = createContext<CallContextType | null>(null);

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};

interface CallProviderProps {
  children: React.ReactNode;
  onStartCall?: (targetId: string) => Promise<void>;
  onEndCall?: () => void;
}

export const CallProvider: React.FC<CallProviderProps> = ({
  children,
  onStartCall,
  onEndCall,
}) => {
  const [callState, setCallState] = useState<CallState>(initialCallState);

  const startCall = useCallback(async (targetId: string) => {
    if (onStartCall) {
      await onStartCall(targetId);
    }
    setCallState(prev => ({ ...prev, isInCall: true }));
  }, [onStartCall]);

  const endCall = useCallback(() => {
    if (onEndCall) {
      onEndCall();
    }
    setCallState(initialCallState);
  }, [onEndCall]);

  const toggleMute = useCallback(() => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const toggleVideo = useCallback(() => {
    setCallState(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
  }, []);

  const value = {
    ...callState,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export default CallContext; 