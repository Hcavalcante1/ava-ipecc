const fs = require('fs');
const crypto = require('crypto');

const source = JSON.parse(fs.readFileSync('ava-conteudo-atual.json', 'utf8'));
const moduleById = Object.fromEntries(source.modulos.map(m => [m.id, m]));

const outputs = {
  'Inclusão Digital e Serviços Básicos': 'dossiê digital pessoal com e-mail profissional, arquivos organizados e documento em PDF',
  'Produtividade e Apoio Administrativo': 'conjunto profissional com documento, planilha e apresentação',
  'Design e Conteúdo Digital': 'pacote comercial com peças digitais e catálogo',
  'Vendas, Divulgação e Atendimento Digital': 'catálogo, campanha e simulação de atendimento e venda',
  'Empreendedorismo, Portfólio e Inserção Produtiva': 'portfólio profissional e plano de ação de 30 dias'
};

const kinds = [
  { tipo: 'revisao', nome: 'Revisão guiada', verb: 'Revise os conceitos centrais', evidence: 'Registre três pontos essenciais e uma dúvida.' },
  { tipo: 'exercicio', nome: 'Exercício aplicado', verb: 'Execute uma prática curta', evidence: 'Descreva o resultado obtido e a principal dificuldade.' },
  { tipo: 'portfolio', nome: 'Construção do produto', verb: 'Acrescente uma pequena entrega ao produto do módulo', evidence: 'Informe o que foi criado ou melhorado e como será usado.' },
  { tipo: 'autoavaliacao', nome: 'Autoavaliação', verb: 'Avalie o que você já consegue fazer sem ajuda', evidence: 'Dê uma nota de 1 a 5 e explique o próximo passo.' }
];

function clean(s='') { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function uuid() { return crypto.randomUUID(); }

const activities = [];
for (const aula of source.aulas) {
  const modulo = moduleById[aula.modulo_id];
  if (!modulo) throw new Error(`Módulo ausente para ${aula.titulo}`);
  const product = outputs[modulo.titulo] || 'produto prático do módulo';
  const context = clean(aula.conteudo);
  kinds.forEach((k, idx) => {
    const instructions = [
      `<p><strong>Objetivo:</strong> consolidar ${aula.titulo.toLowerCase()} em uma atividade de aproximadamente 15 minutos.</p>`,
      `<p><strong>Contexto:</strong> ${context}</p>`,
      `<ol><li>${k.verb} sobre <strong>${aula.titulo}</strong>.</li>`,
      idx === 0 ? '<li>Compare o que você já sabia com o conteúdo trabalhado no encontro presencial.</li>' :
      idx === 1 ? '<li>Faça a tarefa no computador ou celular e confira o resultado antes de concluir.</li>' :
      idx === 2 ? `<li>Relacione a entrega ao ${product}.</li>` :
      '<li>Identifique uma habilidade dominada e outra que precisa de apoio.</li>',
      `<li>${k.evidence}</li></ol>`,
      '<p><strong>Conclusão:</strong> envie o registro solicitado. Apenas abrir a atividade não conta como conclusão.</p>'
    ].join('');
    activities.push({
      id: uuid(), aula_id: aula.id, ordem: idx + 1, tipo: k.tipo,
      titulo: `${k.nome} — ${aula.titulo}`,
      instrucoes: instructions,
      pergunta: k.evidence,
      duracao_min: 15,
      publicada: true
    });
  });
}

if (activities.length !== 160) throw new Error(`Esperadas 160 atividades; geradas ${activities.length}`);
for (const a of activities) {
  if (!a.titulo || !a.instrucoes || !a.pergunta || a.duracao_min !== 15) throw new Error(`Atividade inválida: ${a.id}`);
}

fs.mkdirSync('conteudo', { recursive: true });
fs.writeFileSync('conteudo/atividades-ava-160.json', JSON.stringify(activities, null, 2));

const q = v => `'${String(v).replace(/'/g, "''")}'`;
const values = activities.map(a => `(${q(a.id)},${q(a.aula_id)},${a.ordem},${q(a.tipo)},${q(a.titulo)},${q(a.instrucoes)},${q(a.pergunta)},15,true)`).join(',\n');
const sql = `-- AVA IPECC: quatro atividades de 15 minutos para cada uma das 40 semanas\n`+
`create table if not exists public.ava_atividades (\n`+
`  id uuid primary key default gen_random_uuid(),\n  aula_id uuid not null references public.ava_aulas(id) on delete cascade,\n`+
`  ordem smallint not null check (ordem between 1 and 4),\n  tipo text not null check (tipo in ('revisao','exercicio','portfolio','autoavaliacao')),\n`+
`  titulo text not null,\n  instrucoes text not null,\n  pergunta text not null,\n  duracao_min smallint not null default 15 check (duracao_min = 15),\n`+
`  publicada boolean not null default false,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n`+
`  unique (aula_id, ordem)\n);\n\n`+
`create index if not exists ava_atividades_aula_ordem_idx on public.ava_atividades(aula_id, ordem);\n`+
`alter table public.ava_atividades enable row level security;\n\n`+
`drop policy if exists \"atividades publicadas para autenticados\" on public.ava_atividades;\n`+
`create policy \"atividades publicadas para autenticados\" on public.ava_atividades for select to authenticated using (publicada = true or exists (select 1 from public.ava_perfis p where p.id = auth.uid() and p.papel in ('admin','professor','monitor')));\n\n`+
`drop policy if exists \"gestao de atividades pela equipe\" on public.ava_atividades;\n`+
`create policy \"gestao de atividades pela equipe\" on public.ava_atividades for all to authenticated using (exists (select 1 from public.ava_perfis p where p.id = auth.uid() and p.papel in ('admin','professor'))) with check (exists (select 1 from public.ava_perfis p where p.id = auth.uid() and p.papel in ('admin','professor')));\n\n`+
`insert into public.ava_atividades (id,aula_id,ordem,tipo,titulo,instrucoes,pergunta,duracao_min,publicada) values\n${values}\n`+
`on conflict (aula_id, ordem) do update set tipo=excluded.tipo,titulo=excluded.titulo,instrucoes=excluded.instrucoes,pergunta=excluded.pergunta,duracao_min=excluded.duracao_min,publicada=excluded.publicada,updated_at=now();\n`;
fs.mkdirSync('supabase/migrations', { recursive: true });
fs.writeFileSync('supabase/migrations/20261021_160_atividades_ava.sql', sql);

console.log(JSON.stringify({ aulas: source.aulas.length, atividades: activities.length, minutos: activities.reduce((n,a)=>n+a.duracao_min,0), horas: activities.reduce((n,a)=>n+a.duracao_min,0)/60 }, null, 2));
