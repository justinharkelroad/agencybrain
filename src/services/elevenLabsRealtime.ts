import { AudioRecorder } from '@/utils/audioRecorder';
import { AudioQueue } from '@/utils/audioQueue';

interface ElevenLabsConfig {
  apiKey: string;
  agentId: string;
  voiceId: string;
  onAudioChunk: (audioData: ArrayBuffer) => void;
  onTranscript: (role: string, text: string) => void;
  onStatusChange: (status: string) => void;
  onError: (error: Error) => void;
}

export class ElevenLabsRealtimeService {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private audioQueue: AudioQueue;
  private config: ElevenLabsConfig;

  constructor(config: ElevenLabsConfig) {
    this.config = config;
    this.audioQueue = new AudioQueue();
  }

  async connect() {
    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize audio recorder
      this.recorder = new AudioRecorder((audioData: Float32Array) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendAudioData(audioData);
        }
      });

      await this.recorder.start();

      // Connect to ElevenLabs Conversational AI
      const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.config.agentId}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('ElevenLabs WebSocket connected');
        
        // Authenticate
        this.ws?.send(JSON.stringify({
          type: 'conversation.authentication',
          api_key: this.config.apiKey,
        }));

        // Configure voice and settings
        this.ws?.send(JSON.stringify({
          type: 'conversation.config',
          voice_id: this.config.voiceId,
          latency: 'max',
          stability: 0.4,
          similarity_boost: 0.7,
          speed: 1.1,
        }));

        this.config.onStatusChange('connected');
      };

      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.config.onError(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.config.onStatusChange('disconnected');
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      this.config.onError(error instanceof Error ? error : new Error('Connection failed'));
      throw error;
    }
  }

  private async handleMessage(message: any) {
    switch (message.type) {
      case 'conversation.audio':
        // Handle audio chunk from ElevenLabs
        if (message.audio) {
          const audioData = this.base64ToArrayBuffer(message.audio);
          await this.audioQueue.enqueue(audioData);
          this.config.onAudioChunk(audioData);
        }
        break;

      case 'conversation.transcript':
        // Handle transcript
        this.config.onTranscript(
          message.role || 'assistant',
          message.text || ''
        );
        break;

      case 'conversation.start':
        this.config.onStatusChange('live');
        break;

      case 'conversation.error':
        console.error('Conversation error:', message);
        this.config.onError(new Error(message.message || 'Unknown error'));
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private sendAudioData(float32Array: Float32Array) {
    const base64Audio = this.float32ToBase64(float32Array);
    
    this.ws?.send(JSON.stringify({
      type: 'conversation.audio_input',
      audio: base64Audio,
    }));
  }

  private float32ToBase64(float32Array: Float32Array): string {
    // Convert Float32 to Int16 PCM
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to base64
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  disconnect() {
    this.recorder?.stop();
    this.ws?.close();
    this.audioQueue.clear();
  }
}
