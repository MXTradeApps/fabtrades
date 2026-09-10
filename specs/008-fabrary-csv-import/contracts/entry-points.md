# Contract: Fabrary import entry points

**Import from Fabrary** lives on **that Binder’s settings**. App-wide Settings, Want List, Trade, and shared Binder are not entries.

## In scope

| Surface | Control | When shown | Action |
| --- | --- | --- | --- |
| Mobile Binder grid | Tile menu **Settings** | Live Binder tile | Pushes Binder Settings for that `binderId` |
| Mobile open Binder | App bar **Settings** | A Binder is open (empty or not) | Pushes Binder Settings for the open Binder |
| Web Binder grid | Tile menu **Settings** | Live Binder tile | Navigates to `/binder/settings?b={clientId}` |
| Web open Binder | Header **Settings** | Owner list for one Binder | Navigates to `/binder/settings?b=` that Binder |

Visible text / accessible name for the new menu/header control: **Settings**. The import action itself is labeled **Import from Fabrary** on the settings page ([binder-settings.md](./binder-settings.md)).

Settings is available on an **empty** Binder (that is how a player first fills Collection). Collection Stats stays hidden when empty; do not hide Settings for the same reason.

## Out of scope (must not)

| Surface | Why |
| --- | --- |
| App-wide Settings | FR-001 |
| Mobile Want List tab / web `/wants` | Want List is not a Binder |
| Web hamburger | No Import / Binder Settings item that bypasses `/binder` |
| Web `/b/:token` | Public share is not the owner’s Binder |
| Mobile tab bar | Not a fifth tab |
| Confirm Trade / scan / card detail | Existing add paths unchanged |

## Auth

| Surface | Rule |
| --- | --- |
| Mobile | Settings + import work signed out when Binders are on device |
| Web | Same sign-in gate as `/binder`. Do not invent a local web Binder |

## Onboarding / copy

No new tour required to ship. Do not teach Want List as a Binder. Do not label the Binder tab Collection.
