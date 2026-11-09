# Fluxo de usuários do AVA IPECC

## Responsabilidades

- **Administrador:** cria professores, monitores e alunos; altera papéis; ativa/desativa contas; cria turmas; associa professor à turma; pode matricular alunos.
- **Professor/monitor:** convida alunos. O papel enviado pelo navegador é ignorado para esse perfil; a Edge Function força `aluno`.
- **Aluno:** recebe o convite, define a própria senha e pode se inscrever em turma ativa com vaga, quando essa opção estiver disponível.

## Convite

A tela chama `/functions/v1/ava-criar-usuario` com JWT. A função confirma o usuário autenticado, consulta `ava_perfis` e só aceita admin, professor ou monitor como autor do convite. Admin pode escolher aluno, professor ou monitor; professor/monitor só podem criar/convidar aluno. O usuário é criado no Supabase Auth, o perfil é sincronizado em `ava_perfis` e o convite é enviado por e-mail.

## Professor e turma

O administrador seleciona o professor na turma. O vínculo é salvo em `ava_turmas.professor_id`. O professor passa a conduzir as aulas da turma e a convidar os alunos.

## Senha

O login usa e-mail e senha. O link 'Esqueceu a senha?' chama o fluxo de recuperação do Supabase e leva a `#nova-senha`. Convites também levam a `#nova-senha`, onde o usuário cria a senha inicial.

## Limite atual

A recuperação depende do acesso ao e-mail cadastrado. Se o usuário perdeu esse acesso, a coordenação precisa atualizar o e-mail por procedimento administrativo seguro; não existe recuperação por telefone/CPF no frontend.

## Fonte

A Edge Function está versionada em `supabase/functions/ava-criar-usuario/index.ts` e permanece com JWT obrigatório. O `app.js` na raiz é uma demonstração legada e não participa do fluxo de produção; a aplicação publicada está em `index.html`.
