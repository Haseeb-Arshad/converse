'use client';

import { AISuggestion } from '../types';

interface SuggestionsPopupProps {
  suggestions: AISuggestion[];
  onApply: (suggestion: AISuggestion) => void;
  onDismiss: () => void;
  show: boolean;
}

export default function SuggestionsPopup({ suggestions, onApply, onDismiss, show }: SuggestionsPopupProps) {
  if (!show || suggestions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">CREATIVE SUGGESTIONS</h3>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Suggestions List */}
        <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
          {suggestions.map((suggestion, index) => {
            const uniqueKey = `suggestion-${index}-${suggestion.text.slice(0, 20).replace(/\s+/g, '-')}`;
            return (
              <button
                key={uniqueKey}
                onClick={() => onApply(suggestion)}
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
            onClick={onDismiss}
            className="w-full text-center text-gray-400 hover:text-white transition-colors font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}