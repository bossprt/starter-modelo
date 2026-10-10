// Ruleset de proteção da main (ADR 0004; docs/regras/repositorio-publico.md). Funções puras.

export const RULESET_NAME = 'proteger-main';
// Checks obrigatórios publicados pelo GitHub Actions (integration_id do app GitHub Actions).
export const REQUIRED_CHECKS = ['validate', 'revisao-registrada'];
export const GITHUB_ACTIONS_APP_ID = 15368;

/** Corpo do POST/PUT /repos/{owner}/{repo}/rulesets: PR obrigatório, dois checks, sem bypass. */
export function buildRulesetBody() {
  return {
    name: RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: false,
          allowed_merge_methods: ['squash'],
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: false,
          do_not_enforce_on_create: false,
          required_status_checks: REQUIRED_CHECKS.map((context) => ({ context, integration_id: GITHUB_ACTIONS_APP_ID })),
        },
      },
    ],
  };
}

/**
 * Traduz a recusa da API. No GitHub Free, ruleset em repositório privado é recusado
 * ("Upgrade to GitHub Pro or make this repository public to enable this feature").
 */
export function explainRulesetError(message, visibility) {
  const text = String(message ?? '');
  if (/upgrade to github pro|make this repository public/i.test(text) || (visibility === 'private' && /HTTP 403/.test(text))) {
    return {
      planBlocked: true,
      message: 'PLANO NÃO PERMITE: repositório privado no GitHub Free não aplica rulesets. '
        + 'Opções do dono: tornar público ou assinar o GitHub Pro. Até lá, o npm run status mostra "desprotegida".',
    };
  }
  if (/HTTP 404|Not Found/i.test(text)) {
    return { planBlocked: false, message: 'Repositório não encontrado ou token sem permissão de administrador.' };
  }
  return { planBlocked: false, message: `Recusado pela API: ${text.trim()}` };
}
