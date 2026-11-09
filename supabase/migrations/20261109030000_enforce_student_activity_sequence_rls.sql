create or replace function public.ava_pode_acessar_aula(p_matricula_id uuid, p_aula_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with sequencia as (
    select a.id, m.curso_id,
           row_number() over (partition by m.curso_id order by m.ordem, a.ordem, a.id) as posicao
    from ava_aulas a
    join ava_modulos m on m.id = a.modulo_id
    where a.publicada = true
  ), alvo as (
    select s.id, s.curso_id, s.posicao
    from sequencia s
    join ava_matriculas mat on mat.id = p_matricula_id
      and mat.aluno_id = (select auth.uid())
    join ava_turmas t on t.id = mat.turma_id and t.curso_id = s.curso_id
    where s.id = p_aula_id
  )
  select exists (
    select 1 from alvo a
    where a.posicao = 1
       or exists (
         select 1 from sequencia anterior
         where anterior.curso_id = a.curso_id
           and anterior.posicao = a.posicao - 1
           and (
             exists (select 1 from ava_progresso p where p.matricula_id = p_matricula_id and p.aula_id = anterior.id and p.concluida = true)
             or exists (select 1 from ava_entregas e where e.matricula_id = p_matricula_id and e.aula_id = anterior.id and e.status in ('enviada'::ava_status_entrega, 'avaliada'::ava_status_entrega))
           )
       )
  );
$$;

revoke all on function public.ava_pode_acessar_aula(uuid, uuid) from public;
grant execute on function public.ava_pode_acessar_aula(uuid, uuid) to authenticated;

drop policy if exists aluno_envia_entrega on public.ava_entregas;
create policy aluno_envia_entrega on public.ava_entregas for insert to authenticated
with check (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid()))
  and public.ava_pode_acessar_aula(matricula_id, aula_id));

drop policy if exists aluno_update_entrega on public.ava_entregas;
create policy aluno_update_entrega on public.ava_entregas for update to authenticated
using (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid()))
  and status = 'pendente'::ava_status_entrega)
with check (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid()))
  and public.ava_pode_acessar_aula(matricula_id, aula_id));

drop policy if exists aluno_upsert_entrega on public.ava_entregas;
create policy aluno_upsert_entrega on public.ava_entregas for all to authenticated
using (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid())))
with check (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid()))
  and public.ava_pode_acessar_aula(matricula_id, aula_id));

drop policy if exists aluno_atualiza_progresso on public.ava_progresso;
create policy aluno_atualiza_progresso on public.ava_progresso for insert to authenticated
with check (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid()))
  and public.ava_pode_acessar_aula(matricula_id, aula_id));

drop policy if exists aluno_update_progresso on public.ava_progresso;
create policy aluno_update_progresso on public.ava_progresso for update to authenticated
using (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid())))
with check (matricula_id in (select id from public.ava_matriculas where aluno_id = (select auth.uid()))
  and public.ava_pode_acessar_aula(matricula_id, aula_id));