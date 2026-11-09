import assert from "node:assert/strict";
import vm from "node:vm";

const base = process.env.AVA_BASE_URL || "https://ava.ipecc.org.br";
const html = await (await fetch(base)).text();

assert.match(html, /<title>AVA IPECC<\/title>/);
assert.match(html, /ava-criar-usuario/);
assert.match(html, /ava-recuperar-conta/);
assert.match(html, /#nova-senha/);
assert.match(html, /#recuperar-codigo/);

const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
assert.ok(scripts.length > 0, "A página publicada não contém JavaScript");
for (const [index, script] of scripts.entries()) {
  new vm.Script(script, { filename: "index.html<script " + (index + 1) + ">" });
}

console.log(JSON.stringify({
  base,
  status: "ok",
  scripts: scripts.length,
  checks: ["HTML", "rotas de recuperação", "convite", "sintaxe JavaScript"]
}));
