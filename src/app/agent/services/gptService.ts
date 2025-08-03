"use client";
import { GPTResponse } from '../types/agent.types';

const GPT_API_URL = 'https://api.openai.com/v1/chat/completions';

export class GPTService {
  private static instance: GPTService;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
  }

  public static getInstance(): GPTService {
    if (!GPTService.instance) {
      GPTService.instance = new GPTService();
    }
    return GPTService.instance;
  }

  private getSystemPrompt(): string {
    return `You are a DCA (Dollar Cost Averaging) Agent for a WETH to WMON swap platform. 

Your job is to understand user intents and extract structured data from their messages.

Available actions:
- start_dca: User wants to start automatic investments
- stop_dca: User wants to stop their current DCA
- view_history: User wants to see their investment history
- modify_dca: User wants to change their current DCA settings
- unclear: User message is unclear or unrelated

For start_dca, extract:
- amount: WETH amount (e.g., "0.01", "0.1")
- intervalMinutes: ALWAYS set to 1 (testing mode - 1-minute intervals)

IMPORTANT: Always use intervalMinutes: 1 for testing. This will be changed to 5 minutes in production.

Respond ONLY with valid JSON in this format:
{
  "intent": "start_dca|stop_dca|view_history|modify_dca|unclear",
  "amount": "0.01",
  "intervalMinutes": 1,
  "confidence": 0.95,
  "message": "I'll help you set up automatic investment of 0.01 WETH every 1 minute (testing mode)."
}

Be conversational in your message field but keep it concise.`;
  }

  public async parseUserIntent(userMessage: string): Promise<GPTResponse> {
    if (!this.apiKey) {
      console.warn('OpenAI API key not configured, using fallback parsing');
      return this.fallbackParsing(userMessage);
    }

    try {
      const response = await fetch(GPT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`GPT API error: ${response.status}`);
      }

      const data = await response.json();
      const gptResponse = data.choices[0]?.message?.content;

      if (!gptResponse) {
        throw new Error('Empty response from GPT');
      }

      // Parse JSON response
      const parsedResponse: GPTResponse = JSON.parse(gptResponse);
      
      // Validate response structure
      if (!parsedResponse.intent || !parsedResponse.confidence) {
        throw new Error('Invalid GPT response structure');
      }

      return parsedResponse;

    } catch (error) {
      console.error('Error calling GPT API:', error);
      return this.fallbackParsing(userMessage);
    }
  }

  private fallbackParsing(userMessage: string): GPTResponse {
    const message = userMessage.toLowerCase().trim();
    
    // Check for start DCA intent
    if (message.includes('invest') || message.includes('dca') || message.includes('start')) {
      const amountMatch = message.match(/(\d+\.?\d*)\s*(weth|eth)/);
      const amount = amountMatch ? amountMatch[1] : '0.01';
      
      // ALWAYS use 1 minute interval for testing
      const intervalMinutes = 1;

      return {
        intent: 'start_dca',
        amount,
        intervalMinutes,
        confidence: 0.8,
        message: `I'll help you set up automatic investment of ${amount} WETH every 1 minute (testing mode). You'll sign once for this amount, and I'll execute the swaps automatically.`
      };
    }
    
    // Check for stop DCA intent
    if (message.includes('stop') || message.includes('cancel') || message.includes('pause')) {
      return {
        intent: 'stop_dca',
        confidence: 0.9,
        message: "I'll help you stop your current DCA investment."
      };
    }
    
    // Check for history intent
    if (message.includes('history') || message.includes('show') || message.includes('view')) {
      return {
        intent: 'view_history',
        confidence: 0.9,
        message: "Let me show you your investment history."
      };
    }
    
    // Check for modify intent
    if (message.includes('change') || message.includes('modify') || message.includes('update')) {
      return {
        intent: 'modify_dca',
        confidence: 0.7,
        message: "I can help you modify your current DCA settings. What would you like to change?"
      };
    }
    
    // Default unclear response
    return {
      intent: 'unclear',
      confidence: 0.5,
      message: "I'm not sure what you'd like to do. You can:\n• Start DCA: 'Invest 0.01 WETH every 5 minutes'\n• View history: 'Show my history'\n• Stop DCA: 'Stop my investment'"
    };
  }

  // Generate response message based on intent and context
  public generateResponseMessage(intent: GPTResponse, hasActiveInvestment: boolean): string {
    switch (intent.intent) {
      case 'start_dca':
        if (hasActiveInvestment) {
          return `You already have an active DCA investment. Would you like to stop the current one and start a new investment of ${intent.amount} WETH every ${this.formatInterval(intent.intervalMinutes || 5)}?`;
        }
        return intent.message || `I'll set up automatic investment of ${intent.amount} WETH every ${this.formatInterval(intent.intervalMinutes || 1)}.`;
      
      case 'stop_dca':
        if (!hasActiveInvestment) {
          return "You don't have any active DCA investments to stop.";
        }
        return intent.message || "I'll stop your current DCA investment.";
      
      case 'view_history':
        return intent.message || "Here's your investment history:";
      
      case 'modify_dca':
        if (!hasActiveInvestment) {
          return "You don't have any active DCA investments to modify. Would you like to start a new one?";
        }
        return intent.message || "What would you like to change about your current DCA investment?";
      
      default:
        return intent.message || "I'm here to help with your WETH → WMON DCA investments. What would you like to do?";
    }
  }

  private formatInterval(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    } else if (minutes === 60) {
      return '1 hour';
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    } else if (minutes === 1440) {
      return 'day';
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} day${days === 1 ? '' : 's'}`;
    }
  }
}