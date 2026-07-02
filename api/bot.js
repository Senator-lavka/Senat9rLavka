import { getMiniAppUrl, sendTelegramMessage } from './_telegram.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Telegram bot webhook is alive' })
  }

  try {
    const update = req.body || {}
    const message = update.message || update.edited_message
    if (!message?.chat?.id) return res.status(200).json({ ok: true })

    const chatId = message.chat.id
    const text = message.text || ''
    const miniAppUrl = getMiniAppUrl(req)

    if (text.startsWith('/start')) {
      await sendTelegramMessage(chatId, '👋 Добро пожаловать в <b>Лавку Сенатора</b>!\n\nСамые дешевые цены в галактике.', {
        reply_markup: {
          inline_keyboard: [[
            { text: '🛒 Открыть лавку', web_app: { url: miniAppUrl } }
          ]]
        }
      })
    } else {
      await sendTelegramMessage(chatId, '🛒 Лавка Сенатора работает через кнопку ниже.', {
        reply_markup: {
          inline_keyboard: [[
            { text: 'Открыть лавку', web_app: { url: miniAppUrl } }
          ]]
        }
      })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error(error)
    return res.status(200).json({ ok: false, error: error.message })
  }
}
