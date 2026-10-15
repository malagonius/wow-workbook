create table public.workbook_classes (
  class_name text primary key check (
    length(class_name) between 1 and 120 and
    class_name = btrim(class_name) and position('/' in class_name) = 0 and
    class_name not in ('__proto__', 'constructor', 'prototype')
  ),
  owner_id uuid references auth.users(id),
  revision integer not null default 1 check (revision > 0),
  payload jsonb not null,
  constraint valid_class_payload check ((
    jsonb_typeof(payload) = 'object' and
    payload->>'format' = 'wow-workbook-talent-project' and
    payload->>'version' = '6' and
    jsonb_typeof(payload->'content') = 'object' and
    payload->'content' ? class_name and
    jsonb_typeof(payload->'content'->class_name) = 'array' and
    jsonb_typeof(payload->'trees') = 'object' and
    jsonb_typeof(payload->'abilities') = 'object' and
    jsonb_typeof(payload->'shared'->'classes') = 'object' and
    jsonb_typeof(payload->'shared'->'heroes') = 'object' and
    ((payload->'content') - class_name) = '{}'::jsonb
  ) is true)
);

alter table public.workbook_classes enable row level security;
revoke all on public.workbook_classes from anon, authenticated;
grant select on public.workbook_classes to anon, authenticated;
grant insert, update, delete on public.workbook_classes to authenticated;

create policy "Anyone can view classes" on public.workbook_classes
  for select to anon, authenticated using (true);
create policy "Users create their own classes" on public.workbook_classes
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Users update their own classes" on public.workbook_classes
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Users delete their own classes" on public.workbook_classes
  for delete to authenticated using (owner_id = (select auth.uid()));

create function public.validate_workbook_class() returns trigger
language plpgsql set search_path = '' as $$
declare
  item record;
begin
  for item in select key, value from jsonb_each(new.payload->'trees') loop
    if (item.value->>'class') is distinct from new.class_name or
       item.key is distinct from new.class_name || '/' || (item.value->>'spec') or
       not (new.payload->'content'->new.class_name ? (item.value->>'spec')) then
      raise exception 'Specializations must belong to their containing class.';
    end if;
  end loop;
  for item in
    select key from jsonb_each(new.payload->'abilities')
    union all select key from jsonb_each(new.payload->'shared'->'classes')
    union all select key from jsonb_each(new.payload->'shared'->'heroes')
  loop
    if item.key <> new.class_name and
       left(item.key, length(new.class_name) + 1) <> new.class_name || '/' then
      raise exception 'Abilities and shared talents must belong to their containing class.';
    end if;
  end loop;
  return new;
end;
$$;
create trigger validate_workbook_class before insert or update on public.workbook_classes
  for each row execute function public.validate_workbook_class();

create function public.check_workbook_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Class ownership cannot be transferred.';
  end if;
  if new.class_name is distinct from old.class_name then
    raise exception 'Rename a class by deleting and creating it in one save.';
  end if;
  new.revision := old.revision + 1;
  return new;
end;
$$;
create trigger workbook_revision before update on public.workbook_classes
  for each row execute function public.check_workbook_revision();

-- A single transaction preserves multi-class imports, renames, and deletions.
-- Invoker rights retain RLS enforcement even when the function is called directly.
create function public.save_workbook_classes(changes jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  change jsonb;
  saved public.workbook_classes;
  result jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to save classes.'; end if;
  if jsonb_typeof(changes) is distinct from 'array' then
    raise exception 'Changes must be an array.';
  end if;
  for change in select value from jsonb_array_elements(changes)
    order by value->>'class_name'
  loop
    if change->'revision' = 'null'::jsonb then
      if change->'payload' = 'null'::jsonb then raise exception 'Cannot delete an unknown class.'; end if;
      insert into public.workbook_classes (class_name, owner_id, payload)
        values (change->>'class_name', auth.uid(), change->'payload') returning * into saved;
    elsif change->'payload' = 'null'::jsonb then
      delete from public.workbook_classes
        where class_name = change->>'class_name' and owner_id = auth.uid()
        and revision = (change->>'revision')::integer returning * into saved;
      if not found then raise exception 'Class changed or is not yours. Export unsaved work and reload.'; end if;
      result := result || jsonb_build_array(jsonb_build_object('class_name', saved.class_name, 'revision', null));
      continue;
    else
      update public.workbook_classes set payload = change->'payload'
        where class_name = change->>'class_name' and owner_id = auth.uid()
        and revision = (change->>'revision')::integer returning * into saved;
      if not found then raise exception 'Class changed or is not yours. Export unsaved work and reload.'; end if;
    end if;
    result := result || jsonb_build_array(to_jsonb(saved));
  end loop;
  return result;
end;
$$;
revoke all on function public.save_workbook_classes(jsonb) from public, anon;
grant execute on function public.save_workbook_classes(jsonb) to authenticated;
