const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function cleanEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function collectMeta(payload, req) {
  return {
    utm_source: payload.utm_source || null,
    utm_medium: payload.utm_medium || null,
    utm_campaign: payload.utm_campaign || null,
    utm_content: payload.utm_content || null,
    utm_term: payload.utm_term || null,
    referrer: payload.referrer || null,
    user_agent: req.headers["user-agent"] || null,
  };
}

function detectKeyType(serviceKey) {
  if (serviceKey.startsWith("sb_secret_")) return "sb_secret";
  if (serviceKey.startsWith("sb_publishable_")) return "sb_publishable";
  if (serviceKey.startsWith("eyJ")) return "legacy_jwt";
  return "unknown";
}

function buildHeaderVariants(serviceKey) {
  const keyType = detectKeyType(serviceKey);
  const base = {
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  // sb_secret: só apikey (Bearer quebra com Invalid JWT)
  // JWT legado: apikey + Authorization Bearer
  if (keyType === "sb_secret" || keyType === "sb_publishable") {
    return [{ ...base }, { ...base, Authorization: `Bearer ${serviceKey}` }];
  }

  return [{ ...base, Authorization: `Bearer ${serviceKey}` }];
}

async function supabaseRequest(supabaseUrl, serviceKey, path, { method = "GET", body, prefer } = {}) {
  const variants = buildHeaderVariants(serviceKey);
  let lastError = null;

  for (const headers of variants) {
    if (prefer) {
      headers.Prefer = prefer;
    }

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (response.ok) {
      return data;
    }

    const message =
      (data && (data.message || data.error_description || data.hint || data.error || data.code)) ||
      `Supabase ${response.status}`;

    lastError = new Error(typeof message === "string" ? message : JSON.stringify(message));
    lastError.status = response.status;
    lastError.details = data;

    // Se deu Invalid JWT, tenta a próxima variante de header
    const msg = String(message).toLowerCase();
    if (msg.includes("jwt") || response.status === 401) {
      continue;
    }
    break;
  }

  throw lastError || new Error("Falha ao falar com o Supabase");
}

async function syncBrevo({ email, name, phone, tags }) {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;

  if (!apiKey || !listId) {
    return { skipped: true };
  }

  const response = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      email,
      updateEnabled: true,
      attributes: {
        FIRSTNAME: name || undefined,
        SMS: phone || undefined,
      },
      listIds: [Number(listId)],
      tags: tags || ["landing"],
    }),
  });

  if (!response.ok && response.status !== 204) {
    const detail = await response.text();
    throw new Error(`Brevo error ${response.status}: ${detail}`);
  }

  return { synced: true };
}

function getConfig() {
  const supabaseUrl = cleanEnv(process.env.SUPABASE_URL || process.env.URL_SUPABASE);
  const serviceKey = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  );
  return { supabaseUrl, serviceKey, keyType: detectKeyType(serviceKey) };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return json(res, 204, {});
  }

  const { supabaseUrl, serviceKey, keyType } = getConfig();

  // Diagnóstico sem gravar dados
  if (req.method === "GET") {
    if (!supabaseUrl || !serviceKey) {
      return json(res, 503, {
        ok: false,
        error: "Variáveis ausentes",
        hasUrl: Boolean(supabaseUrl),
        hasKey: Boolean(serviceKey),
      });
    }

    const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl);
    let probe = null;
    try {
      await supabaseRequest(supabaseUrl, serviceKey, "customers?select=id&limit=1", {
        method: "GET",
        prefer: "count=exact",
      });
      probe = { ok: true };
    } catch (error) {
      probe = {
        ok: false,
        status: error.status || null,
        detail: error.message || "erro",
      };
    }

    return json(res, probe.ok ? 200 : 500, {
      ok: probe.ok,
      urlOk,
      keyType,
      hint:
        keyType === "sb_publishable"
          ? "Troque pela chave secreta (sb_secret_) ou service_role legada"
          : keyType === "sb_secret" && !probe.ok
            ? "Se continuar falhando, use a aba legada service_role (eyJ...) na Vercel"
            : null,
      probe,
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceKey) {
    return json(res, 503, { error: "Lead capture not configured" });
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
    return json(res, 503, {
      error: "URL_SUPABASE inválida. Use https://SEU_PROJETO.supabase.co",
    });
  }

  if (keyType === "sb_publishable") {
    return json(res, 503, {
      error: "Chave publicável no lugar da secreta. Use sb_secret_ ou service_role.",
    });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }

  if (payload.company) {
    return json(res, 200, { ok: true });
  }

  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const name = String(payload.name || "").trim().slice(0, 120);
  const phone = String(payload.phone || "").trim().slice(0, 40);
  const source = String(payload.source || "landing").trim().slice(0, 80);
  const pageUrl = String(payload.page_url || "").trim().slice(0, 500);
  const consentEmail = Boolean(payload.consent_email);

  if (!EMAIL_RE.test(email)) {
    return json(res, 400, { error: "E-mail inválido" });
  }

  if (!consentEmail) {
    return json(res, 400, { error: "Consentimento de e-mail é obrigatório" });
  }

  const meta = collectMeta(payload, req);
  const tags = Array.from(new Set(["landing", source].filter(Boolean)));
  const customerRow = {
    email,
    name: name || null,
    phone: phone || null,
    source,
    consent_email: true,
    consent_at: new Date().toISOString(),
    tags,
    meta,
  };

  try {
    const customers = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      "customers?on_conflict=email",
      {
        method: "POST",
        body: customerRow,
        prefer: "resolution=merge-duplicates,return=representation",
      }
    );

    const customer = Array.isArray(customers) ? customers[0] : customers;

    if (!customer || !customer.id) {
      return json(res, 500, { error: "Cadastro não retornou o cliente" });
    }

    try {
      await supabaseRequest(supabaseUrl, serviceKey, "lead_events", {
        method: "POST",
        body: {
          customer_id: customer.id,
          event_type: "email_signup",
          source,
          page_url: pageUrl || null,
          meta,
        },
        prefer: "return=minimal",
      });
    } catch (eventError) {
      console.error("lead_events insert", eventError);
    }

    try {
      await syncBrevo({ email, name, phone, tags });
    } catch (error) {
      console.error("brevo sync", error);
    }

    return json(res, 200, { ok: true, customer_id: customer.id });
  } catch (error) {
    console.error("customers upsert", error);
    return json(res, 500, {
      error: "Não foi possível salvar o cadastro",
      detail: error && error.message ? error.message : "erro desconhecido",
      keyType,
      hint:
        "No Supabase → API Keys → aba legada, copie service_role (eyJ...) e cole em SUPABASE_SERVICE_ROLE_KEY na Vercel. Redeploy.",
    });
  }
};
