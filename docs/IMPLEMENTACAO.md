# Plano de implementação — Taldo Studio 3D

Ecossistema: **site na Vercel** + **banco no Supabase** + **e-mail no Brevo** + **remarketing via GTM** (já no site).

## Fase 1 — Contas (você faz no navegador)

### 1. Supabase
1. Crie conta em [supabase.com](https://supabase.com) → New project (`taldo-studio`).
2. Em **SQL Editor**, cole e rode o arquivo `supabase/migrations/001_customers.sql`.
3. Em **Project Settings → API**, copie:
   - Project URL → `SUPABASE_URL`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`  
   **Nunca** use a service role no frontend.

### 2. Vercel
1. Conta em [vercel.com](https://vercel.com).
2. **Add New Project** → importe `juanfazolo-cpu/Landingpage`.
3. Framework Preset: **Other** (site estático + `/api`).
4. Em **Environment Variables**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy.

### 3. Domínio `taldostudio3d.com.br`
1. Na Vercel: Project → **Settings → Domains** → adicione `taldostudio3d.com.br` e `www`.
2. No DNS do domínio, aponte conforme a Vercel indicar (A/CNAME).
3. Remova o apontamento antigo do GitHub Pages quando o SSL da Vercel estiver ativo.
4. O arquivo `CNAME` do repo pode ficar; a Vercel não depende dele.

### 4. Brevo (e-mail marketing) — opcional nesta semana
1. Conta em [brevo.com](https://www.brevo.com).
2. Crie uma lista (ex.: `Landing Taldo`).
3. Em SMTP & API → API key → `BREVO_API_KEY`.
4. Na Vercel, adicione também `BREVO_LIST_ID` (número da lista).
5. Redeploy.

## Fase 2 — O que já está no código

| Peça | Onde |
|------|------|
| Tabelas `customers` + `lead_events` | `supabase/migrations/001_customers.sql` |
| API de cadastro | `POST /api/leads` |
| Formulário na seção Contato | `index.html` + `script.js` |
| Sync Brevo (se env configurado) | `api/leads.js` |
| Evento GTM `email_signup` | `script.js` |

## Fase 3 — Remarketing (GTM)

O site já tem GTM `GTM-W489C435`. No painel do GTM:
1. Tags Meta Pixel / Google Ads Remarketing.
2. Trigger no evento personalizado `email_signup` (e no `whatsapp_budget_click` que já existe).

## Fase 4 — Crescimento (sem refazer a base)

Com o mesmo Supabase dá para evoluir depois:
- Pedidos / orçamentos ligados a `customers.id`
- Tags de interesse (`bonecos`, `chaveiros`, `relogios`)
- Painel admin (Supabase Auth)
- Sync WhatsApp Business

## Checklist rápido

- [ ] SQL rodado no Supabase
- [ ] Projeto Vercel conectado ao GitHub
- [ ] Env vars `SUPABASE_*` na Vercel
- [ ] Domínio apontando para a Vercel
- [ ] Teste: preencher o formulário em produção → linha em `customers`
- [ ] (Opcional) Brevo + env vars
- [ ] (Opcional) Pixel Meta / Google no GTM

## Teste local da API

```bash
npm install
npx vercel dev
```

Abra o site local e envie o formulário (com as env vars no `.env.local`).
