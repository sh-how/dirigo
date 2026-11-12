# Design system

The mockups in `design/screens/` are the source of truth. This document names what they contain so it can be built as components. Token values are in `design/tokens.css`.

## Direction

Calm, light and restrained. A soft stone background, white surfaces, dark evergreen for the brand and primary actions, one typeface. Colour is reserved for status. A dark theme follows the operating system setting (see below).

## Logo

- **Mark:** a solid half-disc, 12 px wide and 24 px tall, flat on the left and fully rounded on the right (`border-radius: 0 12px 12px 0`), filled with the brand colour. It reads as a "D" and points forward.
- **Wordmark:** "Dirigo" in Instrument Sans, 21 px, weight 700, letter-spacing -0.03em, in the ink colour.
- **Lockup:** mark then wordmark, 10 px apart, vertically centred.
- No container, outline, gradient or shadow.

## Colour

| Role | Token | Value | Used for |
|---|---|---|---|
| Background | `--color-bg` | `#F4F5F1` | Page |
| Surface | `--color-surface` | `#FFFFFF` | Cards, sidebar, tables |
| Soft surface | `--color-surface-soft` | `#F6F7F4` | Plain work cards, fact strips |
| Fill | `--color-fill` | `#ECEFE9` | Progress tracks, neutral chips |
| Ink | `--color-ink` | `#1B211E` | Primary text |
| Muted | `--color-muted` | `#5A635E` | Secondary text |
| Line | `--color-line` | `#E0E4DD` | Borders and dividers |
| Strong line | `--color-line-strong` | `#B8BFB6` | Input and secondary-button borders |
| Brand | `--color-brand` | `#1C5443` | Logo, primary buttons, links, on-track progress |
| Blocked | `--color-blocked` | `#BF3F27` | Blocked, late, past target |
| Waiting | `--color-waiting-icon` and related | `#9A6200` | Waiting on the user |
| On track | `--color-ok` | `#256B50` | On track, ready to merge, early |

### Dark theme

Added at the product owner's request after the mockups. It switches with the operating system setting (`prefers-color-scheme`) and is defined entirely in the dark block of `design/tokens.css`: components use tokens only, never literal colours. It keeps the same three meanings (red blocked or late, amber waiting on you, green on track) and the same 4.5:1 minimum contrast for text. The brand green is lightened so links and primary buttons read on dark surfaces; text on brand and status fills turns dark. The light theme remains the reference design.

## The status system

This is the core of the interface. Each status has a colour, an icon shape and a word, so it never depends on colour alone.

| Status | Colour | Icon | Words used |
|---|---|---|---|
| Blocked or late | Red | Solid red circle with a white horizontal bar | "Blocked", "Behind", "At risk", "N days late" |
| Waiting on you | Amber | Thick amber ring | "Needs your decision", "Waiting on you" |
| On track | Green | Thin green circle with a check | "On track", "Ready to merge", "N days early" |

Rules:

- A blocked or waiting card gets a 2 px border in its status colour and a small label above its title. All other cards have no border.
- A status pill is the tint background with status-coloured bold text, fully rounded.
- Progress bars are brand green when on track and red when behind or at risk.
- Stages are never colour-coded.
- Grey and bold "no owner" marks an unassigned issue. It is not a status colour.

## Type

One family: Instrument Sans (Google Fonts), weights 400, 500, 600 and 700. Use tabular numerals everywhere.

| Use | Size / line height | Weight | Tracking |
|---|---|---|---|
| Landing hero | 58 / 1.04 | 700 | -0.035em |
| Page headline | 44 / 1.06 | 700 | -0.03em |
| Landing section heading | 36 / 1.1 | 700 | -0.025em |
| Large count | 44 / 1 | 700 | -0.03em |
| Blocked card headline | 22 / 1.2 | 700 | -0.015em |
| Section heading in the app | 20 | 700 | 0 |
| Lead sentence | 18 / 1.5 | 400 | 0 |
| Row title | 17 to 18 / 1.3 | 600 | 0 |
| Body | 16 / 1.5 | 400 | 0 |
| Small | 14 | 400 or 600 | 0 |
| Caption | 13 | 400 or 600 | 0 |
| Smallest allowed | 12 | 400 or 700 | 0 |

Headlines use balanced wrapping. Nothing is set in capitals or in a monospace face.

## Layout

- **App shell:** a 210 px sidebar and a fluid main column with padding 36 px top, 40 px sides, 56 px bottom.
- **Marketing pages:** a centred container up to 1200 px with 32 px side padding.
- **Spacing:** sections 24 to 28 px apart; card padding 18 to 26 px; rows inside a card divided by a 1 px line with 16 to 22 px vertical padding.
- **Radius:** 16 px for large containers and tables, 14 px for cards, 10 px for inputs and navigation items, 8 px for buttons and small work cards, full for pills.
- **Elevation:** almost none. Two shadows exist: the landing preview card and a selected work card.
- **Responsive:** rows wrap and columns stack. The sidebar stacks above content. Wide tables and the stage grid scroll sideways inside their own container; the page never scrolls sideways.
- **Touch targets:** at least 44 px high.

## Components

| Component | Where | Notes |
|---|---|---|
| Sidebar | Screens 4 to 13 | Logo, five navigation items, sync status, Settings link |
| Page header | All app screens | Optional date line, generated headline, one supporting sentence |
| Bucket tabs | Today | Three large counts with icon, label and caption; the active one has a 2 px status border |
| Blocked card | Today | Icon, problem headline, item line, repository chip, three facts, links to GitHub |
| Fact strip | Blocked card | Label and value pairs on a soft surface: holds up, waiting on, since |
| Decision row | Today | Amber ring, title, context line, one outlined link named for the action |
| Milestone block | Today, screen 12 | Status, name, due date, days left, progress bar, projection sentence |
| Stage grid | All work | Stage columns by row group, with header counts |
| Work card | All work, One repository | Variants: plain, blocked, waiting on you, ready to merge, no owner, selected |
| Quick filter | All work, One repository | Pill button with a count; active is filled ink; zero is disabled |
| Repository table | Repositories | Counts per stage, the stuck stage filled red, milestone cell, totals row |
| Review row | Reviews | Title and context, who it waits on, wait bar, days, link |
| Wait bar | Reviews | 140 px track; fill is days waited out of 7; a tick marks the target |
| Timeline row | Milestones | Track from today, due-date tick, landing dot, difference in days |
| Stepper | Connect, Choose repositories | Three steps; done shows a check, current is filled |
| Repository picker row | Choose repositories | Checkbox, name, owner, role, last active, open count; ticked rows are tinted |
| Status pill, status icon | Everywhere | See the status system |
| Buttons | Everywhere | Primary: brand fill, white text. Secondary: white with a strong-line border. Destructive: white with a red border and red text. Text link: brand colour, weight 600 |
| Form controls | Settings, All work, Choose repositories | 44 to 48 px high, strong-line border, 8 to 10 px radius, each with a visible label |
| Empty cell text | All work | Short muted sentence, no icon |
| Preview outline | Screen 11 | Dashed border, used only to preview content that does not exist yet |

## Copy rules

- **Headlines are sentences that state the situation,** ending with a full stop: "Two things are blocking delivery." Page titles that are names ("All work", "Repositories", "Settings") are the exception.
- **Say what is wrong in plain words.** "A review has stalled for 6 days", not "PR #479 stale".
- **Spell out "pull request"** in sentences. "PRs" appears only in tight column headings.
- **Name the next step on the link:** "Review", "Revise", "See the 2 failing checks", "Open on GitHub".
- **Every blocked item answers three questions:** what it holds up, who it is waiting on, since when.
- **Dates** are written as "Wednesday 11 November" in headers and "21 November" or "21 Nov" elsewhere. Durations are "6 days", "yesterday", "4 hours ago".
- **Numbers under ten are words in headlines** ("Two things", "One milestone") and digits everywhere else.
- **Sentence case** for everything. No exclamation marks, no emoji.
- **Singular and plural must be correct:** "1 day", "2 days", "One review has", "Two reviews have".

## Headline generation

Each headline is chosen from the data, most severe condition first. Supporting sentences give the remaining counts.

| Screen | Condition | Headline |
|---|---|---|
| Today | N blocked items, N > 0 | "N things are blocking delivery." ("One thing is blocking delivery.") |
| Today | None blocked, N waiting on you | "N things need your decision." |
| Today | None blocked, none waiting | "Nothing is blocked. Nothing is waiting on you." |
| Today | No repositories | "You are not watching any repositories yet." |
| Reviews | A review waited at least the stalled threshold | "One review has been stuck for N days." |
| Reviews | Some past target, none stalled | "N reviews are past your N-day target." |
| Reviews | All within target | "Every review is within your target." |
| Milestones | Some late or at risk | "One milestone will be late. One is at risk." |
| Milestones | All on track | "Every milestone is on track." |

Only the first and third Today rows, the first Reviews row and the first Milestones row appear in the mockups. The others are proposed wording.

## Accessibility

- Text contrast at least 4.5:1; large text and graphical marks at least 3:1.
- Real `button`, `a`, `input` and `label` elements. Decorative icons are hidden from assistive technology; meaningful graphics have a text label.
- Visible keyboard focus on every control.
- Respect reduced-motion preferences. The mockups contain no animation.
