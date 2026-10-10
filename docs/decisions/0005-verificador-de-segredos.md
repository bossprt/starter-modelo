# 0005 — Verificador de segredos no CI: gitleaks (CLI) + proteções nativas do GitHub

- Data: 2026-10-10
- Estado: aceita (aplicação de docs/regras/repositorio-publico.md; pedida pelo dono)

## Contexto

O modelo é feito para repositório público: segredo commitado fica no histórico, visível a todos.
É preciso uma verificação no CI, dentro de um check obrigatório, sem conta nova nem custo (orçamento zero).

## Pesquisa (2026-10-10)

Fontes: `gh api repos/<repo>` (estrelas, último push, licença), `gh api repos/<repo>/releases/latest`,
READMEs dos projetos, docs.github.com (about-secret-scanning).

| Opção | Versão / atividade | Licença | Exige conta/chave | Custo | Observação |
| --- | --- | --- | --- | --- | --- |
| **gitleaks** (CLI) | v8.30.1 (2026-03-21); ★29,8 mil; push 2026-09-30 | MIT | não | R$ 0 | Binário único, checksums publicados, `git log`/diretório, `.gitleaksignore` |
| gitleaks-action | v3.0.0 (2026-05-30) | licença própria desde v2 | chave grátis só para organizações | R$ 0 (conta pessoal) | Wrapper da CLI; licença não-MIT, sem ganho sobre a CLI |
| TruffleHog | v3.99.2 (2026-10-08); ★28,4 mil | **AGPL-3.0** | não | R$ 0 | Verifica se o segredo está ativo (chamadas de rede a provedores); mais pesado |
| Betterleaks | v1.9.0 (2026-09-29); v2 em release candidate | MIT | não | R$ 0 | Dos autores do gitleaks; v2 muda CLI/config — esperar estabilizar |
| Kingfisher (MongoDB) | v2.11.1 (2026-10-08); ★1,3 mil | Apache-2.0 | não | R$ 0 | Ativo, base menor |
| ggshield (GitGuardian) | v1.55.0 (2026-09-24) | MIT | **sim** (conta/API key GitGuardian) | grátis limitado | Serviço externo = conta nova (decisão do dono) |
| detect-secrets (Yelp) | v1.5.0 (2024-05-06) | Apache-2.0 | não | R$ 0 | Sem release desde 2024 |
| Nosey Parker | v0.24.0 | Apache-2.0 | — | — | **Arquivado** |
| GitHub secret scanning + push protection | nativo | — | não | **grátis em repositório público** | Roda no GitHub (não no PR como check), bloqueia push com segredo de provedor conhecido |
| Construir | — | — | — | manutenção própria | Sem sentido: regras de detecção são o valor das ferramentas acima |

## Decisão

1. **gitleaks CLI v8.30.1**, baixado do release oficial com **verificação de SHA-256** e rodado como passo
   do job `validate` (já obrigatório no ruleset), sobre os commits do PR (`base..head`), em todo PR —
   inclusive o atalho só-documentação. Falso positivo: `.gitleaksignore` com motivo, em PR de starter.
2. **Proteções nativas do GitHub** (grátis em público): secret scanning e push protection ativos.
   Validity checks e padrões genéricos (non-provider) exigem GitHub Secret Protection (pago): não ativar
   (orçamento zero).
3. Revisar em 6 meses ou quando o Betterleaks v2 estabilizar (mesmos autores, MIT).

## Consequências

- Atualizar a versão do gitleaks exige trocar versão **e** SHA-256 no workflow (PR de starter).
- O passo usa a rede só para baixar o binário do GitHub Releases; não envia segredos a terceiros
  (por isso TruffleHog com verificação ativa ficou de fora como padrão).
