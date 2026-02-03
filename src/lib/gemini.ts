import { GoogleGenAI, type Content } from '@google/genai'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export class GeminiLiveClient {
  private client: GoogleGenAI | null = null
  private chatHistory: Content[] = []
  private isConnected = false

  onMessage?: (message: ChatMessage) => void
  onError?: (error: Error) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void

  async connect(apiKey: string) {
    try {
      this.onStatusChange?.('connecting')
      console.log('[Gemini] Initializing client...')

      this.client = new GoogleGenAI({ apiKey })
      this.chatHistory = []
      this.isConnected = true
      
      console.log('[Gemini] Client initialized successfully')
      this.onStatusChange?.('connected')
      
      // Send a welcome message
      this.onMessage?.({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Hi! I'm your AI assistant. How can I help you today?",
        timestamp: new Date(),
      })
    } catch (error) {
      console.error('[Gemini] Connection error:', error)
      const err = error instanceof Error ? error : new Error(String(error))
      this.onError?.(err)
      this.onStatusChange?.('disconnected')
      throw error
    }
  }

  async sendText(text: string) {
    if (!this.client || !this.isConnected) {
      throw new Error('Not connected to Gemini')
    }

    console.log('[Gemini] Sending text:', text)

    // Add user message to UI
    this.onMessage?.({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    })

    // Add to history
    this.chatHistory.push({
      role: 'user',
      parts: [{ text }],
    })

    try {
      // Use the generateContent method with chat history
      const response = await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: this.chatHistory,
        config: {
          systemInstruction: `You are a friendly, conversational AI assistant. Be warm, helpful, and engaging. 
Keep responses concise but natural - like talking to a friend. 
Feel free to ask clarifying questions and show genuine interest in the conversation.`,
        },
      })

      const responseText = response.text || 'Sorry, I could not generate a response.'
      
      console.log('[Gemini] Received response:', responseText.slice(0, 100))

      // Add to history
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: responseText }],
      })

      // Send to UI
      this.onMessage?.({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      })
    } catch (error) {
      console.error('[Gemini] Error sending message:', error)
      
      // Parse error for user-friendly message
      let errorMessage = 'Failed to get response'
      if (error instanceof Error) {
        if (error.message.includes('API_KEY') || error.message.includes('401')) {
          errorMessage = 'Invalid API key'
        } else if (error.message.includes('quota') || error.message.includes('429')) {
          errorMessage = 'Rate limited - please wait a moment'
        } else {
          errorMessage = error.message
        }
      }
      
      this.onError?.(new Error(errorMessage))
    }
  }

  disconnect() {
    console.log('[Gemini] Disconnecting...')
    this.isConnected = false
    this.chatHistory = []
    this.client = null
    this.onStatusChange?.('disconnected')
  }
}
