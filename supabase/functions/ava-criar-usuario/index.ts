import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PAPEIS_PERMITIDOS = ["aluno", "professor", "monitor"];
const PAPEIS_STAFF = ["admin", "professor", "monitor"];

type ItemEntrada = {
  nome?: string;
  nome_completo?: string;
  email?: string;
  telefone?: string;
  papel?: string;
};

type ItemResultado = {
  email: string;
  success: boolean;
  id?: string;
  reenviado?: boolean;
  tipo?: "convite" | "recuperacao";
  error?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nao autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // cliente autenticado como quem chamou, apenas para identificar o usuario e checar o papel
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Sessao invalida" }, 401);

    const { data: callerPerfil } = await callerClient
      .from("ava_perfis")
      .select("papel")
      .eq("id", user.id)
      .single();

    const callerPapel = callerPerfil?.papel;
    if (!PAPEIS_STAFF.includes(callerPapel)) {
      return json({ error: "Voce nao tem permissao para convidar usuarios" }, 403);
    }
    const callerIsAdmin = callerPapel === "admin";

    const body = await req.json().catch(() => ({}));

    // aceita um unico usuario (body.email, ...) ou um lote (body.usuarios: [...])
    // — mantido compativel com o formato anterior usado pelo admin
    const itens: ItemEntrada[] = Array.isArray(body.usuarios) && body.usuarios.length
      ? body.usuarios
      : [body];

    if (itens.length > 200) {
      return json({ error: "Envie no maximo 200 usuarios por vez" }, 400);
    }

    // Nunca permita que um convite redirecione para outro site. O AVA e o destino canonico.
    const redirectTo = (() => {
      const candidato = typeof body.redirectTo === "string" ? body.redirectTo : "";
      try {
        const url = new URL(candidato);
        if (url.origin === "https://ava.ipecc.org.br" && url.pathname === "/") {
          return candidato;
        }
      } catch {
        // usa o destino seguro abaixo
      }
      return "https://ava.ipecc.org.br/#nova-senha";
    })();

    // cliente com service role — so usado aqui, no servidor, nunca enviado ao navegador
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // professores/monitores so podem convidar alunos — o papel enviado pelo
    // cliente e ignorado nesse caso, nunca confiamos nisso vindo do navegador
    let listaExistentesCache: { id: string; email?: string; email_confirmed_at?: string | null }[] | null = null;
    async function buscarUsuarioExistentePorEmail(email: string) {
      if (!listaExistentesCache) {
        const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listErr) throw new Error(listErr.message);
        listaExistentesCache = list?.users || [];
      }
      return listaExistentesCache.find((u) => (u.email || "").toLowerCase() === email);
    }

    const resultados: ItemResultado[] = [];

    for (const item of itens) {
      const email = String(item.email || "").trim().toLowerCase();
      const nome = String(item.nome || "").trim();
      const nomeCompleto = String(item.nome_completo || "").trim() || null;
      const telefone = String(item.telefone || "").trim() || null;
      const papel = callerIsAdmin && PAPEIS_PERMITIDOS.includes(item.papel || "")
        ? (item.papel as string)
        : "aluno";

      if (!email || !email.includes("@")) {
        resultados.push({ email: email || "(vazio)", success: false, error: "E-mail invalido" });
        continue;
      }
      if (!nome) {
        resultados.push({ email, success: false, error: "Nome obrigatorio" });
        continue;
      }

      try {
        // convida por e-mail (usa o template "Convite" ja configurado no projeto) —
        // o proprio usuario define a senha pelo link recebido
        const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
          email,
          redirectTo ? { redirectTo } : undefined,
        );

        let userId: string | undefined = invited?.user?.id;
        let reenviado = false;

        if (inviteErr) {
          const jaExiste = /already|registrad|existe/i.test(inviteErr.message || "");
          if (!jaExiste) {
            resultados.push({ email, success: false, error: inviteErr.message });
            continue;
          }
          // usuario ja existe no Auth — localiza o id pelo e-mail para so sincronizar o perfil
          const existing = await buscarUsuarioExistentePorEmail(email);
          if (!existing) {
            resultados.push({ email, success: false, error: "Usuario ja cadastrado, mas nao foi possivel localiza-lo." });
            continue;
          }
          userId = existing.id;
          if (existing.email_confirmed_at) {
            const { error: recoveryErr } = await adminClient.auth.resetPasswordForEmail(email, { redirectTo });
            if (recoveryErr) {
              resultados.push({ email, success: false, error: recoveryErr.message });
              continue;
            }
            reenviado = true;
          }
        }

        if (!userId) {
          resultados.push({ email, success: false, error: "Nao foi possivel criar o usuario" });
          continue;
        }

        const { error: perfilErr } = await adminClient.from("ava_perfis").upsert({
          id: userId,
          email,
          nome,
          nome_completo: nomeCompleto,
          telefone,
          papel,
          ativo: true,
        });
        if (perfilErr) {
          resultados.push({ email, success: false, error: perfilErr.message });
          continue;
        }

        resultados.push({ email, success: true, id: userId, reenviado });
      } catch (err) {
        resultados.push({ email, success: false, error: (err as Error)?.message || String(err) });
      }
    }

    // compatibilidade: chamada com um unico usuario continua respondendo no
    // formato antigo ({success, id, reenviado} ou {error}), sem quebrar o
    // front-end existente do fluxo de criacao individual
    if (!Array.isArray(body.usuarios)) {
      const r = resultados[0];
      if (!r.success) return json({ error: r.error }, 400);
      return json({ success: true, id: r.id, reenviado: r.reenviado, tipo: r.tipo });
    }

    const okCount = resultados.filter((r) => r.success).length;
    return json({ success: true, total: resultados.length, enviados: okCount, resultados });
  } catch (err) {
    return json({ error: (err as Error)?.message || String(err) }, 500);
  }
});
