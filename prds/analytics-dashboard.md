## Problem Statement

There’s currently no visibility into how users engage with Ferdinand. As a super admin, I need a clear way to track logins, usage patterns, asset interactions, and Slack bot activity to understand adoption, debug issues, and plan future improvements.

## Goals

- Provide a usage dashboard within Ferdinand visible to super admins only.
- Track and store moderate-level usage analytics (page views, session time, asset interactions).
- Record Slack bot queries and responses in a structured format.
- Allow identification of users and their roles per event.
- Lay groundwork for V2 features like exports, Slack querying, and deeper analytics.

## User Stories

### Super Admin

- As a super admin, I want to see which users have logged in and when, so I can assess product engagement.
- As a super admin, I want to track what sections of the app users are using, so I can see what’s most valuable.
- As a super admin, I want to see which assets are viewed or downloaded by users, so I know what’s getting used.
- As a super admin, I want to track who is using the Slack bot, what they’re asking, and what was returned, so I can monitor quality and fix bugs.
- As a super admin, I want a simple dashboard to view this data inside Ferdinand.

## Key Features

### 1. Session & Usage Tracking (Moderate Depth)

Track the following:

- `user_id`
- `role`
- `login_timestamp`
- `logout_timestamp` (or session end inferred)
- `pages_viewed`: list of Ferdinand sections viewed with timestamps
- `time_spent_per_section` (rough estimate: time between navigations)

**Tracked Sections:**

- Logo System
- Color System
- Type System
- Design System
- User Personas

---

### 2. Asset Usage Tracking

Track both:

- Asset views (on-page preview or modal open)
- Asset downloads

Data captured per event:

- `user_id`
- `role`
- `asset_type` (inferred from file extension or metadata)
- `asset_name`
- `event_type`: `viewed` or `downloaded`
- `timestamp`

---

### 3. Slack Bot Logging

Track every bot interaction:

- `slack_user_id` (mapped to Ferdinand user_id if possible)
- `query_text` (message sent to the bot)
- `bot_response_summary` (summarized output)
- `asset_requested` (if applicable)
- `timestamp`

Store all logs in Ferdinand's backend and display in analytics section under a tab called `Slack Activity`.

---

### 4. Analytics Dashboard

UI visible to Super Admins only:

- Summary Cards:
    - Total logins this week/month
    - Most viewed section
    - Most downloaded asset
    - Most active user (by time or actions)
- Table Views:
    - Full user event log (sortable, filterable)
    - Asset interactions log
    - Slack bot activity log

---

## Technical Requirements

### Data Structure

Create centralized `events` table/log with:

- `event_type` (login, page_view, asset_download, slack_query, etc.)
- `user_id` and `role`
- `payload` (JSON blob: section, asset, query, etc.)
- `timestamp`

### Slack Bot Integration

- If direct DB write access from Slack bot is not possible, use intermediary webhook or queue to funnel logs into Ferdinand’s backend.

---

## Success Criteria (MVP)

- ✅ Super admin can view logins, page visits, and asset activity inside Ferdinand.
- ✅ Slack bot logs appear in the dashboard with basic info.
- ✅ Each event is traceable to a user and timestamped.
- ✅ Dashboard is scoped, performant, and styled consistently with existing UI.

---

## Future Enhancements (V2+)

- Export analytics data as CSV or JSON
- Auto-generate weekly/monthly email reports
- Slack bot command to request reports (`/ferdinand usage this-week`)
- Time-on-page precision (scroll and focus tracking)
- Funnel analysis (e.g., user started onboarding → dropped off)

---

## Non-Goals

- No public user-facing analytics
- No AI-driven insights or recommendations (yet)
- No third-party analytics platform integration