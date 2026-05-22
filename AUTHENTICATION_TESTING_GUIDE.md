# Firebase Authentication Testing Guide

## Overview
This guide will help you test the newly implemented Firebase Authentication system for the Candelita app.

## Prerequisites
- The app must be served over HTTP/HTTPS (not file://)
- Use Live Server extension in VS Code, or deploy to Firebase Hosting
- Have access to the Firebase Console for the project

## Testing Checklist

### 1. Initial Load - New User
**Expected Behavior:**
- [ ] App loads and shows authentication modal
- [ ] Login form is displayed by default
- [ ] Modal cannot be closed without authenticating

**Steps:**
1. Open the app in a browser (clear localStorage first)
2. Verify the authentication modal appears
3. Check browser console for: "App loading..." and "No user authenticated, showing auth modal"

### 2. User Registration
**Expected Behavior:**
- [ ] Can switch to registration form
- [ ] Form validates all inputs
- [ ] Shows appropriate error messages
- [ ] Successfully creates account
- [ ] Redirects to main app after registration

**Steps:**
1. Click "Regístrate" link
2. Try submitting with empty fields - should show validation errors
3. Try password with < 8 characters - should show error
4. Enter valid data:
   - Display Name: "TestUser"
   - Email: "test@example.com"
   - Password: "testpass123"
5. Click "Registrarse"
6. Check console for: "Registering user:" and "User registered successfully:"
7. Verify you're redirected to main app with greeting "Hola TestUser ✨"

### 3. User Login
**Expected Behavior:**
- [ ] Can login with registered credentials
- [ ] Shows error for wrong password
- [ ] Shows error for non-existent email
- [ ] Successfully logs in and loads user data

**Steps:**
1. Logout (click "Cerrar Sesión" in menu)
2. Try logging in with wrong password - should show error
3. Try logging in with non-existent email - should show error
4. Login with correct credentials
5. Check console for: "Logging in user:" and "User logged in successfully:"
6. Verify main app loads with user data

### 4. Session Persistence
**Expected Behavior:**
- [ ] User stays logged in after page reload
- [ ] Auth state is restored correctly

**Steps:**
1. Login to the app
2. Reload the page (F5)
3. Check console for: "Auth state changed:" with user email
4. Verify you're still logged in (no auth modal shown)
5. Verify user data loads correctly

### 5. Password Reset
**Expected Behavior:**
- [ ] Can request password reset email
- [ ] Shows confirmation message
- [ ] Email is sent (check inbox)

**Steps:**
1. On login form, enter your email
2. Click "¿Olvidaste tu contraseña?"
3. Check for alert: "Se ha enviado un email para restablecer tu contraseña"
4. Check email inbox for password reset email from Firebase

### 6. Logout
**Expected Behavior:**
- [ ] Successfully logs out
- [ ] Clears session data
- [ ] Shows auth modal again

**Steps:**
1. Login to the app
2. Open side menu
3. Click "Cerrar Sesión"
4. Check console for: "Logging out user" and "User logged out successfully"
5. Verify page reloads and shows auth modal

### 7. Backward Compatibility - Legacy Users
**Expected Behavior:**
- [ ] Users with localStorage name can still use app
- [ ] No auth modal shown for legacy users
- [ ] App functions normally

**Steps:**
1. Logout completely
2. Open browser console
3. Run: `localStorage.setItem('nombreUsuario', 'LegacyUser')`
4. Reload page
5. Verify app loads without showing auth modal
6. Verify greeting shows "Hola LegacyUser ✨"
7. Verify all features work (calendar, ranking, etc.)

### 8. Error Handling
**Expected Behavior:**
- [ ] Shows user-friendly error messages
- [ ] Handles network errors gracefully
- [ ] Handles Firebase errors appropriately

**Test Cases:**
1. **Email already in use:**
   - Try registering with an existing email
   - Should show: "Este email ya está registrado. Por favor, inicia sesión."

2. **Invalid email format:**
   - Try "notanemail" as email
   - Should show: "El formato del email no es válido."

3. **Weak password:**
   - Try password with < 8 characters
   - Should show: "La contraseña debe tener al menos 8 caracteres."

4. **Wrong password:**
   - Try logging in with wrong password
   - Should show: "Contraseña incorrecta."

5. **User not found:**
   - Try logging in with non-existent email
   - Should show: "No existe una cuenta con este email."

### 9. UI/UX Testing
**Expected Behavior:**
- [ ] Forms are responsive and look good
- [ ] Buttons show loading states
- [ ] Inputs have focus states
- [ ] Links are clickable and styled
- [ ] Modal is centered and styled correctly

**Steps:**
1. Test on desktop browser
2. Test on mobile browser (or responsive mode)
3. Verify all form elements are accessible
4. Check that buttons disable during async operations
5. Verify error messages are visible and styled

### 10. Integration Testing
**Expected Behavior:**
- [ ] Authenticated users can register "tomas"
- [ ] Calendar loads user's data
- [ ] Ranking shows correct data
- [ ] Statistics work correctly
- [ ] All existing features still work

**Steps:**
1. Login as authenticated user
2. Click "REGISTRAR DELICIOSO 🍧"
3. Verify toma is saved to Firestore
4. Check calendar updates
5. Check ranking updates
6. Navigate through all sections (Inicio, Ranking, Progreso, Logros)
7. Verify no errors in console

## Common Issues and Solutions

### Issue: "Firebase: Error (auth/operation-not-allowed)"
**Solution:** Enable Email/Password authentication in Firebase Console:
1. Go to Firebase Console > Authentication > Sign-in method
2. Enable "Email/Password" provider

### Issue: "Firebase: Error (auth/unauthorized-domain)"
**Solution:** Add your domain to authorized domains:
1. Go to Firebase Console > Authentication > Settings > Authorized domains
2. Add your domain (e.g., localhost, your-app.web.app)

### Issue: Modal doesn't show
**Solution:** Check browser console for errors. Verify:
1. Firebase is initialized correctly
2. HTML elements have correct IDs
3. No JavaScript errors

### Issue: "Cannot read property 'value' of null"
**Solution:** Verify all form input IDs match between HTML and JavaScript:
- loginEmail, loginPassword
- registerEmail, registerPassword, registerDisplayName

## Console Logs to Monitor

During normal operation, you should see these logs:

**On App Load (Not Authenticated):**
```
App loading...
Auth state changed: No user
No user authenticated, showing auth modal
Opening auth modal
```

**On Registration:**
```
Registering user: test@example.com
User registered successfully: [uid]
Auth state changed: test@example.com
User authenticated: [uid]
```

**On Login:**
```
Logging in user: test@example.com
User logged in successfully: [uid]
Auth state changed: test@example.com
User authenticated: [uid]
```

**On Logout:**
```
Logging out user
User logged out successfully
Auth state changed: No user
No user authenticated, showing auth modal
```

## Next Steps After Testing

Once all tests pass:
1. Document any issues found
2. Test with multiple users
3. Test concurrent sessions
4. Prepare for Phase 2: User Profiles (creating users collection in Firestore)

## Notes
- Firebase Auth tokens expire after 1 hour but refresh automatically
- Session persists in browser localStorage
- Multiple tabs will share the same auth state
- Incognito mode can be used for testing multiple accounts