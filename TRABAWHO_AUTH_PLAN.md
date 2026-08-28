# TrabaWho Auth + Profile Plan

## Supabase project details
- **Project URL:** https://dczhfpcfqlygpbqjctwf.supabase.co
- **Publishable Key:** sb_publishable_YFgfiGPizdbN-jtd9suIJw__NVqsltC
- **Direct Connection String:** postgresql://postgres:[YOUR-PASSWORD]@db.dczhfpcfqlygpbqjctwf.supabase.co:5432/postgres
- **CLI Setup Commands:**
   - supabase login
   - supabase init
   - supabase link --project-ref dczhfpcfqlygpbqjctwf

## Ready-to-paste implementation prompt
Use this prompt when you want to start the authentication build:

> Implement the TrabaWho authentication system using Supabase and Python. Build registration and login first, with a default client role and optional worker role after seller setup. Create and connect the database tables needed for profiles and worker profiles, ensure the Profile page reads accurate user data, and make sure the UI changes from "Become a seller" to "My Work" after worker setup is completed. Keep the implementation feature-by-feature, and use the Supabase project details above for setup.

## Goal
Build registration and login first, with a clean database design that supports:
- Supabase authentication
- Python-backed server logic
- A default **Client** role
- Optional **Seller/Worker** role after "Become a seller" that changes the UI state to **My Work** once the worker/services setup is completed
- Accurate profile data that appears correctly in the Profile page
- A smooth path to finish one feature at a time without breaking the rest of the app

## Main idea
Use **Supabase Auth** for sign-up/sign-in and a separate application database layer for profile and role data.

Supabase Auth will handle:
- email/password authentication
- session handling
- password recovery
- secure user IDs

The application database will handle:
- profile data
- role assignment
- seller/worker onboarding data
- UI-specific user state

## Role model
A user should always start as:
- **client**

After clicking **Become a seller** and completing seller setup, the same account should become:
- **client + worker**

That means the user should still be able to browse and book as a client, while also accessing worker features.

## Recommended data design

### 1. `profiles`
One row per authenticated user.

Suggested fields:
- `id` or `user_id` linked to Supabase Auth user ID
- `full_name`
- `email`
- `phone_number`
- `profile_photo`
- `bio`
- `location`
- `role_status` or `roles`
- `is_client` default `true`
- `is_worker` default `false`
- `created_at`
- `updated_at`

### 2. `worker_profiles`
Only created when the user becomes a seller/worker.

Suggested fields:
- `user_id`
- `service_type`
- `description`
- `pricing_model`
- `fixed_price`
- `hourly_rate`
- `daily_rate`
- `weekly_rate`
- `monthly_rate`
- `payment_advance`
- `payment_after_service`
- `after_service_payment_type`
- `gcash_number`
- `verification_status`
- `created_at`
- `updated_at`

### 3. Optional `user_roles`
If you want the role system to be more flexible later, use a separate table.

Example roles:
- `client`
- `worker`
- `admin`

For this app, a simple `profiles.is_worker` flag may be enough for v1.

## Registration flow

### Client registration
1. User signs up with email/password.
2. Supabase Auth creates the auth user.
3. A `profiles` row is created automatically.
4. Default values are saved:
   - role = client
   - worker = false
5. User is sent to the main client experience.

### Seller/worker setup
1. User clicks **Become a seller**.
2. The app opens the seller onboarding flow.
3. The user fills in service details.
4. A `worker_profiles` row is created.
5. `profiles.is_worker` becomes `true`.
6. The user keeps client access and also gets worker access.

## Login flow
1. User enters email/password.
2. Supabase Auth validates the credentials.
3. The app fetches the user profile by Supabase user ID.
4. The app reads the user role flags.
5. UI routes based on current role state:
   - client view
   - worker view
   - combined client/worker access

## Profile flow
The Profile page should always read from the same source of truth:
- `profiles` for general user data
- `worker_profiles` for seller-specific data

That ensures the displayed name, bio, and photo are accurate after registration or later edits.

## Python backend role
Python should be used for the server-side feature logic that needs more control, such as:
- creating or updating profile rows
- seller onboarding validation
- secure role changes
- syncing app state with the database
- any future business rules

Possible Python stack later:
- FastAPI
- Supabase Python client
- server endpoints for profile bootstrap and onboarding

## Suggested implementation order

### Phase 1: Auth foundation
- Supabase sign-up
- Supabase sign-in
- session persistence
- logout
- password recovery

### Phase 2: Profile foundation
- create profile row on registration
- load profile after login
- update profile editing
- connect Profile page to stored data

### Phase 3: Role foundation
- default client role
- Become a seller flow
- worker profile creation
- client + worker access support

### Phase 4: Feature-by-feature database connection
- bookings
- chats
- payments
- refunds
- worker dashboard
- notifications

## Rules to keep the system clean
- Never assume a user is a worker unless the database says so.
- Never lose client access when worker access is added.
- Keep auth data separate from profile/business data.
- Keep profile updates synchronized with the database.
- Build one feature + its database connection at a time.

## Expected result for v1
After this first step is complete:
- users can register
- users can log in
- profiles are stored correctly
- every account starts as a client
- seller onboarding can safely upgrade the same account into a worker too

## Next step
If this plan looks good, the next file should be the detailed database schema and auth API flow.
