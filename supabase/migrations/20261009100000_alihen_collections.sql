-- Aplicar una sola vez en ALIHEN. No modifica tablas existentes de otras aplicaciones.
begin;

create table public.alihen_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.alihen_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  filename text not null check (length(filename) between 1 and 255),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','processing','needs_review','reviewed','error')),
  result jsonb,
  error_code text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, sha256),
  unique (owner_id, id),
  check (storage_path = owner_id::text || '/' || id::text || '.pdf')
);

create table public.alihen_invoices (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null check (id > 0),
  number text not null check (length(btrim(number)) between 1 and 100),
  issuer_id text not null,
  client_id bigint not null,
  issue_date date,
  due_date date,
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  total numeric(14,2) not null check (total >= 0),
  opening_paid numeric(14,2) not null default 0 check (opening_paid >= 0),
  cancelled boolean not null default false,
  document_id uuid,
  data jsonb not null,
  primary key (owner_id, id),
  foreign key (owner_id, document_id) references public.alihen_documents(owner_id,id),
  check (due_date is null or issue_date is null or due_date >= issue_date),
  check (opening_paid <= total)
);
create unique index alihen_invoice_number on public.alihen_invoices(owner_id, issuer_id, upper(btrim(number)));
create unique index alihen_invoice_document on public.alihen_invoices(owner_id, document_id) where document_id is not null;

create table public.alihen_payments (
  id uuid primary key,
  owner_id uuid not null,
  invoice_id bigint not null,
  paid_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  note text not null default '' check (length(note) <= 500),
  foreign key (owner_id, invoice_id) references public.alihen_invoices(owner_id,id) on delete cascade
);
create index alihen_due_date on public.alihen_invoices(owner_id, due_date) where not cancelled;

alter table public.alihen_workspaces enable row level security;
alter table public.alihen_documents enable row level security;
alter table public.alihen_invoices enable row level security;
alter table public.alihen_payments enable row level security;
create policy alihen_workspace_read on public.alihen_workspaces for select to authenticated using (owner_id = (select auth.uid()));
create policy alihen_invoice_read on public.alihen_invoices for select to authenticated using (owner_id = (select auth.uid()));
create policy alihen_payment_read on public.alihen_payments for select to authenticated using (owner_id = (select auth.uid()));
create policy alihen_document_read on public.alihen_documents for select to authenticated using (owner_id = (select auth.uid()));
create policy alihen_document_insert on public.alihen_documents for insert to authenticated with check (
  owner_id = (select auth.uid()) and state = 'pending' and result is null and error_code is null
  and exists (select 1 from storage.objects o where o.bucket_id = 'alihen-invoices' and o.name = storage_path)
);
-- Los cambios de estado/resultados solo los realiza la función de servidor.
revoke all on public.alihen_workspaces, public.alihen_invoices, public.alihen_payments, public.alihen_documents from anon, authenticated;
grant select on public.alihen_workspaces, public.alihen_invoices, public.alihen_payments, public.alihen_documents to authenticated;
grant insert on public.alihen_documents to authenticated;
grant all on public.alihen_workspaces, public.alihen_invoices, public.alihen_payments, public.alihen_documents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alihen-invoices','alihen-invoices',false,10485760,array['application/pdf']);
create policy alihen_pdf_read on storage.objects for select to authenticated using (
  bucket_id = 'alihen-invoices' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy alihen_pdf_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'alihen-invoices' and (storage.foldername(name))[1] = (select auth.uid())::text
);
-- Solo permite limpiar subidas que no llegaron a registrarse como documentos.
create policy alihen_pdf_delete_orphan on storage.objects for delete to authenticated using (
  bucket_id = 'alihen-invoices' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.alihen_documents d where d.owner_id = (select auth.uid()) and d.storage_path = name)
);

create function public.alihen_load_account() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('revision', w.revision, 'snapshot',
    w.data || jsonb_build_object('invoices', coalesce((
      select jsonb_agg(i.data order by i.id desc) from public.alihen_invoices i where i.owner_id = auth.uid()
    ), '[]'::jsonb)))
  from public.alihen_workspaces w where w.owner_id = auth.uid();
$$;

create function public.alihen_save_account(snapshot jsonb, expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  current_revision bigint;
  inv jsonb;
  pay jsonb;
  payment_sum numeric;
  inv_id bigint;
  retained_ids bigint[] := array[]::bigint[];
  document_hash text;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(snapshot->'invoices') is distinct from 'array' or jsonb_typeof(snapshot->'clients') is distinct from 'array'
    or jsonb_typeof(snapshot->'invoiceIssuers') is distinct from 'array' or jsonb_typeof(snapshot->'quotes') is distinct from 'array'
    or jsonb_array_length(snapshot->'invoices') > 10000 or octet_length(snapshot::text) > 15000000
    then raise exception 'Invalid account snapshot'; end if;
  -- Serializa la primera importación y las actualizaciones de una misma cuenta.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id::text, 0));
  select revision into current_revision from public.alihen_workspaces where owner_id = account_id for update;
  if current_revision is distinct from expected_revision then raise exception 'ALIHEN_CONFLICT'; end if;
  if current_revision is null then
    insert into public.alihen_workspaces(owner_id) values(account_id);
    current_revision := 0;
  end if;
  for inv in select value from jsonb_array_elements(snapshot->'invoices') loop
    inv_id := (inv->>'id')::bigint;
    if inv_id = any(retained_ids) then raise exception 'Duplicate invoice id'; end if;
    retained_ids := array_append(retained_ids, inv_id);
    if not exists (select 1 from jsonb_array_elements(snapshot->'clients') c where (c->>'id')::bigint = (inv->>'clientId')::bigint)
      or not exists (select 1 from jsonb_array_elements(snapshot->'invoiceIssuers') e where e->>'id' = inv->>'issuerId')
      then raise exception 'Missing client or issuer'; end if;
    if inv->>'documentId' is not null then
      select sha256 into document_hash from public.alihen_documents
        where owner_id = account_id and id = (inv->>'documentId')::uuid;
      if document_hash is null or document_hash is distinct from inv->>'documentHash' then raise exception 'Invalid document'; end if;
    end if;
    if jsonb_typeof(inv->'payments') is distinct from 'array' then raise exception 'Missing payment list'; end if;
    if (inv->>'amount')::numeric <> round((inv->>'amount')::numeric,2)
      or coalesce((inv->>'openingPaid')::numeric,0) <> round(coalesce((inv->>'openingPaid')::numeric,0),2)
      then raise exception 'Money amounts must use cents'; end if;
    select coalesce(sum((p->>'amount')::numeric),0) into payment_sum from jsonb_array_elements(inv->'payments') p;
    if payment_sum + coalesce((inv->>'openingPaid')::numeric,0) > (inv->>'amount')::numeric then raise exception 'Payments exceed total'; end if;
    if coalesce((inv->>'cancelled')::boolean,false) and payment_sum + coalesce((inv->>'openingPaid')::numeric,0) > 0 then raise exception 'Paid invoice cannot be cancelled'; end if;
    insert into public.alihen_invoices(owner_id,id,number,issuer_id,client_id,issue_date,due_date,currency,total,opening_paid,cancelled,document_id,data)
      values(account_id,inv_id,inv->>'number',inv->>'issuerId',(inv->>'clientId')::bigint,
        nullif(inv->>'issueDate','')::date,nullif(inv->>'dueDate','')::date,coalesce(inv->>'currency','EUR'),
        (inv->>'amount')::numeric,coalesce((inv->>'openingPaid')::numeric,0),coalesce((inv->>'cancelled')::boolean,false),
        (inv->>'documentId')::uuid,inv)
      on conflict(owner_id,id) do update set number=excluded.number,issuer_id=excluded.issuer_id,client_id=excluded.client_id,
        issue_date=excluded.issue_date,due_date=excluded.due_date,currency=excluded.currency,total=excluded.total,
        opening_paid=excluded.opening_paid,cancelled=excluded.cancelled,document_id=excluded.document_id,data=excluded.data;
    delete from public.alihen_payments where owner_id=account_id and invoice_id=inv_id;
    for pay in select value from jsonb_array_elements(inv->'payments') loop
      if (pay->>'amount')::numeric <> round((pay->>'amount')::numeric,2) then raise exception 'Payment amounts must use cents'; end if;
      if (pay->>'date')::date > (now() at time zone 'Europe/Madrid')::date then raise exception 'Future payment date'; end if;
      insert into public.alihen_payments(id,owner_id,invoice_id,paid_on,amount,note)
        values((pay->>'id')::uuid,account_id,inv_id,(pay->>'date')::date,(pay->>'amount')::numeric,coalesce(pay->>'note',''));
    end loop;
    update public.alihen_documents set state='reviewed', updated_at=now()
      where owner_id=account_id and id=(inv->>'documentId')::uuid;
  end loop;
  -- Eliminaciones intencionadas, protegidas por la revisión de concurrencia.
  if exists (select 1 from public.alihen_invoices i where i.owner_id=account_id and not(i.id=any(retained_ids))
      and (i.document_id is not null or i.opening_paid > 0 or exists(select 1 from public.alihen_payments p where p.owner_id=account_id and p.invoice_id=i.id)))
    then raise exception 'Use cancellation instead of deleting a documented or paid invoice'; end if;
  delete from public.alihen_invoices where owner_id=account_id and not(id=any(retained_ids));
  update public.alihen_workspaces set revision=current_revision+1, data=snapshot-'invoices', updated_at=now() where owner_id=account_id;
  return current_revision+1;
end;
$$;

create view public.alihen_collection_status with (security_invoker=true) as
select i.owner_id,i.id,i.number,i.currency,i.total,i.due_date,i.cancelled,
  i.opening_paid + coalesce(p.amount,0) as paid,
  case when i.cancelled then 0 else greatest(0,i.total-i.opening_paid-coalesce(p.amount,0)) end as balance,
  case when i.cancelled then 'cancelled'
    when i.total>0 and i.opening_paid+coalesce(p.amount,0)>=i.total then 'paid'
    when i.opening_paid+coalesce(p.amount,0)>0 then 'partial' else 'pending' end as payment_status,
  not i.cancelled and i.total>i.opening_paid+coalesce(p.amount,0)
    and i.due_date < (now() at time zone 'Europe/Madrid')::date as overdue
from public.alihen_invoices i left join (
  select owner_id,invoice_id,sum(amount) as amount from public.alihen_payments group by owner_id,invoice_id
) p on p.owner_id=i.owner_id and p.invoice_id=i.id;

revoke all on function public.alihen_load_account() from public,anon;
revoke all on function public.alihen_save_account(jsonb,bigint) from public,anon;
grant execute on function public.alihen_load_account() to authenticated;
grant execute on function public.alihen_save_account(jsonb,bigint) to authenticated;
grant select on public.alihen_collection_status to authenticated;
commit;
