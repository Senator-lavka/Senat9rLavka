create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price integer not null,
  stock integer not null default 0,
  image_urls text[] default array[]::text[],
  created_at timestamptz default now()
);

alter table products enable row level security;

drop policy if exists "Public read products" on products;
create policy "Public read products"
on products for select
using (true);

drop policy if exists "Public insert products" on products;
create policy "Public insert products"
on products for insert
with check (true);

drop policy if exists "Public update products" on products;
create policy "Public update products"
on products for update
using (true)
with check (true);

drop policy if exists "Public delete products" on products;
create policy "Public delete products"
on products for delete
using (true);

insert into products (name, description, price, stock, image_urls)
select 'Малиновое варенье 250 г', 'Домашнее варенье для первой проверки магазина.', 450, 7, array['https://images.unsplash.com/photo-1606971809537-6e041e400cbc?q=80&w=1200&auto=format&fit=crop']
where not exists (select 1 from products);
