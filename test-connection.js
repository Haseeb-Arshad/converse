const WebSocket = require('ws');

console.log('Testing WebSocket connection to backend...');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('✅ Connected to backend WebSocket');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('📨 Received message:', message);
    
    if (message.type === 'ping') {
      console.log('🏓 Sending pong response');
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: Date.now()
      }));
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
  }
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

// Close connection after 5 seconds
setTimeout(() => {
  console.log('⏰ Closing connection after 5 seconds');
  ws.close();
}, 5000);