'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CallManager } from '@/services/callManager';
import { CallState, CallMetrics, CallEventCallback } from '@/types/call';
import { socketService } from '@/services/socket';

interface CallContextType {
  state: CallState;
  metrics: CallMetrics | null;
  startCall: (patientId: string, patientName: string) => Promise<void>;
  endCall: () => Promise<void>;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callManager] = useState(() => new CallManager());
  const [state, setState] = useState<CallState>(() => callManager.getCurrentState());
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Initialize socket connection and register as caretaker
    const initializeSocket = async () => {
      try {
        await socketService.connect();
        await socketService.register('caretaker-1');
        if (mounted) {
          console.log('[CallContext] Socket connected and registered');
          setIsRegistered(true);
        }
      } catch (error) {
        console.error('[CallContext] Socket connection failed:', error);
        if (mounted) {
          setIsRegistered(false);
        }
      }
    };

    initializeSocket();

    // Handle socket events
    socketService.on('registration-success', () => {
      if (mounted) setIsRegistered(true);
    });

    socketService.on('registration-error', () => {
      if (mounted) setIsRegistered(false);
    });

    const handleStateChange: CallEventCallback<'statusChange'> = (_, newState) => {
      if (mounted) {
        console.log('[CallContext] State changed:', newState);
        setState(newState);
      }
    };

    const handleMetricsUpdate: CallEventCallback<'metricsUpdate'> = (_, newMetrics) => {
      if (mounted) {
        setMetrics(newMetrics);
      }
    };

    callManager.addEventListener('statusChange', handleStateChange);
    callManager.addEventListener('metricsUpdate', handleMetricsUpdate);

    return () => {
      mounted = false;
      callManager.removeEventListener('statusChange', handleStateChange);
      callManager.removeEventListener('metricsUpdate', handleMetricsUpdate);
      socketService.disconnect();
    };
  }, [callManager]);

  const startCall = async (patientId: string, patientName: string) => {
    if (!isRegistered) {
      throw new Error('Cannot start call: not registered with signaling server');
    }

    try {
      console.log('[CallContext] Starting call to patient:', patientId);
      await callManager.startCall({
        id: patientId,
        name: patientName,
        type: 'patient'
      });
    } catch (error) {
      console.error('[CallContext] Failed to start call:', error);
      throw error;
    }
  };

  const endCall = async () => {
    try {
      console.log('[CallContext] Ending current call');
      await callManager.endCall();
    } catch (error) {
      console.error('[CallContext] Failed to end call:', error);
      throw error;
    }
  };

  return (
    <CallContext.Provider value={{ state, metrics, startCall, endCall }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
} 