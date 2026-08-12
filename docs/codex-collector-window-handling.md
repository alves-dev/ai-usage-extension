# Codex: tratamento das janelas de uso

O Codex pode trocar a semântica de `primary_window` e `secondary_window`.
Por isso, a extensão sempre classifica as entradas por `limit_window_seconds`:

| Duração | ID | Label padrão |
| ---: | --- | --- |
| `18000` | `short` | `5-hour window` |
| `604800` | `long` | `Weekly window` |

O resultado é enviado em `usage_data.windows`, conforme o [Payload Contract
2.0](payload-contract.md). Janelas de duração desconhecida são ignoradas e
janelas ausentes não são inventadas. Os labels podem ser editados na tela de
opções e são aplicados pelo ID técnico.
