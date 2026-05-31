# Payload Contract

Este documento define o envelope comum que qualquer coletor deve enviar ao Home Assistant.

A regra principal é: o envelope é padronizado, mas `provider_data` é específico de cada provider.

## Formato Base

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-05-30T15:40:00Z",
  "provider": "codex",
  "status": "ok",
  "account_data": {
    "email": "optional@example.com"
  },
  "plan_data": {
    "type": "plus"
  },
  "provider_data": {},
  "error": null
}
```

## Campos Do Envelope

### `schema_version`

Versão do contrato do payload.

Use para evoluir o formato sem quebrar a integração.

```json
"schema_version": "1.0"
```

### `source`

Origem da coleta.

Exemplos:

```text
browser_extension
shell_script
python_collector
manual_test
```

### `source_version`

Versão da implementação que coletou os dados.

Para a extensão, deve ser a versão do `manifest.json`.

### `collected_at`

Data/hora UTC em ISO 8601.

```json
"collected_at": "2026-05-30T15:40:00Z"
```

### `provider`

Identificador estável do provider.

Exemplos:

```text
codex
ollama_cloud
```

### `status`

Status da coleta.

Valores esperados:

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

Objeto k/v com dados de conta.

Exemplos:

```json
{
  "email": "user@example.com",
  "user_id": "user-...",
  "workspace_id": "workspace-..."
}
```

Deve ser `{}` quando não houver dados de conta.

### `plan_data`

Objeto k/v com dados do plano.

Exemplos:

```json
{
  "type": "plus"
}
```

```json
{
  "name": "Pro",
  "tier": "paid",
  "billing_cycle": "monthly"
}
```

Deve ser `{}` quando não houver dados de plano.

### `provider_data`

Objeto específico do provider.

A integração deve interpretar esse bloco com base em `provider`.

Este campo não precisa ter o mesmo formato entre providers.

### `error`

Erro estruturado.

Em sucesso, usar `null`.

Em falha:

```json
{
  "code": "not_authenticated",
  "message": "User is not logged in"
}
```

`code` deve ser estável e fácil de usar em automações. `message` deve ser legível para debug.

## Exemplo Codex

Payload inicial validado:

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-05-30T15:40:00Z",
  "provider": "codex",
  "status": "ok",
  "account_data": {
    "email": "user@example.com"
  },
  "plan_data": {
    "type": "plus"
  },
  "provider_data": {},
  "error": null
}
```

## Exemplo Ollama Cloud

Payload inicial validado:

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.0",
  "collected_at": "2026-05-30T15:40:00Z",
  "provider": "ollama_cloud",
  "status": "ok",
  "account_data": {},
  "plan_data": {},
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

## Exemplo De Erro

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

## Regras

- O envelope comum deve estar presente em todos os payloads.
- `provider_data` pode variar por provider.
- `account_data`, `plan_data` e `provider_data` devem ser objetos, mesmo quando vazios.
- `error` deve ser `null` em sucesso.
- Em erro, `status` deve refletir o erro principal.
- Não enviar cookies, tokens, HTML bruto ou API keys.
- Não incluir segredos em `account_data`, `plan_data` ou `provider_data`.
