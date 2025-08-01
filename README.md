# AssemblyAI Live Transcription App

A complete real-time speech-to-text application built with Next.js frontend and Node.js backend, powered by AssemblyAI's Universal Streaming API.

## Features

- **Real-time transcription** - Live speech-to-text with streaming audio
- **Beautiful UI** - Modern, responsive interface with dark mode support
- **Configurable settings** - Adjust sample rate, confidence thresholds, and silence detection
- **Session management** - Track transcription sessions with unique IDs
- **Export functionality** - Download transcripts as text files
- **Word-level details** - View individual word confidence scores and timing
- **Turn detection** - Automatic detection of speaking turns with formatting
- **Error handling** - Comprehensive error handling and connection management

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Node.js with Express and WebSocket
- **API**: AssemblyAI Universal Streaming API
- **Real-time Communication**: WebSocket connection between frontend and backend

## Quick Start

### 1. Get AssemblyAI API Key

Sign up at [AssemblyAI](https://www.assemblyai.com/) and get your API key.

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your AssemblyAI API key
npm run dev
```

### 3. Setup Frontend

```bash
# In the root directory
npm install
npm run dev
```

### 4. Open the Application

Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Start the backend server** (port 3001)
2. **Start the frontend** (port 3000)
3. **Click "Start Recording"** to begin transcription
4. **Speak into your microphone** - see live transcription appear
5. **Click "Stop Recording"** when done
6. **Download or clear transcripts** as needed

## Configuration Options

- **Sample Rate**: Audio sample rate (8000, 16000, 22050, 44100 Hz)
- **End of Turn Confidence**: Threshold for detecting end of speaking turn (0.0-1.0)
- **Min End of Turn Silence**: Minimum silence duration to detect turn end (ms)
- **Max Turn Silence**: Maximum silence allowed in a turn (ms)
- **Format Turns**: Enable/disable text formatting and punctuation

## Technical Details

### Frontend (Next.js)
- React hooks for state management
- WebSocket client for real-time communication
- MediaRecorder API for audio capture
- Responsive design with Tailwind CSS
- TypeScript for type safety

### Backend (Node.js)
- Express server with WebSocket support
- Proxy to AssemblyAI streaming API
- Audio data forwarding and session management
- CORS enabled for frontend communication
- Environment variable configuration

### Audio Processing
- Browser captures microphone audio using MediaRecorder
- Audio chunks converted to base64 and sent via WebSocket
- Backend forwards binary audio data to AssemblyAI
- Real-time transcription results streamed back to frontend

## Browser Requirements

- Modern browser with WebRTC support
- Microphone access permission
- WebSocket support
- MediaRecorder API support

## Troubleshooting

### Common Issues

1. **Microphone not working**
   - Check browser permissions
   - Ensure HTTPS in production
   - Try different browsers

2. **WebSocket connection failed**
   - Ensure backend server is running on port 3001
   - Check firewall settings
   - Verify CORS configuration

3. **No transcription results**
   - Verify AssemblyAI API key is correct
   - Check network connectivity
   - Ensure audio is being captured

4. **Poor transcription quality**
   - Adjust sample rate settings
   - Improve microphone quality
   - Reduce background noise
   - Adjust confidence thresholds

## Development

### Project Structure
```
├── app/                 # Next.js app directory
│   ├── page.tsx        # Main application component
│   ├── layout.tsx      # Root layout
│   └── globals.css     # Global styles
├── backend/            # Node.js backend
│   ├── server.js       # Main server file
│   ├── package.json    # Backend dependencies
│   └── .env.example    # Environment variables template
├── package.json        # Frontend dependencies
└── README.md          # This file
```

### Scripts

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

**Backend:**
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server

## License

This project is open source and available under the MIT License.

## Support

For issues related to:
- **AssemblyAI API**: Check [AssemblyAI Documentation](https://www.assemblyai.com/docs/)
- **Next.js**: Check [Next.js Documentation](https://nextjs.org/docs)
- **This application**: Create an issue in the repository#   c o n v e r s e  
 