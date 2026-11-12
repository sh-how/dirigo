# Product brief

## One sentence

Dirigo reads the GitHub repositories you contribute to and tells you what is blocked, what needs your decision, and whether you will ship on time.

The name is Latin for "I direct".

## Who it is for

Someone who answers for work in more than one repository: a lead, maintainer or project manager who is also a contributor. They open Dirigo in the morning and want the answer before they have to ask anyone.

They ask three questions, in this order:

1. What is blocked?
2. What needs me?
3. Will we ship on time?

## What it does

- Signs in with GitHub and lets the user choose which repositories to watch.
- Sorts every open issue and pull request into one of four stages: backlog, in progress, needs review, open pull requests.
- Flags the exceptions: blocked items, items waiting on the user, reviews past target, issues with no owner.
- Shows all work across all watched repositories on one board, and the same board for a single repository.
- Projects when each milestone will land at the current pace and compares that with its due date.

## Principles

| Principle | What it means in practice |
|---|---|
| A sentence first | Each page opens with a plain statement of the situation, generated from data |
| Exceptions only | Colour and emphasis are spent on what needs attention; the rest is quiet |
| Three colours, three meanings | Red blocked or late, amber waiting on you, green on track |
| Worst first | Every list is sorted by severity |
| Read-only | Dirigo shows and links; GitHub is where things change |
| Calm | One typeface, generous spacing, no charts for their own sake |

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Form | Hosted web application | Sign-up from a landing page; data kept current by a server; one codebase |
| Host | GitHub only | The user's repositories are on GitHub |
| Actions | None in the app; every action opens GitHub | "Don't reinvent the wheel"; keeps permissions read-only |
| Name | Dirigo | Chosen by the product owner. Trademark and domains not yet checked |
| Logo | A solid half-disc "D" beside the wordmark | Minimal; specified in `docs/03-design-system.md` |
| Views | Cross-repository board and single-repository board both kept | The overview across repositories is the point of the product; the single view is still useful |
| Build | Custom build, not a fork of an existing tool | Smaller codebase, fully owned |

## Out of scope for the first version

- Any write action on GitHub.
- GitLab, Bitbucket or other hosts.
- Teams, organisations, roles, billing and a pricing page.
- Email, Slack or push notifications and digests.
- Charts and analytics beyond what the screens show.
- A desktop or mobile app. A desktop wrapper may come later.
- GitHub Enterprise Server and sign-in by access token. The Connect screen links to it, but the flow is not designed.

## Design directions that were tried and rejected

Do not return to these without being asked.

- A dark "command centre" with every item drawn as a dot. Rejected as not pleasing and not readable.
- A bright palette with one colour per stage, donut and bar charts. Rejected: the colours were disliked and it could not be read at a glance.
- A neutral grey dashboard with many panels. Rejected as generic.

The agreed direction is calm and light: a soft stone background, dark evergreen as the brand colour, and colour used only for status.

## Existing tools reviewed

These were surveyed for reference before the custom build was chosen. Ideas borrowed are noted.

| Tool | What was borrowed |
|---|---|
| Gitdeck (formerly gh-dashboard) | Cross-repository lists and a board; several sign-in modes |
| DashGit | Views by role: assigned, created, review requested, unassigned |
| Mergeable, gh-dash | Sections defined as saved GitHub searches |
| DiffKit | Design-led restraint |
| monday.com, Asana, ClickUp, Jira, Linear, Notion | Portfolio rows with health, status visible at a distance, swimlanes |
