export interface AISuggestion {
  id: string;
  text: string;
  confidence: number;
  type: 'completion' | 'correction' | 'context' | 'next_word' | 'ai_completion' | 'fallback';
  reasoning: string;
}

export interface TranscriptionData {
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

export interface ConnectionStatus {
  connected: boolean;
  message: string;
}