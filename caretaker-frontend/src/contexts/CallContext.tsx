'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { socketService, type CallbackData } from '@/services/socket';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface CallContextType {
  connect: (userId: string) => Promise<void>;
  connectionStatus: ConnectionStatus;
  currentCall: {
    peerId: string;
    isIncoming: boolean;
  } | null;
  initiateCall: (targetId: string) => Promise<string>;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentCall, setCurrentCall] = useState<{ peerId: string; isIncoming: boolean } | null>(null);

  const setupSocketListeners = useCallback(() => {
    const handleIncomingCall = (data: CallbackData) => {
      if (data.from) {
        setCurrentCall({ peerId: data.from, isIncoming: true });
      }
    };

    const handleCallEnded = () => {
      setCurrentCall(null);
    };

    const handleCallRejected = () => {
      setCurrentCall(null);
    };

    socketService.on('incoming-call-request', handleIncomingCall);
    socketService.on('call-ended', handleCallEnded);
    socketService.on('call-rejected', handleCallRejected);

    return () => {
      socketService.off('incoming-call-request', handleIncomingCall);
      socketService.off('call-ended', handleCallEnded);
      socketService.off('call-rejected', handleCallRejected);
    };
  }, []);

  const connect = useCallback(async (userId: string) => {
    try {
      setConnectionStatus('connecting');
      await socketService.connect();
      await socketService.register(userId);
      setConnectionStatus('connected');
      setupSocketListeners();
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      throw error;
    }
  }, [setupSocketListeners]);

  const initiateCall = useCallback(async (targetId: string) => {
    try {
      const sessionId = await socketService.initiateCall(targetId);
      setCurrentCall({ peerId: targetId, isIncoming: false });
      return sessionId;
    } catch (error) {
      console.error('Failed to start call:', error);
      throw error;
    }
  }, []);

  const endCall = useCallback(() => {
    if (currentCall) {
      socketService.sendCallEnd(currentCall.peerId);
      setCurrentCall(null);
    }
  }, [currentCall]);

  // Set up initial socket listeners
  useEffect(() => {
    const cleanup = setupSocketListeners();
    return () => {
      cleanup();
      socketService.disconnect();
    };
  }, [setupSocketListeners]);

  const value = {
    connect,
    connectionStatus,
    currentCall,
    initiateCall,
    endCall,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
} 