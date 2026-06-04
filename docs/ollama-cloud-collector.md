# Ollama Cloud Collector

Este documento descreve o fluxo validado na POC para coletar limites de uso do Ollama Cloud a partir da sessão autenticada do navegador.

## Fonte Dos Dados

Página usada para validação manual e coleta:

```text
https://ollama.com/settings
```

O Ollama Cloud não expôs, neste teste, uma API JSON de usage. A página retorna HTML renderizado pelo servidor com os dados necessários nos blocos de usage.

## Dados Coletados

Campos coletados nesta versao:

- username definido pelo usuario;
- email da conta;
- plano atual;
- uso da janela de sessão atual em percentual;
- data/hora de reset da janela de sessão;
- uso semanal em percentual;
- data/hora de reset semanal.

Exemplo:

```json
{
  "account_data": {
    "username": "alves-dev",
    "email": "user@example.com"
  },
  "plan_data": {
    "type": "free"
  },
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

## HTML Observado

O bloco de sessão aparece com o label `Session usage`:

```html
<div>
  <div class="flex justify-between mb-2">
    <span class="text-sm ">Session usage</span>
    <span class="text-sm ">
      0% used
    </span>
  </div>

  <div class="relative group" data-usage-meter>
    <div
      class="relative h-3 overflow-hidden rounded-full bg-neutral-200"
      data-usage-track
      aria-label="Session usage 0% used"
    >
      <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 0%; "></div>
    </div>
  </div>

  <div
    class="text-xs text-neutral-500 mt-1 local-time"
    data-time="2026-05-31T19:00:00Z"
  >
    Resets in 3 hours
  </div>
</div>
```

O bloco semanal aparece com o label `Weekly usage`:

```html
<div>
  <div class="flex justify-between mb-2">
    <span class="text-sm">Weekly usage</span>
    <span class="text-sm ">4.4% used</span>
  </div>

  <div class="relative group" data-usage-meter>
    <div
      class="relative h-3 overflow-hidden rounded-full bg-neutral-200"
      data-usage-track
      aria-label="Weekly usage 4.4% used"
    >
      <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 4.4%">
        <button
          type="button"
          data-usage-segment
          data-model="gpt-oss:120b"
          data-requests="191"
          aria-label="gpt-oss:120b: 191 requests"
        ></button>
      </div>
    </div>
  </div>

  <div
    class="text-xs text-neutral-500 mt-1 local-time"
    data-time="2026-06-01T00:00:00Z"
  >
    Resets in 8 hours
  </div>
</div>
```

## Estratégia De Extração

O collector deve fazer:

1. `GET https://ollama.com/settings` com `credentials: "include"`.
2. Validar que o HTML não é uma página de login.
3. Extrair dados de perfil e plano:
   - `username` de campos ou labels como `Username`, `User name` ou `Handle`;
   - `email` de campos ou texto que contenha e-mail;
   - `plan` de campos ou labels como `Plan`, `Current plan` ou `Subscription`.
4. Procurar o bloco `Session usage`.
5. Dentro desse bloco, extrair:
   - `used_percent` de `aria-label="Session usage 0% used"`;
   - `reset_at` de `data-time="2026-05-31T19:00:00Z"`.
6. Procurar o bloco `Weekly usage`.
7. Dentro desse bloco, extrair:
   - `used_percent` de `aria-label="Weekly usage 4.4% used"`;
   - `reset_at` de `data-time="2026-06-01T00:00:00Z"`.
8. Normalizar datas para ISO com milissegundos, via `new Date(value).toISOString()`.
9. Normalizar `plan` para `plan_data.type`, por exemplo `free`.

## Seletores E Atributos

Preferir atributos estruturais em vez de texto livre:

```text
[data-usage-track]
aria-label="Session usage 0% used"
aria-label="Weekly usage 4.4% used"
[data-time]
```

Regex recomendada para percentual:

```js
/(\d+(?:[,.]\d+)?)\s*%\s*used/i
```

Regex recomendada para reset:

```js
/data-time=["']([^"']+)["']/i
```

## Payload Contratado

Payload validado para o Home Assistant:

```json
{
  "schema_version": "1.0",
  "source": "browser_extension",
  "source_version": "0.1.1",
  "collected_at": "2026-05-31T16:00:00.000Z",
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

## Fallback

O caminho principal deve ser `fetch` direto pelo service worker.

Se falhar por contexto de autenticação, CORS ou HTML incompleto, a extensão pode:

1. Abrir aba inativa em `https://ollama.com/settings`.
2. Injetar script via `chrome.scripting.executeScript`.
3. Ler o DOM da página:
   - extrair `username`, `email` e `plan` a partir de campos, labels ou texto visivel;
   - localizar `[data-usage-track]` cujo `aria-label` começa com `Session usage`;
   - localizar `[data-usage-track]` cujo `aria-label` começa com `Weekly usage`;
   - procurar o `[data-time]` no container pai de cada usage meter.
4. Fechar a aba temporária.

Na POC, o script é executado no `MAIN` world.

## Erros Esperados

Mapeamento recomendado:

```text
HTTP 401 ou 403 -> not_authenticated
HTML com login/sign in -> not_authenticated
HTTP 429 -> rate_limited
HTTP 5xx -> provider_unavailable
Session usage ausente -> parse_error
Weekly usage ausente -> parse_error
Percentual ou data-time ausente -> parse_error
Username, email ou plan ausente -> parse_error
Erro de rede -> provider_unavailable
```

## Segurança

A implementação real deve manter estas regras:

- Não ler cookies diretamente via `chrome.cookies`.
- Não enviar cookies ao Home Assistant.
- Não enviar HTML bruto ao Home Assistant.
- Não armazenar HTML localmente.
- Não usar `<all_urls>` como permissão fixa.
- Manter `https://ollama.com/*` e, se necessário, `https://www.ollama.com/*` como host permissions explícitas.
- Enviar apenas os campos derivados necessários.

## Observações

- O HTML do Ollama Cloud pode mudar sem aviso.
- A estrutura `data-usage-track`, `aria-label` e `data-time` foi validada em 2026-05-31.
- Os segmentos internos em `data-usage-segment`, `data-model` e `data-requests` podem ser úteis depois para detalhar uso por modelo, mas não fazem parte do teste inicial.
- A extensão não faz login automático; se a sessão expirar, o usuário precisa autenticar manualmente no Ollama.
