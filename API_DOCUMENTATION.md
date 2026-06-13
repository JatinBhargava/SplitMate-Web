# SplitMate API Documentation

Complete REST API reference for building native Android/iOS apps.

## Base URL

```
https://tzvgmjszxxmtewmwacpv.supabase.co/functions/v1
```

## Authentication

### Sign Up
```
POST https://tzvgmjszxxmtewmwacpv.supabase.co/auth/v1/signup
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "securepassword",
  "data": {
    "display_name": "John Doe"
  }
}

Response 200:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "xxx",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

### Sign In
```
POST https://tzvgmjszxxmtewmwacpv.supabase.co/auth/v1/token?grant_type=password
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "securepassword"
}

Response 200:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "xxx",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

### Refresh Token
```
POST https://tzvgmjszxxmtewmwacpv.supabase.co/auth/v1/token?grant_type=refresh_token
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json

Body:
{
  "refresh_token": "xxx"
}
```

### Common Headers (for all authenticated endpoints)
```
Authorization: Bearer <access_token>
apikey: <SUPABASE_ANON_KEY>
Content-Type: application/json
```

---

## API Endpoints

### 1. Groups (`/api-groups`)

#### List My Groups
```
GET /api-groups

Response 200:
{
  "groups": [
    {
      "group_id": "uuid",
      "member_id": "uuid",
      "group_name": "Weekend Trip",
      "group_code": "1234",
      "is_creator": true,
      "member_count": 4,
      "created_at": "2026-03-07T10:00:00Z"
    }
  ]
}
```

#### Create Group
```
POST /api-groups

Body:
{
  "name": "Weekend Trip"
}

Response 201:
{
  "group_id": "uuid",
  "member_id": "uuid",
  "group_name": "Weekend Trip",
  "group_code": "1234",
  "member_name": "John Doe"
}
```

#### Join Group by Code
```
POST /api-groups/join

Body:
{
  "code": "1234"
}

Response 201:
{
  "group_id": "uuid",
  "member_id": "uuid",
  "group_name": "Weekend Trip",
  "group_code": "1234",
  "member_name": "John Doe",
  "already_member": false
}
```

#### Delete Group (Creator Only)
```
DELETE /api-groups/<group_id>

Response 200:
{
  "message": "Group and all associated data deleted"
}
```

---

### 2. Expenses (`/api-expenses`)

#### List Expenses
```
GET /api-expenses?group_id=<group_id>

Response 200:
{
  "expenses": [
    {
      "id": "uuid",
      "group_id": "uuid",
      "paid_by": "uuid (member_id)",
      "description": "Dinner",
      "amount": 1500.00,
      "split_among": ["member_id_1", "member_id_2"],
      "category": "Food & Drinks",
      "created_at": "2026-03-07T10:00:00Z",
      "updated_at": "2026-03-07T10:00:00Z"
    }
  ]
}
```

#### Create Expense
```
POST /api-expenses

Body:
{
  "group_id": "uuid",
  "paid_by": "uuid (member_id)",
  "amount": 1500.00,
  "description": "Dinner",          // optional, defaults to ""
  "split_among": ["member_id_1"],    // optional, defaults to all members
  "category": "Food & Drinks"        // optional
}

Response 201:
{
  "expense": { ... }
}
```

#### Update Expense
```
PUT /api-expenses/<expense_id>

Body:
{
  "amount": 2000.00,
  "description": "Updated dinner",
  "paid_by": "uuid",
  "split_among": ["member_id_1", "member_id_2"],
  "category": "Food & Drinks",
  "member_id": "uuid"  // for activity logging
}

Response 200:
{
  "expense": { ... }
}
```

#### Delete Expense
```
DELETE /api-expenses/<expense_id>?member_id=<member_id>

Response 200:
{
  "message": "Expense deleted"
}
```

---

### 3. Members (`/api-members`)

#### List Members
```
GET /api-members?group_id=<group_id>

Response 200:
{
  "members": [
    {
      "id": "uuid",
      "name": "John Doe",
      "user_id": "uuid or null",
      "created_at": "2026-03-07T10:00:00Z"
    }
  ]
}
```

#### Rename Member (Creator Only)
```
PUT /api-members/<member_id>

Body:
{
  "name": "New Name"
}

Response 200:
{
  "member": { ... }
}
```

#### Remove Member (Creator Only)
```
DELETE /api-members/<member_id>

Response 200:
{
  "message": "Member \"John\" removed"
}
```

---

### 4. Settlements (`/api-settlements`)

#### Get Balances & Settlements
```
GET /api-settlements?group_id=<group_id>

Response 200:
{
  "balances": [
    {
      "memberId": "uuid",
      "memberName": "John",
      "totalPaid": 3000.00,
      "totalOwed": 1500.00,
      "balance": 1500.00
    }
  ],
  "settlements": [
    {
      "from": "uuid",
      "from_name": "Alice",
      "to": "uuid",
      "to_name": "John",
      "amount": 750.00
    }
  ]
}
```

---

### 5. Activity Log (`/api-activity`)

#### Get Activity History
```
GET /api-activity?group_id=<group_id>&limit=50

Response 200:
{
  "activities": [
    {
      "id": "uuid",
      "action": "EXPENSE_ADDED",
      "details": "John added \"Dinner\" (₹1500)",
      "member_id": "uuid",
      "created_at": "2026-03-07T10:00:00Z"
    }
  ]
}
```

**Action Types:** `GROUP_CREATED`, `MEMBER_JOINED`, `EXPENSE_ADDED`, `EXPENSE_UPDATED`, `EXPENSE_DELETED`

---

### 6. Share Settings (`/api-share-settings`)

#### Get Share Settings
```
GET /api-share-settings?group_id=<group_id>

Response 200:
{
  "sharing_enabled": true,
  "is_creator": true
}
```

#### Update Share Settings (Creator Only)
```
PUT /api-share-settings?group_id=<group_id>

Body:
{
  "share_password": "mypassword"   // set to null/empty to disable
}

Response 200:
{
  "message": "Sharing enabled",
  "sharing_enabled": true
}
```

---

### 7. Shared View (`/api-shared-view`) — PUBLIC, No Auth Required

#### View Shared Expenses
```
POST /api-shared-view
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Content-Type: application/json

Body:
{
  "code": "1234",
  "password": "sharepassword"
}

Response 200:
{
  "group_name": "Weekend Trip",
  "group_code": "1234",
  "members": [ { "id": "uuid", "name": "John" } ],
  "expenses": [ { "id": "uuid", "paid_by": "uuid", "description": "Dinner", "amount": 1500, ... } ],
  "balances": [ { "memberId": "uuid", "memberName": "John", "totalPaid": 3000, "totalOwed": 1500, "balance": 1500 } ],
  "total_expenses": 5000.00
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Description of the error"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthorized / incorrect password |
| 403 | Forbidden (not creator / sharing disabled) |
| 404 | Resource not found |
| 405 | Method not allowed |
| 500 | Internal server error |

---

## Expense Categories

Available categories (optional when creating expenses):

| Category | Emoji |
|----------|-------|
| Food & Drinks | 🍕 |
| Transport | 🚗 |
| Accommodation | 🏠 |
| Entertainment | 🎬 |
| Shopping | 🛍️ |
| Utilities | 💡 |
| Health | 🏥 |
| Education | 📚 |
| Travel | ✈️ |
| Other | 📦 |

---

## Realtime Subscriptions

For real-time updates in native apps, connect to the Supabase Realtime websocket:

```
wss://tzvgmjszxxmtewmwacpv.supabase.co/realtime/v1/websocket?apikey=<SUPABASE_ANON_KEY>
```

Subscribe to changes on:
- `expenses` table (filtered by `group_id`)
- `group_members` table (filtered by `group_id`)

Use the [Supabase Realtime client](https://supabase.com/docs/guides/realtime) for your platform:
- **Android (Kotlin):** `io.github.jan-tennert.supabase:realtime-kt`
- **iOS (Swift):** `supabase-swift` package

---

## Native SDK References

| Platform | SDK | Install |
|----------|-----|---------|
| Android | supabase-kt | `implementation("io.github.jan-tennert.supabase:gotrue-kt:3.x")` |
| iOS | supabase-swift | `https://github.com/supabase/supabase-swift` (SPM) |
| Flutter | supabase_flutter | `supabase_flutter: ^2.x` |
| React Native | @supabase/supabase-js | `npm i @supabase/supabase-js` |

You can use the native Supabase SDKs for auth and realtime, then call these edge function APIs for all business logic.
