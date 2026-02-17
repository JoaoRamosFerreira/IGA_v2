# IGA Platform (React + Tailwind + Supabase)

## Setup

1. Copy `.env.example` to `.env` and fill in Supabase credentials.
2. Install dependencies: `npm install`
3. Run the app: `npm run dev`
4. Apply `supabase/schema.sql` in Supabase SQL editor.

## Included

- Supabase auth client wiring (`src/lib/supabase.ts`)
- `admin` / `user` profile roles in `profiles` table and creation trigger.
- Full database schema requested for IGA entities.
- Persistent sidebar nav and placeholder pages for:
  - Dashboard
  - My Reviews
  - Review History
  - Assets
  - Employees
  - Settings
  - POC Overview

## Settings Page Details

- Settings page reads and updates the singleton `system_settings` row with `id=1`.
- Integrations tab includes BambooHR (Employees + Contractors), Okta, and Slack cards.
- General tab includes an editor for `nhi_types` JSON array values.
- Secret fields are masked and show a hint with the final 3 characters when configured.
- BambooHR and Okta cards include "Test Connection" actions that invoke Supabase Edge Functions:
  - `test-bamboohr-connection`
  - `test-okta-connection`

## Employee Directory + Sync Engine

- `sync-employees-bamboohr` edge function supports payload `{ target: 'employees' | 'contractors' | 'all' }`.
- Reads BambooHR settings from `system_settings` and fetches custom reports for employees/contractors.
- Maps BambooHR data into `employees` table and mirrors records by deleting rows not present in the fetched data for mirrored worker types.
- `fetch-slack-ids` edge function fetches Slack workspace users and updates `employees.slack_id` by matching on email.
- Employees page includes tabs for Employees/Contractors and a manual "Sync Slack IDs" trigger.

### Deploy edge functions

```bash
supabase functions deploy test-bamboohr-connection
supabase functions deploy test-okta-connection
supabase functions deploy sync-employees-bamboohr
supabase functions deploy fetch-slack-ids
```
