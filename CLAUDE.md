@AGENTS.md

# Específico do Claude Code

- Hook `Stop` em `.claude/settings.json` roda `scripts/hooks/stop-validate.mjs` (`npm run validate`).
  Se falhar, o turno continua uma vez para corrigir; na segunda parada não bloqueia de novo.
- Revisão pelo Codex: `node scripts/codex-review.mjs --task TASK-NNN --registrar` (somente leitura, ADR 0002/0004).
  Não use o plugin `/codex:*` nem `codex exec` com escrita. Rode em segundo plano se demorar.
- **Explorar código:** se `graphify-out/graph.json` existir, use primeiro `graphify query "<pergunta>"`
  (ou `graphify path "A" "B"` / `graphify explain "X"`) e só depois Grep/Glob para o detalhe.
  Sem grafo: busca nativa (Grep/Glob/Read). O grafo não é versionado (`graphify-out/` no .gitignore);
  como gerar está no README. Economia de tokens com o Graphify neste modelo: **não medida**.
- Sessão nova não interativa (prova de continuidade, tarefa delegada): `node scripts/sessao-agente.mjs "<prompt>"`.
  Ele isola a configuração global do usuário (no piloto: −92% de tokens de entrada). Não use `--bare` (exige chave de API).
