const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// WebSocket server for handling client connections
const wss = new WebSocket.Server({ server });

// Store active AssemblyAI connections
const activeConnections = new Map();

// AssemblyAI WebSocket connection handler
function createAssemblyAIConnection(clientWs, config = {}) {
  const {
    sample_rate = 16000,
    format_turns = true,
    end_of_turn_confidence_threshold = 0.7,
    min_end_of_turn_silence_when_confident = 160,
    max_turn_silence = 2400
  } = config;

  const params = new URLSearchParams({
    sample_rate: sample_rate.toString(),
    encoding: 'pcm_s16le',
    format_turns: format_turns.toString(),
    end_of_turn_confidence_threshold: end_of_turn_confidence_threshold.toString(),
    min_end_of_turn_silence_when_confident: min_end_of_turn_silence_when_confident.toString(),
    max_turn_silence: max_turn_silence.toString()
  });

  const assemblyWs = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params}`, {
    headers: {
      'Authorization': process.env.ASSEMBLYAI_API_KEY
    }
  });

  assemblyWs.on('open', () => {
    console.log('Connected to AssemblyAI streaming service');
    console.log('Connection URL:', `wss://streaming.assemblyai.com/v3/ws?${params}`);
    console.log('API Key (first 8 chars):', process.env.ASSEMBLYAI_API_KEY?.substring(0, 8) + '...');
    
    clientWs.send(JSON.stringify({
      type: 'connection_status',
      status: 'connected',
      message: 'Connected to AssemblyAI streaming service'
    }));
  });

  assemblyWs.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      // Ultra-fast forwarding - no logging for performance
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'transcription',
          data: message
        }));
      }
    } catch (error) {
      console.error('Error parsing AssemblyAI message:', error);
    }
  });

  assemblyWs.on('error', (error) => {
    console.error('AssemblyAI WebSocket error:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'AssemblyAI connection error',
        error: error.message
      }));
    }
  });

  assemblyWs.on('close', (code, reason) => {
    console.log(`AssemblyAI connection closed: ${code} - ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'connection_status',
        status: 'disconnected',
        message: 'Disconnected from AssemblyAI streaming service'
      }));
    }
  });

  return assemblyWs;
}

// Handle client WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('New client connected');
  
  // Send initial connection status to client
  ws.send(JSON.stringify({
    type: 'connection_status',
    status: 'ready',
    message: 'Connected to backend server'
  }));
  
  // Send a ping to test connection
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));
    }
  }, 1000);
  
  let assemblyWs = null;
  const connectionId = Date.now().toString();
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'start_session':
          if (assemblyWs) {
            assemblyWs.close();
          }
          
          assemblyWs = createAssemblyAIConnection(ws, data.config);
          activeConnections.set(connectionId, assemblyWs);
          break;
          
        case 'audio_data':
          if (assemblyWs && assemblyWs.readyState === WebSocket.OPEN) {
            // Convert base64 audio data back to binary and send to AssemblyAI immediately
            const audioBuffer = Buffer.from(data.audio, 'base64');
            assemblyWs.send(audioBuffer);
            
            // Minimal logging for performance
            if (!ws.audioChunkCount) ws.audioChunkCount = 0;
            ws.audioChunkCount++;
          }
          break;
          
        case 'update_config':
          if (assemblyWs && assemblyWs.readyState === WebSocket.OPEN) {
            assemblyWs.send(JSON.stringify({
              type: 'UpdateConfiguration',
              ...data.config
            }));
          }
          break;
          
        case 'force_endpoint':
          if (assemblyWs && assemblyWs.readyState === WebSocket.OPEN) {
            assemblyWs.send(JSON.stringify({ type: 'ForceEndpoint' }));
          }
          break;
          
        case 'terminate':
          if (assemblyWs && assemblyWs.readyState === WebSocket.OPEN) {
            assemblyWs.send(JSON.stringify({ type: 'Terminate' }));
          }
          break;
          
        case 'pong':
          console.log('Received pong from client');
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing message',
        error: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    if (assemblyWs) {
      assemblyWs.close();
      activeConnections.delete(connectionId);
    }
  });
  
  ws.on('error', (error) => {
    console.error('Client WebSocket error:', error);
    if (assemblyWs) {
      assemblyWs.close();
      activeConnections.delete(connectionId);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size
  });
});

// API endpoint to validate AssemblyAI API key
app.post('/api/validate-key', (req, res) => {
  const apiKey = req.body.apiKey || process.env.ASSEMBLYAI_API_KEY;
  
  if (!apiKey) {
    return res.status(400).json({
      valid: false,
      message: 'No API key provided'
    });
  }
  
  // Simple validation - just check if it looks like a valid key format
  const isValidFormat = /^[a-f0-9]{32}$/.test(apiKey);
  
  res.json({
    valid: isValidFormat,
    message: isValidFormat ? 'API key format is valid' : 'Invalid API key format'
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  
  if (!process.env.ASSEMBLYAI_API_KEY) {
    console.warn('⚠️  ASSEMBLYAI_API_KEY not found in environment variables');
    console.warn('   Please create a .env file with your AssemblyAI API key');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Close all active AssemblyAI connections
  activeConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'Terminate' }));
      ws.close();
    }
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});