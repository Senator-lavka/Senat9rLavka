# Лавка Сенатора

Полноценный React/Vite проект для Telegram Mini App магазина.

## Что есть
- Фермерский дизайн
- Несколько фото на товар
- В наличии / Нет в наличии
- Корзина
- Заказ в личку @Senat9r
- Админка
- Supabase для товаров и фотографий

## Supabase
1. SQL Editor → вставить содержимое `supabase.sql` → Run.
2. Storage → New bucket → `product-images` → Public bucket.

## Vercel Environment Variables
Добавь:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OWNER_USERNAME` = `Senat9r`
- `VITE_ADMIN_PASSWORD` = твой пароль

## Админка
Открой сайт и нажми «Админка» или зайди на `/admin`.


## Fix 3
- Карточки товара уже, фото ниже: не растягиваются на всю страницу.
- Корзина остаётся отдельным блоком ниже товаров.


## fix6
Фото товара сделано крупнее внутри компактной карточки: cover-кроп вместо contain.
