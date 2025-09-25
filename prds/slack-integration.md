## Summary

A natural-language Slack integration that allows users to access brand assets (logos, colors, typography, etc.) and documentation directly from Ferdinand by asking simple questions inside Slack. The system will use an LLM to interpret user intent and route requests to the correct backend response.

---

## Problem Statement

Marketing, design, and dev teams working inside Slack often waste time jumping between tools to find brand assets and style guidance. Ferdinand contains the source of truth, but there's no fast way to retrieve that info in-chat. This integration solves that by letting users speak naturally and receive structured answers (or assets) instantly via Slack.

---

## User Stories

- **Marketing Lead:** “I need the main logo for a pitch deck. I ask in Slack, get a download instantly.”
- **Designer:** “I need our updated brand hex values while updating an email template.”
- **Executive:** “I want to send a vendor our brand guidelines or a font file directly from Slack.”
- **Anyone:** “What’s our headline style?” or “What colors should I use on a warning banner?”

These are not command-driven — they should work with natural queries via LLM interpretation.

---

## Key Features & Requirements

### Functional

- Accepts natural language queries in Slack (not predefined commands).
- Routes queries to appropriate Ferdinand asset or rule (e.g., color hex, font sizes, logo file).
- Returns structured response (formatted text or direct asset).
- Supports follow-up clarifications (e.g., “Can I get that in white?”).
- Allows file delivery or email send (e.g., “Email this logo to our partner”).

### Technical

- Slack app with bot persona.
- Message processing layer using LLM (e.g., OpenAI or open-source model).
- Internal MCP layer or structured API interface for Ferdinand if not yet built.
- Response formatting system for Slack (file cards, blocks, buttons, etc.).
- Logging layer for usage analytics and error reporting.

---

## System Architecture Needs

### API (To Be Built or Confirmed)

You don’t currently have a live API. This integration project must also scope and deliver:

- MCP or API-like interface for LLMs to retrieve:
    - Logos
    - Color codes
    - Typography rules
    - Files (PDFs, brand guides)
    - Figma links
- Authentication (token or OAuth if needed)
- Internal functions for retrieval from storage (e.g., S3, Google Drive)

---

## Example Inputs & Outputs

| Slack Message | Action | Output |
| --- | --- | --- |
| “What’s our primary blue hex code?” | LLM interprets → API call | Slack response: `#0033FF` with context |
| “Send me the dark mode logo” | LLM → logo endpoint → file | Slack file card with logo |
| “Can you email that to Sarah?” | Email trigger | “Sent to [sarah@email.com](mailto:sarah@email.com)” |

---

## Success Criteria

- Users receive correct response in under 5 seconds.
- 90%+ of natural queries return usable asset or response.
- Bot handles at least 10 common intents (colors, logos, fonts, guidelines, emails).
- Email-sending and file-returning work consistently.
- Logs user behavior to help improve query accuracy.

---

## Constraints & Open Questions

- No existing API or MCP → must scope and implement.
- Slack permissions and OAuth must be handled if external use is desired later.
- File access and structure in Ferdinand must be queryable (e.g., files must be tagged or indexed clearly).
- LLM cost and security depending on provider choice.
- Do you want to train your own model for better semantic matching, or use OpenAI/Claude out of the box?