import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isAudio?: boolean
}

export class GeminiLiveClient {
  private client: GoogleGenAI | null = null
  private session: Session | null = null
  private audioContext: AudioContext | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying = false

  onMessage?: (message: ChatMessage) => void
  onAudioResponse?: (audio: ArrayBuffer) => void
  onError?: (error: Error) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void

  async connect(apiKey: string) {
    try {
      this.onStatusChange?.('connecting')
      console.log('[Gemini] Initializing client...')

      this.client = new GoogleGenAI({ apiKey })
      
      // Initialize audio context for playback
      this.audioContext = new AudioContext({ sampleRate: 24000 })
      console.log('[Gemini] Audio context created, sample rate:', this.audioContext.sampleRate)

      console.log('[Gemini] Connecting to Live API...')
      
      this.session = await this.client.live.connect({
        model: 'models/gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction: {
            parts: [
              {
                text: `You are a friendly, conversational AI assistant. Be warm, helpful, and engaging. 
Keep responses concise but natural - like talking to a friend. 
Feel free to ask clarifying questions and show genuine interest in the conversation.`,
              },
            ],
          },
        },
        callbacks: {
          onopen: () => {
            console.log('[Gemini] WebSocket opened - connected!')
            this.onStatusChange?.('connected')
          },
          onmessage: (message: LiveServerMessage) => {
            console.log('[Gemini] Received message:', JSON.stringify(message).slice(0, 200))
            this.handleMessage(message)
          },
          onerror: (error: ErrorEvent) => {
            console.error('[Gemini] WebSocket error:', error)
            this.onError?.(new Error(error.message || 'WebSocket connection error'))
          },
          onclose: (event: CloseEvent) => {
            console.log('[Gemini] WebSocket closed:', {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
            })
            
            // Provide more context about the close reason
            let errorMessage = 'Connection closed'
            if (event.code === 1000) {
              errorMessage = 'Connection closed normally'
            } else if (event.code === 1006) {
              errorMessage = 'Connection closed abnormally - possible network issue or invalid API key'
            } else if (event.code === 1008) {
              errorMessage = 'Policy violation - check your API key permissions'
            } else if (event.code === 1011) {
              errorMessage = 'Server error - the Gemini service encountered an issue'
            } else if (event.reason) {
              errorMessage = `Connection closed: ${event.reason}`
            }
            
            if (event.code !== 1000) {
              this.onError?.(new Error(errorMessage))
            }
            
            this.onStatusChange?.('disconnected')
          },
        },
      })

      console.log('[Gemini] Session created successfully')
    } catch (error) {
      console.error('[Gemini] Connection error:', error)
      const err = error instanceof Error ? error : new Error(String(error))
      this.onError?.(err)
      this.onStatusChange?.('disconnected')
      throw error
    }
  }

  private handleMessage(message: LiveServerMessage) {
    // Handle setup complete
    if (message.setupComplete) {
      console.log('[Gemini] Setup complete')
      return
    }

    // Handle server content
    if (message.serverContent) {
      const { serverContent } = message

      // Check for interruption
      if ('interrupted' in serverContent && serverContent.interrupted) {
        console.log('[Gemini] Response interrupted')
        return
      }

      // Check for turn complete
      if ('turnComplete' in serverContent && serverContent.turnComplete) {
        console.log('[Gemini] Turn complete')
        this.playQueuedAudio()
        return
      }

      // Handle model turn content
      if (serverContent.modelTurn?.parts) {
        for (const part of serverContent.modelTurn.parts) {
          // Handle text
          if (part.text) {
            console.log('[Gemini] Received text:', part.text.slice(0, 100))
            this.onMessage?.({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: part.text,
              timestamp: new Date(),
            })
          }

          // Handle audio
          if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) {
            console.log('[Gemini] Received audio chunk')
            const audioData = this.base64ToArrayBuffer(part.inlineData.data)
            this.queueAudio(audioData)
          }
        }
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
        // Convert raw PCM to playable format (16-bit signed integer at 24kHz)
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
        console.error('[Gemini] Error playing audio:', error)
      }
    }

    this.isPlaying = false
  }

  async sendText(text: string) {
    if (!this.session) {
      throw new Error('Not connected to Gemini')
    }

    console.log('[Gemini] Sending text:', text)

    // Add user message to chat
    this.onMessage?.({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    })

    try {
      await this.session.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      })
    } catch (error) {
      console.error('[Gemini] Error sending message:', error)
      throw error
    }
  }

  disconnect() {
    console.log('[Gemini] Disconnecting...')
    
    if (this.session) {
      try {
        this.session.close()
      } catch (e) {
        console.error('[Gemini] Error closing session:', e)
      }
      this.session = null
    }
    
    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (e) {
        console.error('[Gemini] Error closing audio context:', e)
      }
      this.audioContext = null
    }
    
    this.audioQueue = []
    this.isPlaying = false
    this.onStatusChange?.('disconnected')
  }
}
