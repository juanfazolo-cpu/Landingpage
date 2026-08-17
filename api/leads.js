const { createClient } = require("@supabase/supabase-js");

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

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  // Aceita SUPABASE_URL ou URL_SUPABASE (alias na Vercel)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.URL_SUPABASE;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    return json(res, 503, { error: "Lead capture not configured" });
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const meta = collectMeta(payload, req);
  const tags = Array.from(new Set(["landing", source].filter(Boolean)));

  const { data: customer, error: upsertError } = await supabase
    .from("customers")
    .upsert(
      {
        email,
        name: name || null,
        phone: phone || null,
        source,
        consent_email: true,
        consent_at: new Date().toISOString(),
        tags,
        meta,
      },
      { onConflict: "email" }
    )
    .select("id, email")
    .single();

  if (upsertError) {
    console.error("customers upsert", upsertError);
    return json(res, 500, { error: "Não foi possível salvar o cadastro" });
  }

  const { error: eventError } = await supabase.from("lead_events").insert({
    customer_id: customer.id,
    event_type: "email_signup",
    source,
    page_url: pageUrl || null,
    meta,
  });

  if (eventError) {
    console.error("lead_events insert", eventError);
  }

  try {
    await syncBrevo({ email, name, phone, tags });
  } catch (error) {
    console.error("brevo sync", error);
  }

  return json(res, 200, { ok: true, customer_id: customer.id });
};
