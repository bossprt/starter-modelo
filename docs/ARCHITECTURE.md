# Arquitetura — decisões e restrições

<!-- Modelo em branco. Só decisões e restrições, uma por linha; o porquê fica nas ADRs.
     Preencher depois da ADR 0001 (stack). Exemplos de linha (apague):
     - Linguagem, versão mínima do runtime e formato de módulo.
     - Dependências de runtime permitidas (ou "nenhuma").
     - Regras de erro (lançar exceção ou devolver valor).
     - O que é camada fina e o que concentra a regra de negócio. -->

- Scripts do starter em Node `.mjs`, sem bash; lógica pura separada de chamadas a git/gh/disco.
- Estado de tarefas é derivado de PRs e CI (`scripts/project-status.mjs`); nunca escrito em arquivo.
- `npm run validate` é o mesmo comando local, no hook do Claude Code e no CI.
- A PREENCHER: decisões e restrições do projeto.
