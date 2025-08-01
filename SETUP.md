# Setup Guide

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **AssemblyAI API Key** - Get one from [AssemblyAI](https://www.assemblyai.com/)

## Step-by-Step Setup

### 1. Get Your AssemblyAI API Key

1. Go to [AssemblyAI](https://www.assemblyai.com/)
2. Sign up for a free account
3. Navigate to your dashboard
4. Copy your API key

### 2. Configure the Backend

1. Navigate to the `backend` folder
2. Open the `.env` file
3. Replace `your_assemblyai_api_key_here` with your actual API key:
   ```
   ASSEMBLYAI_API_KEY=your_actual_api_key_here
   PORT=3001
   FRONTEND_URL=http://localhost:3000
   ```

### 3. Start the Application

#### Option A: Use the Startup Scripts (Recommended)

**Windows Command Prompt:**
```bash
start.bat
```

**Windows PowerShell:**
```powershell
.\start.ps1
```

#### Option B: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 4. Open the Application

1. Open your browser
2. Go to [http://localhost:3000](http://localhost:3000)
3. Allow microphone access when prompted
4. Click "Start Recording" to begin transcription

## Troubleshooting

### Backend Server Won't Start
- Check if port 3001 is available
- Verify your AssemblyAI API key is correct
- Make sure Node.js is installed

### Frontend Won't Connect
- Ensure backend server is running first
- Check browser console for errors
- Verify WebSocket connection to localhost:3001

### Microphone Issues
- Grant microphone permissions in browser
- Try a different browser (Chrome recommended)
- Check if other applications are using the microphone

### No Transcription Results
- Verify AssemblyAI API key is valid
- Check network connectivity
- Ensure you're speaking clearly into the microphone

## Browser Compatibility

**Recommended:**
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

**Required Features:**
- WebRTC/MediaRecorder API
- WebSocket support
- Microphone access

## Production Deployment

For production deployment:

1. Set environment variables properly
2. Use HTTPS for microphone access
3. Configure CORS settings
4. Use a process manager like PM2
5. Set up proper logging and monitoring

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify all setup steps were completed
3. Test with a different browser
4. Check AssemblyAI API status
5. Review the troubleshooting section above