# 0006 — Revisão do Codex: só o diff, sem ferramentas, com teto de tokens

- Data: 2026-10-10
- Estado: aceita (decisão do dono)

## Contexto

No piloto, as revisões custaram de 12 mil a 557 mil tokens. A diferença veio do **modo** de revisão:
- **Diff entregue no prompt, sem ferramentas (um turno):** 11.812, 12.382 e 14.969 tokens.
- **Codex instruído a rodar `git diff` e "ler o que precisar" (agêntico):** de 29.514 a 33.228 em PRs pequenos
  de documentação; de 194.663 a 271.843 em PRs de código; 557.615 quando ele tentou rodar o Graphify e a consulta travou.
- **Por que cresce:** cada chamada de ferramenta é um turno novo, e todo turno reenvia o contexto inteiro
  (a leitura de cache conta como entrada; ex.: 270.808 de entrada, dos quais 226.560 de cache). O contexto-base
  do Codex com plugins, skills e ferramentas é de cerca de 22,5 mil tokens. Com tudo desligado, cerca de 14,2 mil.

## Decisão

1. `scripts/codex-review.mjs` monta a entrada sozinho: o diff `base...HEAD` (sem `package-lock.json` e `graphify-out/`),
   a tarefa (`--task`), `docs/ARCHITECTURE.md` e a seção "Decisão" de cada ADR.
2. O Codex **não executa ferramentas**. O prompt proíbe, e a configuração desliga: shell, plugins, apps, MCP,
   navegador, subagentes, hooks e AGENTS.md automático. A revisão é um único turno.
3. **Teto:** 60.000 tokens por revisão (entrada + saída), em `DEFAULT_MAX_TOKENS`.
   - Antes de chamar o Codex, o script estima a entrada (~3 caracteres por token, mais a base fixa). Acima do teto,
     não chama.
   - Depois, confere o uso real. Acima do teto, não registra.
   - Nos dois casos, abre pendência `depende-de-mim` (dividir o PR, subir o teto para uma revisão ou seguir sem
     revisão) e sai com código 4.
4. Subir o teto de uma revisão é decisão do dono: `CODEX_REVIEW_MAX_TOKENS=<n>`. Mudar o padrão é PR de starter.

## Consequências

- O revisor não vê o repositório inteiro, só o diff e as regras. Defeito que dependa de código fora do diff
  pode passar. O CI e os testes continuam cobrindo o comportamento.
- PR grande demais para o teto precisa ser dividido. É coerente com "um push por tarefa" e tarefas pequenas.
