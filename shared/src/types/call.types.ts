export interface CallState {
  isInCall: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
}

export interface CallContextType extends CallState {
  startCall: (targetId: string) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  from: string;
  to: string;
} 