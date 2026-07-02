import { getMiniAppUrl, htmlEscape, sendTelegramMessage } from './_telegram.js'

function formatItems(items = []) {
  return items.map(item => `• ${htmlEscape(item.name)} — ${Number(item.qty || 0)} шт. × ${Number(item.price || 0)} ₽ = ${Number(item.sum || 0)} ₽`).join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const body = req.body || {}
    const buyer = body.buyer || {}
    const items = body.items || []
    const total = Number(body.total || 0)
    const ownerUsername = body.owner_username || process.env.OWNER_USERNAME || process.env.VITE_OWNER_USERNAME || 'Senat9r'
    const adminId = process.env.ADMIN_TELEGRAM_ID
    const miniAppUrl = getMiniAppUrl(req)
    const reservedUntilText = body.reserved_until ? new Date(body.reserved_until).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) : ''
    const buyerDisplay = buyer.username || buyer.name || 'Покупатель из Telegram'
    const itemsText = formatItems(items)

    const buyerText = `✅ <b>Заказ создан</b>\n\nЗаказ ожидает подтверждения Сенатора.\nБронь действует 1 час${reservedUntilText ? `, до ${htmlEscape(reservedUntilText)} по Москве` : ''}.\n\nПожалуйста, напишите продавцу: @${htmlEscape(ownerUsername)}\n\n<b>Ваш заказ:</b>\n${itemsText}\n\n<b>Итого:</b> ${total} ₽`

    const adminText = `🛒 <b>Новый заказ</b>\n\n<b>Покупатель:</b> ${htmlEscape(buyerDisplay)}${buyer.telegram_id ? `\n<b>ID:</b> ${htmlEscape(buyer.telegram_id)}` : ''}\n\n<b>Товары:</b>\n${itemsText}\n\n<b>Итого:</b> ${total} ₽\n\nЗаказ ожидает подтверждения в админке.`

    const results = []
    if (buyer.telegram_id) {
      results.push(await sendTelegramMessage(buyer.telegram_id, buyerText, {
        reply_markup: { inline_keyboard: [[{ text: `Написать @${ownerUsername}`, url: `https://t.me/${ownerUsername}` }]] }
      }))
    }

    // Уведомление о новом заказе отправляется только на ADMIN_TELEGRAM_ID, не всем пользователям бота.
    if (adminId) {
      results.push(await sendTelegramMessage(adminId, adminText, {
        reply_markup: { inline_keyboard: [[{ text: 'Открыть админку', web_app: { url: miniAppUrl } }]] }
      }))
    }

    return res.status(200).json({ ok: true, results })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
