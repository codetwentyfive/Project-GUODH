import React from 'react';
import { CallContextType } from '../types/call.types';
declare const CallContext: React.Context<CallContextType | null>;
export declare const useCallContext: () => CallContextType;
interface CallProviderProps {
    children: React.ReactNode;
    onStartCall?: (targetId: string) => Promise<void>;
    onEndCall?: () => void;
}
export declare const CallProvider: React.FC<CallProviderProps>;
export default CallContext;
