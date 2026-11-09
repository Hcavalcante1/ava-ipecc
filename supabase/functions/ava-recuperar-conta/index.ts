import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const encoder = new TextEncoder();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

async function hashCode(code: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(code.trim().toUpperCase()));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || "recover";

  try {
    if (mode === "generate") {
      const auth = req.headers.get("Authorization");
      if (!auth) return json({ error: "Sessão inválida." }, 401);
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
      const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
      const { data: { user }, error: userError } = await caller.auth.getUser();
      if (userError || !user) return json({ error: "Sessão inválida." }, 401);

      const code = randomCode();
      const hash = await hashCode(code);
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await admin.from("ava_codigos_recuperacao").upsert({
        usuario_id: user.id,
        codigo_hash: hash,
        expira_em: expires,
        usado_em: null,
        tentativas: 0,
        ultima_tentativa: null,
      });
      if (error) return json({ error: "Não foi possível gerar o código." }, 500);
      return json({ success: true, codigo: code, expira_em: expires });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.codigo || "").trim().toUpperCase();
    const password = String(body.senha || "");
    if (!email || !code || password.length < 6) {
      return json({ error: "Informe e-mail, código e uma senha com pelo menos 6 caracteres." }, 400);
    }

    const { data: perfil } = await admin.from("ava_perfis")
      .select("id,email,ativo").ilike("email", email).maybeSingle();
    if (!perfil?.id || perfil.ativo === false) {
      return json({ error: "Dados de recuperação inválidos." }, 400);
    }

    const { data: registro } = await admin.from("ava_codigos_recuperacao")
      .select("usuario_id,codigo_hash,expira_em,usado_em,tentativas")
      .eq("usuario_id", perfil.id).maybeSingle();
    if (!registro || registro.usado_em || new Date(registro.expira_em).getTime() < Date.now() || registro.tentativas >= 5) {
      return json({ error: "Código inválido, expirado ou bloqueado." }, 400);
    }

    const recebido = await hashCode(code);
    await admin.from("ava_codigos_recuperacao").update({
      tentativas: registro.tentativas + 1,
      ultima_tentativa: new Date().toISOString(),
    }).eq("usuario_id", perfil.id);

    if (!constantTimeEqual(recebido, registro.codigo_hash)) {
      return json({ error: "Código inválido." }, 400);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(perfil.id, { password });
    if (updateError) return json({ error: "Não foi possível atualizar a senha." }, 500);
    await admin.from("ava_codigos_recuperacao").update({ usado_em: new Date().toISOString() }).eq("usuario_id", perfil.id);
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
