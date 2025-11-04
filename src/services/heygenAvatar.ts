export class HeyGenAvatarService {
  private embedToken: string;
  private avatarId: string;
  private avatarInstance: any = null;
  private audioContext: AudioContext | null = null;
  private audioStream: MediaStream | null = null;

  constructor(embedToken: string, avatarId: string) {
    this.embedToken = embedToken;
    this.avatarId = avatarId;
  }

  async initialize(container: HTMLElement) {
    try {
      // Initialize audio context for streaming
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      // Load HeyGen SDK (assuming it's loaded via script tag)
      if (!(window as any).HeyGen) {
        throw new Error('HeyGen SDK not loaded');
      }

      const HeyGen = (window as any).HeyGen;

      // Initialize HeyGen Interactive Avatar
      this.avatarInstance = await HeyGen.StreamingAvatar.create({
        container: container,
        token: this.embedToken,
        avatarId: this.avatarId,
        quality: 'high',
      });

      console.log('HeyGen avatar initialized');
    } catch (error) {
      console.error('Failed to initialize HeyGen avatar:', error);
      throw error;
    }
  }

  async setAudioInput(audioData: ArrayBuffer) {
    try {
      if (!this.avatarInstance) {
        console.warn('Avatar instance not initialized');
        return;
      }

      if (!this.audioContext) {
        console.warn('Audio context not initialized');
        return;
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);

      // Create a MediaStream from the audio buffer for lip-sync
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const destination = this.audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.start();

      this.audioStream = destination.stream;

      // Send audio to HeyGen for lip-sync
      if (this.avatarInstance.setAudioStream) {
        await this.avatarInstance.setAudioStream(this.audioStream);
      }
    } catch (error) {
      console.error('Failed to set audio input:', error);
    }
  }

  cleanup() {
    if (this.avatarInstance) {
      try {
        this.avatarInstance.destroy?.();
      } catch (error) {
        console.error('Error destroying avatar:', error);
      }
      this.avatarInstance = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioStream = null;
  }
}
