export type AiResult = { text: string; source: 'ai' | 'template' }

/**
 * Calls the Anthropic Messages API from the server. If no key is set (or the
 * call fails) the caller's plain-text fallback is returned so the app keeps working.
 */
export async function askAI(prompt: string, fallback: string): Promise<AiResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { text: fallback, source: 'template' }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
    const data = await res.json()
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim()
    if (!text) throw new Error('Empty AI response')
    return { text, source: 'ai' }
  } catch {
    return { text: fallback, source: 'template' }
  }
}
