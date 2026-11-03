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
  const content = ['ATIVIDADES COMPLEMENTARES','IPECC - INFORMATICA PRODUTIVA','', title,'','Material de apoio. Realize as atividades na ordem indicada e conclua cada etapa no AVA.',''];
  items.forEach((item, i) => {
    content.push(`${i+1}. ${item.titulo||'Atividade'}`, `Duracao estimada: ${item.duracao_min||15} minutos | Tipo: ${item.tipo||'atividade'}`, '', plain(item.instrucoes||''), '', `Registro solicitado: ${item.pergunta||'Registre o que aprendeu.'}`, '', 'Registro do aluno:', '________________________________________________________________________________', '');
  });
  const all=[]; content.forEach(x=>lines(x).forEach(y=>all.push(y)));
  const perPage=45, pages=[]; for(let i=0;i<all.length;i+=perPage) pages.push(all.slice(i,i+perPage));
  const objects=[]; const add=o=>{objects.push(o);return objects.length;};
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds=[]; const contentIds=[];
  for (let p=0;p<pages.length;p++) {
    const cmds=['BT','/F1 16 Tf','60 790 Td'];
    pages[p].forEach((line,j)=>{ if(j===4) cmds.push('/F1 10 Tf'); cmds.push(`(${esc(line)}) Tj`, '0 -16 Td'); });
    cmds.push('ET'); const stream=cmds.join('\n'); const cid=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`); contentIds.push(cid); pageIds.push(add(''));
  }
  const pagesId=add('');
  for(let i=0;i<pageIds.length;i++) objects[pageIds[i]-1]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  const catalog=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let outPdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){ offsets[i+1]=Buffer.byteLength(outPdf); outPdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref=Buffer.byteLength(outPdf); outPdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<=objects.length;i++) outPdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'; outPdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.writeFileSync(path.join(out, `${aulaId}.pdf`), outPdf);
}
for (const [id, items] of groups) pdfFor(id, items);
console.log(`Gerados ${groups.size} PDFs em ${out}`);
