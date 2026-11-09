# Evidências de QA do AVA

## Automatizado

- Workflow: `AVA quality gate`
- Último SHA: `8d2e87023975eb4cd13bb929e226516c59cb5fa3`
- Resultado: sucesso
- Smoke test: HTML publicado, rotas de recuperação e sintaxe JavaScript

## Banco

- 40 aulas publicadas
- 160 atividades publicadas
- 40 aulas com exatamente 4 atividades
- 0 violações históricas de sequência encontradas

## Chrome real

- Produção carregou a versão nova com cache-bust
- Perfil exibiu geração do código de recuperação
- Rota de recuperação exibiu e-mail, código e nova senha
- Ambiente do professor exibiu as 40 aulas
- Console sem erros ou avisos

## Pendências explícitas

- Aplicar a migração `enforce_student_activity_sequence_rls` em produção, após autorização explícita.
- Executar sessão independente de aluno para o fluxo completo.
- Verificar rollback em ambiente separado; não executar rollback destrutivo na produção principal.
