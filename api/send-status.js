import { htmlEscape, sendTelegramMessage } from './_telegram.js'

const LABELS = {
  confirmed: '✅ Заказ подтверждён. Ожидайте сообщения Сенатора.',
  completed: '🎉 Заказ выдан / оплачен. Спасибо за покупку!',
  cancelled: '❌ Заказ отменён.',
  expired: '⌛ Время брони истекло. Заказ больше не удерживает товар.'
}

function formatItems(items = []) {
  return items.map(item => `• ${htmlEscape(item.name)} — ${Number(item.qty || 0)} шт.`).join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const body = req.body || {}
    const chatId = body.buyer_telegram_id
    const status = body.status
    const text = LABELS[status]
    if (!chatId || !text) return res.status(200).json({ ok: true, skipped: true })

    const itemsText = formatItems(body.items || [])
    const fullText = `${text}${itemsText ? `\n\n<b>Товары:</b>\n${itemsText}` : ''}`
    const result = await sendTelegramMessage(chatId, fullText)
    return res.status(200).json({ ok: true, result })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
