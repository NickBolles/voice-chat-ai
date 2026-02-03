# Voice Chat AI

A conversational AI voice assistant powered by Google Gemini Live API. Built with TanStack Start for a modern full-stack React experience.

## Features

- 🎤 **Real-time Voice Conversation** - Talk naturally with AI using your microphone
- 💬 **Text Chat** - Type messages if you prefer
- 📱 **PWA Support** - Install as a native-like app on any device
- 🔔 **Push Notifications** - Get notified for check-ins and long-running tasks
- ⚡ **Fast & Modern** - Built with TanStack Start, React 19, and Tailwind CSS v4

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (Full-stack React)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **AI:** [Google Gemini Live API](https://ai.google.dev/gemini-api/docs/live)
- **PWA:** [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- **Deployment:** Vercel / Netlify / Cloudflare

## Getting Started

### Prerequisites

- Node.js 20+
- A [Gemini API key](https://aistudio.google.com/apikey)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/voice-chat-ai.git
   cd voice-chat-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Gemini API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click **Connect** to establish a connection with Gemini
2. **Type** a message in the input field, or
3. **Press and hold** the microphone button to talk
4. The AI will respond with both text and voice

## PWA Installation

On supported browsers, you'll see an "Install App" prompt. Installing gives you:
- Standalone app experience (no browser chrome)
- Offline support for the UI
- Push notifications (when enabled)

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add `GEMINI_API_KEY` to environment variables
4. Deploy!

The app uses Nitro under the hood and works with Vercel's edge functions.

### Other Platforms

TanStack Start supports multiple deployment targets:
- Netlify
- Cloudflare Pages
- Railway
- Node.js server

See the [TanStack Start Hosting Guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) for details.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |

## Project Structure

```
voice-chat-ai/
├── src/
│   ├── components/     # React components
│   │   └── VoiceChat.tsx
│   ├── lib/            # Utilities and clients
│   │   └── gemini.ts   # Gemini Live API client
│   ├── routes/         # TanStack Router routes
│   │   ├── __root.tsx
│   │   └── index.tsx
│   ├── server/         # Server functions
│   │   └── api.ts
│   └── styles/         # CSS files
├── public/             # Static assets & PWA icons
├── vite.config.ts      # Vite + PWA configuration
└── package.json
```

## Contributing

Contributions are welcome! Please open an issue or PR.

## License

MIT
