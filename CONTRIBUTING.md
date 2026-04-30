# Contributing

Thanks for considering a contribution. **Note: this project is in active development and not yet open for public access** — see [Status](README.md#status). Drive-by PRs are welcome for the items below; anything larger should start as an issue.

## Priorities

1. **AWS Polly IAM fix** — the TTS provider matrix has `Polly` failing with `AccessDeniedException`. The `iam:GetPolicyVersion` + `polly:SynthesizeSpeech` policy attach is documented in [`docs/VPS_SETUP.md`](docs/VPS_SETUP.md). PR with the corrected policy JSON + a test that exercises the fallback chain is welcome.
2. **Adaptive difficulty** — the companion currently respects the user's CEFR level toggle (A2 / B1 / B2) but does not auto-detect or adjust mid-session. Proposal: track per-turn corrections-per-100-words, raise / lower difficulty when it crosses thresholds.
3. **Pronunciation UI surfacing** — Azure Speech SDK integration exists at the agent layer (`pronunciation.py`) but per-phoneme scoring is not yet rendered in `CompanionBubble`. The score payload is already in the WebSocket message envelope.
4. **Topic Discovery v2** — earlier text-injection version was disabled because of Rust-themed spam. Re-introduce as Rich Link Cards: a separate UI affordance the user can dismiss, rather than text appended to the companion's reply.
5. **Voice message playback** — the user can speak; they cannot yet listen back to their own recording. Backlog item under [`docs/BACKLOG.md`](docs/BACKLOG.md).
6. **Push notifications** — VAPID keys + service worker registration for streak reminders. Schema and route exist (`backend/app/api/routes/push.py`); frontend integration is pending.

## What we will not merge

- Drive-by changes to the TTS provider order without a measured comparison (cost / latency / quality samples).
- New language pairs beyond Russian / English without a partner native speaker reviewing the prompt templates.
- Refactors that bypass the existing 91-test suite. Every PR must keep the suite green.
- UI changes that would require a redesign of `CompanionBubble` / `UserBubble` without a written design doc in `plans/` first.

## Pull request checklist

- [ ] `cd backend && pytest` — 91 tests still green
- [ ] `pnpm --filter @lingua/web typecheck` — TypeScript clean
- [ ] `pnpm --filter @lingua/web test` — Vitest green
- [ ] `pnpm --filter @lingua/web exec playwright test` — E2E suite at least matches current 10/11 baseline (do not regress the 1 known soft fail without a note)
- [ ] If you touched a slash-route or WebSocket envelope: `docs/AI_PIPELINE.md` updated
- [ ] If you added a config knob: `.env.example` updated, `docs/API_KEYS.md` updated
- [ ] `CHANGELOG.md` entry added — Session N format, matching existing voice
- [ ] If user-facing: both `README.md` and `README.ru.md` mirrored

## Style

- Russian responses in `CLAUDE.md` are intentional — the author works in Russian. Code, identifiers, and external API surface stay in English.
- Backend agent files are short and single-purpose. Resist the urge to bundle multiple agents into one.
- Frontend components follow shadcn/ui conventions. Use the `cn()` helper, not template-string class concatenation.
- One feature per PR. Stack PRs if you have multiple.

## Author / maintainer

[@CreatmanCEO](https://github.com/CreatmanCEO) — Nick Podolyak.
