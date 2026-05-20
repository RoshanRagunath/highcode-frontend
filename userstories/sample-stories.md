# Notifications module

We want to give users control over how the app contacts them — email, in-app, push — and make sure that preference is honoured across every workflow that currently sends a message.

## Goal

Stop spamming users. Right now every notification path is opt-out via a hidden flag. We want a unified Notification Center where preferences are first-class.

## Stories

### Story: Show a Notification Center page

As a user, I want a Notification Center page where I can see all my notifications and clear them.

**Acceptance criteria**
- Accessible from the top-right bell icon
- Lists last 50 notifications, newest first
- "Mark all read" button works
- Empty state shows a friendly illustration and copy

### Story: Per-channel opt-out

As a user, I want to choose which channels (email / push / in-app) each notification type uses.

**Acceptance criteria**
- Settings page lists every notification type with three toggles
- Defaults: in-app ON, email ON, push OFF
- Changes persist immediately
- Blocks the dependent "Show a Notification Center page" story because we need the data model first

### Story: Backend opt-out enforcement

As the platform, I must respect the user's opt-out preferences in every outbound notification path.

**Acceptance criteria**
- All five existing send paths check the user_preferences table
- Bypass flag for security/transactional emails is honoured
- Adds an audit log row when a preference suppresses a send
