# IA Usage — Cores dos Ícones (versão final)

Referência das cores utilizadas nas versões **light** e **dark** dos ícones da integração Home Assistant.

---

## 🌈 Arco de progresso (compartilhado)

O gradiente do arco é idêntico nas duas versões, aplicado da esquerda (0%) para a direita (100%):

| Posição | Hex | Significado |
|---|---|---|
| 0% | `#ef4444` | Sem uso |
| 35% | `#f97316` | Uso baixo |
| 60% | `#fbbf24` | Uso moderado |
| 85% | `#17b6ea` | Uso alto — cor oficial Home Assistant |
| 100% | `#00ffa3` / `#00c48a` | Limite próximo |

> O ponto brilhante na ponta do arco usa sempre `#17b6ea` — a cor primária do Home Assistant.

---

## 🌑 Dark

| Elemento | Hex |
|---|---|
| Fundo (início) | `#111827` |
| Fundo (fim) | `#0b1120` |
| Track do arco | `#1e293b` |
| Anel interno | `#1e293b` |
| Ticks | `#1e3a55` |
| Texto "AI" (início) | `#17b6ea` |
| Texto "AI" (fim) | `#00ffa3` |
| Texto "USAGE" | `#94a3b8` |
| Ponto HA | `#17b6ea` |

---

## ☀️ Light

| Elemento | Hex |
|---|---|
| Fundo (início) | `#f0f4ff` |
| Fundo (fim) | `#e4edf8` |
| Track do arco | `#d1dce8` |
| Anel interno | `#c8d6e5` |
| Ticks | `#c8d6e5` |
| Texto "AI" (início) | `#17b6ea` |
| Texto "AI" (fim) | `#00a876` |
| Texto "USAGE" | `#475569` |
| Ponto HA | `#17b6ea` |

---

## 📁 Arquivos gerados

| Arquivo | Tema | Tamanho | Uso |
|---|---|---|---|
| `icon.png` | Light | 256×256 | HA padrão |
| `icon@2x.png` | Light | 512×512 | HA hDPI/Retina |
| `dark_icon.png` | Dark | 256×256 | HA tema escuro |
| `dark_icon@2x.png` | Dark | 512×512 | HA tema escuro hDPI |

*Versão 2.0 — ícones `ia_usage_light.svg` e `ia_usage_dark.svg`*
