import { useCallback, useEffect, useRef, useState } from 'react'
import { GeminiLiveClient, type ChatMessage } from '~/lib/gemini'
import { getApiConfig } from '~/server/api'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface ConnectionError {
  message: string
  details?: string
  recoverable: boolean
}

export function VoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [isRecording, setIsRecording] = useState(false)
  const [connectionError, setConnectionError] = useState<ConnectionError | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const clientRef = useRef<GeminiLiveClient | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const parseError = (error: Error | string): ConnectionError => {
    const message = typeof error === 'string' ? error : error.message

    // API key errors
    if (message.includes('API_KEY') || message.includes('apiKey') || message.includes('environment variable')) {
      return {
        message: 'API Key Not Configured',
        details: 'The Gemini API key is not set up. Please contact the administrator.',
        recoverable: false,
      }
    }

    // WebSocket/connection errors
    if (message.includes('WebSocket') || message.includes('connection') || message.includes('network')) {
      return {
        message: 'Connection Failed',
        details: 'Unable to connect to the AI service. Check your internet connection and try again.',
        recoverable: true,
      }
    }

    // Authentication errors
    if (message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('forbidden')) {
      return {
        message: 'Authentication Error',
        details: 'The API key may be invalid or expired. Please contact the administrator.',
        recoverable: false,
      }
    }

    // Rate limiting
    if (message.includes('429') || message.includes('rate') || message.includes('quota')) {
      return {
        message: 'Rate Limited',
        details: 'Too many requests. Please wait a moment and try again.',
        recoverable: true,
      }
    }

    // Model errors
    if (message.includes('model') || message.includes('not found') || message.includes('unavailable')) {
      return {
        message: 'Service Unavailable',
        details: 'The AI model is currently unavailable. Please try again later.',
        recoverable: true,
      }
    }

    // Default error
    return {
      message: 'Connection Error',
      details: message || 'An unexpected error occurred. Please try again.',
      recoverable: true,
    }
  }

  const connect = useCallback(async () => {
    try {
      setConnectionError(null)
      setStatus('connecting')

      const { apiKey } = await getApiConfig()

      const client = new GeminiLiveClient()
      clientRef.current = client

      client.onMessage = (message) => {
        setMessages((prev) => [...prev, message])
      }

      client.onStatusChange = (newStatus) => {
        if (newStatus === 'connected') {
          setStatus('connected')
          setRetryCount(0)
          setConnectionError(null)
        } else if (newStatus === 'disconnected') {
          // Check if this was an unexpected disconnect
          if (status === 'connected') {
            setConnectionError({
              message: 'Connection Lost',
              details: 'The connection was unexpectedly closed. You can try reconnecting.',
              recoverable: true,
            })
          }
          setStatus('disconnected')
        } else {
          setStatus(newStatus)
        }
      }

      client.onError = (err) => {
        const parsedError = parseError(err)
        setConnectionError(parsedError)
        setStatus('error')
      }

      await client.connect(apiKey)
    } catch (err) {
      const parsedError = parseError(err instanceof Error ? err : String(err))
      setConnectionError(parsedError)
      setStatus('error')
    }
  }, [status])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }
    setIsRecording(false)
    setConnectionError(null)
  }, [])

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
    connect()
  }, [connect])

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !clientRef.current || status !== 'connected') return

    try {
      await clientRef.current.sendText(inputText.trim())
      setInputText('')
    } catch (err) {
      const parsedError = parseError(err instanceof Error ? err : String(err))
      setConnectionError(parsedError)
    }
  }, [inputText, status])

  const toggleRecording = useCallback(async () => {
    if (!clientRef.current || status !== 'connected') return

    if (isRecording) {
      clientRef.current.stopAudioStream()
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
        audioStreamRef.current = null
      }
      setIsRecording(false)
    } else {
      try {
        const stream = await clientRef.current.startAudioStream()
        audioStreamRef.current = stream
        setIsRecording(true)
      } catch (err) {
        setConnectionError({
          message: 'Microphone Access Denied',
          details: 'Please allow microphone access to use voice chat.',
          recoverable: true,
        })
      }
    }
  }, [isRecording, status])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-white">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <MicIcon isRecording={false} />
          </div>
          <h1 className="text-lg font-semibold">Voice Chat AI</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <StatusIndicator status={status} />
          
          {/* Auth placeholder - will be replaced with Clerk */}
          <button
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            onClick={() => alert('Auth coming soon!')}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Connection Controls */}
      <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          {status === 'connected' && '🟢 Ready to chat'}
          {status === 'connecting' && '🟡 Establishing connection...'}
          {status === 'disconnected' && '⚪ Not connected'}
          {status === 'error' && '🔴 Connection error'}
        </div>
        
        <div className="flex items-center gap-2">
          {(status === 'disconnected' || status === 'error') && (
            <button
              onClick={connectionError?.recoverable === false ? undefined : (retryCount > 0 ? retry : connect)}
              disabled={connectionError?.recoverable === false}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                connectionError?.recoverable === false
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {retryCount > 0 ? `Retry (${retryCount})` : 'Connect'}
            </button>
          )}
          {status === 'connected' && (
            <button
              onClick={disconnect}
              className="px-4 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors"
            >
              Disconnect
            </button>
          )}
          {status === 'connecting' && (
            <button
              onClick={disconnect}
              className="px-4 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {connectionError && (
        <div className={`px-4 py-3 ${connectionError.recoverable ? 'bg-amber-900/30' : 'bg-red-900/30'} border-b ${connectionError.recoverable ? 'border-amber-800/50' : 'border-red-800/50'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${connectionError.recoverable ? 'text-amber-400' : 'text-red-400'}`}>
              {connectionError.recoverable ? (
                <WarningIcon />
              ) : (
                <ErrorIcon />
              )}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${connectionError.recoverable ? 'text-amber-200' : 'text-red-200'}`}>
                {connectionError.message}
              </p>
              {connectionError.details && (
                <p className={`text-sm mt-1 ${connectionError.recoverable ? 'text-amber-300/70' : 'text-red-300/70'}`}>
                  {connectionError.details}
                </p>
              )}
            </div>
            <button
              onClick={() => setConnectionError(null)}
              className={`p-1 rounded hover:bg-white/10 ${connectionError.recoverable ? 'text-amber-400' : 'text-red-400'}`}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {status === 'disconnected' && messages.length === 0 && !connectionError && (
          <div className="text-center text-slate-400 mt-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
              <MicIcon isRecording={false} />
            </div>
            <p className="text-lg font-medium text-slate-300">Welcome to Voice Chat AI</p>
            <p className="mt-2 text-sm">Click "Connect" to start a conversation</p>
          </div>
        )}

        {status === 'connecting' && messages.length === 0 && (
          <div className="text-center text-slate-400 mt-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
              <LoadingSpinner />
            </div>
            <p className="text-lg font-medium text-slate-300">Connecting...</p>
            <p className="mt-2 text-sm">Setting up your AI conversation</p>
          </div>
        )}

        {status === 'connected' && messages.length === 0 && (
          <div className="text-center text-slate-400 mt-8">
            <p className="text-lg">👋 Hi there!</p>
            <p className="mt-2">Type a message or hold the mic button to talk.</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-4 bg-slate-800 border-t border-slate-700">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          {/* Mic Button */}
          <button
            onClick={toggleRecording}
            disabled={status !== 'connected'}
            className={`p-4 rounded-full transition-all ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : status === 'connected'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-slate-600 cursor-not-allowed'
            }`}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <MicIcon isRecording={isRecording} />
          </button>

          {/* Text Input */}
          <div className="flex-1 flex items-center gap-2 bg-slate-700 rounded-lg px-4 py-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={status === 'connected' ? 'Type a message...' : 'Connect to start chatting'}
              disabled={status !== 'connected'}
              className="flex-1 bg-transparent outline-none text-white placeholder-slate-400"
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || status !== 'connected'}
              className={`p-2 rounded-lg transition-colors ${
                inputText.trim() && status === 'connected'
                  ? 'text-indigo-400 hover:bg-slate-600'
                  : 'text-slate-500 cursor-not-allowed'
              }`}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  )
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const colors = {
    disconnected: 'bg-slate-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
          isUser ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-slate-700 text-slate-100 rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1 ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function MicIcon({ isRecording }: { isRecording: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`w-6 h-6 ${isRecording ? 'text-white' : ''}`}
    >
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
      <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg className="w-8 h-8 animate-spin text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('Install prompt outcome:', outcome)
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 mx-auto max-w-md bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl z-50">
      <p className="text-sm text-slate-200 mb-3">📱 Install Voice Chat AI for a better experience!</p>
      <div className="flex gap-2">
        <button onClick={handleInstall} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium">
          Install App
        </button>
        <button onClick={() => setShowPrompt(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
          Later
        </button>
      </div>
    </div>
  )
}
