import api from './auth.js'

// R3 #12 — AI Assistant
export const getAssistantStatus = () => api.get('/assistant/status')
export const getAssistantSummary = () => api.get('/assistant/summary')
export const getAssistantConversation = (id) => api.get(`/assistant/conversations/${id}`)

// Streamed chat (Server-Sent Events over a POST). axios can't read a stream, so this
// uses fetch. onEvent receives {type: 'conversation'|'text'|'tool'|'done'|'error', ...}.
export async function streamAssistantChat(payload, onEvent, signal) {
  const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try { detail = (await res.json()).detail || detail } catch { /* not JSON */ }
    onEvent({ type: 'error', message: detail })
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (line) {
        try { onEvent(JSON.parse(line.slice(6))) } catch { /* ignore malformed event */ }
      }
    }
  }
}
