'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Settings, Download, Trash2, Zap, Volume2 } from 'lucide-react';

interface TranscriptionData {
  type: string;
  turn_order?: number;
  turn_is_formatted?: boolean;
  end_of_turn?: boolean;
  transcript?: string;
  end_of_turn_confidence?: number;
  words?: Array<{
    text: string;
    word_is_final: boolean;
    start: number;
    end: number;
    confidence: number;
  }>;
  id?: string;
  expires_at?: number;
  audio_duration_seconds?: number;
  session_duration_seconds?: number;
}

interface ConnectionStatus {
  connected: boolean;
  message: string;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false, message: 'Initializing...' });
  const [transcripts, setTranscripts] = useState<TranscriptionData[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ id?: string; expires_at?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Audio recording refs
  const audioStreamRef = useRef<MediaStream | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const sessionStartTime = useRef<number>(0);

  // Ultra-fast settings for maximum performance
  const [settings, setSettings] = useState({
    sample_rate: 16000,
    format_turns: true,
    end_of_turn_confidence_threshold: 0.6, // Lower for faster response
    min_end_of_turn_silence_when_confident: 100, // Faster turn detection
    max_turn_silence: 1500 // Shorter silence tolerance
  });

  const connectWebSocket = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket('ws://localhost:8081');
    websocketRef.current = ws;

    ws.onopen = () => {
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'connection_status':
            setConnectionStatus({
              connected: message.status === 'connected' || message.status === 'ready',
              message: message.message
            });
            break;

          case 'transcription':
            handleTranscriptionMessage(message.data);
            break;

          case 'error':
            setError(message.message);
            break;

          case 'ping':
            if (websocketRef.current?.readyState === WebSocket.OPEN) {
              websocketRef.current.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now()
              }));
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setConnectionStatus({ connected: false, message: 'Reconnecting...' });

      setTimeout(() => {
        if (!websocketRef.current || websocketRef.current.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 2000);
    };

    ws.onerror = () => {
      setError('Connection failed');
    };
  }, []);

  const handleTranscriptionMessage = useCallback((data: TranscriptionData) => {
    switch (data.type) {
      case 'Begin':
        setSessionInfo({
          id: data.id,
          expires_at: data.expires_at
        });
        setCurrentTranscript('');
        sessionStartTime.current = Date.now();
        break;

      case 'Turn':
        if (data.transcript) {
          if (data.end_of_turn && data.turn_is_formatted) {
            // Final formatted transcript
            setTranscripts(prev => [...prev, data]);
            setCurrentTranscript('');
            setWordCount(prev => prev + (data.words?.length || 0));
          } else {
            // Live transcript - ultra-fast updates
            setCurrentTranscript(data.transcript);
          }
        }
        break;

      case 'Termination':
        setSessionInfo(null);
        setCurrentTranscript('');
        break;
    }
  }, []);

  const startRecording = async () => {
    try {
      setError(null);

      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: settings.sample_rate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      audioStreamRef.current = stream;

      // Ultra-fast audio processing optimized for AssemblyAI requirements
      const audioContext = new AudioContext({ sampleRate: settings.sample_rate });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1); // Optimized for 50ms+ chunks

      analyser.fftSize = 256;
      source.connect(analyser);
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      // Audio level monitoring for visual feedback
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        if (isRecording) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      let audioChunkCount = 0;

      scriptProcessor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Skip silent chunks for performance
        let hasAudio = false;
        for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > 0.005) {
            hasAudio = true;
            break;
          }
        }

        if (!hasAudio) return;

        audioChunkCount++;

        // Ultra-fast PCM conversion
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // Fast binary conversion
        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcmData.length; i++) {
          view.setInt16(i * 2, pcmData[i], true);
        }

        const uint8Array = new Uint8Array(buffer);
        const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: 'audio_data',
            audio: base64Audio
          }));
        }
      };

      (audioStreamRef.current as any).audioContext = audioContext;
      (audioStreamRef.current as any).processor = scriptProcessor;

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'start_session',
          config: settings
        }));

        await new Promise(resolve => setTimeout(resolve, 200)); // Minimal delay
      }

      setIsRecording(true);
      sessionStartTime.current = Date.now();

    } catch (error) {
      setError(`Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const stopRecording = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());

      const audioContext = (audioStreamRef.current as any).audioContext;
      const processor = (audioStreamRef.current as any).processor;

      if (processor) {
        try {
          processor.disconnect();
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => { });
      }

      audioStreamRef.current = null;
    }

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: 'terminate' }));
    }

    setIsRecording(false);
    setCurrentTranscript('');
    setAudioLevel(0);
  }, []);

  const clearTranscripts = () => {
    setTranscripts([]);
    setCurrentTranscript('');
    setWordCount(0);
  };

  const downloadTranscripts = () => {
    const content = transcripts.map((t, index) =>
      `${t.transcript}`
    ).join('\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Session duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && sessionStartTime.current) {
      interval = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [connectWebSocket]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Glassmorphism Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Live Transcription
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ultra-fast speech-to-text
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Connection Status */}
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Performance Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Response Speed
                </label>
                <select
                  value={settings.end_of_turn_confidence_threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, end_of_turn_confidence_threshold: parseFloat(e.target.value) }))}
                  className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value={0.5}>Ultra Fast</option>
                  <option value={0.6}>Fast</option>
                  <option value={0.7}>Balanced</option>
                  <option value={0.8}>Accurate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Turn Detection (ms)
                </label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={settings.min_end_of_turn_silence_when_confident}
                  onChange={(e) => setSettings(prev => ({ ...prev, min_end_of_turn_silence_when_confident: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <span className="text-sm text-slate-500">{settings.min_end_of_turn_silence_when_confident}ms</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Main Recording Interface */}
        <div className="text-center mb-8">
          {/* Recording Button */}
          <div className="relative inline-block">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!connectionStatus.connected}
              className={`relative w-24 h-24 rounded-full transition-all duration-300 transform hover:scale-105 ${isRecording
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-2xl shadow-red-500/30'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl shadow-blue-500/30'
                } ${!connectionStatus.connected ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-3xl'}`}
            >
              {isRecording ? (
                <MicOff className="w-8 h-8 text-white mx-auto" />
              ) : (
                <Mic className="w-8 h-8 text-white mx-auto" />
              )}

              {/* Audio Level Indicator */}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-pulse"
                  style={{
                    transform: `scale(${1 + audioLevel * 0.3})`,
                    opacity: 0.7 + audioLevel * 0.3
                  }}>
                </div>
              )}
            </button>

            {/* Pulse Animation */}
            {isRecording && (
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
            )}
          </div>

          <p className="mt-4 text-slate-600 dark:text-slate-400">
            {isRecording ? 'Recording... Tap to stop' : 'Tap to start recording'}
          </p>

          {/* Session Stats */}
          {isRecording && (
            <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center space-x-1">
                <Volume2 className="w-4 h-4" />
                <span>{formatTime(sessionDuration)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>{wordCount} words</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Transcript */}
        {currentTranscript && (
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200/50 dark:border-yellow-800/50 backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Live</span>
            </div>
            <p className="text-lg text-slate-900 dark:text-white leading-relaxed">
              {currentTranscript}
            </p>
          </div>
        )}

        {/* Transcripts */}
        <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Transcripts ({transcripts.length})
              </h2>

              {transcripts.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={downloadTranscripts}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <button
                    onClick={clearTranscripts}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {transcripts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Mic className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Start recording to see your transcripts appear here
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {transcripts.map((transcript, index) => (
                  <div key={index} className="group p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Turn {transcript.turn_order}
                      </span>
                      {transcript.end_of_turn_confidence && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {(transcript.end_of_turn_confidence * 100).toFixed(0)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900 dark:text-white leading-relaxed">
                      {transcript.transcript}
                    </p>

                    {transcript.words && transcript.words.length > 0 && (
                      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        {transcript.words.length} words •
                        {transcript.words.length > 0 ?
                          ((transcript.words[transcript.words.length - 1].end - transcript.words[0].start) / 1000).toFixed(1) + 's' :
                          'N/A'
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Powered by AssemblyAI • Ultra-fast streaming transcription</p>
        </div>
      </div>
    </div>
  );
}