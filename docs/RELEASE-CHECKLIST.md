# Release checklist e rollback

## Gate obrigatório

1. GitHub Actions `AVA quality gate` verde.
2. Smoke test da URL de produção verde.
3. Chrome real: login e fluxo do perfil/recuperação, ambiente do professor com 40 aulas, e fluxo do aluno.
4. Supabase: RLS e Edge Functions sem erros 5xx relevantes.
5. Registrar o SHA publicado.

## Estado verificado

- SHA atual: `529492df456ef024a1c942010480b5a65422172f`
- Quality gate: concluído com sucesso.
- SHA anterior disponível para rollback: `544d8e99571996eb49c6788fdefe31ee4ac34377`
- O histórico GitHub preserva os dois estados.

## Rollback

Se o smoke test ou o Chrome real falhar, interromper a progressão e promover o SHA anterior no provedor de deploy. Depois repetir o smoke test e verificar o Chrome. Não apagar commits nem usar reset destrutivo.

## Observação

O rollback foi preparado por histórico imutável e SHA identificável. A promoção efetiva do SHA anterior ainda não deve ser executada apenas como teste, porque alteraria produção; ela é o procedimento de contingência.
