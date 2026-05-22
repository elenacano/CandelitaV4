# Legacy User Data Migration System - Implementation Guide

## Overview
This system automatically links historical data from legacy users (who used localStorage before Firebase Authentication) to their new Firebase accounts when they register.

## Problem Solved
- **Before**: Legacy users had activities with `userId: null, usuario: "TheirName"`
- **After Registration**: New activities got `userId: "firebase-uid", usuario: "TheirName"`
- **Issue**: Old activities remained orphaned, causing duplicate entries in rankings and disconnected statistics
- **Solution**: Automatic data linking during registration with user confirmation

## Implementation Components

### 1. Core Migration Functions (script.js)

#### `linkLegacyData(userId, displayName)`
- **Purpose**: Links all legacy activities to a Firebase user account
- **Process**:
  1. Queries Firestore for documents with matching `usuario` and `userId: null`
  2. Uses batch operations (max 500 docs per batch) for efficiency
  3. Updates all matching documents with the new `userId`
  4. Stores migration status in localStorage
- **Returns**: Number of activities linked
- **Error Handling**: Comprehensive try-catch with user-friendly error messages

#### `checkLegacyData(displayName)`
- **Purpose**: Checks if a user has legacy data that can be migrated
- **Returns**: Count of legacy activities found
- **Use Case**: Called before showing migration prompt

#### `isMigrationCompleted(displayName)`
- **Purpose**: Prevents re-prompting users who already migrated
- **Storage**: Uses localStorage key `migration_completed_${displayName}`
- **Returns**: Boolean

#### `showLegacyUserBanner()`
- **Purpose**: Displays banner for legacy users without accounts
- **Conditions**:
  - User has `nombreUsuario` in localStorage
  - User is NOT authenticated with Firebase
  - Banner hasn't been dismissed
- **Timing**: Called 1 second after legacy user detection

### 2. Registration Flow Enhancement

The `handleRegister()` function now includes:

1. **Standard Registration**: Creates Firebase account
2. **Legacy Data Detection**: Checks for matching legacy activities
3. **User Confirmation**: Shows dialog with activity count
4. **Migration Execution**: Links data if user confirms
5. **Success Feedback**: Shows count of linked activities
6. **Data Refresh**: Updates UI to show complete history

**User Experience Flow**:
```
User Registers → Check Legacy Data → Found X Activities
                                    ↓
                        "¿Vincular X actividades a tu cuenta?"
                                    ↓
                        [Sí] → Link Data → Success Message
                        [No] → Skip Migration
```

### 3. Legacy User Banner (HTML + CSS)

**Banner Features**:
- Fixed position at top of screen
- Gradient background (purple theme)
- Dismissible with localStorage persistence
- Responsive design for mobile
- Smooth slide-down animation

**Banner Content**:
- Icon: 🔐 (security/protection theme)
- Message: "¡Protege tus datos! Crea una cuenta para acceder desde cualquier dispositivo"
- Primary Action: "Crear Cuenta" (opens registration with pre-filled name)
- Dismiss Action: ✕ button

**Visibility Logic**:
- Shows for legacy users (localStorage name, no Firebase auth)
- Hidden if dismissed (localStorage flag)
- Hidden for authenticated users
- Auto-shows 1 second after legacy user detection

### 4. Migration Status Tracking

**localStorage Keys**:
- `migration_completed_${displayName}`: Tracks completed migrations
- `legacy_banner_dismissed`: Tracks banner dismissal
- `nombreUsuario`: Original legacy user identifier

**Benefits**:
- Prevents duplicate migration attempts
- Respects user's choice to dismiss banner
- Persists across browser sessions

## Technical Details

### Firestore Batch Operations
- Maximum 500 operations per batch (Firestore limit)
- Automatic batching for large datasets
- Fallback to individual updates if batch unavailable

### Query Structure
```javascript
query(
    collection(db, "tomas"),
    where("usuario", "==", displayName),
    where("userId", "==", null)
)
```

### Data Model
**Before Migration**:
```javascript
{
    userId: null,
    usuario: "TheirName",
    userPhotoURL: null,
    fecha: Timestamp
}
```

**After Migration**:
```javascript
{
    userId: "firebase-uid-123",  // ← Updated
    usuario: "TheirName",
    userPhotoURL: null,
    fecha: Timestamp
}
```

## Testing Scenarios

### Scenario 1: New User (No Legacy Data)
1. User registers with new name
2. System checks for legacy data
3. No data found → Normal registration flow
4. **Expected**: No migration prompt

### Scenario 2: Legacy User Registers
1. Legacy user (has localStorage name) registers
2. System finds matching activities
3. Shows confirmation: "Encontramos X actividades..."
4. User confirms → Data linked
5. **Expected**: All activities now have userId, no duplicates in ranking

### Scenario 3: Legacy User Declines Migration
1. Legacy user registers
2. System finds matching activities
3. User declines migration
4. **Expected**: New activities have userId, old activities remain with userId: null

### Scenario 4: Already Migrated User
1. User who already migrated tries to register again (different email)
2. System checks migration status
3. **Expected**: No migration prompt (already completed)

### Scenario 5: Legacy User Sees Banner
1. Legacy user (no Firebase account) opens app
2. Banner appears after 1 second
3. User clicks "Crear Cuenta"
4. **Expected**: Registration modal opens with pre-filled name

### Scenario 6: Banner Dismissal
1. Legacy user dismisses banner
2. Banner hidden and localStorage flag set
3. User refreshes page
4. **Expected**: Banner doesn't reappear

## Edge Cases Handled

1. **No Legacy Data**: Gracefully skips migration
2. **Large Datasets**: Batch operations handle 500+ activities
3. **Network Errors**: Try-catch with user-friendly messages
4. **Duplicate Names**: Uses exact match on displayName
5. **Partial Matches**: Only updates documents with userId: null
6. **Re-registration**: Migration status prevents duplicate attempts

## User Interface Updates

### Ranking System
- **Before**: Duplicate entries (one with userId: null, one with userId)
- **After**: Single entry per user with complete activity count

### Statistics
- **Before**: Disconnected stats (legacy vs new activities)
- **After**: Unified stats including all historical data

### Calendar
- **Before**: Only shows activities after registration
- **After**: Shows complete history including legacy activities

## Security Considerations

1. **User Confirmation**: Migration requires explicit user consent
2. **Exact Matching**: Only links activities with exact displayName match
3. **One-Time Operation**: Migration status prevents repeated attempts
4. **No Data Loss**: Original activities preserved, only userId updated

## Maintenance Notes

### Monitoring Migration Success
Check console logs for:
- `🔄 Starting legacy data migration...`
- `📊 Found X legacy activities to migrate`
- `✅ Migrated X/Y activities`
- `✨ Migration complete!`

### Common Issues

**Issue**: Migration not triggered
- **Check**: User has localStorage `nombreUsuario`
- **Check**: Activities exist with matching `usuario` and `userId: null`
- **Check**: Migration not already completed

**Issue**: Banner not showing
- **Check**: User is not authenticated
- **Check**: Banner not dismissed (localStorage)
- **Check**: `nombreUsuario` exists in localStorage

**Issue**: Partial migration
- **Check**: Network connectivity during batch operations
- **Check**: Firestore permissions for update operations
- **Check**: Console for error messages

## Future Enhancements

1. **Admin Dashboard**: View migration statistics
2. **Bulk Migration Tool**: Migrate all legacy users at once
3. **Migration History**: Track when and what was migrated
4. **Rollback Feature**: Undo migration if needed
5. **Email Notifications**: Notify users about successful migration

## Code Locations

- **Migration Functions**: `script.js` lines 629-800
- **Registration Flow**: `script.js` lines 1036-1150
- **Auth State Handler**: `script.js` lines 871-890
- **Banner HTML**: `index.html` lines 28-46
- **Banner CSS**: `style.css` lines 8-165

## Conclusion

This migration system provides a seamless transition for legacy users to Firebase Authentication while preserving their complete activity history. The implementation prioritizes user experience with clear prompts, automatic detection, and comprehensive error handling.