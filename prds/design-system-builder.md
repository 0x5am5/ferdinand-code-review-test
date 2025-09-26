## Problem Statement

---

Design and marketing teams waste time manually rebuilding or copying brand styles between Ferdinand and Figma. This leads to inconsistencies, duplicated effort, and out-of-sync source-of-truth design systems. Teams need a seamless way to push and pull design tokens between Ferdinand and Figma while maintaining control and accountability.

---

## Goals

- Deliver brand-consistent Figma files to internal or client teams quickly.
- Enable teams to push finalized Ferdinand styles into Figma with zero manual styling.
- Let designers push local changes back to Ferdinand when needed, with version control.
- Eliminate the need for manual Notion syncing or redundant exports.

---

## User Stories

### Green Bull Design Team (Internal)

- As a Green Bull designer, I want to push a client's approved design tokens from Ferdinand to Figma so the client receives a ready-to-use Figma system.

### Client Design Team

- As a client-side designer, I want to import our brand styles into a blank Figma file with one click so I don’t waste time manually setting up tokens and variables.

### Collaborative Workflow

- As a designer, I want to push local updates from Figma back into Ferdinand so that the source-of-truth reflects real-world changes.
- As a design lead, I want to see a changelog of who made what updates and when, so I can review or revert if necessary.
- As a manager, I want the team to be notified when major updates to the design system occur, so everyone stays aligned.

---

## Key Features

### Plugin Features

1. **One-Click Import** – Pull Ferdinand tokens (color, typography, spacing, etc.) into Figma variables.
2. **One-Click Push** – Push updated styles from Figma back to Ferdinand (manual trigger only).
3. **Token Sync Map** – Ferdinand maps its raw and semantic tokens to corresponding Figma variables. Mapping is automatic but editable.
4. **Scoped Imports** – User can choose to import entire token sets or just specific layers (e.g., only typography, only color).

### Versioning & Change Logs

1. **Auto Version Snapshots** – Every push to Ferdinand creates a new version of the design system.
2. **Automatic Logging** – No manual commit messages; Ferdinand logs:
    - Timestamp
    - User email/name
    - Type of change (push or pull)
    - Summary of what changed (auto-generated)
3. **Rollback Functionality** – Users can revert to any previous snapshot.

### Slack Notifications (Phase 2)

- Slack integration (optional) for update alerts:
    - “Ferdinand Update: John Smith pushed new typography tokens from Figma to Ferdinand for [ClientName] at 2:04 PM.”
- Will require integration with existing Slack bot infrastructure (to be developed separately).

---

## Technical Requirements

### Plugin Tech Stack

- Built using Figma Plugin API
- Connects to Ferdinand via REST API (Auth via user token or OAuth)
- Client-side UI for selecting tokens, importing, and pushing

### API Endpoints (to be finalized)

- `GET /tokens` – Pull design tokens from Ferdinand
- `POST /tokens` – Push token update to Ferdinand
- `GET /versions` – Fetch previous versions
- `POST /revert` – Rollback to previous version
- `POST /notify` – (Phase 2) Trigger Slack message

### Data Structure

- Tokens follow Ferdinand’s existing schema: raw and semantic tokens, grouped by type
- Changes are diffed at the token level (e.g., color-primary-500 changed from #0044cc to #0055dd)

---

## Success Criteria

- ✅ Designers can import a full design system into Figma in <2 minutes
- ✅ Pushing updates back to Ferdinand works without conflicts or errors
- ✅ Version history auto-logs user actions with >95% accuracy
- ✅ Slack notifications (when added) trigger in real-time with <5s latency
- ✅ System adoption by all internal teams + 1–2 external clients within first 30 days

---

## Non-Goals

- No real-time two-way sync in V1
- No partial token editing or diff merging in Figma (entire token sets only)
- No inline Notion updates or content sync

---

## Future Considerations

- Live preview of token changes inside the plugin
- Scheduled syncs (e.g., daily pulls)
- Read-only mode for clients with restricted access
- Change approval workflows (e.g., design lead approval before push)