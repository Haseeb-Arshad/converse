# 🎤 AssemblyAI Live Transcription - Complete Setup Guide

## 🚀 What You've Built

A professional-grade real-time speech-to-text application featuring:

- **Real-time streaming transcription** using AssemblyAI's Universal Streaming API
- **Modern Next.js frontend** with TypeScript and Tailwind CSS
- **Node.js WebSocket backend** for seamless audio streaming
- **Advanced configuration options** for fine-tuning transcription
- **Beautiful, responsive UI** with dark mode support
- **Export functionality** to download transcripts
- **Session management** with unique IDs and timing data

## 📋 Prerequisites

✅ **Node.js 16+** installed  
✅ **AssemblyAI API Key** (get free at [assemblyai.com](https://assemblyai.com))  
✅ **Modern browser** with microphone access  

## 🔧 Quick Setup (3 Steps)

### Step 1: Get AssemblyAI API Key
1. Visit [AssemblyAI](https://www.assemblyai.com/)
2. Create free account
3. Copy your API key from dashboard

### Step 2: Configure Backend
Edit `backend/.env`:
```env
ASSEMBLYAI_API_KEY=your_actual_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Step 3: Start Application
**Windows (Easy):**
```bash
# Command Prompt
start.bat

# PowerShell
.\start.ps1
```

**Manual Start:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
npm run dev
```

## 🌐 Access Your App

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend Health**: [http://localhost:3001/health](http://localhost:3001/health)

## 🎯 How to Use

1. **Open** [http://localhost:3000](http://localhost:3000)
2. **Allow** microphone access when prompted
3. **Click** "Start Recording" button
4. **Speak** clearly into your microphone
5. **Watch** live transcription appear in real-time
6. **Stop** recording when finished
7. **Download** or clear transcripts as needed

## ⚙️ Advanced Configuration

Click the **Settings** gear icon to adjust:

- **Sample Rate**: Audio quality (16000 Hz recommended)
- **Confidence Threshold**: End-of-turn detection sensitivity
- **Silence Detection**: Fine-tune turn detection timing
- **Text Formatting**: Enable punctuation and capitalization

## 🏗️ Architecture Overview

```
┌─────────────────┐    WebSocket    ┌─────────────────┐    HTTPS    ┌─────────────────┐
│   Next.js App   │ ←──────────────→ │  Node.js Server │ ←──────────→ │  AssemblyAI API │
│   (Frontend)    │                 │   (Backend)     │             │   (Streaming)   │
│   Port 3000     │                 │   Port 3001     │             │                 │
└─────────────────┘                 └─────────────────┘             └─────────────────┘
```

## 📁 Project Structure

```
converse/
├── app/                    # Next.js frontend
│   ├── page.tsx           # Main transcription UI
│   ├── layout.tsx         # App layout
│   └── globals.css        # Styles
├── backend/               # Node.js backend
│   ├── server.js          # WebSocket server
│   ├── package.json       # Backend dependencies
│   ├── .env              # Environment config
│   └── README.md         # Backend docs
├── package.json          # Frontend dependencies
├── start.bat            # Windows startup script
├── start.ps1           # PowerShell startup script
└── README.md           # Main documentation
```

## 🔍 Testing Your Setup

### Backend Health Check
```bash
cd backend
npm test
```

### Frontend Build Test
```bash
npm run build
```

### WebSocket Connection Test
Open browser console at [http://localhost:3000](http://localhost:3000) and check for:
- ✅ "Connected to backend WebSocket"
- ✅ "Connected to AssemblyAI streaming service"

## 🐛 Troubleshooting

### Common Issues & Solutions

**🔴 "WebSocket connection failed"**
- Ensure backend server is running on port 3001
- Check if port is blocked by firewall
- Verify CORS settings

**🔴 "Microphone access denied"**
- Grant microphone permissions in browser
- Use HTTPS in production
- Try different browser (Chrome recommended)

**🔴 "No transcription results"**
- Verify AssemblyAI API key is correct
- Check network connectivity
- Ensure audio is being captured
- Test with different microphone

**🔴 "Poor transcription quality"**
- Increase sample rate to 16000 Hz
- Reduce background noise
- Speak clearly and at normal pace
- Adjust confidence thresholds

### Debug Commands

```bash
# Check backend server
curl http://localhost:3001/health

# View backend logs
cd backend && npm run dev

# Check frontend build
npm run build

# Test API key format
node -e "console.log(/^[a-f0-9]{32}$/.test('your_api_key'))"
```

## 🚀 Production Deployment

For production use:

1. **Environment Variables**
   ```env
   NODE_ENV=production
   ASSEMBLYAI_API_KEY=your_key
   PORT=3001
   FRONTEND_URL=https://yourdomain.com
   ```

2. **HTTPS Required**
   - Microphone access requires HTTPS
   - Use SSL certificates
   - Configure reverse proxy

3. **Process Management**
   ```bash
   npm install -g pm2
   pm2 start backend/server.js --name "assemblyai-backend"
   ```

4. **Frontend Build**
   ```bash
   npm run build
   npm start
   ```

## 📊 Features Showcase

### Real-time Transcription
- Live audio streaming to AssemblyAI
- Instant transcription results
- Word-level confidence scores
- Turn detection and formatting

### Advanced Settings
- Configurable sample rates
- Adjustable confidence thresholds
- Customizable silence detection
- Text formatting options

### User Experience
- Modern, responsive design
- Dark mode support
- Session management
- Export functionality
- Error handling and recovery

### Technical Excellence
- TypeScript for type safety
- WebSocket for real-time communication
- Proper error handling
- Clean architecture
- Comprehensive documentation

## 🎉 You're All Set!

Your AssemblyAI Live Transcription app is ready to use! This professional-grade application demonstrates:

- Real-time audio processing
- WebSocket communication
- Modern React patterns
- Node.js backend architecture
- API integration best practices

**Next Steps:**
1. Test with different audio sources
2. Experiment with configuration settings
3. Customize the UI to your needs
4. Deploy to production when ready

**Need Help?**
- Check the troubleshooting section above
- Review browser console for errors
- Test individual components separately
- Verify all setup steps were completed

Happy transcribing! 🎤✨