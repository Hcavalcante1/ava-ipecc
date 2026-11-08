const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'materiais', 'aulas');
fs.mkdirSync(out, { recursive: true });
const aulas = JSON.parse(fs.readFileSync(path.join(root, 'conteudo', 'ava-conteudo-base.json'), 'utf8')).aulas;

function esc(s='') { return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E\n]/g, ''); }
function lines(text, width=82) {
  const out=[];
  for (const para of String(text).split('\n')) {
    let line='';
    for (const word of para.split(/\s+/)) {
      if ((line+' '+word).trim().length > width) { if(line) out.push(line); line=word; }
      else line=(line+' '+word).trim();
    }
    if(line) out.push(line);
  }
  return out;
}
function makePdf(aula) {
  const titleLines=lines(aula.titulo,42).slice(0,3);
  const body=[
    'CONTEUDO DA AULA',
    aula.conteudo,
    '',
    'OBJETIVO DE APRENDIZAGEM',
    aula.prompt,
    '',
    'ROTEIRO DE APLICACAO',
    '1. Observe o contexto e identifique o problema ou necessidade.',
    '2. Aplique o conceito apresentado em uma ferramenta ou situacao real.',
    '3. Registre as escolhas, os procedimentos e o resultado obtido.',
    '4. Revise a entrega usando os criterios de qualidade e seguranca.',
    '5. Compartilhe o produto final e descreva o proximo passo.',
    '',
    'REGISTRO DO ALUNO',
    'O que foi produzido? _________________________________________________',
    'O que foi aprendido? _________________________________________________',
    'Como sera aplicado? _________________________________________________'
  ];
  const chunks=[]; for(let i=0;i<body.length;i+=32) chunks.push(body.slice(i,i+32));
  const objects=[]; const add=o=>{objects.push(o);return objects.length;};
  const f=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const b=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pages=[], streams=[];
  const cover=[];
  cover.push('q','0.08 0.25 0.20 rg','0 0 595 842 re','f','0.74 0.88 0.82 rg','0 0 595 74 re','f','0.86 0.67 0.25 rg','0 74 595 5 re','f','Q');
  cover.push('BT','/F1 8 Tf','1 1 1 rg','52 790 Td','(IPECC - AVA NOVO RUMO) Tj','ET');
  cover.push('BT','/F2 26 Tf','1 1 1 rg','52 680 Td','(Aula do curso) Tj','ET');
  titleLines.forEach((line,i)=>cover.push('BT','/F2 15 Tf','1 1 1 rg',`52 ${638-i*22} Td`,`(${esc(line)}) Tj`,'ET'));
  cover.push('q','0.06 0.55 0.57 rg','390 590 120 120 re','f','0.86 0.67 0.25 rg','425 618 50 64 re','f','0.08 0.25 0.20 rg','438 636 24 28 re','f','Q');
  cover.push('q','1 1 1 rg','52 430 458 88 re','f','Q');
  cover.push('BT','/F2 12 Tf','0.08 0.25 0.20 rg','70 482 Td','(Aprenda fazendo) Tj','ET');
  cover.push('BT','/F1 9 Tf','0.18 0.22 0.21 rg','70 458 Td','(Aula interativa para mediacao do professor.) Tj','ET');
  cover.push('BT','/F1 8 Tf','0.08 0.25 0.20 rg','52 34 Td','(IPECC - material pedagogico) Tj','ET');
  streams.push(cover.join('\n'));
  for(const chunk of chunks){
    const c=['q','0.08 0.25 0.20 rg','0 792 595 50 re','f','0.86 0.67 0.25 rg','0 786 595 6 re','f','0.96 0.97 0.95 rg','40 60 515 650 re','f','Q','BT','/F2 18 Tf','1 1 1 rg','52 813 Td','(IPECC | MATERIAL PEDAGOGICO) Tj','ET'];
    let y=748;
    chunk.forEach((line,i)=>{const head=/^[A-Z ]+$/.test(line)||/^\d\./.test(line); if(head&&i>0){c.push('0.88 0.69 0.27 rg','45 '+(y+6)+' 505 18 re','f');} c.push('BT',`${head?'/F2':'/F1'} ${head?11:9} Tf`,`${head?'0.08 0.25 0.20':'0.18 0.22 0.21'} rg`,`52 ${y} Td`,`(${esc(line)}) Tj`,'ET'); y-=head?24:16;});
    streams.push(c.join('\n'));
  }
  const contentIds=streams.map(s=>add(`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}\nendstream`));
  const pageIds=streams.map(()=>add('')); const pagesId=add('');
  pageIds.forEach((id,i)=>objects[id-1]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f} 0 R /F2 ${b} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  const catalog=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf='%PDF-1.4\n', offsets=[0]; for(let i=0;i<objects.length;i++){offsets[i+1]=Buffer.byteLength(pdf);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const x=Buffer.byteLength(pdf); pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<=objects.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'; pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  fs.writeFileSync(path.join(out,`${aula.id}.pdf`),pdf);
}
aulas.forEach(makePdf);
console.log(`Gerados ${aulas.length} PDFs em ${out}`);
