import { useCallback, useEffect, useRef, useState } from 'react'
import { GeminiLiveClient, type ChatMessage } from '~/lib/gemini'
import { getApiConfig } from '~/server/api'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export function VoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<GeminiLiveClient | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const connect = useCallback(async () => {
    try {
      setError(null)
      const { apiKey } = await getApiConfig()

      const client = new GeminiLiveClient()
      clientRef.current = client

      client.onMessage = (message) => {
        setMessages((prev) => [...prev, message])
      }

      client.onStatusChange = (newStatus) => {
        setStatus(newStatus)
      }

      client.onError = (err) => {
        setError(err.message)
      }

      await client.connect(apiKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setStatus('disconnected')
    }
  }, [])

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
  }, [])

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !clientRef.current || status !== 'connected') return

    try {
      await clientRef.current.sendText(inputText.trim())
      setInputText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
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
        setError(err instanceof Error ? err.message : 'Failed to start recording')
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <h1 className="text-xl font-semibold">Voice Chat AI</h1>
        <div className="flex items-center gap-3">
          <StatusIndicator status={status} />
          {status === 'disconnected' ? (
            <button
              onClick={connect}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 text-red-200 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && status === 'connected' && (
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
    disconnected: 'bg-red-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
  }

  const labels = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {labels[status]}
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
    <div className="fixed bottom-20 left-4 right-4 mx-auto max-w-md bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl">
      <p className="text-sm text-slate-200 mb-3">Install Voice Chat AI for a better experience!</p>
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
