interface MediaConstraints {
  audio: boolean;
  video?: boolean;
}

interface MediaState {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
}

class MediaManager {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaState: MediaState = {
    isAudioEnabled: false,
    isVideoEnabled: false
  };

  async initialize(constraints: MediaConstraints): Promise<void> {
    try {
      if (this.localStream) {
        console.log('[MediaManager] Stream already exists, cleaning up first');
        this.cleanup();
      }

      console.log('[MediaManager] Initializing with constraints:', constraints);
      const mediaConstraints = {
        audio: constraints.audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
        video: constraints.video || false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

      this.mediaState = {
        isAudioEnabled: constraints.audio,
        isVideoEnabled: !!constraints.video
      };

      // Set up audio context for level monitoring
      if (constraints.audio) {
        this.setupAudioContext();
      }

      console.log('[MediaManager] Media initialized successfully');
    } catch (error) {
      console.error('[MediaManager] Error initializing media:', error);
      throw error;
    }
  }

  private setupAudioContext(): void {
    if (!this.localStream) return;

    try {
      this.audioContext = new AudioContext();
      this.mediaSource = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.mediaSource.connect(this.analyser);
    } catch (error) {
      console.error('[MediaManager] Error setting up audio context:', error);
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async toggleAudio(): Promise<boolean> {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.mediaState.isAudioEnabled = audioTrack.enabled;
      console.log('[MediaManager] Audio toggled:', audioTrack.enabled);
      return audioTrack.enabled;
    }
    return false;
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.mediaState.isVideoEnabled = videoTrack.enabled;
      console.log('[MediaManager] Video toggled:', videoTrack.enabled);
      return videoTrack.enabled;
    }
    return false;
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return average / 255; // Normalize to 0-1 range
  }

  getMediaState(): MediaState {
    return { ...this.mediaState };
  }

  cleanup(): void {
    console.log('[MediaManager] Cleaning up media resources');

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('[MediaManager] Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    if (this.mediaSource) {
      this.mediaSource.disconnect();
      this.mediaSource = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaState = {
      isAudioEnabled: false,
      isVideoEnabled: false
    };
  }
}

export const mediaManager = new MediaManager();
export type { MediaConstraints, MediaState }; 