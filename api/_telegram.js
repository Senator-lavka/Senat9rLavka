export async function sendTelegramMessage(chatId, text, extra = {}) {
  const token = process.env.BOT_TOKEN
  if (!token) {
    return { ok: false, error: 'BOT_TOKEN is not set' }
  }
  if (!chatId) {
    return { ok: false, error: 'chatId is empty' }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra
    })
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    return { ok: false, error: data.description || response.statusText, data }
  }
  return { ok: true, data }
}

export function getMiniAppUrl(req) {
  if (process.env.MINI_APP_URL) return process.env.MINI_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const host = req?.headers?.host
  return host ? `https://${host}` : ''
}

export function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
