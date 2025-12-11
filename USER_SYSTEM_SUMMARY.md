# User System & Notifications - Summary

## Features Implemented

### 1. User Handles (@mentions)
- Every user has a unique `@handle` (auto-generated from username)
- Handles are shown throughout the app (comments, profile)
- Type `@` in comments to mention users
- Mentioned users appear with highlighted styling

### 2. User Invitations
- **Admin Only**: Click the user icon (+) in top nav to invite users
- Enter email + role (freelancer/admin)
- System generates invite link valid for 7 days
- Copy link and send to invitee
- Invitee visits link → creates account with chosen username

### 3. Notifications Inbox
- Bell icon in top nav shows unread count
- Click to see all notifications
- Notification types:
  - **Mention**: When someone @mentions you in a comment
  - **Assignment**: When admin assigns you a template
  - **Status Change**: When your template is reviewed/needs fixes/published
- Click notification to go to the template
- Mark as read or delete notifications

### 4. Freelancer Dashboard Visibility
- Freelancers only see:
  - Unassigned templates (available to take)
  - Templates assigned to themselves
- Cannot see templates assigned to other freelancers

## API Endpoints

### Notifications
```
GET    /api/notifications           - Get all notifications
GET    /api/notifications/unread-count - Get unread count
PUT    /api/notifications/:id/read  - Mark as read
PUT    /api/notifications/mark-all-read - Mark all as read
DELETE /api/notifications/:id       - Delete notification
DELETE /api/notifications           - Clear all
```

### Invitations
```
POST   /api/auth/invitations        - Create invite (admin)
GET    /api/auth/invitations        - List invites (admin)
GET    /api/auth/invitations/check/:token - Check if valid
POST   /api/auth/invitations/accept - Accept & create account
DELETE /api/auth/invitations/:id    - Delete invite
```

### Users
```
GET    /api/auth/users              - List all users (for mentions)
```

## Database Tables Added

### invitations
- `email`, `token`, `role`, `invited_by`, `expires_at`, `accepted_at`

### notifications
- `user_id`, `type`, `title`, `message`, `idea_id`, `from_user_id`, `read_at`

### users (updated)
- Added `handle` column (unique @handle for mentions)

## How It Works

### Inviting a User
1. Admin clicks (+) icon in nav
2. Enters email and role
3. System creates invitation with unique token
4. Admin copies link and sends to user
5. User visits `/register?token=...`
6. User creates account (username becomes @handle)
7. User is logged in automatically

### Mentioning Users
1. In any comment, type `@`
2. Dropdown shows matching users
3. Click to insert mention
4. On submit, mentioned users get notifications

### Status Change Notifications
When admin changes status to:
- `reviewed` → Freelancer notified "Your work has been reviewed"
- `needs_fixes` → Freelancer notified "Your submission needs fixes"
- `published` → Freelancer notified "Your template has been published!"
- `assigned` → Freelancer notified "You have been assigned a new template"

## Files Changed

### Backend
- `db.js` - Added tables for invitations, notifications, handle column
- `auth.js` - Added invitation endpoints, handle generation
- `ideas.js` - Added notification triggers on status change, mention parsing
- `notifications.js` - New file for notification endpoints
- `server.js` - Registered notifications routes

### Frontend
- `types/index.ts` - Added Notification, Invitation, UserBasic types
- `api.ts` - Added notifications, invitations, users API
- `Layout.tsx` - Added notification bell, invite button
- `NotificationsInbox.tsx` - New component for notification dropdown
- `InviteUserModal.tsx` - New component for inviting users
- `Register.tsx` - New page for accepting invitations
- `IdeaDetail.tsx` - Added @mention support in comments
- `App.tsx` - Added Register route

## Quick Test

1. Login as admin
2. Click (+) icon → invite a test email
3. Copy the invite link
4. Open in incognito → create account
5. Login as admin → assign template to new user
6. Login as new user → see notification in bell icon
7. Add comment mentioning @admin → admin gets notification

