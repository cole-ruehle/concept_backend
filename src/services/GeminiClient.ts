/**
 * Gemini API Client
 * Handles LLM orchestration for route planning
 */

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiClient {
  private apiKey: string;
  private model: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey: string, model = "gemini-1.5-pro") {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Generate content using Gemini API
   */
  async generateContent(
    prompt: string,
    systemInstruction?: string,
    temperature = 0.2
  ): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const messages: GeminiMessage[] = [];

    // Add system instruction as first user message if provided
    if (systemInstruction) {
      messages.push({
        role: "user",
        parts: [{ text: systemInstruction }],
      });
      messages.push({
        role: "model",
        parts: [{ text: "Understood. I will follow these instructions." }],
      });
    }

    // Add the actual prompt
    messages.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const request: GeminiRequest = {
      contents: messages,
      generationConfig: {
        temperature,
        maxOutputTokens: 8192,
        topP: 0.95,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: GeminiResponse = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini API");
    }

    const text = data.candidates[0].content.parts[0].text;
    return text;
  }

  /**
   * Generate structured JSON response
   */
  async generateJSON<T>(
    prompt: string,
    systemInstruction?: string,
    temperature = 0.2
  ): Promise<T> {
    const fullPrompt = `${prompt}\n\nYou must respond with ONLY valid JSON, no markdown, no explanation.`;
    const response = await this.generateContent(fullPrompt, systemInstruction, temperature);

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = response.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.error("Failed to parse JSON from Gemini:", jsonText);
      throw new Error(`Invalid JSON response from Gemini: ${error}`);
    }
  }

  /**
   * Chat with multiple messages
   */
  async chat(messages: GeminiMessage[], temperature = 0.7): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const request: GeminiRequest = {
      contents: messages,
      generationConfig: {
        temperature,
        maxOutputTokens: 8192,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: GeminiResponse = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini API");
    }

    return data.candidates[0].content.parts[0].text;
  }
}

