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
