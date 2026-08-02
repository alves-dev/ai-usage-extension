# Codex Collector: tratamento das janelas de uso

Este documento define como o collector deve transformar o response de
`GET /backend-api/wham/usage` no payload enviado ao Home Assistant.

## Regra principal

Os campos `primary_window` e `secondary_window` do Codex nao devem ser usados
para determinar a semantica da janela. O Codex pode mudar qual janela aparece
em cada campo. A classificacao deve usar `limit_window_seconds`:

|  Duracao | Campo no contrato do collector |
|---------:|--------------------------------|
|  `18000` | `five_hour_window`             |
| `604800` | `weekly_window`                |

O contrato do Home Assistant e o schema `1.1`.

## Normalizacao

O collector deve sempre produzir os dois campos semanticos dentro de
`provider_data.rate_limit`:

```json
{
  "allowed": true,
  "limit_reached": false,
  "five_hour_window": null,
  "weekly_window": {
    "used_percent": 59,
    "limit_window_seconds": 604800,
    "reset_after_seconds": 69577,
    "reset_at": 1780310621
  }
}
```

Nesse exemplo, o Codex informou somente a janela semanal. A janela de 5 horas
deve permanecer `null`; nunca copie os dados semanais para ela.

Quando as duas janelas forem informadas, o resultado será:

```json
{
  "five_hour_window": {
    "used_percent": 10,
    "limit_window_seconds": 18000,
    "reset_after_seconds": 12000,
    "reset_at": 1780434415
  },
  "weekly_window": {
    "used_percent": 59,
    "limit_window_seconds": 604800,
    "reset_after_seconds": 69577,
    "reset_at": 1780310621
  }
}
```

Quando o Codex nao fornecer uma janela, o collector deve enviar `null`. Nao
deve enviar zero, remover o campo, reutilizar uma amostra anterior ou produzir
um status de erro somente por causa da janela ausente.

## Algoritmo recomendado

1. Ler `rate_limit.primary_window` e `rate_limit.secondary_window` do response.
2. Ignorar entradas nulas.
3. Para cada entrada, ler `limit_window_seconds`.
4. Mapear `18000` para `five_hour_window` e `604800` para `weekly_window`.
5. Inicializar os dois campos semanticos com `null` antes do mapeamento.
6. Copiar a estrutura da janela sem alterar seus valores.
7. Enviar o payload com `schema_version: "1.1"`.

Se uma janela tiver uma duracao desconhecida, nao a atribua a uma janela
conhecida. O collector deve registrar o evento para diagnostico e omitir essa
entrada do contrato sem inventar sua semantica.

## Testes obrigatorios

O collector deve cobrir pelo menos estes casos:

- `primary_window` com `18000` e `secondary_window` com `604800`;
- `primary_window` com `604800` e `secondary_window: null`;
- `primary_window: null` e `secondary_window` com `604800`;
- ambas as janelas como `null`;
- duracao desconhecida sem preenchimento de `five_hour_window` ou
  `weekly_window`;
- valores de `used_percent`, `reset_after_seconds` e `reset_at` preservados.

O token de sessao, cookies e qualquer HTML continuam fora do payload. Somente
os dados normalizados devem ser enviados ao Home Assistant.
