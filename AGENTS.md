# Repository guidance

## Completion checks

- Add or update focused unit tests for every behavior change. Cover the public path and meaningful edge/error cases; use integration or compatibility tests when generated Bruno files must be parsed or consumed by another tool.
- Run `npm test` for ordinary changes. Run `npm run test:coverage` for changes that add or alter behavior. The Vitest coverage thresholds enforce at least 80% for lines, branches, functions, and statements; do not lower them to accommodate untested code.
- Run the relevant lint, formatting, and build checks before handoff.

## Fixtures

- Put reusable, realistic input specifications under `test/fixtures/<format-or-domain>/` (for example, `test/fixtures/grpc/`). Keep each fixture focused on the behavior it demonstrates.
- Name fixtures descriptively and keep test-only generated output in temporary directories or ignored test-output paths.
- Pair a new parser format or significant fixture with a fixture integration test. When output has a machine-readable format, validate it using that format's parser where practical.

## Release documentation

- Update `README.md` whenever a change affects supported inputs, public APIs, CLI behavior, generated output, configuration, or user workflow.
- Add an entry to `CHANGELOG.md` for every user-visible change, under the next release version, using the existing Keep a Changelog sections.
- Keep package version, README claims, changelog entries, and behavior consistent before release.
