# Ollama Cloud Collector

O coletor lê a página autenticada de configurações do Ollama Cloud e extrai as
áreas `Session usage` e `Weekly usage`. O HTML é usado somente durante a coleta
e nunca é enviado ao Home Assistant.

As janelas normalizadas são `session` (`18000` segundos, label padrão
`Session window`) e `weekly` (`604800` segundos, label padrão `Weekly window`).
Se uma janela não estiver presente, ela é omitida; a coleta só falha quando
nenhuma janela válida é encontrada. O ID da conta é um hash estável gerado pelo
coletor quando o provider não fornece um ID próprio.

Consulte o [Payload Contract 2.0](payload-contract.md) para o envelope enviado.
