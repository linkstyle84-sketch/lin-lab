-- 테이블 권한 (RLS와 별개로 authenticated/anon에 GRANT 필요)
-- SQL Editor에 붙여넣고 Run

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.characters to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.comments to authenticated;

grant select on public.posts to anon;
grant select on public.comments to anon;

-- 탈퇴용 (이미 있으면 에러 나도 무시)
do $$
begin
  create policy "members_self_delete" on public.members
    for delete to authenticated
    using (email = auth.jwt() ->> 'email');
exception
  when duplicate_object then null;
end $$;
