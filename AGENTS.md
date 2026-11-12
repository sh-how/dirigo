# Instructions for the coding agent

Read `docs/00-handoff.md` first for the reading order, then `README.md` for how the code is laid out. These are the rules that hold for all work in this repository.

## Hard rules

1. **Dirigo never writes to GitHub.** No assigning, labelling, commenting, merging, closing or reassigning. Every action button is a link that opens the item on GitHub. Request read-only permissions only. If a task seems to need a write permission, stop and ask.
2. **Never read or store source code.** Dirigo stores metadata only: titles, states, labels, assignees, reviewers, check results, milestones and timestamps.
3. **One user must never see another user's private data.** Every query for repository data must be scoped to repositories the signed-in user can access on GitHub. See `docs/05-architecture.md`.
4. **Colour has three meanings and no others.** Red is blocked or late. Amber is waiting on the signed-in user. Green is on track. Stages (backlog, in progress, needs review, open pull requests) are never colour-coded. Everything else is neutral.
5. **Every page opens with a sentence that states the situation.** For example "Two things are blocking delivery." The sentence is generated from data. See the copy rules in `docs/03-design-system.md`.
6. **Problems first.** Every list is sorted with the worst item at the top. Healthy items stay visually quiet.
7. **Build what is specified.** Do not add pages, charts, settings, notifications or integrations that are not in `docs/02-screens.md`. If something seems missing, add it to `docs/07-open-questions.md` and ask.
8. **Sample data is invented.** Never ship the names, numbers or dates from the mockups as real content. Keep bracketed placeholders marked until real content is supplied.
9. **Do not resolve open questions by guessing.** `docs/07-open-questions.md` lists decisions owed by the product owner. Where one blocks you, ask. Where it does not, build behind the proposed default and keep it easy to change.

## Working method

- Follow the phases in `docs/06-build-plan.md` in order. Each phase has acceptance criteria.
- Build the screens against `design/sample-data.json` before connecting GitHub. The rules engine must reproduce the counts in the mockups from that fixture.
- Compare each built screen with its screenshot in `design/screenshots/` at 1440 px wide.
- Verify GitHub API details (permissions, fields, webhook events, rate limits, token lifetimes) against GitHub's current documentation before relying on them. This package was written from general knowledge and may be out of date.
- Keep all thresholds (review target, stalled-after, pace window) as per-user settings, never constants.

## Definition of done for any screen

- Matches the mockup at 1440 px and reflows to one column at 390 px with no horizontal page scroll.
- Has loading, empty and error states. The agreed empty states are screens 11 to 13.
- Works with keyboard only, with visible focus. Text contrast is at least 4.5:1.
- Status is never conveyed by colour alone: each status has an icon shape and a word.
- Numbers shown agree with each other across screens for the same data.
