import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isAudio?: boolean
}

export class GeminiLiveClient {
  private client: GoogleGenAI | null = null
  private session: any = null
  private audioContext: AudioContext | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying = false

  onMessage?: (message: ChatMessage) => void
  onAudioResponse?: (audio: ArrayBuffer) => void
  onError?: (error: Error) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void

  async connect(apiKey: string) {
    try {
      this.onStatusChange?.('connecting')

      this.client = new GoogleGenAI({ apiKey })
      this.audioContext = new AudioContext({ sampleRate: 24000 })

      this.session = await this.client.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            console.log('Connected to Gemini Live API')
            this.onStatusChange?.('connected')
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message)
          },
          onerror: (error: ErrorEvent) => {
            console.error('WebSocket error:', error)
            this.onError?.(new Error(error.message || 'Connection error'))
          },
          onclose: (event: CloseEvent) => {
            console.log('Connection closed:', event.reason)
            this.onStatusChange?.('disconnected')
          },
        },
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede',
              },
            },
          },
          systemInstruction: {
            parts: [
              {
                text: `You are a friendly, conversational AI assistant. Be warm, helpful, and engaging. 
Keep responses concise but natural - like talking to a friend. 
Feel free to ask clarifying questions and show genuine interest in the conversation.
Respond in a way that feels natural for voice conversation.`,
              },
            ],
          },
        },
      })
    } catch (error) {
      console.error('Failed to connect:', error)
      this.onError?.(error as Error)
      this.onStatusChange?.('disconnected')
      throw error
    }
  }

  private handleMessage(message: LiveServerMessage) {
    if (message.serverContent) {
      const { modelTurn, turnComplete } = message.serverContent

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.text) {
            this.onMessage?.({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: part.text,
              timestamp: new Date(),
            })
          }

          if (part.inlineData?.data) {
            const audioData = this.base64ToArrayBuffer(part.inlineData.data)
            this.queueAudio(audioData)
          }
        }
      }

      if (turnComplete) {
        this.playQueuedAudio()
      }
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  private queueAudio(audioData: ArrayBuffer) {
    this.audioQueue.push(audioData)
  }

  private async playQueuedAudio() {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioContext) return

    this.isPlaying = true

    while (this.audioQueue.length > 0) {
      const audioData = this.audioQueue.shift()!

      try {
        // Convert raw PCM to playable format
        const pcmData = new Int16Array(audioData)
        const floatData = new Float32Array(pcmData.length)

        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0
        }

        const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000)
        audioBuffer.getChannelData(0).set(floatData)

        const source = this.audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(this.audioContext.destination)

        await new Promise<void>((resolve) => {
          source.onended = () => resolve()
          source.start()
        })
      } catch (error) {
        console.error('Error playing audio:', error)
      }
    }

    this.isPlaying = false
  }

  async sendText(text: string) {
    if (!this.session) {
      throw new Error('Not connected')
    }

    this.onMessage?.({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    })

    await this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [{ text }],
        },
      ],
      turnComplete: true,
    })
  }

  async startAudioStream(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    })

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && this.session) {
        const arrayBuffer = await event.data.arrayBuffer()
        const base64 = this.arrayBufferToBase64(arrayBuffer)

        await this.session.sendRealtimeInput({
          audio: {
            data: base64,
            mimeType: 'audio/webm;codecs=opus',
          },
        })
      }
    }

    this.mediaRecorder.start(100) // Send chunks every 100ms
    return stream
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  stopAudioStream() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
      this.mediaRecorder = null
    }
  }

  disconnect() {
    this.stopAudioStream()
    if (this.session) {
      this.session.close()
      this.session = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.onStatusChange?.('disconnected')
  }
}
