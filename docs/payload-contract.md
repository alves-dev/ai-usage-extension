# Payload Contract

Este documento define o contrato esperado pela integracao Home Assistant.

A integracao e a autoridade do contrato. Qualquer source que envie dados, incluindo a extensao de navegador, deve adaptar o payload para este formato antes de chamar o webhook.

## Contrato Base

Todo payload enviado ao Home Assistant deve usar este envelope:

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-05-30T15:40:00.000Z",
  "provider": "codex",
  "status": "ok",
  "account_data": {},
  "plan_data": {},
  "provider_data": {},
  "error": null
}
```

## Campos Do Envelope

### `schema_version`

Versao do contrato do payload.

Valor atual:

```text
1.0
```

### `source`

Origem que coletou os dados.

Valores conhecidos:

```text
browser_extension
shell_script
python_collector
manual_test
```

### `source_version`

Versao da implementacao que coletou os dados.

Para a extensao, deve ser a versao do `manifest.json`.

### `collected_at`

Data/hora da coleta em UTC no formato ISO 8601.

```json
"collected_at": "2026-05-30T15:40:00.000Z"
```

### `provider`

Identificador estavel do provider.

Valores conhecidos:

```text
codex
ollama_cloud
```

### `status`

Resultado principal da coleta.

Valores aceitos:

```text
ok
not_authenticated
provider_unavailable
parse_error
rate_limited
ha_unavailable
unknown_error
```

### `account_data`

Objeto com dados da conta no provider.

Deve ser `{}` quando o provider nao fornecer dados de conta nesta versao.

Campos conhecidos:

```json
{
  "user_id": "user-...",
  "account_id": "acct-...",
  "username": "alves-dev",
  "email": "user@example.com"
}
```

### `plan_data`

Objeto com dados do plano no provider.

Deve ser `{}` quando o provider nao fornecer dados de plano nesta versao.

Campos conhecidos:

```json
{
  "type": "plus"
}
```

### `provider_data`

Objeto especifico do provider.

A integracao deve interpretar esse bloco com base em `provider`. Os campos de `provider_data` nao precisam ter o mesmo formato entre providers, mas cada provider deve manter o formato documentado neste contrato.

### `error`

Erro estruturado.

Em sucesso, deve ser `null`.

Em falha, deve conter:

```json
{
  "code": "not_authenticated",
  "message": "User is not logged in"
}
```

`code` deve ser estavel e facil de usar em automacoes. `message` deve ser legivel para debug.

## Provider: Codex

O provider `codex` usa os dados retornados por `GET https://chatgpt.com/backend-api/wham/usage`.

### Mapeamento

Campos aceitos nesta versao:

```text
response.user_id -> account_data.user_id
response.account_id -> account_data.account_id
response.email -> account_data.email
response.plan_type -> plan_data.type
response.rate_limit -> provider_data.rate_limit
```

Campos ignorados nesta versao:

```text
code_review_rate_limit
additional_rate_limits
credits
spend_control
rate_limit_reached_type
promo
referral_beacon
rate_limit_reset_credits
```

### `provider_data.rate_limit`

O bloco `rate_limit` deve ser enviado como objeto especifico do Codex.

Formato esperado:

```json
{
  "allowed": true,
  "limit_reached": false,
  "primary_window": {
    "used_percent": 15,
    "limit_window_seconds": 18000,
    "reset_after_seconds": 17706,
    "reset_at": 1780434990
  },
  "secondary_window": {
    "used_percent": 21,
    "limit_window_seconds": 604800,
    "reset_after_seconds": 428946,
    "reset_at": 1780846229
  }
}
```

Observacoes:

- `reset_at` dentro de `rate_limit` usa Unix epoch seconds, conforme retornado pelo Codex.
- `used_percent` e numerico e representa percentual ja usado na janela.
- `primary_window` e `secondary_window` sao janelas do provider; a integracao deve tratar o significado delas como especifico do Codex.

### Exemplo Codex

```json
{
  "schema_version": "1.0",
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

## Provider: Ollama Cloud

O provider `ollama_cloud` coleta os limites exibidos na pagina `https://ollama.com/settings`.

### Mapeamento

Campos aceitos nesta versao:

```text
Username -> account_data.username
Email -> account_data.email
Plan -> plan_data.type
Session usage percent -> provider_data.session_usage.used_percent
Session reset time -> provider_data.session_usage.reset_at
Weekly usage percent -> provider_data.weekly_usage.used_percent
Weekly reset time -> provider_data.weekly_usage.reset_at
```

### `account_data`

Formato esperado:

```json
{
  "username": "alves-dev",
  "email": "user@example.com"
}
```

### `plan_data`

Formato esperado:

```json
{
  "type": "free"
}
```

### `provider_data`

Formato esperado:

```json
{
  "session_usage": {
    "used_percent": 0,
    "reset_at": "2026-05-31T19:00:00.000Z"
  },
  "weekly_usage": {
    "used_percent": 4.4,
    "reset_at": "2026-06-01T00:00:00.000Z"
  }
}
```

Observacoes:

- `reset_at` em `session_usage` e `weekly_usage` deve ser ISO 8601 UTC.

### Exemplo Ollama Cloud

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-06-02T15:40:00.000Z",
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
      "reset_at": "2026-05-31T19:00:00.000Z"
    },
    "weekly_usage": {
      "used_percent": 4.4,
      "reset_at": "2026-06-01T00:00:00.000Z"
    }
  },
  "error": null
}
```

## Exemplo De Erro

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-06-02T15:40:00.000Z",
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

## Regras

- O envelope comum deve estar presente em todos os payloads.
- `account_data`, `plan_data` e `provider_data` devem ser objetos, mesmo quando vazios.
- `error` deve ser `null` quando `status` for `ok`.
- Quando `status` nao for `ok`, `error.code` e `error.message` devem estar preenchidos.
- Em erro, `status` deve refletir o erro principal.
- Sources nao devem enviar cookies, tokens, HTML bruto ou API keys.
- Sources nao devem incluir segredos em `account_data`, `plan_data` ou `provider_data`.
- Campos nao documentados neste contrato devem ser ignorados pela integracao nesta versao.
