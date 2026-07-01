create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price integer not null,
  stock integer not null default 0,
  reserved_qty integer not null default 0,
  image_urls text[] default array[]::text[],
  created_at timestamptz default now()
);

alter table products add column if not exists reserved_qty integer not null default 0;
alter table products add column if not exists image_urls text[] default array[]::text[];

alter table products enable row level security;

drop policy if exists "Public read products" on products;
create policy "Public read products"
on products for select
to anon
using (true);

drop policy if exists "Public insert products" on products;
create policy "Public insert products"
on products for insert
to anon
with check (true);

drop policy if exists "Public update products" on products;
create policy "Public update products"
on products for update
to anon
using (true)
with check (true);

drop policy if exists "Public delete products" on products;
create policy "Public delete products"
on products for delete
to anon
using (true);

-- Политики для загрузки фото в Storage bucket product-images
drop policy if exists "Public read product images" on storage.objects;
drop policy if exists "Public upload product images" on storage.objects;
drop policy if exists "Public update product images" on storage.objects;
drop policy if exists "Public delete product images" on storage.objects;

create policy "Public read product images"
on storage.objects for select
to anon
using (bucket_id = 'product-images');

create policy "Public upload product images"
on storage.objects for insert
to anon
with check (bucket_id = 'product-images');

create policy "Public update product images"
on storage.objects for update
to anon
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "Public delete product images"
on storage.objects for delete
to anon
using (bucket_id = 'product-images');
