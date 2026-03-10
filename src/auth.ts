import * as p from "@clack/prompts";

export async function getApiKey(): Promise<string> {
  let apiKey = process.env.COVAL_API_KEY;

  if (!apiKey) {
    const result = await p.password({
      message: "Enter your Coval API key",
      validate: (v) => {
        if (!v) return "API key is required";
      },
    });
    if (p.isCancel(result)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    apiKey = result;
  }

  return apiKey;
}

export async function verifyApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.coval.dev/v1/agents", {
      headers: { "x-api-key": apiKey },
    });
    // 200 = valid key, 401/403 = invalid
    return res.ok;
  } catch {
    return false;
  }
}
