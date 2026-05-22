# Candelita V4 - Project Structure Documentation

## 📁 New Folder Organization

The project has been reorganized into a clean, maintainable structure:

```
Candelita V4/
├── index.html                    # Main entry point (PWA requirement - must stay in root)
├── manifest.json                 # PWA manifest (must stay in root)
│
├── src/                          # Source code
│   ├── script.js                 # Main application logic (3,270 lines)
│   └── style.css                 # Application styles (982 lines)
│
├── assets/                       # Static assets
│   ├── images/
│   │   ├── iconoapp.png         # Main app icon (fixed from iconoapp.png.png)
│   │   ├── iconoapp2.png        # Unused alternative icon
│   │   └── iconoapp3.png        # Unused alternative icon
│   └── audio/
│       ├── success2.mp3         # Achievement sound (actively used)
│       └── success.mp3          # Alternative sound (appears unused)
│
├── docs/                         # Documentation
│   ├── AUTHENTICATION_TESTING_GUIDE.md
│   ├── BASE64_PROFILE_PICTURES.md
│   ├── FIREBASE_STORAGE_SETUP.md
│   ├── IMPLEMENTATION_COMPLETE.md
│   ├── LEGACY_USER_MIGRATION_GUIDE.md
│   ├── MIGRATION_IMPLEMENTATION_SUMMARY.md
│   ├── MIGRATION_TESTING_CHECKLIST.md
│   ├── PHASE1_IMPLEMENTATION_SUMMARY.md
│   ├── PROJECT_STRUCTURE.md     # This file
│   ├── START_SERVER.md
│   └── USER_PROFILE_SYSTEM_ARCHITECTURE.md
│
└── .vscode/                      # VS Code configuration
```

---

## 🔄 Changes Made

### Files Updated (Path References)

1. **index.html** (3 changes)
   - Line 8: `iconoapp.png` → `assets/images/iconoapp.png`
   - Line 9: `style.css` → `src/style.css`
   - Line 406: `script.js` → `src/script.js`

2. **manifest.json** (2 changes)
   - Lines 11 & 16: `iconoapp.png` → `assets/images/iconoapp.png`

3. **script.js** (1 change)
   - Line 2089: `success2.mp3` → `assets/audio/success2.mp3`

### Files Moved

- **Source Code:**
  - `style.css` → `src/style.css`
  - `script.js` → `src/script.js`

- **Assets:**
  - `iconoapp.png.png` → `assets/images/iconoapp.png` (renamed to fix double extension)
  - `iconoapp2.png` → `assets/images/iconoapp2.png`
  - `iconoapp3.png` → `assets/images/iconoapp3.png`
  - `success.mp3` → `assets/audio/success.mp3`
  - `success2.mp3` → `assets/audio/success2.mp3`

- **Documentation:**
  - All `.md` files → `docs/` directory

---

## ✅ Testing Checklist

After the reorganization, verify the following:

### Critical Tests (Must Pass)

- [ ] **App Loads Successfully**
  - Open `index.html` in a browser
  - Check browser console for errors
  - Verify no 404 errors in Network tab

- [ ] **Styles Render Correctly**
  - All CSS should be applied
  - Check gradient backgrounds
  - Verify side menu displays properly
  - Test responsive layout on mobile view

- [ ] **JavaScript Executes**
  - Check console for "✅ Firebase initialized" message
  - Verify no JavaScript errors
  - Test that Firebase connects successfully

- [ ] **Authentication Works**
  - Test login functionality
  - Test registration
  - Verify user session persistence

### Medium Priority Tests

- [ ] **Audio Playback**
  - Register a new activity/achievement
  - Verify success sound plays
  - Check browser console for audio loading errors

- [ ] **PWA Manifest Valid**
  - Open DevTools → Application → Manifest
  - Verify manifest loads without errors
  - Check that icons are displayed correctly

- [ ] **App Icons Display**
  - Check PWA install prompt shows correct icon
  - Verify icon appears in browser tab

- [ ] **iOS Home Screen Icon** (if iOS device available)
  - Add app to home screen
  - Verify icon displays correctly

### Feature Tests

- [ ] **Calendar Functionality**
  - View calendar
  - Check activity heat map colors
  - Test date selection

- [ ] **Ranking System**
  - View user rankings
  - Verify statistics display

- [ ] **Profile Management**
  - View user profile
  - Test profile picture upload (base64)
  - Update profile information

- [ ] **Activity History**
  - View activity history
  - Check charts render (Chart.js)
  - Test data export functionality

- [ ] **Achievements System**
  - View achievements
  - Test achievement unlock animations
  - Verify confetti effect works

---

## 🚀 How to Run the App

### Option 1: Local Server (Recommended)

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (http-server)
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

Then open: `http://localhost:8000`

### Option 2: VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

### Option 3: Direct File Access

⚠️ **Not Recommended** - Some features may not work due to CORS restrictions

- Simply open `index.html` in a browser
- Firebase and external CDN resources should still work

---

## 🛡️ Rollback Instructions

If you encounter issues and need to revert:

### Quick Rollback (PowerShell)

```powershell
# Move files back to root
Move-Item -Path "src\style.css" -Destination "."
Move-Item -Path "src\script.js" -Destination "."
Move-Item -Path "assets\audio\success2.mp3" -Destination "."
Move-Item -Path "assets\audio\success.mp3" -Destination "."
Move-Item -Path "assets\images\iconoapp.png" -Destination "iconoapp.png.png"
Move-Item -Path "assets\images\iconoapp2.png" -Destination "."
Move-Item -Path "assets\images\iconoapp3.png" -Destination "."
Move-Item -Path "docs\*.md" -Destination "."

# Remove empty directories
Remove-Item -Path "src","assets","docs" -Recurse -Force
```

### Revert Code Changes

If using Git:
```bash
git checkout index.html manifest.json src/script.js
```

Or manually revert the path changes in:
- `index.html` (lines 8, 9, 406)
- `manifest.json` (lines 11, 16)
- `script.js` (line 2089)

---

## 📊 Benefits of New Structure

### Before
```
❌ 18 files in root directory
❌ Confusing file naming (iconoapp.png.png)
❌ Mixed concerns (code, assets, docs together)
❌ Hard to navigate and maintain
```

### After
```
✅ Only 2 files in root (PWA requirements)
✅ Clear separation of concerns
✅ Easy to find files by category
✅ Fixed naming issues
✅ Professional project structure
✅ Easier to maintain and scale
```

---

## 🔍 File Dependencies Reference

### index.html depends on:
- `src/style.css` (line 9)
- `src/script.js` (line 406)
- `manifest.json` (line 7)
- `assets/images/iconoapp.png` (line 8)

### manifest.json depends on:
- `index.html` (start_url)
- `assets/images/iconoapp.png` (icons array)

### script.js depends on:
- `assets/audio/success2.mp3` (line 2089)
- Firebase CDN libraries (imported at top)

### External Dependencies (CDN):
- Firebase v10.8.0 (App, Firestore, Auth)
- Cropper.js (image cropping)
- Chart.js (statistics charts)
- Canvas Confetti (celebration effects)

---

## 📝 Notes

- **PWA Requirement:** `index.html` and `manifest.json` must remain in root directory for Progressive Web App standards
- **Module Imports:** `script.js` uses ES6 modules - internal imports are not affected by the move
- **Base64 Images:** Profile pictures are stored as base64 in Firestore, not as files
- **Service Worker:** Not currently implemented in this project
- **Firebase Config:** Hardcoded in `script.js` - no environment variables used

---

## 🎯 Next Steps

1. ✅ Run through the testing checklist above
2. ✅ Verify all features work as expected
3. ✅ Test on different browsers (Chrome, Firefox, Safari)
4. ✅ Test on mobile devices
5. ✅ Consider adding a service worker for offline functionality
6. ✅ Consider using environment variables for Firebase config
7. ✅ Consider implementing a build process (webpack, vite, etc.)

---

## 📞 Support

If you encounter any issues:

1. Check browser console for errors
2. Verify all files are in correct locations (use file tree above)
3. Ensure local server is running (not using file:// protocol)
4. Check Network tab for 404 errors
5. Refer to rollback instructions if needed

---

**Last Updated:** May 22, 2026  
**Project Version:** Candelita V4  
**Structure Version:** 1.0