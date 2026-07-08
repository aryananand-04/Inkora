// AI word generation via Groq (OpenAI-compatible chat completions API).
// Optional: enabled only when GROQ_API_KEY is set — callers must handle
// aiEnabled() === false gracefully.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export function aiEnabled(): boolean {
  return !!process.env.GROQ_API_KEY
}

export async function generateWords(theme: string, count = 20): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('AI word generation is not configured')

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      temperature: 0.9,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You generate words for a Pictionary-style drawing game. '
            + 'Reply ONLY with a JSON array of lowercase strings. '
            + 'Each word must be a concrete, drawable noun or short phrase (max 3 words), '
            + 'family-friendly, and 2-30 characters long.',
        },
        {
          role: 'user',
          content: `Generate ${count} drawable words for the theme: "${theme}"`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status})`)
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content ?? ''

  // The model replies with a JSON array, possibly wrapped in a code fence
  const match = content.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('AI returned an unexpected format')

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    throw new Error('AI returned invalid JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('AI returned an unexpected format')

  const words = parsed
    .filter((w): w is string => typeof w === 'string')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 2 && w.length <= 30 && /^[a-z0-9' -]+$/.test(w))

  if (words.length === 0) throw new Error('AI returned no usable words')
  return [...new Set(words)].slice(0, count)
}
