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







## Reviews + Compliance Rules

- `My Reviews` shows pending `review_items` assigned to the logged-in reviewer.
- Table columns: Employee Name, Asset, Okta Group, RBAC URL badge and Approve/Revoke actions.
- Bulk NHI CSV actions in My Reviews:
  - `Export CSV` downloads current pending rows with headers: `Email, Employee Name, Asset, Decision, Notes`.
  - `Import CSV` parses uploaded rows, matches by Email + Asset, and updates `decision` + `notes` on matching pending `review_items` with a success toast.
- Segregation of Duties rule enforced in UI:
  - if reviewer matches employee, Approve is disabled with warning tooltip/message.
- Decisions are submitted via `submit-review-decision` edge function which:
  - updates `review_items` status/decision
  - appends a new immutable `audit_logs` row for every decision.
- `Review History` lists completed campaigns and provides `Export Audit Report` CSV download from `audit_logs`.

## Review Campaign Generation

- Dashboard includes a multi-step Create Campaign wizard:
  - Step 1: campaign name + start/due dates
  - Step 2: scope selection (`all_assets` or searchable multi-select specific assets)
- `generate-review-campaign` edge function executes strict Okta-based generation:
  - For each in-scope asset with `okta_id`, fetch app groups and current group users from Okta
  - Create `review_items` for each user with:
    - `reviewer_email = asset.owner_email`
    - `status = pending`
    - `okta_group = group name`

## Assets + Okta Deep Dive

- Assets page now lists all `assets` table rows in a table and includes a `+ Create Asset` modal (Name, Owner Email, Type, RBAC URL, Okta ID).
- Clicking an asset opens a deep-dive drawer. If `okta_id` exists, the UI calls the `fetch-okta-groups` edge function.
- Drawer displays an accordion of Okta Groups -> Users with user avatars.
- Each group header includes a `Privileged Access` toggle that persists the group ID into `assets.privileged_group_ids` JSONB.

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
supabase functions deploy fetch-okta-groups
supabase functions deploy generate-review-campaign
supabase functions deploy submit-review-decision
```
