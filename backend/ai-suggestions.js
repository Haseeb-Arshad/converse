const OpenAI = require('openai');

// Lazy initialization of OpenAI client
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Generate intelligent next-word suggestions using GPT-4o-mini
 * @param {string} currentText - The current transcript text
 * @param {string[]} conversationHistory - Previous sentences for context
 * @returns {Promise<Array>} Array of suggestion objects
 */
async function generateAISuggestions(currentText, conversationHistory = []) {
  try {
    const openaiClient = getOpenAIClient();
    if (!openaiClient) {
      console.log('OpenAI client not available, using fallback suggestions');
      return generateFallbackSuggestions(currentText, conversationHistory);
    }

    const context = conversationHistory.slice(-5).join(' '); // Last 5 sentences for context
    const prompt = createSuggestionPrompt(currentText, context);

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an intelligent speech completion assistant. Your job is to predict the next 1-8 words that someone is likely to say based on their current speech and conversation context.

Rules:
1. Provide 3-5 different suggestions
2. Each suggestion should be 1-8 words maximum
3. Consider the conversation context and natural speech patterns
4. Make suggestions that sound natural and contextually appropriate
5. Include confidence scores (0.0-1.0)
6. Respond ONLY with valid JSON in this exact format:

{
  "suggestions": [
    {
      "text": "suggested words here",
      "confidence": 0.95,
      "reasoning": "brief explanation"
    }
  ]
}`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.3, // Lower temperature for more focused suggestions
      top_p: 0.9
    });

    const response = completion.choices[0].message.content;
    const parsed = JSON.parse(response);
    
    // Transform to our format
    return parsed.suggestions.map((suggestion, index) => ({
      id: `ai-${Date.now()}-${index}`,
      text: suggestion.text,
      confidence: suggestion.confidence,
      type: 'ai_completion',
      reasoning: suggestion.reasoning
    }));

  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    
    // Fallback to rule-based suggestions if OpenAI fails
    return generateFallbackSuggestions(currentText, conversationHistory);
  }
}

/**
 * Create a well-structured prompt for GPT-4o-mini
 */
function createSuggestionPrompt(currentText, context) {
  const lastWords = currentText.split(' ').slice(-3).join(' '); // Last 3 words
  
  return `Context from previous conversation:
"${context}"

Current incomplete sentence:
"${currentText}"

The person just said: "${lastWords}"

What are the most likely next 1-8 words they will say? Consider:
- Natural speech patterns
- Conversation context
- Common phrases and expressions
- The speaker's apparent intent

Provide 3-5 suggestions with confidence scores.`;
}

/**
 * Fallback suggestions when OpenAI is unavailable
 */
function generateFallbackSuggestions(currentText, conversationHistory) {
  const suggestions = [];
  const words = currentText.toLowerCase().split(' ');
  const lastWord = words[words.length - 1];
  const context = conversationHistory.join(' ').toLowerCase();

  // Common completion patterns
  const patterns = [
    {
      trigger: ['i am', 'my name is'],
      suggestions: ['working on', 'building', 'developing'],
      confidence: 0.85
    },
    {
      trigger: ['working on'],
      suggestions: ['a project', 'building this', 'developing'],
      confidence: 0.90
    },
    {
      trigger: ['building'],
      suggestions: ['this application', 'a system', 'something'],
      confidence: 0.88
    },
    {
      trigger: ['this is'],
      suggestions: ['a test', 'working well', 'amazing'],
      confidence: 0.82
    }
  ];

  // Find matching patterns
  for (const pattern of patterns) {
    for (const trigger of pattern.trigger) {
      if (currentText.toLowerCase().includes(trigger)) {
        pattern.suggestions.forEach((suggestion, index) => {
          suggestions.push({
            id: `fallback-${Date.now()}-${index}`,
            text: suggestion,
            confidence: pattern.confidence - (index * 0.05),
            type: 'fallback',
            reasoning: `Common continuation after "${trigger}"`
          });
        });
        break;
      }
    }
  }

  // Word completion suggestions
  if (lastWord && lastWord.length > 2) {
    const completions = getWordCompletions(lastWord);
    completions.forEach((completion, index) => {
      suggestions.push({
        id: `completion-${Date.now()}-${index}`,
        text: completion,
        confidence: 0.75 - (index * 0.1),
        type: 'completion',
        reasoning: `Word completion for "${lastWord}"`
      });
    });
  }

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

/**
 * Get word completions for partial words
 */
function getWordCompletions(partialWord) {
  const completions = {
    'build': ['building', 'built'],
    'work': ['working', 'worked'],
    'dev': ['developing', 'development'],
    'app': ['application', 'applications'],
    'sys': ['system', 'systems'],
    'thi': ['this', 'think', 'thing'],
    'rea': ['really', 'ready', 'real'],
    'goo': ['good', 'google'],
    'per': ['perfect', 'performance', 'person'],
    'pro': ['project', 'problem', 'process']
  };

  return completions[partialWord.toLowerCase()] || [];
}

/**
 * Generate suggestions optimized for real-time use
 */
async function generateRealTimeSuggestions(currentText, conversationHistory = []) {
  // For real-time, use faster fallback with some AI enhancement
  const fallbackSuggestions = generateFallbackSuggestions(currentText, conversationHistory);
  
  // If text is substantial enough, get AI suggestions asynchronously
  if (currentText.split(' ').length >= 3) {
    try {
      const aiSuggestions = await generateAISuggestions(currentText, conversationHistory);
      // Merge AI suggestions with fallback, prioritizing AI
      return [...aiSuggestions.slice(0, 3), ...fallbackSuggestions.slice(0, 2)];
    } catch (error) {
      console.error('Real-time AI suggestions failed:', error);
      return fallbackSuggestions;
    }
  }
  
  return fallbackSuggestions;
}

module.exports = {
  generateAISuggestions,
  generateRealTimeSuggestions,
  generateFallbackSuggestions
};