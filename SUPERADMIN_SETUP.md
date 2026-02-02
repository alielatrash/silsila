# Platform Superadmin Setup Guide

## Overview

The platform superadmin system provides a cross-organizational administrative dashboard for managing all organizations and users on the Teamtakt platform. This is separate from in-organization admin roles.

## Features Implemented

### 1. Database Schema
- **Organization suspension**: `status`, `suspendedAt`, `suspendedReason`, `suspendedBy` fields
- **Platform admins**: `PlatformAdmin` table with user-based access control
- **Activity events**: `ActivityEvent` table for tracking user actions across the platform
- **Admin audit log**: `AdminAuditLog` table for tracking all superadmin actions
- **User activity tracking**: `lastActivityAt` field on User model

### 2. Security & Authorization
- **Platform admin allowlist**: Environment variable `PLATFORM_SUPERADMINS` for bootstrapping
- **Database-driven access**: `PlatformAdmin` table as primary source of truth
- **Server-side enforcement**: All API routes protected with `requirePlatformAdmin()`
- **Middleware protection**: Organization suspension enforced at middleware level

### 3. API Routes

#### Statistics
- `GET /api/superadmin/stats` - Platform-wide statistics and KPIs

#### Organizations
- `GET /api/superadmin/organizations` - List all orgs (paginated, searchable, filterable)
- `GET /api/superadmin/organizations/[orgId]` - Get org details
- `PATCH /api/superadmin/organizations/[orgId]` - Suspend/unsuspend/change plan

#### Users
- `GET /api/superadmin/users` - List all users (paginated, searchable)
- `GET /api/superadmin/users/[userId]` - Get user details
- `PATCH /api/superadmin/users/[userId]` - Disable/enable user

#### Activity & Audit
- `GET /api/superadmin/activity` - Activity events feed
- `GET /api/superadmin/audit` - Admin audit log

### 4. UI Pages
- `/superadmin` - Dashboard with stats overview
- `/superadmin/organizations` - Organizations list with filters
- `/superadmin/organizations/[orgId]` - Org detail with suspension controls
- `/superadmin/users` - Users list with search
- `/superadmin/activity` - Activity feed (ready for implementation)
- `/superadmin/audit` - Audit log (ready for implementation)

### 5. Suspension Enforcement
- **Middleware check**: All authenticated requests check org status
- **Automatic redirect**: Suspended org users redirected to `/suspended` page
- **API-level enforcement**: All API routes respect org suspension status
- **Graceful handling**: Suspended users see clear message with reason

## Setup Instructions

### Step 1: Run Database Migration

The migration has already been applied, but if you need to re-run:

```bash
npx prisma db push
npx prisma generate
```

### Step 2: Set Environment Variables

Add to your `.env` file:

```env
# Platform Superadmin Access
# Comma-separated list of emails that should have platform admin access
# This is used as a fallback when the PlatformAdmin table is empty
PLATFORM_SUPERADMINS="your-email@teamtakt.app,another-admin@teamtakt.app"
```

### Step 3: Grant Platform Admin Access

#### Option A: Via Environment Variable (Bootstrap)
Simply add your email to `PLATFORM_SUPERADMINS` in `.env`. This is useful for initial setup.

#### Option B: Via Database (Recommended for Production)
Once you have at least one platform admin (via env var), use this admin to grant access to others through the UI or via direct database insert:

```sql
INSERT INTO "PlatformAdmin" ("id", "userId", "email", "role", "createdAt", "createdBy")
VALUES (
  'cuid-here',
  'user-id-from-user-table',
  'admin@teamtakt.app',
  'ADMIN',
  NOW(),
  'existing-admin-user-id'
);
```

### Step 4: Access the Superadmin Dashboard

1. Log in to the app with your platform admin account
2. Navigate to `/superadmin`
3. You should see the platform dashboard

If you get a 403 error:
- Verify your email is in `PLATFORM_SUPERADMINS`
- Check that you're logged in
- Ensure database migration completed successfully

## Usage Guide

### Managing Organizations

#### Suspend an Organization
1. Go to `/superadmin/organizations`
2. Click on an organization
3. Click "Suspend" button
4. Enter a reason (required)
5. Confirm suspension

**Effect**: All users in that organization will be immediately blocked from accessing the app and redirected to a suspension notice page.

#### Unsuspend an Organization
1. Go to suspended organization's detail page
2. Click "Unsuspend" button
3. Users can immediately access the app again

#### Change Organization Plan
1. Go to organization detail page
2. Click "Change Plan" button
3. Select new tier (STARTER, PROFESSIONAL, ENTERPRISE)
4. Confirm change

**Note**: This updates the `subscriptionTier` field. If you have Stripe integration, you'll need to also update the Stripe subscription separately.

### Managing Users

#### View All Users
- Navigate to `/superadmin/users`
- Search by name or email
- Click on a user to see details

#### Disable a User
- Go to user detail page
- Click "Disable" button
- User will be logged out and cannot log back in

#### Enable a User
- Go to disabled user's detail page
- Click "Enable" button
- User can log in again

### Viewing Activity

#### Platform-wide Activity
- Navigate to `/superadmin/activity`
- Filter by organization, user, event type, or date range
- See all user actions across all organizations

#### Admin Audit Log
- Navigate to `/superadmin/audit`
- See all actions taken by platform admins
- Includes before/after state for all changes

## Activity Event Logging

### How to Log Activity Events

In your application code, import and use the activity logger:

```typescript
import { logActivity } from '@/lib/activity-logger'

// After a significant user action:
await logActivity({
  session,
  eventType: 'demand.create',
  entityType: 'DemandForecast',
  entityId: newForecast.id,
  metadata: {
    routeKey: newForecast.routeKey,
    totalQty: newForecast.totalQty,
  },
})
```

### Recommended Events to Log

Already defined event types in `activity-logger.ts`:
- `user.login` - User logs in
- `user.register` - New user registration
- `demand.create` - Create demand forecast
- `demand.update` - Update demand forecast
- `demand.import` - Bulk import demands
- `supply.create` - Create supply commitment
- `supply.update` - Update supply commitment
- `org.settings_update` - Organization settings changed
- `org.member_added` - New member invited/added
- `subscription.upgrade` - Plan upgraded

### Where to Add Activity Logging

Key places to add `logActivity()` calls:
1. **Auth routes**: `src/app/api/auth/login/route.ts` (after successful login)
2. **Demand routes**: `src/app/api/demand/route.ts` (POST, PATCH, DELETE)
3. **Supply routes**: `src/app/api/supply/route.ts` (POST, PATCH, DELETE)
4. **Organization routes**: When changing org settings or inviting members
5. **Import routes**: After bulk imports complete

## Security Considerations

### Access Control
- ✅ All superadmin routes protected by `requirePlatformAdmin()`
- ✅ Server-side checks (not just client-side)
- ✅ Middleware enforces org suspension globally
- ✅ Audit log records all admin actions

### Best Practices
1. **Limit platform admins**: Only grant access to trusted employees
2. **Use database method**: After bootstrap, rely on PlatformAdmin table, not env vars
3. **Review audit logs**: Regularly check admin actions
4. **Provide suspension reasons**: Always explain why an org was suspended
5. **Test suspension**: Verify suspended orgs are truly blocked

### Revoking Access

To revoke platform admin access:

```sql
UPDATE "PlatformAdmin"
SET "revokedAt" = NOW(), "revokedBy" = 'admin-user-id'
WHERE "userId" = 'user-to-revoke';
```

Or use the helper function:

```typescript
import { revokePlatformAdmin } from '@/lib/platform-admin'

await revokePlatformAdmin({
  userId: 'user-id',
  revokedBy: session.user.id,
  reason: 'No longer platform admin',
})
```

## Troubleshooting

### "Platform admin access required" error
- Check `PLATFORM_SUPERADMINS` env var is set correctly
- Verify you're logged in with the correct email
- Check `PlatformAdmin` table for your user
- Ensure `revokedAt` is null in PlatformAdmin table

### Organization suspension not working
- Check middleware is running: `src/middleware.ts`
- Verify org status is 'SUSPENDED' in database
- Check suspended page exists: `src/app/(auth)/suspended/page.tsx`
- Look for middleware errors in logs

### Activity events not appearing
- Ensure `logActivity()` calls are added to your routes
- Check ActivityEvent table has records
- Verify organizationId is set correctly
- Check for errors in server logs

### Stats not loading
- Verify all database queries in `src/app/api/superadmin/stats/route.ts` run successfully
- Check for Prisma query errors
- Ensure counts don't timeout (add indexes if needed)

## Future Enhancements

### Planned Features (Not Yet Implemented)
1. **Email notifications**: Notify orgs when suspended/unsuspended
2. **Bulk actions**: Suspend/change plans for multiple orgs at once
3. **Advanced analytics**: Usage trends, retention metrics, churn analysis
4. **Export capabilities**: Export user/org data to CSV
5. **Stripe integration**: Sync plan changes with Stripe subscriptions
6. **Custom price overrides**: Set custom pricing per organization
7. **Seat limits**: Enforce max users per organization based on plan

### To Implement These Features

1. **Email notifications**: Integrate with email service (SendGrid, Postmark, etc.)
2. **Bulk actions**: Add checkboxes to lists + bulk action dropdown
3. **Analytics**: Create aggregation queries, add charting library
4. **Export**: Add CSV generation endpoints
5. **Stripe sync**: Update org detail page to call Stripe API when changing plans

## Testing Checklist

Before deploying to production:

- [ ] Platform admin can access `/superadmin`
- [ ] Non-admin cannot access `/superadmin` (403 error)
- [ ] Can suspend an organization
- [ ] Suspended org users are blocked (redirected to `/suspended`)
- [ ] Can unsuspend an organization
- [ ] Can change organization plan
- [ ] Can disable/enable users
- [ ] Activity events are logged
- [ ] Admin audit log records all actions
- [ ] Pagination works on all list pages
- [ ] Search/filters work correctly
- [ ] Middleware doesn't break public routes

## Support

For issues or questions:
- Check server logs for errors
- Review this documentation
- Check Prisma schema for table structure
- Verify environment variables are set
- Test with different user accounts (admin vs non-admin)

## Migration Notes

If migrating from an existing system:
1. Existing orgs default to `status='ACTIVE'`
2. No users have lastActivityAt initially (will populate on next login)
3. No activity events exist before this system (historical data not tracked)
4. Admin audit log starts from installation date

All platform admin actions from this point forward will be logged.
