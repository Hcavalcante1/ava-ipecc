# Evidências de QA do AVA

## Automatizado

- Workflow: `AVA quality gate`
- Migração de sequência endurecida no commit: `ca6f5e6ae632797da64f91b3d546dba981cb6a51`
- Resultado: smoke test aprovado anteriormente para HTML publicado, convite, recuperação e sintaxe JavaScript
- Limite: ainda não existe E2E autenticado no CI porque não há credenciais de teste configuradas

## Banco

- 40 aulas publicadas
- 160 atividades publicadas
- 40 aulas com exatamente 4 atividades
- 0 violações históricas de sequência encontradas
- `ava_pode_acessar_aula` ainda não existe em produção; a migração está versionada, mas não aplicada
- Perfis atuais: 1 administrador e 1 aluno; nenhum professor cadastrado
- Migrações aplicadas incluem `add_account_recovery_codes`

## Chrome real

- Produção carregou com cache-bust
- Perfil exibiu geração do código de recuperação
- Rota de recuperação exibiu e-mail, código e nova senha
- Ambiente do professor exibiu as 40 aulas
- Aula do professor exibiu conteúdo interativo, roteiro de 5 horas e controles Abrir/Baixar dos PDFs
- Console sem erros ou avisos observados

## Observabilidade

- Logs Supabase disponíveis para edge, auth, PostgREST, Postgres, realtime, auditoria de autenticação, pgbouncer e storage
- Health advisors sem achados
- Security advisors ainda apontam funções SECURITY DEFINER expostas, proteção contra senhas vazadas desativada e tabelas RLS sem políticas

## Pendências explícitas

- Aplicar a migração `enforce_student_activity_sequence_rls` em produção, após autorização explícita.
- Criar um professor de teste usando e-mail autorizado.
- Executar sessão independente de aluno para o fluxo completo.
- Verificar rollback em ambiente separado; não executar rollback destrutivo na produção principal.
