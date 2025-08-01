@echo off
echo 🚀 Starting Ultra-Fast AssemblyAI Live Transcription...
echo.

echo 📦 Installing dependencies...
call npm install --silent

echo.
echo 🔧 Installing backend dependencies...
cd backend
call npm install --silent
cd ..

echo.
echo ⚡ Starting optimized backend server...
start "Backend Server (Ultra-Fast)" cmd /k "cd backend && set NODE_ENV=production && npm start"

echo.
echo ⏳ Waiting for backend to initialize...
timeout /t 2 /nobreak > nul

echo ✨ Starting frontend with Turbopack...
start "Frontend Server (Ultra-Fast)" cmd /k "npm run dev"

echo.
echo 🎉 Both servers are starting with maximum performance!
echo.
echo 🌐 Frontend: http://localhost:3000
echo 🔌 Backend:  http://localhost:3001
echo.
echo 💡 Tips for best performance:
echo    - Use Chrome or Edge for optimal WebRTC support
echo    - Ensure good microphone quality
echo    - Speak clearly and at normal pace
echo    - Close unnecessary browser tabs
echo.
echo Press any key to exit...
pause > nul