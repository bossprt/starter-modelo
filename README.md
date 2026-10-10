# starter-modelo

Modelo de projeto conduzido por agentes: **Claude Code executa**, **Codex revisa** (só leitura),
o **dono decide** produto, custo e o que é irreversível. Estado vem de PRs e CI; nada de status em arquivo.
Agentes começam por [AGENTS.md](AGENTS.md).

## Começar um projeto novo

| # | Passo | Onde executa | Quem |
| --- | --- | --- | --- |
| 1 | Criar o repositório a partir do modelo (público): botão **Use this template** ou `gh repo create MEU-PROJETO --template bossprt/starter-modelo --public --clone` | GitHub (web ou `gh` no seu terminal) | você |
| 2 | Instalar e conferir: `npm ci` e `npm run validate` | seu terminal, na pasta do projeto | você ou o agente |
| 3 | Criar as etiquetas: `gh label create depende-de-mim -c B60205` e `gh label create aceite-humano -c 0E8A16` | GitHub, via `gh` no seu terminal | você |
| 4 | Proteger a main (uma vez): `npm run ruleset` — PR obrigatório, `validate` e `revisao-registrada` obrigatórios, sem bypass. Diz claramente se o plano não permite | GitHub (API), disparado do seu terminal | **você** |
| 5 | Conferir proteções de segredo (grátis em público): Settings → Advanced Security → secret scanning e push protection ativos | GitHub (web) | você |
| 6 | Revisor: `npm install -g @openai/codex` e `codex login` | seu computador | você |
| 7 | Primeira sessão: no Claude Code, "Leia o AGENTS.md e me diga o que falta para começar." O agente pede a ideia do produto e segue a regra de direção (não constrói nada antes) | Claude Code, na pasta do projeto | você + agente |
| 8 | Preencher `docs/PRODUCT.md`, escolher a stack (ADR 0001, o agente pesquisa e propõe) e trocar a `TASK-001` de exemplo pela primeira tarefa real | repositório (PRs) | você decide, agente escreve |
| 9 | Rotina: `npm run uso` antes de cada tarefa; `npm run trafego` toda semana; `npm run status` a qualquer momento | seu terminal | você ou o agente |

## Avisos

- **Público por padrão.** Sem segredos, dados de cliente ou conteúdo vendável no repositório
  ([docs/regras/repositorio-publico.md](docs/regras/repositorio-publico.md)). O CI varre segredos (gitleaks) em todo PR.
- **Tornar privado desativa a proteção sem aviso** no plano Free (rulesets em privado exigem Pro).
  Ordem: assinar o GitHub Pro **antes**, depois tornar privado, depois conferir `npm run status` = "protegida".
- **Orçamento:** zero além das assinaturas, até o dono dizer outra coisa em
  [docs/metrics/servicos.md](docs/metrics/servicos.md).

## Comandos

`npm run validate` · `npm run status` · `npm run uso` · `npm run trafego` · `npm run ruleset` ·
`node scripts/codex-review.mjs --task TASK-NNN --registrar` · `node scripts/sessao-agente.mjs "<prompt>"` ·
`node scripts/segredos.mjs`
