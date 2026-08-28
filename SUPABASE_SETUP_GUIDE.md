# TrabaWho Supabase Setup Guide

## Step 1: Create `.env.local` File

Create a file named `.env.local` in the root of your project (`c:\Users\Joshua\trabawho\.env.local`) with these variables:

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://dczhfpcfqlygpbqjctwf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_YFgfiGPizdbN-jtd9suIJw__NVqsltC
```

> **Important**: Replace these values with your actual Supabase project URL and API key if they differ.

---

## Step 2: Apply SQL Schema in Supabase

1. **Go to your Supabase Project**
   - Visit https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "+ New Query"

3. **Copy and Run the Complete Schema**
   - Open the file: `supabase/COMPLETE_SCHEMA_CONSOLIDATED.sql`
   - Copy the entire contents
   - Paste it into the Supabase SQL editor
   - Click "Run" button

4. **Verify All Tables Created**
   - Go to "Table Editor" in the left sidebar
   - You should see:
     - `public.profiles`
     - `public.worker_profiles`
     - `public.sellers`
     - `public.services`
     - `public.service_slots`
     - `public.bookings`
     - And all other related tables

---

## Step 3: Verify RLS Policies are Enabled

1. **Check RLS Status**
   - In the "Table Editor", click on each table
   - Go to "RLS" tab
   - Verify "Enable RLS" is toggled ON (blue)

2. **Verify Policies**
   - Click "Policies" to see the RLS policies applied
   - You should see multiple policies for each table

---

## Step 4: Verify API is Exposed

1. **Go to API Settings**
   - Click "Settings" in left sidebar → "API"
   - Verify that the `public` schema is exposed in the "Exposed schemas"
   - All table names should be listed under "Tables and functions"

2. **Check Anonymous Access**
   - For client-side auth to work, your anon key should have permissions
   - Go to "Settings" → "API"
   - Verify the anon key has the right permissions

---

## Step 5:  Verify Auth Configuration

1. **Email/Password Auth Enabled**
   - Go to "Settings" → "Auth"
   - Under "Email" provider, ensure it's enabled
   - Turn ON "Confirm email" if you want email verification

2. **Email Templates (Optional)**
   - Customize email templates under "Email Templates" if needed

---

## Step 6: Test the Connection

Run your React app and try the following:

```bash
npm.cmd start
```

Then:
1. **Sign Up**: Create a new account
2. **Verify Profile Created**: Check Supabase Table Editor → `profiles` table should show your new user
3. **Become a Seller**: Go to onboarding and fill out seller information
4. **Verify Seller Record**: Check `sellers` table should show your new seller record

---

## Common Issues & Fixes

### Error: "TypeError: Failed to fetch"
**Causes:**
- Environment variables are wrong or missing
- Supabase API is down
- CORS is not configured (usually not an issue on Supabase's managed platform)

**Solution:**
1. Verify `.env.local` exists with correct values
2. Check your Supabase project URL is correct
3. Restart React dev server: `npm.cmd start`

---

### Error: "Table 'public.sellers' does not exist"
**Cause:** The SQL schema hasn't been run yet

**Solution:**
1. Run the complete SQL file in Supabase SQL editor
2. Wait for completion (usually takes 5-10 seconds)
3. Refresh your React app

---

### Error: "Permission denied for schema public"
**Cause:** RLS policies are blocking the request, or table doesn't have proper RLS setup

**Solution:**
1. Verify RLS is enabled on the table
2. Verify policies are created
3. Check that `auth.uid()` is available (user must be logged in)

---

### Error: "Row-level security policy blocked this operation"
**Cause:** RLS policy doesn't match the current user

**Solution:**
1. Verify the user is authenticated
2. Check the RLS policy condition matches your user ID
3. Verify `auth.uid()` matches the user_id in the table

---

## File Changes Made

The following file was created to consolidate all SQL schemas:
- `supabase/COMPLETE_SCHEMA_CONSOLIDATED.sql` - Contains all tables, indexes, RLS policies, and triggers in one file

## Next Steps

1. ✅ Create `.env.local` with Supabase credentials
2. ✅ Run `COMPLETE_SCHEMA_CONSOLIDATED.sql` in Supabase SQL Editor
3. ✅ Verify tables and RLS policies are created
4. ✅ Restart React app: `npm.cmd start`
5. ✅ Test sign-up and seller onboarding

If you still see errors, please share:
- The exact error message
- Your Supabase project URL (without the API key)
- Whether the SQL script ran successfully
