# Codex Collector

A extensão consulta a sessão autenticada do ChatGPT e o endpoint
`/backend-api/wham/usage`. O token é usado apenas na requisição ao provider e
nunca entra no payload.

O coletor envia conta, plano e janelas no formato comum do [Payload Contract
2.0](payload-contract.md). `primary_window` e `secondary_window` são
classificadas pela duração, nunca pelo nome do campo. A janela de 5 horas usa
`short` e `18000`; a semanal usa `long` e `604800`.
