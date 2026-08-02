# Codex Collector

Este documento descreve o fluxo validado na POC para coletar dados do Codex a partir da sessão autenticada do navegador.

## Fonte Dos Dados

Página usada para validação manual:

```text
https://chatgpt.com/codex/cloud/settings/analytics
```

Endpoint usado pela página:

```text
GET https://chatgpt.com/backend-api/wham/usage
```

Endpoint usado para obter o token de sessão:

```text
GET https://chatgpt.com/api/auth/session
```

## Fluxo Validado

1. A extensão chama `https://chatgpt.com/api/auth/session` com `credentials: "include"`.
2. A resposta deve conter `accessToken` ou `access_token`.
3. A extensão mantém esse token apenas em memória.
4. A extensão chama `https://chatgpt.com/backend-api/wham/usage` com:

```http
Accept: application/json
Authorization: Bearer <accessToken>
```

5. A request também deve usar `credentials: "include"`.
6. A resposta JSON é parseada pelo collector.
7. O payload enviado ao Home Assistant deve seguir `docs/payload-contract.md`.

## Payload Contratado

Payload esperado pela integração Home Assistant para esta versão:

```json
{
  "schema_version": "1.1",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-06-02T15:40:00.000Z",
  "provider": "codex",
  "status": "ok",
  "account_data": {
    "user_id": "user-...",
    "account_id": "user-...",
    "email": "user@example.com"
  },
  "plan_data": {
    "type": "plus"
  },
  "provider_data": {
    "rate_limit": {
      "allowed": true,
      "limit_reached": false,
      "five_hour_window": {
        "used_percent": 1,
        "limit_window_seconds": 18000,
        "reset_after_seconds": 18000,
        "reset_at": 1780434415
      },
      "weekly_window": {
        "used_percent": 18,
        "limit_window_seconds": 604800,
        "reset_after_seconds": 429815,
        "reset_at": 1780846229
      }
    }
  },
  "error": null
}
```

Mapeamento do response do Codex:

```text
user_id -> account_data.user_id
account_id -> account_data.account_id
email -> account_data.email
plan_type -> plan_data.type
rate_limit -> provider_data.rate_limit
```

## Response Observado

Formato observado em 2026-05-31:

```json
{
  "user_id": "user-...",
  "account_id": "user-...",
  "email": "user@example.com",
  "plan_type": "plus",
  "rate_limit": {
    "allowed": true,
    "limit_reached": false,
    "primary_window": {
      "used_percent": 1,
      "limit_window_seconds": 18000,
      "reset_after_seconds": 18000,
      "reset_at": 1780259045
    },
    "secondary_window": {
      "used_percent": 59,
      "limit_window_seconds": 604800,
      "reset_after_seconds": 69577,
      "reset_at": 1780310621
    }
  },
  "credits": {
    "has_credits": false,
    "unlimited": false,
    "overage_limit_reached": false,
    "balance": "0"
  }
}
```

## Fallback

O caminho principal deve ser a chamada direta pelo service worker.

Se a chamada direta falhar por contexto de autenticação, a extensão pode:

1. Abrir uma aba inativa em `https://chatgpt.com/codex/cloud/settings/analytics`.
2. Injetar um script via `chrome.scripting.executeScript`.
3. Executar o mesmo fluxo dentro do contexto da página:
   - `GET /api/auth/session`
   - `GET /backend-api/wham/usage` com `Authorization: Bearer <accessToken>`
4. Fechar a aba temporária.

Na POC, o script é executado no `MAIN` world para se aproximar do contexto real da página.

## Erros Esperados

Mapeamento recomendado:

```text
HTTP 401 ou 403 em /api/auth/session -> not_authenticated
HTTP 401 ou 403 em /backend-api/wham/usage -> not_authenticated
HTTP 429 -> rate_limited
HTTP 5xx -> provider_unavailable
JSON sem email ou plan_type -> parse_error
Erro de rede -> provider_unavailable
```

## Segurança

A implementação real deve manter estas regras:

- Não armazenar `accessToken`.
- Não enviar `accessToken` ao Home Assistant.
- Não enviar cookies ao Home Assistant.
- Não ler cookies diretamente via `chrome.cookies`.
- Não enviar HTML bruto da página.
- Não usar `<all_urls>` como permissão fixa.
- Manter `https://chatgpt.com/*` como host permission explícita.
- Enviar apenas dados derivados e necessários.

## Observações

- `backend-api/wham/usage` não é API pública documentada e pode mudar.
- O token vem da sessão autenticada do usuário no navegador.
- A extensão não faz login automático; se a sessão expirar, o usuário precisa autenticar manualmente no ChatGPT.
- O endpoint retornou `user_id`, `account_id`, `email`, `plan_type` e `rate_limit` no teste validado.
- Campos como `credits`, `spend_control`, `promo` e `rate_limit_reset_credits` existem no response observado, mas são ignorados nesta versão do contrato.
