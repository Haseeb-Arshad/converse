# AssemblyAI Streaming Backend

This is the Node.js backend server for the AssemblyAI streaming transcription application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your AssemblyAI API key:
```bash
cp .env.example .env
```

Then edit `.env` and add your AssemblyAI API key:
```
ASSEMBLYAI_API_KEY=your_actual_api_key_here
PORT=3001
```

3. Start the server:
```bash
npm run dev
```

The server will run on port 3001 by default.

## Features

- WebSocket server for real-time communication with the frontend
- Proxy connection to AssemblyAI streaming API
- Audio data forwarding from browser to AssemblyAI
- Real-time transcription message handling
- Session management and configuration updates
- Health check endpoint

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/validate-key` - Validate AssemblyAI API key format
- WebSocket connection on the same port for real-time communication

## WebSocket Messages

### Client to Server:
- `start_session` - Start a new transcription session
- `audio_data` - Send audio data (base64 encoded)
- `update_config` - Update session configuration
- `force_endpoint` - Force end of turn
- `terminate` - Terminate the session

### Server to Client:
- `connection_status` - Connection status updates
- `transcription` - Transcription data from AssemblyAI
- `error` - Error messages

## Requirements

- Node.js 16+
- AssemblyAI API key
- WebSocket support