import Anthropic from "@anthropic-ai/sdk";

export interface ExplanationProvider {
  generate(prompt: string): Promise<string>;
}

export function createClaudeProvider(apiKey: string): ExplanationProvider {
  const client = new Anthropic({ apiKey });

  return {
    async generate(prompt: string): Promise<string> {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude response contained no text block");
      }
      return textBlock.text;
    },
  };
}

export function createOllamaProvider(baseUrl: string, model: string): ExplanationProvider {
  return {
    async generate(prompt: string): Promise<string> {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: "json",
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    },
  };
}

export function createProvider(): ExplanationProvider {
  const providerType = process.env.CADUWARD_EXPLAIN_PROVIDER ?? "claude";

  if (providerType === "ollama") {
    const baseUrl = process.env.CADUWARD_OLLAMA_BASE_URL ?? "http://localhost:11434";
    const model = process.env.CADUWARD_OLLAMA_MODEL ?? "llama3.2";
    return createOllamaProvider(baseUrl, model);
  }

  const apiKey = process.env.CADUWARD_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CADUWARD_ANTHROPIC_API_KEY is required when CADUWARD_EXPLAIN_PROVIDER is 'claude'",
    );
  }
  return createClaudeProvider(apiKey);
}
