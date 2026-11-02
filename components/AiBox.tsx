'use client'

import { useState } from 'react'

export default function AiBox({ params, label }: { params: Record<string, string>; label: string }) {
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      setText(json.text ?? json.error ?? 'Something went wrong')
      setSource(json.source ?? '')
    } catch {
      setText('Could not reach the server.')
    }
    setLoading(false)
  }

  return (
    <div className="ai no-print">
      <button type="button" onClick={run} disabled={loading}>
        {loading ? 'Working…' : label}
      </button>
      {text && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ marginTop: 10 }} />
          <small>
            {source === 'ai'
              ? 'Written by AI. Please review before using.'
              : 'Built-in template (add ANTHROPIC_API_KEY to get AI-written text).'}
          </small>
        </>
      )}
    </div>
  )
}
