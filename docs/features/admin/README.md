# Admin Portal

Status: active feature requirements
Route: `/admin` and protected child routes

The Admin portal is TrabaWho’s operations workspace. It follows the application, frontend architecture, and UI standards indexed in [`../../README.md`](../../README.md); those standards take precedence over this feature document.

## Access and safety

- Only authenticated users with the `admin` role may enter any `/admin` route.
- Navigation visibility is not authorization. Supabase RLS and guarded database operations remain authoritative.
- Sensitive actions identify their target, explain their effect, prevent duplicate submission, and require confirmation when destructive.
- Operational counts must come from verified data. Unknown or unavailable data is shown as unavailable rather than replaced with invented metrics.
- Admin actions that change roles, access, moderation state, or settings must be auditable before those workflows are considered complete.

## Information architecture

```text
/admin                 Dashboard
/admin/users           User management
/admin/jobs            Job management
/admin/employers       Employer management
/admin/applications    Application monitoring
/admin/moderation      Reports and content moderation
/admin/audit-logs      Sensitive activity history
/admin/settings        Admin and platform settings
```

Each management area has its own bookmarkable route. The dashboard summarizes work and routes administrators to the appropriate area; it does not contain every CRUD workflow.

## Current delivery boundary

The present frontend supports the operations dashboard, identity review queue, existing account management actions, review-comment moderation, and audit-log empty/data states. Jobs, employers, applications, and settings have protected route shells but remain explicitly marked as not connected until their live database contracts and authorization policies are verified.

## Detailed requirements

- [`dashboard.md`](dashboard.md)
- [`user-management.md`](user-management.md)
- [`job-management.md`](job-management.md)
- [`employer-management.md`](employer-management.md)
- [`application-monitoring.md`](application-monitoring.md)
- [`moderation.md`](moderation.md)
- [`audit-logs.md`](audit-logs.md)
- [`settings.md`](settings.md)
