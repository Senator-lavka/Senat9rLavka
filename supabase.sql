create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price integer not null,
  stock integer not null default 0,
  reserved_qty integer not null default 0,
  image_url text,
  image_urls text[] default array[]::text[],
  created_at timestamptz default now()
);

alter table products add column if not exists reserved_qty integer not null default 0;
alter table products add column if not exists image_urls text[] default array[]::text[];

alter table products enable row level security;

drop policy if exists "Public read products" on products;
drop policy if exists "Public insert products" on products;
drop policy if exists "Public update products" on products;
drop policy if exists "Public delete products" on products;

create policy "Public read products" on products for select to anon using (true);
create policy "Public insert products" on products for insert to anon with check (true);
create policy "Public update products" on products for update to anon using (true) with check (true);
create policy "Public delete products" on products for delete to anon using (true);

drop policy if exists "Public read product images" on storage.objects;
drop policy if exists "Public upload product images" on storage.objects;
drop policy if exists "Public update product images" on storage.objects;
drop policy if exists "Public delete product images" on storage.objects;

create policy "Public read product images" on storage.objects for select to anon using (bucket_id = 'product-images');
create policy "Public upload product images" on storage.objects for insert to anon with check (bucket_id = 'product-images');
create policy "Public update product images" on storage.objects for update to anon using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
create policy "Public delete product images" on storage.objects for delete to anon using (bucket_id = 'product-images');

create table if not exists product_suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  comment text default '',
  contact text default '',
  is_new boolean not null default true,
  created_at timestamptz default now()
);

alter table product_suggestions enable row level security;

drop policy if exists "Public read product suggestions" on product_suggestions;
drop policy if exists "Public insert product suggestions" on product_suggestions;
drop policy if exists "Public update product suggestions" on product_suggestions;
drop policy if exists "Public delete product suggestions" on product_suggestions;

create policy "Public read product suggestions" on product_suggestions for select to anon using (true);
create policy "Public insert product suggestions" on product_suggestions for insert to anon with check (true);
create policy "Public update product suggestions" on product_suggestions for update to anon using (true) with check (true);
create policy "Public delete product suggestions" on product_suggestions for delete to anon using (true);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]'::jsonb,
  total integer not null default 0,
  status text not null default 'pending',
  reserved_until timestamptz,
  buyer_name text default '',
  buyer_username text default '',
  buyer_telegram_id text default '',
  created_at timestamptz default now()
);

alter table orders add column if not exists items jsonb not null default '[]'::jsonb;
alter table orders add column if not exists total integer not null default 0;
alter table orders add column if not exists status text not null default 'pending';
alter table orders add column if not exists reserved_until timestamptz;
alter table orders add column if not exists buyer_name text default '';
alter table orders add column if not exists buyer_username text default '';
alter table orders add column if not exists buyer_telegram_id text default '';

alter table orders enable row level security;

drop policy if exists "Public read orders" on orders;
drop policy if exists "Public insert orders" on orders;
drop policy if exists "Public update orders" on orders;
drop policy if exists "Public delete orders" on orders;

create policy "Public read orders" on orders for select to anon using (true);
create policy "Public insert orders" on orders for insert to anon with check (true);
create policy "Public update orders" on orders for update to anon using (true) with check (true);
create policy "Public delete orders" on orders for delete to anon using (true);

create table if not exists product_waits (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  product_name text not null default '',
  buyer_name text default '',
  buyer_username text default '',
  buyer_telegram_id text default '',
  is_new boolean not null default true,
  created_at timestamptz default now()
);

alter table product_waits add column if not exists product_id uuid references products(id) on delete cascade;
alter table product_waits add column if not exists product_name text not null default '';
alter table product_waits add column if not exists buyer_name text default '';
alter table product_waits add column if not exists buyer_username text default '';
alter table product_waits add column if not exists buyer_telegram_id text default '';
alter table product_waits add column if not exists is_new boolean not null default true;
alter table product_waits add column if not exists created_at timestamptz default now();

alter table product_waits enable row level security;

drop policy if exists "Public read product waits" on product_waits;
drop policy if exists "Public insert product waits" on product_waits;
drop policy if exists "Public update product waits" on product_waits;
drop policy if exists "Public delete product waits" on product_waits;

create policy "Public read product waits" on product_waits for select to anon using (true);
create policy "Public insert product waits" on product_waits for insert to anon with check (true);
create policy "Public update product waits" on product_waits for update to anon using (true) with check (true);
create policy "Public delete product waits" on product_waits for delete to anon using (true);
