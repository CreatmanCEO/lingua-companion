const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const cache: Record<string, string> = {};

export async function translateText(text: string, to: "ru" | "en" = "ru"): Promise<string> {
  const key = `${text}:${to}`;
  if (cache[key]) return cache[key];

  try {
    const resp = await fetch(`${API_URL}/api/v1/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, to }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    cache[key] = data.translated;
    return data.translated;
  } catch (err) {
    console.error("Translation failed:", err);
    return text; // fallback: return original
  }
}
