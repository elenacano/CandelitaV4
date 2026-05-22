# 🔥 Firebase Storage Setup Guide

## 📋 Table of Contents
1. [Problem Explanation](#-problem-explanation)
2. [Quick Fix (3 Steps)](#-quick-fix-3-steps)
3. [Detailed Firebase Console Setup](#-detailed-firebase-console-setup)
4. [Storage Security Rules](#-storage-security-rules)
5. [Verification Steps](#-verification-steps)
6. [Alternative Solution](#-alternative-solution-temporary-workaround)
7. [Troubleshooting](#-troubleshooting)

---

## 🚨 Problem Explanation

### What's Happening?
You're seeing this error when trying to upload profile pictures:

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/v0/b/candelita-pura.firebasestorage.app/o?name=profile-pictures%2F...' 
from origin 'http://127.0.0.1:5501' has been blocked by CORS policy
```

### Why Is This Happening?
This CORS (Cross-Origin Resource Sharing) error occurs because:

1. **Firebase Storage is not enabled** in your Firebase project
2. **Storage bucket doesn't exist** or is not properly configured
3. **CORS policy is not set** to allow requests from your local development server

### Impact on Your App
- ❌ Users cannot upload profile pictures
- ❌ Profile picture upload button doesn't work
- ❌ Error messages appear in the browser console
- ✅ Default avatar generation still works (fallback)
- ✅ All other features work normally

---

## ⚡ Quick Fix (3 Steps)

**Estimated Time:** 5-10 minutes

### Step 1: Enable Firebase Storage
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **candelita-pura**
3. Click **Storage** in the left sidebar
4. Click **Get Started** button
5. Click **Next** → **Done**

### Step 2: Set Storage Rules
1. In Storage, click the **Rules** tab
2. Replace the default rules with the rules from [Storage Security Rules](#-storage-security-rules) section below
3. Click **Publish**

### Step 3: Test
1. Restart your local server
2. Try uploading a profile picture
3. ✅ Success! No more CORS errors

---

## 🛠️ Detailed Firebase Console Setup

### Part 1: Access Firebase Console

1. **Open Firebase Console**
   - Navigate to: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Select Your Project**
   - Click on **candelita-pura** project card
   - You should see the project dashboard

### Part 2: Enable Firebase Storage

1. **Navigate to Storage**
   - In the left sidebar, find and click **Build** section
   - Click **Storage** (icon looks like a folder)

2. **Initialize Storage**
   
   **If you see "Get Started" button:**
   - Click **Get Started**
   - A dialog will appear: "Set up Cloud Storage"
   - Click **Next** (keep default production mode)
   - Select your Cloud Storage location (choose closest to your users):
     - For Spain/Europe: `europe-west1` or `europe-west3`
     - For US: `us-central1`
   - Click **Done**
   - Wait 10-30 seconds for initialization

   **If you see the Storage dashboard:**
   - Storage is already enabled ✅
   - Proceed to Part 3

3. **Verify Storage Bucket**
   - You should see: `candelita-pura.firebasestorage.app`
   - This matches your [`firebaseConfig`](script.js:10) in script.js ✅

### Part 3: Configure Storage Rules

1. **Access Rules Tab**
   - In Storage dashboard, click the **Rules** tab at the top
   - You'll see the current security rules

2. **Update Security Rules**
   - Delete all existing rules
   - Copy and paste the rules from the [Storage Security Rules](#-storage-security-rules) section below
   - Click **Publish** button

3. **Confirm Publication**
   - You should see: "Rules published successfully"
   - The rules are now active

### Part 4: Configure CORS (If Needed)

**Note:** Usually not needed for local development, but if you still get CORS errors:

1. **Create CORS Configuration File**
   
   Create a file named `cors.json` with this content:
   ```json
   [
     {
       "origin": ["http://localhost:5500", "http://localhost:5501", "http://127.0.0.1:5500", "http://127.0.0.1:5501"],
       "method": ["GET", "POST", "PUT", "DELETE"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

2. **Apply CORS Configuration**
   
   You need Google Cloud SDK installed. Run:
   ```bash
   gsutil cors set cors.json gs://candelita-pura.firebasestorage.app
   ```

   **Don't have Google Cloud SDK?**
   - Download from: https://cloud.google.com/sdk/docs/install
   - Or skip this step - Firebase Storage usually works without custom CORS

---

## 🔒 Storage Security Rules

### Complete Rules (Copy & Paste)

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Profile pictures folder
    match /profile-pictures/{userId}/{fileName} {
      // Allow authenticated users to read any profile picture
      allow read: if request.auth != null;
      
      // Allow users to upload/update/delete only their own profile pictures
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    
    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Rule Explanation

#### Line-by-Line Breakdown:

**Lines 1-3:** Rule version and service declaration
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
```
- Uses Firebase Storage Rules version 2
- Applies to all storage buckets in your project

**Lines 5-6:** Profile pictures path matching
```javascript
match /profile-pictures/{userId}/{fileName} {
  allow read: if request.auth != null;
```
- Matches files in: `profile-pictures/USER_ID/avatar.jpg`
- `{userId}` is a variable capturing the user's ID
- `{fileName}` is a variable capturing the file name
- **Read access:** Any authenticated user can view profile pictures

**Lines 9-12:** Write access rules
```javascript
allow write: if request.auth != null 
  && request.auth.uid == userId
  && request.resource.size < 5 * 1024 * 1024
  && request.resource.contentType.matches('image/.*');
```
- **`request.auth != null`**: User must be logged in
- **`request.auth.uid == userId`**: User can only modify their own folder
- **`request.resource.size < 5 * 1024 * 1024`**: File must be under 5MB
- **`request.resource.contentType.matches('image/.*')`**: File must be an image

**Lines 16-18:** Deny all other access
```javascript
match /{allPaths=**} {
  allow read, write: if false;
}
```
- Blocks access to any other paths in Storage
- Security best practice: deny by default

### Security Features

✅ **User Isolation:** Users can only modify their own profile pictures  
✅ **Size Limit:** Prevents large file uploads (5MB max)  
✅ **Type Validation:** Only image files allowed  
✅ **Authentication Required:** No anonymous uploads  
✅ **Read Access:** Authenticated users can view all profile pictures  

### How It Works with Your Code

Your [`uploadProfilePicture`](script.js:230) function:
```javascript
const storagePath = `profile-pictures/${userId}/avatar.jpg`;
```

This creates paths like:
- `profile-pictures/abc123/avatar.jpg` ✅ Allowed (user's own folder)
- `profile-pictures/xyz789/avatar.jpg` ❌ Blocked (different user's folder)

---

## ✅ Verification Steps

### Step 1: Verify Storage is Enabled

1. **Check Firebase Console**
   - Go to Storage section
   - You should see the Files tab (not "Get Started" button)
   - Bucket name: `candelita-pura.firebasestorage.app`

2. **Check Browser Console**
   - Open your app: http://127.0.0.1:5501
   - Open DevTools (F12)
   - Look for: `✅ Firebase initialized successfully`
   - No errors about Storage

### Step 2: Test Profile Picture Upload

1. **Login to Your App**
   - Use valid credentials
   - Navigate to Profile Settings

2. **Upload Test Image**
   - Click "Cambiar foto de perfil" button
   - Select a small image (< 5MB)
   - Click upload

3. **Expected Results**
   - ✅ Upload progress indicator appears
   - ✅ Image uploads successfully
   - ✅ Profile picture updates in UI
   - ✅ No CORS errors in console

### Step 3: Verify in Firebase Console

1. **Check Storage Files**
   - Go to Firebase Console → Storage → Files tab
   - You should see: `profile-pictures/YOUR_USER_ID/avatar.jpg`
   - Click the file to see details

2. **Check File Metadata**
   - Content-Type: `image/jpeg`
   - Size: Should be compressed (< 1MB typically)
   - Download URL exists

### Step 4: Test Security Rules

**Test 1: Upload as authenticated user**
- ✅ Should work

**Test 2: Try uploading a 10MB file**
- ❌ Should fail with size error

**Test 3: Try uploading a .txt file**
- ❌ Should fail with type error

**Test 4: View another user's profile picture**
- ✅ Should work (read access allowed)

---

## 🔄 Alternative Solution (Temporary Workaround)

If you **cannot enable Firebase Storage** right now, you can temporarily disable profile picture uploads and use only default avatars.

### Option 1: Disable Upload UI (Recommended)

**Modify your HTML/UI code to hide the upload button:**

1. Find the profile picture upload section in your UI
2. Add `style="display: none;"` to hide it temporarily
3. Users will only see their default avatar (generated from initials)

**Example:**
```html
<!-- Hide this section temporarily -->
<div id="profilePictureUpload" style="display: none;">
  <button id="uploadPhotoBtn">Cambiar foto de perfil</button>
</div>
```

### Option 2: Disable Upload Functionality

**Modify [`uploadProfilePicture`](script.js:230) function:**

```javascript
async function uploadProfilePicture(userId, file) {
    // Temporarily disabled - Firebase Storage not configured
    throw new Error('La carga de fotos está temporalmente deshabilitada. Usa tu avatar predeterminado.');
}
```

### Option 3: Use Default Avatars Only

Your app already has excellent default avatar generation:
- ✅ Generates colorful avatars with user initials
- ✅ Works via [`generateDefaultAvatar`](script.js:56) function
- ✅ No Firebase Storage needed
- ✅ Unique color per user

**To use only default avatars:**
1. Keep the current implementation
2. Don't enable Firebase Storage
3. Remove or hide upload buttons
4. Users get beautiful default avatars automatically

---

## 🔧 Troubleshooting

### Issue 1: Still Getting CORS Errors After Setup

**Symptoms:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solutions:**

1. **Clear Browser Cache**
   - Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
   - Clear cached images and files
   - Restart browser

2. **Verify Storage Rules Published**
   - Go to Firebase Console → Storage → Rules
   - Check "Last published" timestamp
   - Should be recent (within last few minutes)

3. **Check Storage Bucket Name**
   - In [`firebaseConfig`](script.js:10): `candelita-pura.firebasestorage.app`
   - In Firebase Console: Should match exactly
   - If different, update your config

4. **Restart Local Server**
   - Stop your server (Ctrl+C)
   - Start again
   - Hard refresh browser (Ctrl+Shift+R)

### Issue 2: "Permission Denied" Error

**Symptoms:**
```
FirebaseError: Missing or insufficient permissions
```

**Solutions:**

1. **Check User Authentication**
   - User must be logged in
   - Check: `currentUser` is not null
   - Verify: Firebase Auth token is valid

2. **Verify Storage Rules**
   - Rules must include: `request.auth != null`
   - Rules must match your file path structure
   - Re-publish rules if needed

3. **Check User ID Match**
   - Upload path: `profile-pictures/${userId}/avatar.jpg`
   - `userId` must match `request.auth.uid`
   - Verify in console: `console.log(currentUser.uid)`

### Issue 3: File Upload Fails Silently

**Symptoms:**
- No error message
- Upload button doesn't respond
- Nothing happens

**Solutions:**

1. **Check File Size**
   - Maximum: 5MB (5 * 1024 * 1024 bytes)
   - Your code compresses to ~800px max dimension
   - Original file might still be too large

2. **Check File Type**
   - Allowed: JPG, PNG, WEBP
   - Check: [`validateProfileImage`](script.js:167) function
   - Browser console shows validation errors

3. **Check Browser Console**
   - Open DevTools (F12)
   - Look for JavaScript errors
   - Check Network tab for failed requests

### Issue 4: Storage Quota Exceeded

**Symptoms:**
```
FirebaseError: Quota exceeded
```

**Solutions:**

1. **Check Storage Usage**
   - Firebase Console → Storage
   - Look at usage meter at top
   - Free tier: 5GB total storage

2. **Delete Old Files**
   - Go to Storage → Files
   - Delete unnecessary files
   - Empty trash

3. **Upgrade Plan (If Needed)**
   - Free tier: 5GB storage, 1GB/day downloads
   - Blaze plan: Pay as you go
   - For small apps, free tier is usually enough

### Issue 5: Image Not Displaying After Upload

**Symptoms:**
- Upload succeeds
- Image doesn't show in UI
- Broken image icon appears

**Solutions:**

1. **Check Download URL**
   - Verify: [`getDownloadURL`](script.js:242) returns valid URL
   - URL should start with: `https://firebasestorage.googleapis.com`
   - Test URL in browser directly

2. **Check Image Cache**
   - Browser might cache old image
   - Hard refresh: Ctrl+Shift+R
   - Or add cache-busting: `?t=${Date.now()}`

3. **Verify Firestore Update**
   - Check: [`updateDoc`](script.js:244) succeeds
   - User profile should have `photoURL` field
   - Verify in Firebase Console → Firestore

### Issue 6: Rules Not Taking Effect

**Symptoms:**
- Published rules but still getting errors
- Changes don't seem to apply

**Solutions:**

1. **Wait for Propagation**
   - Rules can take 1-2 minutes to propagate
   - Wait and try again

2. **Check Rules Syntax**
   - Go to Rules tab
   - Look for syntax errors (red underlines)
   - Fix and re-publish

3. **Test Rules in Simulator**
   - Firebase Console → Storage → Rules
   - Click "Rules Playground" button
   - Test your rules with sample requests

---

## 📊 Storage Best Practices

### Performance Tips

1. **Image Compression**
   - Your app already compresses images via [`compressProfileImage`](script.js:180)
   - Max dimension: 800px
   - Quality: 85%
   - Format: JPEG

2. **Caching**
   - Firebase Storage URLs are cacheable
   - Browser automatically caches images
   - Use cache-busting only when needed

3. **Lazy Loading**
   - Load profile pictures only when needed
   - Don't load all users' pictures at once

### Security Tips

1. **Never Trust Client**
   - Always validate on server (Storage Rules)
   - Client validation is just UX improvement
   - Rules are your real security

2. **Principle of Least Privilege**
   - Users can only access their own folders
   - Read access only for viewing
   - Write access only for own files

3. **Regular Audits**
   - Review Storage Rules monthly
   - Check for unused files
   - Monitor usage patterns

### Cost Optimization

1. **Free Tier Limits**
   - 5GB storage
   - 1GB/day downloads
   - 50,000 downloads/day

2. **Reduce Costs**
   - Compress images (already done ✅)
   - Delete old/unused files
   - Use CDN for frequently accessed files

3. **Monitor Usage**
   - Firebase Console → Usage tab
   - Set up budget alerts
   - Track storage growth

---

## 📚 Additional Resources

### Official Documentation
- [Firebase Storage Documentation](https://firebase.google.com/docs/storage)
- [Storage Security Rules](https://firebase.google.com/docs/storage/security)
- [CORS Configuration](https://firebase.google.com/docs/storage/web/download-files#cors_configuration)

### Related Guides in This Project
- [`USER_PROFILE_SYSTEM_ARCHITECTURE.md`](USER_PROFILE_SYSTEM_ARCHITECTURE.md) - Profile system overview
- [`AUTHENTICATION_TESTING_GUIDE.md`](AUTHENTICATION_TESTING_GUIDE.md) - Auth testing
- [`START_SERVER.md`](START_SERVER.md) - Local development setup

### Support
- Firebase Support: https://firebase.google.com/support
- Stack Overflow: Tag `firebase-storage`
- Firebase Community: https://firebase.google.com/community

---

## ✨ Summary

### What You Need to Do

1. **Enable Firebase Storage** (5 minutes)
   - Firebase Console → Storage → Get Started
   - Choose location → Done

2. **Set Security Rules** (2 minutes)
   - Copy rules from this guide
   - Paste in Rules tab → Publish

3. **Test Upload** (2 minutes)
   - Login to app
   - Upload profile picture
   - Verify success

### Expected Results

✅ No more CORS errors  
✅ Profile pictures upload successfully  
✅ Images display correctly  
✅ Secure user isolation  
✅ File size and type validation  

### Time to Fix
**Total: 10-15 minutes**

### Need Help?
If you encounter issues not covered in this guide, check the Troubleshooting section or refer to the official Firebase documentation.

---

**Last Updated:** 2026-05-22  
**Firebase Project:** candelita-pura  
**Storage Bucket:** candelita-pura.firebasestorage.app