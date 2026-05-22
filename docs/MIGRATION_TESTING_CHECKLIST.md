# Legacy User Migration - Testing Checklist

## Pre-Testing Setup

### Required Test Data
- [ ] At least one legacy user with activities in Firestore
  - Activities should have: `userId: null, usuario: "TestUser"`
- [ ] Access to browser DevTools (Console + Application tabs)
- [ ] Test email addresses for registration

### Verify Firestore Rules
Ensure Firestore rules allow:
- Reading documents with `userId: null`
- Updating `userId` field on existing documents

## Test Cases

### ✅ Test 1: Legacy User Banner Display
**Steps:**
1. Clear browser localStorage
2. Set `localStorage.setItem('nombreUsuario', 'TestUser')`
3. Refresh the page (without logging in)
4. Wait 1 second

**Expected Results:**
- [ ] Purple banner appears at top of screen
- [ ] Banner shows: "¡Protege tus datos! Crea una cuenta..."
- [ ] "Crear Cuenta" button is visible
- [ ] Dismiss (✕) button is visible
- [ ] Console shows: "Legacy user found: TestUser"

**Pass/Fail:** ___________

---

### ✅ Test 2: Banner Dismissal
**Steps:**
1. With banner visible, click the ✕ button
2. Refresh the page

**Expected Results:**
- [ ] Banner disappears immediately
- [ ] localStorage has `legacy_banner_dismissed: "true"`
- [ ] Banner does NOT reappear after refresh

**Pass/Fail:** ___________

---

### ✅ Test 3: Banner Opens Registration
**Steps:**
1. Clear `legacy_banner_dismissed` from localStorage
2. Refresh page to show banner
3. Click "Crear Cuenta" button

**Expected Results:**
- [ ] Registration modal opens
- [ ] Display name field is pre-filled with "TestUser"
- [ ] Email and password fields are empty
- [ ] Registration form is visible (not login form)

**Pass/Fail:** ___________

---

### ✅ Test 4: New User Registration (No Legacy Data)
**Steps:**
1. Register with a NEW name (not in Firestore)
2. Use email: `newuser@test.com`
3. Use password: `password123`

**Expected Results:**
- [ ] Registration succeeds
- [ ] Console shows: "No legacy data found for this user"
- [ ] NO migration prompt appears
- [ ] User is logged in successfully
- [ ] Modal closes

**Pass/Fail:** ___________

---

### ✅ Test 5: Legacy User Registration with Migration
**Steps:**
1. Ensure Firestore has activities for "TestUser" with `userId: null`
2. Register with displayName: "TestUser"
3. Use email: `testuser@test.com`
4. Use password: `password123`
5. Wait for migration prompt

**Expected Results:**
- [ ] Registration succeeds
- [ ] Console shows: "🔍 Checking for legacy data to migrate..."
- [ ] Console shows: "📦 Found X legacy activities"
- [ ] Confirmation dialog appears: "¡Encontramos X actividades anteriores..."
- [ ] Dialog shows correct count of activities

**Pass/Fail:** ___________

---

### ✅ Test 6: Migration Confirmation - Accept
**Steps:**
1. Continue from Test 5
2. Click "Aceptar" (OK) on confirmation dialog
3. Wait for migration to complete

**Expected Results:**
- [ ] Button text changes to "Vinculando datos..."
- [ ] Console shows: "✅ Migrated X/X activities"
- [ ] Console shows: "✨ Migration complete!"
- [ ] Success alert appears: "✨ ¡Éxito! Se han vinculado X actividades..."
- [ ] localStorage has `migration_completed_TestUser: "true"`
- [ ] Ranking updates (no duplicate entries)
- [ ] Calendar shows all historical activities

**Verify in Firestore:**
- [ ] All "TestUser" activities now have `userId: "firebase-uid"`
- [ ] No activities remain with `userId: null` for "TestUser"

**Pass/Fail:** ___________

---

### ✅ Test 7: Migration Confirmation - Decline
**Steps:**
1. Create another legacy user "TestUser2" with activities
2. Register with displayName: "TestUser2"
3. Click "Cancelar" (Cancel) on confirmation dialog

**Expected Results:**
- [ ] Console shows: "User declined migration"
- [ ] NO migration occurs
- [ ] User is logged in successfully
- [ ] Modal closes
- [ ] New activities will have userId, old ones remain null

**Verify in Firestore:**
- [ ] "TestUser2" activities still have `userId: null`

**Pass/Fail:** ___________

---

### ✅ Test 8: Prevent Duplicate Migration
**Steps:**
1. Use account from Test 6 (already migrated)
2. Log out
3. Try to register again with same displayName but different email

**Expected Results:**
- [ ] Console shows: "✅ Migration already completed for this user"
- [ ] NO migration prompt appears
- [ ] Registration completes normally

**Pass/Fail:** ___________

---

### ✅ Test 9: Large Dataset Migration (500+ Activities)
**Steps:**
1. Create test user with 600+ activities (use script if needed)
2. Register with that displayName
3. Accept migration

**Expected Results:**
- [ ] Console shows batch processing: "✅ Migrated 500/600 activities"
- [ ] Console shows: "✅ Migrated 600/600 activities"
- [ ] All activities successfully migrated
- [ ] No errors in console

**Pass/Fail:** ___________

---

### ✅ Test 10: Ranking Deduplication
**Steps:**
1. Before migration: Check ranking for duplicate entries
2. Complete migration for a legacy user
3. Check ranking again

**Expected Results:**
- [ ] Before: Two entries (one with userId: null, one with userId)
- [ ] After: Single entry with combined count
- [ ] Total count matches sum of both previous entries

**Pass/Fail:** ___________

---

### ✅ Test 11: Mobile Responsiveness
**Steps:**
1. Open DevTools, switch to mobile view (375px width)
2. Display legacy banner
3. Test all interactions

**Expected Results:**
- [ ] Banner displays correctly on mobile
- [ ] Text is readable (not cut off)
- [ ] Buttons are tappable
- [ ] Banner doesn't overlap content
- [ ] Dismiss button works

**Pass/Fail:** ___________

---

### ✅ Test 12: Error Handling - Network Failure
**Steps:**
1. Open DevTools Network tab
2. Set throttling to "Offline"
3. Try to complete migration

**Expected Results:**
- [ ] Error is caught gracefully
- [ ] User sees error message: "Hubo un error al vincular tus datos..."
- [ ] Console shows error details
- [ ] App doesn't crash

**Pass/Fail:** ___________

---

### ✅ Test 13: Authenticated User (No Banner)
**Steps:**
1. Log in with Firebase account
2. Check for banner

**Expected Results:**
- [ ] Banner does NOT appear
- [ ] Even if localStorage has `nombreUsuario`
- [ ] Banner only shows for unauthenticated legacy users

**Pass/Fail:** ___________

---

## Post-Testing Verification

### Data Integrity Checks
- [ ] No data loss occurred during migration
- [ ] All userId fields correctly updated
- [ ] No orphaned activities remain
- [ ] Ranking shows correct totals
- [ ] Statistics include all historical data
- [ ] Calendar displays complete history

### Performance Checks
- [ ] Migration completes in reasonable time (<5 seconds for 100 activities)
- [ ] No UI freezing during migration
- [ ] Batch operations work efficiently

### User Experience Checks
- [ ] All messages are in Spanish
- [ ] Error messages are user-friendly
- [ ] Success feedback is clear
- [ ] Banner is not intrusive
- [ ] Registration flow is smooth

## Known Issues / Notes

Document any issues found during testing:

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

## Sign-Off

**Tester Name:** _______________
**Date:** _______________
**Overall Result:** PASS / FAIL
**Notes:** _______________________________________________