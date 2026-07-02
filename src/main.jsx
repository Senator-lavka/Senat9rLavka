import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, hasSupabaseConfig, bucketName } from './supabaseClient'
import './styles.css'

const OWNER_USERNAME = import.meta.env.VITE_OWNER_USERNAME || 'Senat9r'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''
const RESERVE_MINUTES = 60

function money(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0)) + ' ₽'
}

function normalizeProduct(product) {
  return {
    ...product,
    reserved_qty: Number(product.reserved_qty || 0),
    stock: Number(product.stock || 0),
    price: Number(product.price || 0),
    image_urls: product.image_urls || []
  }
}

function availableQty(product) {
  return Math.max(0, Number(product.stock || 0) - Number(product.reserved_qty || 0))
}

function getBuyerInfo() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user
  if (!user) return { name: 'Покупатель из Telegram', username: '', telegram_id: '' }
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return {
    name: fullName || user.username || 'Покупатель из Telegram',
    username: user.username ? '@' + user.username : '',
    telegram_id: user.id ? String(user.id) : ''
  }
}

function statusLabel(status) {
  const labels = {
    pending: 'Ожидает подтверждения',
    confirmed: 'Подтверждён',
    completed: 'Выдан / оплачен',
    cancelled: 'Отменён',
    expired: 'Бронь истекла'
  }
  return labels[status] || status
}

function App() {
  const [products, setProducts] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [waits, setWaits] = useState([])
  const [orders, setOrders] = useState([])
  const [cart, setCart] = useState({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(location.pathname.includes('/admin') ? 'admin' : 'shop')

  async function expireOldOrders() {
    if (!hasSupabaseConfig) return
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .lt('reserved_until', nowIso)

    if (error) {
      console.error(error)
      return
    }

    for (const order of data || []) {
      const { error: statusError } = await supabase
        .from('orders')
        .update({ status: 'expired' })
        .eq('id', order.id)
        .eq('status', 'pending')

      if (statusError) {
        console.error(statusError)
        continue
      }

      for (const item of order.items || []) {
        const product = products.find(p => p.id === item.product_id)
        let reservedNow = Number(product?.reserved_qty || 0)

        if (!product) {
          const { data: fresh } = await supabase.from('products').select('reserved_qty').eq('id', item.product_id).single()
          reservedNow = Number(fresh?.reserved_qty || 0)
        }

        await supabase
          .from('products')
          .update({ reserved_qty: Math.max(0, reservedNow - Number(item.qty || 0)) })
          .eq('id', item.product_id)
      }
    }
  }

  async function loadProducts() {
    setLoading(true)
    if (!hasSupabaseConfig) {
      setProducts([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) console.error(error)
    setProducts((data || []).map(normalizeProduct))
    setLoading(false)
  }

  async function loadSuggestions() {
    if (!hasSupabaseConfig) {
      setSuggestions([])
      return
    }
    const { data, error } = await supabase.from('product_suggestions').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      return
    }
    setSuggestions(data || [])
  }


  async function loadWaits() {
    if (!hasSupabaseConfig) {
      setWaits([])
      return
    }
    const { data, error } = await supabase
      .from('product_waits')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      return
    }
    setWaits(data || [])
  }

  async function loadOrders() {
    if (!hasSupabaseConfig) {
      setOrders([])
      return
    }
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      return
    }
    setOrders(data || [])
  }

  async function refreshAll() {
    await expireOldOrders()
    await loadProducts()
    await loadSuggestions()
    await loadWaits()
    await loadOrders()
  }

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  function addToCart(product) {
    const available = availableQty(product)
    if (available <= 0) return
    setCart(prev => {
      const current = prev[product.id] || 0
      if (current >= available) return prev
      return { ...prev, [product.id]: current + 1 }
    })
  }

  function changeQty(productId, delta) {
    const product = products.find(p => p.id === productId)
    setCart(prev => {
      const next = Math.max(0, (prev[productId] || 0) + delta)
      if (product && next > availableQty(product)) return prev
      const updated = { ...prev, [productId]: next }
      if (next === 0) delete updated[productId]
      return updated
    })
  }

  const cartItems = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const product = products.find(p => p.id === id)
      return product ? { ...product, qty } : null
    }).filter(Boolean)
  }, [cart, products])

  const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0)

  async function order() {
    if (!cartItems.length) return
    try {
      const reservedUntil = new Date(Date.now() + RESERVE_MINUTES * 60 * 1000).toISOString()
      const buyer = getBuyerInfo()
      const orderItems = cartItems.map(item => ({
        product_id: item.id,
        name: item.name,
        qty: Number(item.qty),
        price: Number(item.price),
        sum: Number(item.price) * Number(item.qty)
      }))

      for (const item of cartItems) {
        const { data: freshProduct, error: freshError } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.id)
          .single()

        if (freshError) throw freshError
        const fresh = normalizeProduct(freshProduct)
        if (!fresh || item.qty > availableQty(fresh)) {
          alert(`Товар «${item.name}» уже недоступен в таком количестве`)
          await refreshAll()
          return
        }

        const { error } = await supabase
          .from('products')
          .update({ reserved_qty: Number(fresh.reserved_qty || 0) + Number(item.qty || 0) })
          .eq('id', item.id)
        if (error) throw error
      }

      const { data: createdOrder, error: orderError } = await supabase.from('orders').insert({
        items: orderItems,
        total,
        status: 'pending',
        reserved_until: reservedUntil,
        buyer_name: buyer.name,
        buyer_username: buyer.username,
        buyer_telegram_id: buyer.telegram_id
      }).select('*').single()
      if (orderError) throw orderError

      const list = cartItems.map(item => `• ${item.name} — ${item.qty} шт. × ${item.price} ₽ = ${item.qty * item.price} ₽`).join('\n')
      const text = `Достопочтенный Сенатор!\n\nХочу оформить заказ.\n\n${list}\n\nИтоговая стоимость: ${total} ₽\n\nЗаказ ожидает подтверждения Сенатора. Бронь действует ${RESERVE_MINUTES} минут.`

      fetch('/api/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: createdOrder?.id,
          buyer,
          items: orderItems,
          total,
          reserved_until: reservedUntil,
          owner_username: OWNER_USERNAME,
          message_text: text
        })
      }).catch(console.error)

      setCart({})
      await refreshAll()
      alert(`Заказ ожидает подтверждения Сенатора. Бронь действует ${RESERVE_MINUTES} минут. Бот отправит сообщение, но на всякий случай напиши @${OWNER_USERNAME} в личные сообщения.`)
      window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/${OWNER_USERNAME}`)
    } catch (err) {
      alert('Ошибка брони: ' + err.message)
      await refreshAll()
    }
  }

  async function submitSuggestion(payload) {
    if (!hasSupabaseConfig) {
      alert('Supabase не подключён')
      return
    }
    const { error } = await supabase.from('product_suggestions').insert(payload)
    if (error) throw error
    await loadSuggestions()
  }


  async function waitForProduct(product) {
    if (!hasSupabaseConfig) {
      alert('Supabase не подключён')
      return
    }
    const buyer = getBuyerInfo()
    const { error } = await supabase.from('product_waits').insert({
      product_id: product.id,
      product_name: product.name,
      buyer_name: buyer.name,
      buyer_username: buyer.username,
      buyer_telegram_id: buyer.telegram_id,
      is_new: true
    })
    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }
    await loadWaits()
    alert('Отмечено. Сенатор увидит, что вы ждёте этот товар.')
  }

  const waitCounts = useMemo(() => {
    const map = {}
    for (const item of waits) {
      map[item.product_id] = (map[item.product_id] || 0) + 1
    }
    return map
  }, [waits])

  const newSuggestionsCount = suggestions.filter(s => s.is_new).length

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="kicker">Telegram Mini App</p>
          <h1>Лавка Сенатора</h1>
          <p>Самые дешевые цены в галактике!</p>
        </div>
        <div className="hero-actions">
          {page === 'shop' && <SuggestionWidget onSubmit={submitSuggestion} />}
          <button className="admin-link" onClick={() => setPage(page === 'shop' ? 'admin' : 'shop')}>
            {page === 'shop' ? 'Админка' : 'Магазин'}
          </button>
        </div>
      </header>

      {!hasSupabaseConfig && <div className="notice">Не подключён Supabase. Добавь переменные окружения в Vercel.</div>}

      {page === 'shop' ? (
        <Shop products={products} loading={loading} cart={cart} addToCart={addToCart} changeQty={changeQty} cartItems={cartItems} total={total} order={order} waitForProduct={waitForProduct} waitCounts={waitCounts} />
      ) : (
        <Admin products={products} reload={refreshAll} suggestions={suggestions} reloadSuggestions={loadSuggestions} newSuggestionsCount={newSuggestionsCount} waits={waits} reloadWaits={loadWaits} orders={orders} reloadOrders={refreshAll} />
      )}
    </div>
  )
}

function Shop({ products, loading, cart, addToCart, changeQty, cartItems, total, order, waitForProduct, waitCounts }) {
  return (
    <>
      <main className="grid">
        {loading && <p>Загружаем товары...</p>}
        {!loading && products.length === 0 && <p>Пока нет товаров. Добавь первый товар в админке.</p>}
        {products.map(product => (
          <ProductCard key={product.id} product={product} qty={cart[product.id] || 0} addToCart={addToCart} changeQty={changeQty} waitForProduct={waitForProduct} waitCount={waitCounts[product.id] || 0} />
        ))}
      </main>
      <Cart cartItems={cartItems} total={total} changeQty={changeQty} order={order} />
    </>
  )
}

function SuggestionWidget({ onSubmit }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), comment: comment.trim(), contact: contact.trim(), is_new: true })
      setName('')
      setComment('')
      setContact('')
      setOpen(false)
      alert('Предложение отправлено. Ваше предложение не гарантирует наличие товара в будущем.')
    } catch (err) {
      alert('Ошибка: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="suggestion-button" onClick={() => setOpen(true)}>Предложить товар</button>
      {open && <div className="modal-backdrop" onClick={() => setOpen(false)}>
        <form className="suggestion-modal" onSubmit={submit} onClick={e => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button>
          <h2>Предложить товар</h2>
          <p className="warning">Ваше предложение не гарантирует наличие товара в будущем.</p>
          <input required placeholder="Что добавить? Например: сыр, варенье, малина" value={name} onChange={e => setName(e.target.value)} />
          <textarea placeholder="Комментарий: вес, бренд, вкус, примерная цена" value={comment} onChange={e => setComment(e.target.value)} />
          <input placeholder="Контакт для уточнения, если нужно" value={contact} onChange={e => setContact(e.target.value)} />
          <button className="primary" disabled={busy}>{busy ? 'Отправляю...' : 'Отправить предложение'}</button>
        </form>
      </div>}
    </>
  )
}

function ProductCard({ product, qty, addToCart, changeQty, waitForProduct, waitCount }) {
  const images = product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : []
  const [photo, setPhoto] = useState(0)
  const [touchStart, setTouchStart] = useState(null)
  const available = availableQty(product)
  const booked = product.stock > 0 && available <= 0 && Number(product.reserved_qty || 0) > 0
  const outOfStock = Number(product.stock || 0) <= 0
  const currentImage = images[photo] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop'

  function nextPhoto() {
    if (images.length <= 1) return
    setPhoto(prev => (prev + 1) % images.length)
  }

  function prevPhoto() {
    if (images.length <= 1) return
    setPhoto(prev => (prev - 1 + images.length) % images.length)
  }

  function handleTouchEnd(e) {
    if (touchStart === null) return
    const endX = e.changedTouches?.[0]?.clientX
    const delta = endX - touchStart
    setTouchStart(null)
    if (Math.abs(delta) < 45) return
    if (delta < 0) nextPhoto()
    else prevPhoto()
  }

  return (
    <article className="card">
      <div
        className="photo-wrap swipeable"
        onTouchStart={e => setTouchStart(e.touches?.[0]?.clientX ?? null)}
        onTouchEnd={handleTouchEnd}
      >
        <img src={currentImage} alt={product.name} draggable="false" />
        <span className={booked ? 'badge booked' : available > 0 ? 'badge ok' : 'badge no'}>{booked ? 'Забронировано' : available > 0 ? 'В наличии' : 'Нет в наличии'}</span>
        {images.length > 1 && <>
          <button className="photo-nav photo-prev" onClick={prevPhoto} type="button">‹</button>
          <button className="photo-nav photo-next" onClick={nextPhoto} type="button">›</button>
        </>}
      </div>
      {images.length > 1 && <div className="dots">{images.map((_, i) => <button key={i} className={i === photo ? 'dot active' : 'dot'} onClick={() => setPhoto(i)} />)}</div>}
      <div className="card-body">
        <h2>{product.name}</h2>
        {product.description && <p>{product.description}</p>}
        <div className="meta"><span>{money(product.price)}</span><span>{booked ? 'Бронь' : `Остаток: ${available}`}</span></div>
        {qty ? (
          <div className="qty"><button onClick={() => changeQty(product.id, -1)}>-</button><strong>{qty}</strong><button onClick={() => changeQty(product.id, 1)}>+</button></div>
        ) : available > 0 ? (
          <button className="primary" onClick={() => addToCart(product)}>В корзину</button>
        ) : outOfStock ? (
          <button className="wait-button" onClick={() => waitForProduct(product)}><span>＋</span> Жду этот товар</button>
        ) : (
          <button className="primary" disabled>{booked ? 'Забронировано' : 'Закончилось'}</button>
        )}
        {waitCount > 0 && <div className="wait-count">Ждут: {waitCount}</div>}
      </div>
    </article>
  )
}

function Cart({ cartItems, total, changeQty, order }) {
  return (
    <aside className="cart">
      <h2>Корзина</h2>
      {cartItems.length === 0 ? <p>Пока пусто.</p> : cartItems.map(item => (
        <div className="cart-row" key={item.id}>
          <span>{item.name}</span>
          <div><button onClick={() => changeQty(item.id, -1)}>-</button> {item.qty} <button onClick={() => changeQty(item.id, 1)}>+</button></div>
        </div>
      ))}
      <div className="total">Итого: {money(total)}</div>
      <button className="order" disabled={!cartItems.length} onClick={order}>Оформить заказ</button>
      <p className="cart-note">После оформления товары бронируются на 1 час.</p>
    </aside>
  )
}

function Admin({ products, reload, suggestions, reloadSuggestions, newSuggestionsCount, waits, reloadWaits, orders, reloadOrders }) {
  const [authed, setAuthed] = useState(sessionStorage.getItem('lavka_admin') === '1')
  const [password, setPassword] = useState('')
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '' })
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', stock: '' })
  const [editFiles, setEditFiles] = useState([])
  const [editImageUrls, setEditImageUrls] = useState([])
  const [adminTab, setAdminTab] = useState('products')
  const editingProduct = products.find(p => p.id === editingId)
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length
  const newWaitsCount = waits.filter(w => w.is_new).length
  const waitCounts = waits.reduce((map, item) => { map[item.product_id] = (map[item.product_id] || 0) + 1; return map }, {})
  const earnedTotal = orders.filter(o => o.status === 'completed').reduce((sum, order) => sum + Number(order.total || 0), 0)

  function login(e) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('lavka_admin', '1')
      setAuthed(true)
    } else alert('Неверный пароль')
  }

  async function uploadImages(selectedFiles) {
    const urls = []
    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from(bucketName).upload(path, file, { upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from(bucketName).getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  async function addProduct(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const image_urls = await uploadImages(files)
      const { error } = await supabase.from('products').insert({
        name: form.name,
        description: form.description,
        price: Number(form.price),
        stock: Number(form.stock),
        reserved_qty: 0,
        image_urls
      })
      if (error) throw error
      setForm({ name: '', description: '', price: '', stock: '' })
      setFiles([])
      await reload()
      alert('Товар добавлен')
    } catch (err) {
      alert('Ошибка: ' + err.message)
    } finally { setBusy(false) }
  }

  function startEdit(product) {
    setEditingId(product.id)
    setEditForm({
      name: product.name || '',
      description: product.description || '',
      price: String(product.price || ''),
      stock: String(product.stock || '')
    })
    setEditFiles([])
    setEditImageUrls(product.image_urls || [])
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editingProduct) return
    setBusy(true)
    try {
      const newUrls = await uploadImages(editFiles)
      const image_urls = [...editImageUrls, ...newUrls]
      const { error } = await supabase.from('products').update({
        name: editForm.name,
        description: editForm.description,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        image_urls
      }).eq('id', editingProduct.id)
      if (error) throw error
      setEditingId(null)
      setEditFiles([])
      setEditImageUrls([])
      await reload()
      alert('Товар изменён')
    } catch (err) {
      alert('Ошибка: ' + err.message)
    } finally { setBusy(false) }
  }

  function removeEditPhoto(index) {
    setEditImageUrls(prev => prev.filter((_, i) => i !== index))
  }

  async function removeProduct(id) {
    if (!confirm('Удалить товар?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert(error.message)
    await reload()
  }

  async function clearReserve(id) {
    const { error } = await supabase.from('products').update({ reserved_qty: 0 }).eq('id', id)
    if (error) alert(error.message)
    await reload()
  }


  async function markWaitRead(id) {
    const { error } = await supabase.from('product_waits').update({ is_new: false }).eq('id', id)
    if (error) alert(error.message)
    await reloadWaits()
  }

  async function deleteWait(id) {
    if (!confirm('Удалить отметку ожидания?')) return
    const { error } = await supabase.from('product_waits').delete().eq('id', id)
    if (error) alert(error.message)
    await reloadWaits()
  }

  async function markSuggestionRead(id) {
    const { error } = await supabase.from('product_suggestions').update({ is_new: false }).eq('id', id)
    if (error) alert(error.message)
    await reloadSuggestions()
  }

  async function deleteSuggestion(id) {
    if (!confirm('Удалить предложение?')) return
    const { error } = await supabase.from('product_suggestions').delete().eq('id', id)
    if (error) alert(error.message)
    await reloadSuggestions()
  }

  async function releaseOrderReserve(order) {
    for (const item of order.items || []) {
      const product = products.find(p => p.id === item.product_id)
      let reservedNow = Number(product?.reserved_qty || 0)
      if (!product) {
        const { data: fresh } = await supabase.from('products').select('reserved_qty').eq('id', item.product_id).single()
        reservedNow = Number(fresh?.reserved_qty || 0)
      }
      await supabase
        .from('products')
        .update({ reserved_qty: Math.max(0, reservedNow - Number(item.qty || 0)) })
        .eq('id', item.product_id)
    }
  }


  async function completeOrderAndWriteOffStock(order) {
    for (const item of order.items || []) {
      const { data: fresh, error: freshError } = await supabase
        .from('products')
        .select('stock,reserved_qty')
        .eq('id', item.product_id)
        .single()
      if (freshError) {
        console.error(freshError)
        continue
      }
      const qty = Number(item.qty || 0)
      await supabase
        .from('products')
        .update({
          stock: Math.max(0, Number(fresh?.stock || 0) - qty),
          reserved_qty: Math.max(0, Number(fresh?.reserved_qty || 0) - qty)
        })
        .eq('id', item.product_id)
    }
  }

  async function setOrderStatus(order, status) {
    if (status === 'completed' && !confirm('Отметить заказ как выданный/оплаченный? Эта сумма попадёт в заработок.')) return
    if (status === 'cancelled' && !confirm('Отменить заказ и снять бронь?')) return

    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    if (error) {
      alert(error.message)
      return
    }

    if (status === 'completed') {
      await completeOrderAndWriteOffStock(order)
    }

    if (status === 'cancelled') {
      await releaseOrderReserve(order)
    }

    fetch('/api/send-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: order.id,
        buyer_telegram_id: order.buyer_telegram_id,
        status,
        total: order.total,
        items: order.items || []
      })
    }).catch(console.error)

    await reloadOrders()
  }

  if (!authed) return <form className="admin panel" onSubmit={login}><h2>Вход в админку</h2><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" /><button className="primary">Войти</button></form>

  return (
    <section className="admin">
      <div className="admin-tabs">
        <button className={adminTab === 'products' ? 'tab active' : 'tab'} onClick={() => setAdminTab('products')}>Товары</button>
        <button className={adminTab === 'orders' ? 'tab active' : 'tab'} onClick={() => setAdminTab('orders')}>Заказы <span className="tab-count">{pendingOrdersCount}</span></button>
        <button className={adminTab === 'suggestions' ? 'tab active' : 'tab'} onClick={() => setAdminTab('suggestions')}>Предложения <span className="tab-count">{newSuggestionsCount}</span></button>
        <button className={adminTab === 'waits' ? 'tab active' : 'tab'} onClick={() => setAdminTab('waits')}>Ждут товар <span className="tab-count">{newWaitsCount}</span></button>
      </div>

      {adminTab === 'products' && <>
        <form className="panel" onSubmit={addProduct}>
          <h2>Добавить товар</h2>
          <input required placeholder="Название, например: Сыр Гауда 300 г" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <textarea placeholder="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input required type="number" placeholder="Цена" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <input required type="number" placeholder="Остаток" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          <input type="file" multiple accept="image/*" onChange={e => setFiles([...e.target.files])} />
          <button className="primary" disabled={busy}>{busy ? 'Сохраняю...' : 'Добавить'}</button>
        </form>

        <div className="panel">
          <h2>Товары</h2>
          {products.map(p => {
            const available = availableQty(p)
            const booked = p.stock > 0 && available <= 0 && Number(p.reserved_qty || 0) > 0
            return <div className="admin-row" key={p.id}>
              <div>
                <strong>{p.name}</strong><br />
                <small>{money(p.price)} · всего {p.stock} · бронь {p.reserved_qty || 0} · доступно {available} · ждут {waitCounts[p.id] || 0}</small>
                {(waitCounts[p.id] || 0) > 0 && <div className="admin-waiting">Ждут этот товар: {waitCounts[p.id]}</div>}
                {booked && <div className="admin-booked">Забронировано</div>}
              </div>
              <div className="admin-actions">
                <button onClick={() => startEdit(p)}>Редактировать</button>
                <button onClick={() => clearReserve(p.id)}>Убрать бронь</button>
                <button onClick={() => removeProduct(p.id)}>Удалить</button>
              </div>
            </div>
          })}
        </div>

        {editingProduct && <form className="panel edit-panel" onSubmit={saveEdit}>
          <h2>Редактировать товар</h2>
          <input required placeholder="Название" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          <textarea placeholder="Описание" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
          <input required type="number" placeholder="Цена" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
          <input required type="number" placeholder="Остаток" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} />
          <label className="field-label">Добавить новые фото</label>
          <input type="file" multiple accept="image/*" onChange={e => setEditFiles([...e.target.files])} />
          {!!editImageUrls?.length && <div className="thumbs">{editImageUrls.map((url, index) => <div className="thumb" key={url + index}><img src={url} alt="Фото товара" /><button type="button" onClick={() => removeEditPhoto(index)}>×</button></div>)}</div>}
          <button className="primary" disabled={busy}>{busy ? 'Сохраняю...' : 'Сохранить изменения'}</button>
          <button type="button" className="secondary" onClick={() => setEditingId(null)}>Отмена</button>
        </form>}
      </>}

      {adminTab === 'orders' && <OrdersPanel orders={orders} earnedTotal={earnedTotal} setOrderStatus={setOrderStatus} />}

      {adminTab === 'suggestions' && <div className="panel suggestions-panel">
        <h2>Предложения товаров <span className="title-count">{newSuggestionsCount}</span></h2>
        {!suggestions.length && <p>Пока предложений нет.</p>}
        {suggestions.map(item => <div className={item.is_new ? 'suggestion-row new' : 'suggestion-row'} key={item.id}>
          <div>
            <strong>{item.name}</strong> {item.is_new && <span className="new-badge">новое</span>}
            {item.comment && <p>{item.comment}</p>}
            {item.contact && <small>Контакт: {item.contact}</small>}
            <small>{new Date(item.created_at).toLocaleString('ru-RU')}</small>
          </div>
          <div className="admin-actions">
            {item.is_new && <button onClick={() => markSuggestionRead(item.id)}>Прочитано</button>}
            <button onClick={() => deleteSuggestion(item.id)}>Удалить</button>
          </div>
        </div>)}
      </div>}


      {adminTab === 'waits' && <div className="panel suggestions-panel">
        <h2>Ждут товар <span className="title-count">{newWaitsCount}</span></h2>
        {!waits.length && <p>Пока никто ничего не ждёт.</p>}
        {waits.map(item => <div className={item.is_new ? 'suggestion-row new' : 'suggestion-row'} key={item.id}>
          <div>
            <strong>{item.product_name}</strong> {item.is_new && <span className="new-badge">новое</span>}
            <p>Покупатель: {item.buyer_name || 'неизвестно'} {item.buyer_username || ''}</p>
            {item.buyer_telegram_id && <small>ID: {item.buyer_telegram_id}</small>}
            <small>{new Date(item.created_at).toLocaleString('ru-RU')}</small>
          </div>
          <div className="admin-actions">
            {item.is_new && <button onClick={() => markWaitRead(item.id)}>Прочитано</button>}
            <button onClick={() => deleteWait(item.id)}>Удалить</button>
          </div>
        </div>)}
      </div>}
    </section>
  )
}

function OrdersPanel({ orders, earnedTotal, setOrderStatus }) {
  return <div className="panel orders-panel">
    <div className="stats-card">
      <span>Всего заработано</span>
      <strong>{money(earnedTotal)}</strong>
      <small>Считаются заказы со статусом «Выдан / оплачен».</small>
    </div>
    <h2>Заказы</h2>
    {!orders.length && <p>Пока заказов нет.</p>}
    {orders.map(order => {
      const pending = order.status === 'pending'
      const reserveTime = order.reserved_until ? new Date(order.reserved_until).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
      return <div className={`order-card status-${order.status}`} key={order.id}>
        <div className="order-head">
          <div>
            <strong>{statusLabel(order.status)}</strong>
            <small>{new Date(order.created_at).toLocaleString('ru-RU')}</small>
          </div>
          <strong className="order-total">{money(order.total)}</strong>
        </div>
        <div className="buyer">
          Покупатель: {order.buyer_name || 'неизвестно'} {order.buyer_username || ''}
          {order.buyer_telegram_id && <small>ID: {order.buyer_telegram_id}</small>}
        </div>
        {pending && <div className="reserve-timer">Бронь до {reserveTime}</div>}
        <ul className="order-items">
          {(order.items || []).map((item, index) => <li key={index}>{item.name} — {item.qty} шт. × {item.price} ₽ = {item.sum} ₽</li>)}
        </ul>
        <div className="admin-actions order-actions">
          {order.status === 'pending' && <button onClick={() => setOrderStatus(order, 'confirmed')}>Подтвердить</button>}
          {(order.status === 'pending' || order.status === 'confirmed') && <button onClick={() => setOrderStatus(order, 'completed')}>Выдан / оплачен</button>}
          {(order.status === 'pending' || order.status === 'confirmed') && <button onClick={() => setOrderStatus(order, 'cancelled')}>Отменить</button>}
        </div>
      </div>
    })}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
