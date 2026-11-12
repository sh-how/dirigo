# Dirigo: handoff package

Dirigo is a hosted web application that reads the GitHub repositories a person contributes to and tells them, on one screen, what is blocked, what needs their decision, and whether each milestone will ship on time. It is read-only: every action happens on GitHub.

This package contains the agreed design and the specification needed to build the first version. Nothing has been implemented yet.

## Read in this order

1. `AGENTS.md`: the rules you must not break while building.
2. `docs/01-product-brief.md`: who it is for, what it does, and the decisions already made.
3. `docs/02-screens.md`: every screen, its route, content, states and links.
4. `docs/03-design-system.md` and `design/tokens.css`: colours, type, components and copy rules.
5. `docs/04-data-and-rules.md`: the domain model and the rules that classify every item.
6. `docs/05-architecture.md`: the recommended stack, GitHub access and security.
7. `docs/06-build-plan.md`: phases with acceptance criteria.
8. `docs/07-open-questions.md`: decisions still owed by the product owner. Ask before guessing.

## What is in the package

| Path | What it is |
|---|---|
| `AGENTS.md` | Hard rules and definition of done for the coding agent |
| `docs/` | The seven specification documents listed above |
| `design/tokens.css` | Design tokens as CSS custom properties |
| `design/screens/*.html` | The 13 agreed screens as standalone HTML, linked to each other. Open `01-landing.html` in a browser and click through |
| `design/screenshots/*.png` | A screenshot of each screen at 1440 px wide |
| `design/screen-sizes.json` | The width and height each screen was designed at |
| `design/sample-data.json` | The sample data shown in the mockups, as a fixture for building and testing. It includes the results the rules must produce |
| `tools/build_fixture.py` | The script that built the fixture. It contains a short reference implementation of the rules and checks the fixture against every figure in the mockups. Run it with `python3 tools/build_fixture.py design/sample-data.json` |

## How to use the mockups

- The HTML files are the visual source of truth for layout, spacing, colour and copy.
- They are static and use inline styles. Treat them as a reference, not as code to copy. Build real components from the tokens.
- They were designed at 1440 px wide. Each layout wraps to a single column on a phone, but phone layouts have not been reviewed.
- All names, numbers and dates in them are invented sample data. `design/sample-data.json` holds the same data in structured form.
- Screens 1 to 10 show one consistent data set. Screen 11 has no data. Screens 12 and 13 each show a different situation (nothing blocked; columns empty), so their numbers are not in the fixture.
- Text in square brackets, such as `[CUSTOMER LOGO]` or `[YOUR GITHUB NAME]`, is a placeholder for real content. Leave it marked until the product owner supplies it.

## Status

| Area | Status |
|---|---|
| Product direction, name, screens | Agreed |
| Visual design | Agreed for desktop; phone layouts not reviewed |
| Read-only, hosted web app, GitHub only | Decided |
| Rules for "blocked", "at risk" and milestone projection | Proposed in `docs/04-data-and-rules.md`, not yet confirmed |
| Stack | Recommended in `docs/05-architecture.md`, not mandated |
| Trademark and domain check for the name "Dirigo" | Not done |
