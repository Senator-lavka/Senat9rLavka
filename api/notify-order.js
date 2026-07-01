export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const token = process.env.BOT_TOKEN
    if (!token) return res.status(200).json({ ok: false, skipped: true, error: 'BOT_TOKEN is not set' })

    const { chatId, text } = req.body || {}
    if (!chatId || !text) return res.status(400).json({ ok: false, error: 'chatId and text are required' })

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    })

    const data = await tgRes.json()
    return res.status(tgRes.ok ? 200 : 200).json(data)
  } catch (error) {
    return res.status(200).json({ ok: false, error: error.message })
  }
}
