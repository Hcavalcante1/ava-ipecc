# Evidências de QA do AVA

## Automatizado

- Workflow: `AVA quality gate`
- Migração RLS de sequência aplicada em produção: `enforce_student_activity_sequence_rls`
- Correção de ACL aplicada: `revoke_sequence_guard_anon_execute`
- Smoke test aprovado para HTML publicado, convite, recuperação e sintaxe JavaScript
- Limite: ainda não existe E2E autenticado no CI porque não há credenciais de teste configuradas

## Banco

- 40 aulas publicadas
- 160 atividades publicadas
- 40 aulas com exatamente 4 atividades
- 0 violações históricas de sequência encontradas
- `ava_pode_acessar_aula` instalada em produção
- Cinco políticas de gravação de `ava_entregas`/`ava_progresso` usam o guard e destinam-se a `authenticated`
- `anon` sem EXECUTE na função; `authenticated` com EXECUTE
- Perfis atuais: 1 administrador, 1 aluno e 1 professor de teste
- O usuário de professor foi criado e `confirmation_sent_at` foi registrado pelo Supabase; ainda não houve confirmação nem login
- Migrações aplicadas incluem `add_account_recovery_codes` e `enforce_student_activity_sequence_rls`

## Chrome real

- Produção carregou com cache-bust
- Perfil exibiu geração do código de recuperação
- Rota de recuperação exibiu e-mail, código e nova senha
- Ambiente do professor exibiu as 40 aulas
- Aula do professor exibiu conteúdo interativo, roteiro de 5 horas e controles Abrir/Baixar dos PDFs
- Cadastro administrativo exibiu o professor de teste como ativo
- Console sem erros ou avisos observados

## Observabilidade

- Logs Supabase disponíveis para edge, auth, PostgREST, Postgres, realtime, auditoria de autenticação, pgbouncer e storage
- Health advisors sem achados
- Security advisors ainda apontam funções SECURITY DEFINER expostas, proteção contra senhas vazadas desativada e tabelas RLS sem políticas

## Pendências explícitas

- Concluir confirmação/login do professor de teste após recebimento do convite.
- Executar sessão independente de aluno para o fluxo completo pós-RLS.
- Verificar rollback em ambiente separado; não executar rollback destrutivo na produção principal.
- Configurar E2E autenticado no CI, após disponibilizar credenciais de teste seguras.
