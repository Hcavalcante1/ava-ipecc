const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'materiais', 'atividades');
fs.mkdirSync(out, { recursive: true });
const data = JSON.parse(fs.readFileSync(path.join(root, 'conteudo', 'atividades-ava-160.json'), 'utf8'));
const groups = new Map();
for (const item of data.filter(x => x.publicada !== false)) {
  if (!groups.has(item.aula_id)) groups.set(item.aula_id, []);
  groups.get(item.aula_id).push(item);
}

function plain(value='') {
  return String(value)
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/(p|li|h\d|ol|ul)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\r/g, '').trim();
}
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E\n]/g, ''); }
function lines(text, width=92) {
  const result=[];
  for (const para of String(text).split('\n')) {
    let line='';
    for (const word of para.split(/\s+/)) {
      if ((line+' '+word).trim().length > width) { if (line) result.push(line); line=word; }
      else line=(line+' '+word).trim();
    }
    result.push(line);
  }
  return result;
}
function pdfFor(aulaId, items) {
  items.sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const title = (items[0].titulo||'Atividade complementar').split('—').slice(-1)[0].trim();
  const content = ['ATIVIDADES COMPLEMENTARES','IPECC - AMBIENTE VIRTUAL DE APRENDIZAGEM','', title,'','Material complementar da aula. Siga as etapas na ordem indicada e conclua o registro no AVA.',''];
  items.forEach((item, i) => {
    content.push(`${i+1}. ${item.titulo||'Atividade'}`, `Duracao estimada: ${item.duracao_min||15} minutos | Tipo: ${item.tipo||'atividade'}`, '', plain(item.instrucoes||''), '', `Registro solicitado: ${item.pergunta||'Registre o que aprendeu.'}`, '', 'Registro do aluno:', '________________________________________________________________________________', '');
  });
  const all=[]; content.forEach(x=>lines(x,88).forEach(y=>all.push(y)));
  const perPage=40, pages=[]; for(let i=0;i<all.length;i+=perPage) pages.push(all.slice(i,i+perPage));
  const objects=[]; const add=o=>{objects.push(o);return objects.length;};
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds=[]; const contentIds=[];
  for (let p=0;p<pages.length;p++) {
    const cmds=['q','0.08 0.25 0.20 rg','0 792 595 50 re','f','0.86 0.67 0.25 rg','0 786 595 6 re','f','0.96 0.97 0.95 rg','40 60 515 650 re','f','Q'];
    cmds.push('BT','/F2 18 Tf','1 1 1 rg','52 813 Td',`(${esc(p===0?'IPECC | ATIVIDADE COMPLEMENTAR':'IPECC | MATERIAL DE APOIO')}) Tj`,'ET');
    cmds.push('BT','/F2 9 Tf','0.08 0.25 0.20 rg','52 748 Td',`(${esc(`Aula complementar  |  ${aulaId}`)}) Tj`,'ET');
    let y=708;
    pages[p].forEach((line,j)=>{
      const isTitle = j===0 || /^\d+\./.test(line) || line.startsWith('Registro solicitado:');
      const size=isTitle?11:9;
      const color=isTitle?'0.08 0.25 0.20':'0.18 0.22 0.21';
      if (isTitle && j>0) { cmds.push('0.88 0.69 0.27 rg',`${45} ${y+6} 505 18 re`,'f'); }
      cmds.push('BT',`${isTitle?'/F2':'/F1'} ${size} Tf`,`${color} rg`,`52 ${y} Td`,`(${esc(line)}) Tj`,'ET');
      y-=isTitle?24:15;
    });
    cmds.push('BT','/F1 8 Tf','0.35 0.39 0.37 rg','52 38 Td',`(${esc(`IPECC  |  Atividade complementar  |  Pagina ${p+1} de ${pages.length}`)}) Tj`,'ET');
    const stream=cmds.join('\n'); const cid=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`); contentIds.push(cid); pageIds.push(add(''));
  }
  const pagesId=add('');
  for(let i=0;i<pageIds.length;i++) objects[pageIds[i]-1]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  const catalog=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let outPdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){ offsets[i+1]=Buffer.byteLength(outPdf); outPdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref=Buffer.byteLength(outPdf); outPdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<=objects.length;i++) outPdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'; outPdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.writeFileSync(path.join(out, `${aulaId}.pdf`), outPdf);
}
for (const [id, items] of groups) pdfFor(id, items);
console.log(`Gerados ${groups.size} PDFs em ${out}`);
