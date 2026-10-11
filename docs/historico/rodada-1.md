# Rodada 1 — registro de encerramento

- Data: 10/10/2026
- Estado: **fechado**. Registro histórico, não é documento vivo e não será atualizado.
- Repositórios: `bossprt/starter-piloto` (piloto: validador de CPF/CNPJ) e `bossprt/starter-modelo` (este modelo).
- Referências: PRs do piloto aparecem como `piloto#N`; os deste repositório, como `modelo#N`. Números não medidos estão como "não disponível".

## 1. Provas

| Prova | Resultado | Evidência |
| --- | --- | --- |
| Hook Stop (validate ao fim do turno, sem laço) | passou | teste local: passa, bloqueia uma vez, libera com `stop_hook_active` |
| TASK-001 pelo fluxo do AGENTS.md | passou | piloto#3 (CI verde, revisão do Codex) |
| CI vermelho bloqueia merge | passou depois da proteção | piloto#4 falhou, mas era mergeável (sem proteção); piloto#22 `BLOCKED` (run 38091812659) |
| Proteção por ruleset | passou | rulesets 24854218 (piloto) e 24858072 (modelo); `npm run status` = "protegida" |
| Recuperação de contexto (sessão nova, "estado e próxima tarefa") | parcial | leu só o necessário, mas não apontou a TASK-002 (bloqueios do momento) |
| Handoff de execução para o Codex | falhou → experimento | shell do Codex não abriu no Windows (pendência piloto#5). Depois concluiu a TASK-002 só com contornos (piloto#10) → ADR 0002 |
| Continuidade com sessão nova do Claude ("execute a próxima tarefa") | passou | TASK-003 até o PR (piloto#12), com revisão e pendência de aceite (piloto#13) |
| Bloqueio por decisão do dono (TASK-004) | passou | pendência piloto#6 aberta com opções; nada implementado até a decisão; depois piloto#15 |
| Integração automática `ci+revisao` | passou | piloto#15 |
| Revisão verificável (registro no commit + check) | passou | piloto#17; só documentação ok (piloto#19, run 38091123217); sem registro falha (piloto#20, run 38091185225); `BLOCKED` com check obrigatório (piloto#22) |
| CI só em PR, atalho para mudança só de `.md` | passou | piloto#18 e piloto#21; run 38091123217 (estrutura sem `npm ci`) |
| Varredura de segredos (gitleaks) | passou | local: histórico limpo saiu com 0, token falso detectado (saída 1); no GitHub: run 38093829074 (modelo#1) |
| Modelo: sessão nova pede a ideia e não constrói | passou | projeto de teste local, sem alterar arquivos; não passou pelo GitHub (o modelo ainda não estava publicado) |
| Graphify nas sessões isoladas | passou | sessão rodou `graphify query` (modelo#1) |
| Teto da revisão do Codex | passou | modelo#2: estimativa acima do teto parou com código 4; revisões em 1 turno, sem ferramentas |

**Não testado no GitHub:**
- recusa do `npm run ruleset` em repositório privado no plano Free (só testes unitários);
- pendência automática do `npm run trafego` (só testes unitários; a leitura real do piloto deu 0 em tudo);
- a política `strict` de checks atualizados (decidida "não", ADR 0004);
- Betterleaks v2 como substituto do gitleaks.

## 2. Decisões

| ADR | Decisão | Onde |
| --- | --- | --- |
| 0001 | Stack do piloto: TypeScript ~6.0.3, Vitest, ESLint. No modelo, vira modelo em branco | piloto; modelo |
| 0002 | Claude Code executa; Codex só revisa, em somente leitura; `danger-full-access` proibido | piloto#11; modelo |
| 0003 | Código integra sem aceite humano (`ci+revisao`). O dono decide produto, custo e o que é irreversível. Arquivos do starter só em PR próprio. Agentes assinam commits e PRs | piloto#16; modelo |
| 0004 | Revisão registrada em commit vazio + check `revisao-registrada`. Limitação da credencial única. `strict` = não | piloto#17 e piloto#23; modelo |
| 0005 | gitleaks CLI 8.30.1 com SHA-256 no `validate`, mais as proteções nativas grátis do GitHub | modelo |
| 0006 | Revisão só sobre o diff, sem ferramentas, teto de 60.000 tokens (código 4) | modelo#2 |

Outras decisões do dono:
- formato JSON B (piloto#6);
- orçamento zero além das assinaturas (piloto#21);
- não ativar o escopo `user` no token;
- não criar identidade própria para o revisor;
- `-h` não vira tarefa (piloto#14);
- Codex não executa o Graphify na revisão.

## 3. Números

**Sessões novas do Claude** (tokens de entrada; custo informado pela CLI):

| Sessão | Entrada | Custo |
| --- | --- | --- |
| Etapa 6, sem isolação | 185.852 | US$ 0,379 |
| Etapa 6 repetida, sem isolação | 263.180 | US$ 0,397 |
| Continuidade (TASK-003), sem isolação | cerca de 3,73 milhões | US$ 1,80 (último valor informado) |
| Mesma pergunta da Etapa 6, isolada (flags diretas) | 20.409 | US$ 0,067 |
| Mesma pergunta, via `scripts/sessao-agente.mjs` | 21.447 | US$ 0,060 |
| Modelo: "o que falta para começar", isolada | 51.570 | US$ 0,113 |
| Modelo: pergunta sobre código com Graphify, isolada | 96.006 | US$ 0,206 |

Causa: a configuração global do usuário (145 ferramentas, 153 skills, MCPs, hooks) era relida a cada turno.
Contexto da 1ª chamada: cerca de 41 mil tokens sem isolação, cerca de 10,5 mil com isolação.

**Revisões do Codex** (tokens por revisão):

| Modo | Tokens |
| --- | --- |
| Diff no prompt, sem ferramentas (início do piloto) | 11.812 a 14.969 |
| Agêntico, PRs de documentação | 29.514 a 145.810 |
| Agêntico, PRs de código | 194.663 a 271.843 |
| Agêntico, revisão completa do modelo | 470.527 |
| Agêntico, Graphify travado (modelo#1) | 557.615 |
| Com teto (ADR 0006), 9 revisões em modelo#2 | 22.284 a 24.602 |

**Cotas no fim do dia** (última leitura disponível):

| Serviço | Janela de 5h | Semanal | Leitura |
| --- | --- | --- | --- |
| Claude Code | 27% | 5% (7 dias) | 23:03 UTC |
| Codex | 42% | 7% | 00:01 UTC de 11/10 |
| GitHub Actions | grátis em repositório público | — | — |

Tokens da sessão principal do Claude: não disponível.

## 4. Lições

- **Codex como executor:**
  - no Windows, o sandbox elevado do Codex 0.162.x não abre shell (os error 32; openai/codex#52501);
  - com contornos, ele concluiu a TASK-002 (piloto#10), mas integrou antes da revisão e fechou sozinho uma pendência do dono;
  - resultado: papel de revisor, só leitura (ADR 0002).
- **Defeitos reais encontrados pela revisão do Codex**, todos corrigidos ou registrados como decisão:
  - regex de bloqueio (piloto#8);
  - bypass do ruleset (piloto#9);
  - tokens lidos do stream errado (piloto#11);
  - quebra de linha na CLI (piloto#12);
  - referência a regra inexistente (piloto#16);
  - registro não atômico (piloto#17);
  - 7 achados de cota e CI (piloto#18);
  - 9 de 10 achados na revisão completa do modelo;
  - todos os de modelo#2.

  Um dos achados de modelo#2 foi defeito do próprio executor: quebra de linha literal num teste, commitada com o validate falhando.
- **Os 8 ciclos de modelo#2:** 3 ciclos normais, mais 5 extras autorizados em três rodadas pelo dono. Cada ciclo custou cerca de 24 mil tokens e foi achando casos de borda cada vez mais estreitos (consumo parcial, evento malformado). Revisão sem classificação de gravidade não para sozinha. Daí o item em aberto sobre bloqueante e melhoria.
- **Medir antes de afirmar:** a economia do Graphify não foi medida e não é afirmada.

## 5. Limitações conhecidas

- **Credencial única:** Claude Code, Codex e dono usam o mesmo token do GitHub. O registro de revisão é declarativo; a autoria real vem do trailer `Agente:` e dos logs locais (ADR 0004).
- **Contorno do Codex no Windows:** `windows.sandbox="unelevated"` no `scripts/codex-review.mjs`, até a OpenAI corrigir o bug (ADRs 0002 e 0006).
- **Proteção em repositório privado no plano Free:** rulesets não se aplicam. Tornar privado desativa a proteção sem aviso; assinar o Pro antes (`docs/regras/repositorio-publico.md`).

## 6. Em aberto (não resolvido nesta rodada)

- Classificar achados da revisão em **bloqueante** ou **melhoria**, e definir o que só vira registro de melhoria. Decisão do dono, pendente.
- Medir o Graphify num projeto com código suficiente (mesma pergunta com e sem grafo).
- Limpar a configuração global do Claude Code do dono (plugins, skills e MCPs que pesam nas sessões não isoladas).
- Testar o claude-mem.
- Rodada 2 com um produto real a partir deste modelo.
