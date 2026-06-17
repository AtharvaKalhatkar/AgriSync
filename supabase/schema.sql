-- EXTENSIONS
create extension if not exists pg_trgm;

-- CUSTOMERS
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text,                      -- not unique-constrained: same household sometimes shares a number
  address text,
  udhari_balance numeric(12,2) not null default 0,  -- denormalized, kept in sync via trigger below
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_name on customers using gin (name gin_trgm_ops); -- fuzzy search
create index idx_customers_mobile on customers (mobile);

-- MEDICINES (products)
create table medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,                    -- pesticide / fungicide / herbicide / fertilizer / seed / other
  unit text not null,               -- litre / kg / packet / bottle
  rate numeric(10,2) not null,      -- current selling price
  purchase_price numeric(10,2),     -- cost price, optional, for margin tracking
  stock_qty numeric(10,2),          -- optional, see Phase 2 in §8
  net_weight text,
  expiry_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_medicines_name on medicines using gin (name gin_trgm_ops);

-- BILLS
create table bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,         -- e.g. AGS-20260617-001, generated client-side at creation
  customer_id uuid not null references customers(id),
  bill_date date not null default current_date,
  total_amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  due_amount numeric(12,2) not null default 0,   -- total_amount - paid_amount, kept consistent in app logic
  payment_status text not null default 'unpaid', -- 'paid' | 'partial' | 'unpaid'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bills_date on bills (bill_date);
create index idx_bills_customer on bills (customer_id);
create index idx_bills_status on bills (payment_status);

-- BILL ITEMS
create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  medicine_id uuid references medicines(id),
  medicine_name_snapshot text not null,   -- frozen at sale time — never let a future rate edit alter old bills
  rate_at_sale numeric(10,2) not null,
  quantity numeric(10,2) not null,
  item_total numeric(12,2) not null
);
create index idx_bill_items_bill on bill_items (bill_id);

-- PAYMENTS (every money-in event: at-sale payment AND later udhari settlement)
create table payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  bill_id uuid references bills(id),      -- nullable: a pure udhari-settlement payment has no specific bill
  amount numeric(12,2) not null,
  mode text not null,                     -- 'cash' | 'online' | 'udhari_settlement'
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index idx_payments_customer on payments (customer_id);
create index idx_payments_date on payments (payment_date);

-- SUPPLIERS
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text,
  balance_due numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PURCHASES (INWARD)
create table purchases (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  supplier_id uuid not null references suppliers(id),
  purchase_date date not null default current_date,
  total_amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  due_amount numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  medicine_id uuid references medicines(id),
  medicine_name_snapshot text not null,
  purchase_rate numeric(10,2) not null,
  quantity numeric(10,2) not null,
  item_total numeric(12,2) not null
);

-- TRIGGERS
create or replace function recalc_customer_balance() returns trigger as $$
begin
  update customers
  set udhari_balance = (
    select coalesce(sum(due_amount), 0) from bills
    where customer_id = coalesce(new.customer_id, old.customer_id)
      and payment_status != 'paid'
  ),
  updated_at = now()
  where id = coalesce(new.customer_id, old.customer_id);
  return new;
end;
$$ language plpgsql;

create trigger trg_bill_balance after insert or update on bills
  for each row execute function recalc_customer_balance();
create trigger trg_payment_balance after insert on payments
  for each row execute function recalc_customer_balance();
