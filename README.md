# AI Usage Extension

POC de extensão Chromium/Chrome Manifest V3 para coletar usage de providers de IA usando a sessão autenticada do navegador e enviar payloads ao Home Assistant.

Neste primeiro teste os providers implementados são:

- Codex
- Ollama Cloud

## Estrutura

```text
.
├── manifest.json
├── src/
│   ├── background/
│   ├── options/
│   ├── providers/
│   ├── services/
│   └── utils/
└── icons/
```

## Extensão

Carregue a raiz deste projeto como extensão não empacotada em `chrome://extensions`.

Permissões fixas:

- `storage`
- `alarms`
- `scripting`
- `tabs`
- `https://chatgpt.com/*`
- `https://ollama.com/*`
- `https://www.ollama.com/*`

O acesso ao host do Home Assistant é solicitado como permissão opcional apenas para a origem configurada.

## Coleta

Cada provider roda como coletor independente. O payload segue o contrato em `docs/payload-contract.md`, mantendo envelope comum como `schema_version`, `source`, `source_version`, `collected_at`, `provider` e `status`.

Codex:

- chama `https://chatgpt.com/backend-api/wham/usage` com `credentials: "include"`;
- se a chamada do service worker falhar, abre `https://chatgpt.com/codex/cloud/settings/analytics` e tenta o mesmo endpoint a partir da página autenticada;
- envia `user_id`, `account_id` e `email` em `account_data`, `plan_type` em `plan_data.type` e `rate_limit` em `provider_data.rate_limit`.

Ollama Cloud:

- chama `https://ollama.com/settings` com `fetch(url, { credentials: "include" })`;
- extrai `username`, `email` e `plan` de campos, labels ou texto visível;
- parseia o HTML procurando os blocos `Session usage` e `Weekly usage`;
- extrai `used_percent` de `aria-label` e `reset_at` de `data-time`;
- se a chamada direta falhar, abre uma aba inativa temporária, injeta um script de leitura e fecha a aba;
- envia ao HA apenas dados derivados, sem cookies, HTML bruto ou API keys.

Os endpoints internos dos providers são candidatos de POC e podem mudar.

## Home Assistant

Esta extensão envia payloads para um webhook do Home Assistant. A integração ou automação que recebe esse webhook fica fora deste repositório.

A URL final segue o formato:

```text
https://SEU_HA/api/webhook/WEBHOOK_ID
```

Se um token for configurado, a extensão envia o header:

```text
X-AI-Usage-Token: TOKEN
```

## Payload

Sucesso Codex:

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-05-30T15:40:00Z",
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
      "primary_window": {
        "used_percent": 1,
        "limit_window_seconds": 18000,
        "reset_after_seconds": 18000,
        "reset_at": 1780434415
      },
      "secondary_window": {
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

Sucesso Ollama Cloud:

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-05-30T15:40:00Z",
  "provider": "ollama_cloud",
  "status": "ok",
  "account_data": {
    "username": "alves-dev",
    "email": "user@example.com"
  },
  "plan_data": {
    "type": "free"
  },
  "provider_data": {
    "session_usage": {
      "used_percent": 0,
      "reset_at": "2026-05-31T19:00:00Z"
    },
    "weekly_usage": {
      "used_percent": 4.4,
      "reset_at": "2026-06-01T00:00:00Z"
    }
  },
  "error": null
}
```

Erro:

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-05-30T15:40:00Z",
  "provider": "codex",
  "status": "not_authenticated",
  "account_data": {},
  "plan_data": {},
  "provider_data": {},
  "error": {
    "code": "not_authenticated",
    "message": "User is not logged in"
  }
}
```

## Status

- `ok`
- `not_authenticated`
- `provider_unavailable`
- `parse_error`
- `rate_limited`
- `ha_unavailable`
- `unknown_error`

## Referências

- Codex: `https://chatgpt.com/codex/pricing/`
- Codex Help: `https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan`
- Ollama Cloud: `https://docs.ollama.com/cloud`
- Ollama API usage metrics: `https://docs.ollama.com/api/usage`
