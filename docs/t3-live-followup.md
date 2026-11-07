FOLLOW-UP (queue after the redesign milestone; do not interrupt it). The owner has configured an Anthropic API key on this machine for normal testing.
- Never print, log, echo or commit the key or .env contents; report only presence/absence.
- After the visual milestone: verify the provider resolver and pick an Anthropic model ID that is actually available, using official docs or one small authorized request. The default anthropic:claude-sonnet-5-5 was never verified; don't assume it exists. Respect existing config; if the ID is invalid, report the sanitized error and propose a verified ID before changing it.
- Run one bounded live smoke: claims + capabilities on Rin's EXAMPLE artifacts (keeps network out of it) or a public repo already authorized in docs. No private repos or sensitive data.
- Show the results came from the model: valid literal quotes, capabilities only from approved claims. No silent fallback to fixture/recorded output; if live fails, show the real (sanitized) error.
- If an env var, network access or billing is missing, report the real error without secrets. No new spending or plans. Don't use Jev/Exa.
- Update docs/DEMO.md / report with the live-mode result.
