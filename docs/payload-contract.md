# Payload Contract 2.0

Este é o contrato comum da integração `ai_usage` para providers cujo uso é
organizado em janelas de tempo. O coletor normaliza o payload antes de enviá-lo
ao webhook. Providers sem essa semântica ficam fora deste contrato.

## Envelope

```json
{
  "schema_version": "2.0",
  "collected_at": "2026-08-11T18:40:00.000Z",
  "provider": "codex",
  "status": "ok",
  "collector_data": {
    "id": "browser_extension",
    "version": "2026.8.0",
    "transport": "webhook"
  },
  "account_data": {
    "id": "acct-provider-123",
    "id_kind": "provider_account_id",
    "label": "Personal",
    "username": "alves-dev",
    "email": "user@example.com",
    "plan": { "type": "plus" }
  },
  "usage_data": {
    "windows": [
      {
        "id": "short",
        "label": "5-hour window",
        "duration_seconds": 18000,
        "used_percent": 15,
        "reset_at": "2026-08-11T20:00:00.000Z",
        "limit_reached": false
      }
    ]
  },
  "error": null
}
```

`schema_version` é sempre `2.0`. `collected_at` e `reset_at` são ISO 8601 com
timezone e são enviados em UTC. `provider` é lowercase e `snake_case`.
`status` aceita `ok`, `not_authenticated`, `provider_unavailable`,
`parse_error`, `rate_limited`, `ha_unavailable` e `unknown_error`.

## Coletor e conta

`collector_data.id` identifica a implementação (`browser_extension`,
`shell_script`, `python_collector` ou `manual_test`) e `version` é obrigatório.
O ID do coletor não participa da identidade da conta.

`account_data.id` é obrigatório em sucesso e deve ser opaco e estável dentro do
provider. A integração compõe a identidade usando `provider + id`. Email,
username e label são dados de apresentação; o plano fica em `account_data.plan`.
Em erros, `account_data` pode ser `{}`.

## Janelas

Em sucesso, `usage_data.windows` contém uma ou mais janelas válidas. Cada janela
tem `id`, `label`, `duration_seconds` positivo, `used_percent` entre 0 e 100,
`reset_at` e `limit_reached`. `reset_after_seconds` é opcional e informativo.
Janelas ausentes são omitidas; o coletor não copia outra janela nem envia
`available_percent`.

A integração calcula `available_percent = 100 - used_percent` e cria
`binary_sensor.available`. Esse sensor fica ligado quando existe uma janela com
`limit_reached: false`; sem janelas válidas ou em falha, fica desligado.

## Providers desta extensão

O Codex classifica `primary_window` e `secondary_window` por
`limit_window_seconds`: `18000` vira `short` / `5-hour window` e `604800` vira
`long` / `Weekly window`. O Ollama Cloud usa `session` / `Session window` e
`weekly` / `Weekly window`, com as mesmas durações.

Os labels padrão podem ser editados na tela de opções. A edição é armazenada por
provider e por ID técnico da janela, sem alterar a identidade da conta ou da
janela.

## Erros e segurança

Em sucesso, `error` é `null`; em erro, contém `code` e `message`. Erros de
coleta podem enviar `usage_data.windows: []` e não estar associados a uma conta.
Collectors nunca enviam cookies, tokens, HTML bruto, chaves de API, headers de
autenticação ou URLs privadas.
