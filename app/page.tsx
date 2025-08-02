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

interface AISuggestion {
  id: string;
  text: string;
  confidence: number;
  type: 'completion' | 'correction' | 'context' | 'next_word';
  reasoning: string;
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
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [conversationContext, setConversationContext] = useState<string[]>([]);

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

    const ws = new WebSocket('ws://localhost:8080');
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
            setConversationContext(prev => [...prev, data.transcript].slice(-10)); // Keep last 10 sentences
            setCurrentTranscript('');
            setWordCount(prev => prev + (data.words?.length || 0));
            
            // Generate AI suggestions based on context
            generateAISuggestions(data.transcript, conversationContext);
          } else {
            // Live transcript - ultra-fast updates
            setCurrentTranscript(data.transcript);
            
            // Generate real-time suggestions for incomplete sentences
            if (data.transcript.length > 3) {
              generateRealTimeSuggestions(data.transcript);
            }
          }
        }
        break;

      case 'Termination':
        setSessionInfo(null);
        setCurrentTranscript('');
        setAiSuggestions([]);
        break;
    }
  }, [conversationContext]);

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
    console.log('🛑 Stopping recording...');
    
    // First set recording to false to stop audio processing
    setIsRecording(false);
    setCurrentTranscript('');
    setAudioLevel(0);

    if (audioStreamRef.current) {
      // Stop all audio tracks immediately
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Stopped audio track:', track.kind);
      });

      // Clean up audio processing components
      const audioContext = (audioStreamRef.current as any).audioContext;
      const processor = (audioStreamRef.current as any).processor;
      const source = (audioStreamRef.current as any).source;
      const analyser = (audioStreamRef.current as any).analyser;

      // Disconnect all audio nodes
      if (processor) {
        try {
          processor.disconnect();
          processor.onaudioprocess = null; // Remove event handler
          console.log('🔌 Disconnected audio processor');
        } catch (error) {
          console.warn('Error disconnecting processor:', error);
        }
      }

      if (source) {
        try {
          source.disconnect();
          console.log('🔌 Disconnected audio source');
        } catch (error) {
          console.warn('Error disconnecting source:', error);
        }
      }

      if (analyser) {
        try {
          analyser.disconnect();
          console.log('🔌 Disconnected analyser');
        } catch (error) {
          console.warn('Error disconnecting analyser:', error);
        }
      }

      // Close audio context
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().then(() => {
          console.log('🔇 Closed audio context');
        }).catch((error: any) => {
          console.warn('Error closing audio context:', error);
        });
      }

      audioStreamRef.current = null;
    }

    // Send terminate message to server
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: 'terminate' }));
      console.log('📤 Sent terminate message to server');
    }

    console.log('✅ Recording stopped successfully');
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

  // Local fallback suggestions when OpenAI API is unavailable
  const generateLocalFallbackSuggestions = (text: string, context: string[]): AISuggestion[] => {
    const suggestions: AISuggestion[] = [];
    const words = text.toLowerCase().split(' ');
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // Enhanced patterns for full sentence suggestions
    const patterns = [
      {
        triggers: ['i am', 'my name is'],
        suggestions: [
          'working on a new project that involves advanced technology',
          'building something really exciting and innovative for users',
          'developing a solution that will help people communicate better',
          'currently focused on creating something meaningful and impactful'
        ],
        confidence: 0.85
      },
      {
        triggers: ['working on'],
        suggestions: [
          'a project that combines technology and creativity seamlessly',
          'building this application to solve real problems for users',
          'developing something that will make a significant difference',
          'creating a system that can help many people worldwide'
        ],
        confidence: 0.90
      },
      {
        triggers: ['building'],
        suggestions: [
          'this application to demonstrate the incredible power of AI',
          'a system that can understand and respond naturally to speech',
          'something that will revolutionize how we communicate with technology',
          'an innovative solution for real-time transcription and analysis'
        ],
        confidence: 0.88
      },
      {
        triggers: ['this is'],
        suggestions: [
          'working really well and I am excited about the results',
          'an amazing demonstration of what is possible with modern technology',
          'exactly what I was hoping to achieve with this project',
          'a perfect example of how AI can enhance human communication'
        ],
        confidence: 0.82
      },
      {
        triggers: ['hello', 'hi', 'hey'],
        suggestions: [
          'everyone, I am excited to show you what we have been working on',
          'there, I hope you are having a great day today',
          'and welcome to this demonstration of our new technology',
          'I wanted to share something really interesting with you all'
        ],
        confidence: 0.80
      },
      {
        triggers: ['today'],
        suggestions: [
          'I want to demonstrate how this AI transcription system works',
          'we are going to explore the capabilities of real-time speech processing',
          'I am excited to show you the future of voice technology',
          'let us see how well this system can understand natural speech'
        ],
        confidence: 0.83
      }
    ];

    // Find matching patterns
    let suggestionIndex = 0;
    for (const pattern of patterns) {
      for (const trigger of pattern.triggers) {
        if (text.toLowerCase().includes(trigger)) {
          pattern.suggestions.forEach((suggestion) => {
            suggestions.push({
              id: `fallback-${timestamp}-${randomSuffix}-${suggestionIndex++}`,
              text: suggestion,
              confidence: pattern.confidence - (suggestionIndex * 0.02),
              type: 'completion',
              reasoning: `Sentence completion after "${trigger}"`
            });
          });
          break;
        }
      }
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  };

  // AI Suggestion Functions using OpenAI GPT-4o-mini
  const generateAISuggestions = useCallback(async (currentText: string, context: string[]) => {
    try {
      console.log('🤖 Generating AI suggestions for:', currentText);
      
      const response = await fetch('http://localhost:8080/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentText,
          conversationHistory: context,
          realTime: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Received AI suggestions:', data.suggestions);
      
      // Ensure unique IDs for all suggestions
      const uniqueSuggestions = data.suggestions.map((suggestion: AISuggestion, index: number) => ({
        ...suggestion,
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${index}`
      }));
      
      setAiSuggestions(uniqueSuggestions);
    } catch (error) {
      console.error('❌ Error generating AI suggestions:', error);
      // Fallback to local suggestions if API fails
      const fallbackSuggestions = generateLocalFallbackSuggestions(currentText, context);
      setAiSuggestions(fallbackSuggestions);
    }
  }, []);

  const generateRealTimeSuggestions = useCallback(async (partialText: string) => {
    try {
      // Only generate suggestions for substantial text to avoid too many API calls
      if (partialText.split(' ').length < 3) {
        return;
      }

      // Throttle suggestions to avoid overwhelming the system
      const now = Date.now();
      if (now - (generateRealTimeSuggestions as any).lastCall < 3000) {
        return;
      }
      (generateRealTimeSuggestions as any).lastCall = now;

      console.log('⚡ Generating real-time suggestions for:', partialText);
      
      const response = await fetch('http://localhost:8080/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentText: partialText,
          conversationHistory: conversationContext,
          realTime: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('⚡ Received real-time suggestions:', data.suggestions);
      setAiSuggestions(data.suggestions);
    } catch (error) {
      console.error('❌ Error generating real-time suggestions:', error);
      // Fallback to local suggestions if API fails
      const fallbackSuggestions = generateLocalFallbackSuggestions(partialText, conversationContext);
      setAiSuggestions(fallbackSuggestions);
    }
  }, [conversationContext]);

  const analyzeContextAndGenerateSuggestions = async (text: string, context: string[]): Promise<AISuggestion[]> => {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const suggestions: AISuggestion[] = [];
    const words = text.toLowerCase().split(' ');
    const lastWord = words[words.length - 1];
    const contextText = context.join(' ').toLowerCase();

    // Context-based suggestions
    if (text.includes('building') || contextText.includes('building')) {
      suggestions.push({
        id: 'ctx-1',
        text: 'application',
        confidence: 0.92,
        type: 'context',
        reasoning: 'Based on context about building projects'
      });
      suggestions.push({
        id: 'ctx-2',
        text: 'system',
        confidence: 0.88,
        type: 'context',
        reasoning: 'Common follow-up in technical discussions'
      });
    }

    if (text.includes('working') || contextText.includes('working')) {
      suggestions.push({
        id: 'ctx-3',
        text: 'on',
        confidence: 0.95,
        type: 'next_word',
        reasoning: 'Most common word after "working"'
      });
      suggestions.push({
        id: 'ctx-4',
        text: 'with',
        confidence: 0.87,
        type: 'next_word',
        reasoning: 'Alternative continuation'
      });
    }

    // Name-based suggestions
    if (text.includes('I am') || text.includes('my name')) {
      suggestions.push({
        id: 'name-1',
        text: 'Asif',
        confidence: 0.96,
        type: 'completion',
        reasoning: 'Detected name introduction pattern'
      });
    }

    // Technical context suggestions
    if (contextText.includes('transcription') || contextText.includes('ai')) {
      suggestions.push({
        id: 'tech-1',
        text: 'real-time',
        confidence: 0.91,
        type: 'context',
        reasoning: 'Technical context about transcription'
      });
      suggestions.push({
        id: 'tech-2',
        text: 'processing',
        confidence: 0.85,
        type: 'context',
        reasoning: 'Related to AI/transcription workflow'
      });
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  };

  const generateCompletionSuggestions = async (partialText: string): Promise<AISuggestion[]> => {
    await new Promise(resolve => setTimeout(resolve, 50));

    const suggestions: AISuggestion[] = [];
    const words = partialText.toLowerCase().split(' ');
    const lastWord = words[words.length - 1];

    // Word completion suggestions
    if (lastWord.startsWith('build')) {
      suggestions.push({
        id: 'comp-1',
        text: 'building',
        confidence: 0.94,
        type: 'completion',
        reasoning: 'Word completion for "build"'
      });
    }

    if (lastWord.startsWith('work')) {
      suggestions.push({
        id: 'comp-2',
        text: 'working',
        confidence: 0.96,
        type: 'completion',
        reasoning: 'Word completion for "work"'
      });
    }

    if (lastWord.startsWith('thi')) {
      suggestions.push({
        id: 'comp-3',
        text: 'this',
        confidence: 0.98,
        type: 'completion',
        reasoning: 'Word completion for "thi"'
      });
    }

    // Common phrase completions
    if (partialText.endsWith('I am')) {
      suggestions.push({
        id: 'phrase-1',
        text: 'working on',
        confidence: 0.89,
        type: 'completion',
        reasoning: 'Common phrase completion'
      });
    }

    return suggestions.slice(0, 3);
  };

  const applySuggestion = (suggestion: AISuggestion) => {
    console.log('Applied suggestion:', suggestion.text);
    
    // Add the suggestion to the current transcript
    setCurrentTranscript(prev => {
      const trimmed = prev.trim();
      if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
        // If current transcript is complete, add as new sentence
        return `${trimmed} ${suggestion.text}`;
      } else {
        // If incomplete, complete the current sentence
        return `${trimmed} ${suggestion.text}`;
      }
    });
    
    // Clear suggestions after applying one
    setAiSuggestions([]);
    
    // Add to conversation context
    setConversationContext(prev => [...prev, suggestion.text].slice(-10));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30">
      {/* Apple-inspired Header */}
      <div className="sticky top-0 z-50 backdrop-blur-2xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/30 dark:border-gray-700/30">
        <div className="max-w-5xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                  Converse
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  AI-Powered Real-time Transcription
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Connection Status */}
              <div className="flex items-center space-x-3 px-4 py-2 rounded-full bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div className={`w-2.5 h-2.5 rounded-full ${connectionStatus.connected ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'}`}></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-3 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-200 hover:scale-105"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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
            
            {/* AI Suggestions Toggle */}
            <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">AI Suggestions</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Show contextual word and phrase suggestions powered by AI
                  </p>
                </div>
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showSuggestions ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showSuggestions ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
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
              className={`relative w-28 h-28 rounded-full transition-all duration-500 transform hover:scale-110 active:scale-95 ${isRecording
                  ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 shadow-2xl shadow-red-500/40'
                  : 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 shadow-2xl shadow-blue-500/40'
                } ${!connectionStatus.connected ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-3xl'} backdrop-blur-sm border border-white/20`}
            >
              {isRecording ? (
                <MicOff className="w-9 h-9 text-white mx-auto drop-shadow-lg" />
              ) : (
                <Mic className="w-9 h-9 text-white mx-auto drop-shadow-lg" />
              )}

              {/* Audio Level Indicator */}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-3 border-white/40 animate-pulse"
                  style={{
                    transform: `scale(${1 + audioLevel * 0.4})`,
                    opacity: 0.8 + audioLevel * 0.2
                  }}>
                </div>
              )}
            </button>

            {/* Pulse Animation */}
            {isRecording && (
              <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></div>
            )}
          </div>

          <p className="mt-6 text-gray-600 dark:text-gray-400 font-medium">
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

        {/* Live Transcript with AI Suggestions */}
        {currentTranscript && (
          <div className="mb-8 relative">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200/50 dark:border-yellow-800/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Live Transcription</span>
                </div>
                {showSuggestions && aiSuggestions.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">AI Suggestions</span>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <p className="text-lg text-slate-900 dark:text-white leading-relaxed">
                  {currentTranscript}
                  {isRecording && (
                    <span className="inline-block w-0.5 h-5 bg-blue-500 ml-1 animate-pulse"></span>
                  )}
                </p>
                
        {/* AI Suggestions - Clean Bottom Popup like the image */}
        {showSuggestions && aiSuggestions.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/20 backdrop-blur-sm">
            <div className="w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl animate-slide-up">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-700/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">CREATIVE SUGGESTIONS</h3>
                  <button
                    onClick={() => setAiSuggestions([])}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              {/* Suggestions List */}
              <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
                {aiSuggestions.map((suggestion, index) => {
                  const uniqueKey = `${suggestion.id || 'suggestion'}-${index}-${suggestion.text.slice(0, 10)}`;
                  return (
                    <button
                      key={uniqueKey}
                      onClick={() => applySuggestion(suggestion)}
                      className="w-full text-left p-4 rounded-2xl bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 hover:border-gray-600/50 transition-all duration-200 group"
                    >
                      <div className="mb-2">
                        <h4 className="text-white font-medium text-base leading-relaxed">
                          {suggestion.text}
                        </h4>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Click to use
                      </p>
                    </button>
                  );
                })}
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-700/50">
                <button
                  onClick={() => setAiSuggestions([])}
                  className="w-full text-center text-gray-400 hover:text-white transition-colors font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
              </div>
            </div>
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