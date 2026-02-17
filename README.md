# Automated IGA Platform (Prompt-Aligned POC)

This repository is now aligned to the requested prompt set for an end-to-end IGA proof-of-concept.

## Implemented Structure

### Auth & Access Control
- Email signup/login via Supabase Auth.
- Role/status profile model (`user_profiles`) with `pending`, `active`, `suspended` states.
- Admins managed by `app_admins` table.
- Dedicated pages:
  - `/auth`
  - `/pending-approval`
  - `/suspended`

### Dashboard Layout
- Sidebar sections for users:
  - Home, My Reviews, My Assets, Campaign History, Changelog.
- Admin-only sidebar sections:
  - Employees, Assets, Campaigns, Reviews, Audit Items, User Directory, Admins,
    Data Import, Notifications, Audit Logs, Settings, Help Settings.

### Data Model Highlights (`supabase/schema.sql`)
- `app_admins`, `user_profiles`
- `employees` (prompt fields + manual override flag)
- `assets` (prompt fields + cached user count / NHI / manual override)
- `campaigns`, `reviews`, `review_items` (Keep/Revoke + Human/NHI)
- `notification_rules`, `notification_logs`
- `settings` (Okta auto-revocation + retention controls)
- `help_settings`, `help_faq_items`
- `audit_logs`, `error_logs`

### Review Interface
- My Reviews page supports:
  - assigned pending review items
  - Keep/Revoke decisions
  - evidence notes
  - delegation for pending assignments
  - simple completion confetti state

### Integration Edge Functions (Scaffold + Core Stubs)
- Okta: `fetch-okta-groups`, `fetch-okta-users`, `revoke-okta-access`, `test-okta-connection`
- BambooHR: `sync-employees-bamboohr`, `test-bamboohr-connection`
- Google Sheets: `sync-google-sheets-assets`, `sync-google-sheets-review-items`
- Slack: `send-slack-notification`, `fetch-slack-ids`
- Jobs: `run-daily-jobs`, `scheduler-watchdog`

## Local Setup

1. Copy `.env.example` to `.env` and set Supabase credentials.
2. Install dependencies: `npm install`
3. Apply DB schema from `supabase/schema.sql`.
4. Run app: `npm run dev`

## Deploy Edge Functions

```bash
supabase functions deploy fetch-okta-groups
supabase functions deploy fetch-okta-users
supabase functions deploy revoke-okta-access
supabase functions deploy test-okta-connection
supabase functions deploy sync-employees-bamboohr
supabase functions deploy test-bamboohr-connection
supabase functions deploy sync-google-sheets-assets
supabase functions deploy sync-google-sheets-review-items
supabase functions deploy send-slack-notification
supabase functions deploy fetch-slack-ids
supabase functions deploy run-daily-jobs
supabase functions deploy scheduler-watchdog
```
