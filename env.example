import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, hasSupabaseConfig, bucketName } from './supabaseClient'
import './styles.css'

const OWNER_USERNAME = import.meta.env.VITE_OWNER_USERNAME || 'Senat9r'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''

function money(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0)) + ' ₽'
}

function App() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(location.pathname.includes('/admin') ? 'admin' : 'shop')

  async function loadProducts() {
    setLoading(true)
    if (!hasSupabaseConfig) {
      setProducts([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) console.error(error)
    setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [])

  function addToCart(product) {
    if (product.stock <= 0) return
    setCart(prev => {
      const current = prev[product.id] || 0
      if (current >= product.stock) return prev
      return { ...prev, [product.id]: current + 1 }
    })
  }

  function changeQty(productId, delta) {
    const product = products.find(p => p.id === productId)
    setCart(prev => {
      const next = Math.max(0, (prev[productId] || 0) + delta)
      if (product && next > product.stock) return prev
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

  function order() {
    if (!cartItems.length) return
    const list = cartItems.map(item => `• ${item.name} — ${item.qty} шт. × ${item.price} ₽ = ${item.qty * item.price} ₽`).join('\n')
    const text = `Достопочтенный Сенатор!\n\nХочу оформить заказ.\n\n${list}\n\nИтоговая стоимость: ${total} ₽`
    window.open(`https://t.me/${OWNER_USERNAME}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="kicker">Telegram Mini App</p>
          <h1>Лавка Сенатора</h1>
          <p>Ничего не спизжено.</p>
        </div>
        <button className="admin-link" onClick={() => setPage(page === 'shop' ? 'admin' : 'shop')}>
          {page === 'shop' ? 'Админка' : 'Магазин'}
        </button>
      </header>

      {!hasSupabaseConfig && <div className="notice">Не подключён Supabase. Добавь переменные окружения в Vercel.</div>}

      {page === 'shop' ? (
        <Shop products={products} loading={loading} cart={cart} addToCart={addToCart} changeQty={changeQty} cartItems={cartItems} total={total} order={order} />
      ) : (
        <Admin products={products} reload={loadProducts} />
      )}
    </div>
  )
}

function Shop({ products, loading, cart, addToCart, changeQty, cartItems, total, order }) {
  return (
    <>
      <main className="grid">
        {loading && <p>Загружаем товары...</p>}
        {!loading && products.length === 0 && <p>Пока нет товаров. Добавь первый товар в админке.</p>}
        {products.map(product => (
          <ProductCard key={product.id} product={product} qty={cart[product.id] || 0} addToCart={addToCart} changeQty={changeQty} />
        ))}
      </main>
      <Cart cartItems={cartItems} total={total} changeQty={changeQty} order={order} />
    </>
  )
}

function ProductCard({ product, qty, addToCart, changeQty }) {
  const images = product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : []
  const [photo, setPhoto] = useState(0)
  const available = product.stock > 0
  const currentImage = images[photo] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop'
  return (
    <article className="card">
      <div className="photo-wrap">
        <img src={currentImage} alt={product.name} />
        <span className={available ? 'badge ok' : 'badge no'}>{available ? 'В наличии' : 'Нет в наличии'}</span>
      </div>
      {images.length > 1 && <div className="dots">{images.map((_, i) => <button key={i} className={i === photo ? 'dot active' : 'dot'} onClick={() => setPhoto(i)} />)}</div>}
      <div className="card-body">
        <h2>{product.name}</h2>
        {product.description && <p>{product.description}</p>}
        <div className="meta"><span>{money(product.price)}</span><span>Остаток: {product.stock}</span></div>
        {qty ? (
          <div className="qty"><button onClick={() => changeQty(product.id, -1)}>-</button><strong>{qty}</strong><button onClick={() => changeQty(product.id, 1)}>+</button></div>
        ) : (
          <button className="primary" disabled={!available} onClick={() => addToCart(product)}>{available ? 'В корзину' : 'Закончилось'}</button>
        )}
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
    </aside>
  )
}

function Admin({ products, reload }) {
  const [authed, setAuthed] = useState(sessionStorage.getItem('lavka_admin') === '1')
  const [password, setPassword] = useState('')
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '' })
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)

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

  async function removeProduct(id) {
    if (!confirm('Удалить товар?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert(error.message)
    await reload()
  }

  if (!authed) return <form className="admin panel" onSubmit={login}><h2>Вход в админку</h2><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" /><button className="primary">Войти</button></form>

  return (
    <section className="admin">
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
        {products.map(p => <div className="admin-row" key={p.id}><span>{p.name} — {money(p.price)} — остаток {p.stock}</span><button onClick={() => removeProduct(p.id)}>Удалить</button></div>)}
      </div>
    </section>
  )
}

createRoot(document.getElementById('root')).render(<App />)
