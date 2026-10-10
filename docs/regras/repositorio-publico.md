# Repositório público

Vale enquanto o repositório for público (o padrão deste modelo: Actions grátis e proteção por ruleset no plano Free).

## Nunca no repositório

- **Segredos:** chaves de API, tokens, senhas, certificados privados, `.env` com valores reais, URLs com credencial.
  Use variáveis de ambiente locais ou secrets do GitHub Actions; no código, só o nome da variável.
- **Dados de cliente ou pessoais:** nomes, documentos, e-mails, telefones, endereços, registros reais —
  nem em testes, fixtures ou exemplos. Use dados sintéticos (ex.: números de documento gerados, nunca de pessoas).
- **Conteúdo vendável:** o que é o produto pago (base de dados curada, prompts proprietários, material de curso,
  modelos treinados, listas de clientes). Repositório público é copiável por qualquer um.

Se algo disso já foi commitado: **não basta apagar no commit seguinte** — o histórico continua público.
Revogue/troque o segredo imediatamente e abra pendência (`depende-de-mim`): reescrever histórico é ação irreversível do dono.

## Como é verificado

- **CI:** passo de varredura de segredos (gitleaks, ADR 0005) dentro do check obrigatório `validate`,
  sobre todo o histórico do PR. Falso positivo: registrar no `.gitleaksignore` com o motivo, em PR próprio de starter.
- **GitHub (grátis em repositório público):** secret scanning e push protection. Conferir em
  Settings → Advanced Security (ou `gh api repos/OWNER/REPO --jq .security_and_analysis`).
- **Revisão do Codex:** o prompt pede segurança; segredos e dados pessoais entram nisso.

## Proteção da main e mudança para privado

- A proteção (ruleset criado por `npm run ruleset`) **só vale em repositório público no plano Free**.
  Em repositório privado, rulesets exigem GitHub Pro (ou Team/Enterprise).
- **Aviso:** tornar privado um repositório protegido **desativa a proteção sem aviso** no plano Free — o ruleset
  continua listado, mas deixa de ser aplicado; PR, `validate` e `revisao-registrada` deixam de ser obrigatórios.
  O `npm run status` passa a mostrar "desprotegida".
- **Ordem correta para tornar privado:** 1) assinar o GitHub Pro; 2) tornar privado; 3) `npm run status` deve
  continuar "protegida". Mudar visibilidade e assinar plano são decisões do dono (ação com custo).
- Sinais para decidir: `npm run trafego` (semanal) registra visitas, clones e forks em `docs/metrics/trafego.md`
  e abre pendência quando aparece fork novo ou salto de clones.
