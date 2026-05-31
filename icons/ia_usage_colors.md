# IA Usage — Color Palette

Guia de cores para uso consistente em UI, documentação, ícones e integrações.

---

## Temas

A identidade visual possui duas variantes oficiais: **Dark** (padrão) e **Light**.

---

## 🌑 Dark Theme

### Background
| Token | Hex | Uso |
|---|---|---|
| `bg-dark-start` | `#111827` | Início do gradiente de fundo |
| `bg-dark-end` | `#0b1120` | Fim do gradiente de fundo |
| `surface` | `#0d1929` | Cards, chips, painéis internos |
| `surface-raised` | `#152236` | Barras de título, elementos elevados |
| `border` | `#1e3a55` | Bordas, linhas separadoras |
| `track` | `#1e293b` | Trilha de barras de progresso |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#e2e8f0` | Texto principal |
| `text-secondary` | `#94a3b8` | Labels, descrições |
| `text-muted` | `#475569` | Texto desabilitado, placeholders |

---

## ☀️ Light Theme

### Background
| Token | Hex | Uso |
|---|---|---|
| `bg-light-start` | `#f0f4ff` | Início do gradiente de fundo |
| `bg-light-end` | `#e4edf8` | Fim do gradiente de fundo |
| `surface` | `#ffffff` | Cards, chips, painéis internos |
| `border` | `#d1dce8` | Bordas, linhas separadoras |
| `track` | `#dde6f0` | Trilha de barras de progresso |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#1e293b` | Texto principal |
| `text-secondary` | `#475569` | Labels, descrições |
| `text-muted` | `#94a3b8` | Texto desabilitado, placeholders |

---

## 🎨 Accent Colors (compartilhadas entre temas)

### Identidade / Brand
| Token | Hex (Dark) | Hex (Light) | Uso |
|---|---|---|---|
| `accent-green` | `#00ffa3` | `#00c48a` | Cor primária "IA", estado seguro |
| `accent-green-alt` | `#00c8ff` | `#0099dd` | Gradiente secundário, barras safe |

### Status — Consumo de Tokens
| Token | Hex (Dark) | Hex (Light) | Uso |
|---|---|---|---|
| `status-safe` | `#00ffa3` | `#00a876` | 0–65% de uso |
| `status-warning` | `#fbbf24` | `#d97706` | 66–85% de uso |
| `status-danger-soft` | `#f97316` | `#ea6c00` | 86–93% de uso |
| `status-danger` | `#ef4444` | `#dc2626` | 94–100% / acima do limite |

### Gradiente da Barra de Limite (Token Meter)
Aplicado da esquerda para a direita na barra principal:

```
0%   →  #00ffa3  (safe / dark)   |  #00c48a  (safe / light)
68%  →  #fbbf24  (warn / dark)   |  #f59e0b  (warn / light)
88%  →  #f97316  (danger / dark) |  #ea6c00  (danger / light)
100% →  #ef4444  (limit / dark)  |  #dc2626  (limit / light)
```

---

## 🔤 Tipografia

| Uso | Fonte | Peso | Tamanho sugerido |
|---|---|---|---|
| Nome da marca ("IA USAGE") | SF Pro Display / Helvetica Neue / Arial | 900 | 62px (ícone) |
| Dados e labels técnicos | SF Mono / Fira Mono / monospace | 400–700 | 13–22px |

- **"IA"** sempre em `accent-green`
- **"USAGE"** sempre em `text-primary`

---

## 🔵 Dots de Status (rodapé)

Três círculos que reforçam o sistema de semáforo:

| Posição | Cor Dark | Cor Light | Significado |
|---|---|---|---|
| Esquerda | `#00ffa3` | `#00c48a` | Safe |
| Centro | `#fbbf24` | `#f59e0b` | Warning |
| Direita | `#ef4444` | `#dc2626` | Danger |

---

## 📐 Uso Correto

**✅ Faça:**
- Use `accent-green` apenas para o "IA" da marca e estado seguro
- Mantenha o gradiente da barra sempre na ordem verde → amarelo → laranja → vermelho
- Em dark, prefira fundos `surface` (`#0d1929`) para elementos elevados
- Em light, use sombras suaves (`drop-shadow`) em vez de bordas escuras

**❌ Evite:**
- Usar vermelho (`status-danger`) fora de contexto de alerta
- Misturar os tons dark e light no mesmo componente
- Substituir a fonte monospace em labels técnicos por serif

---

*Versão 1.0 — gerado junto com os ícones `ia_usage_icon_v4.svg` (dark) e `ia_usage_icon_light.svg` (light)*
