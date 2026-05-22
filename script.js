import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, getDocs, where, getDoc, doc, setDoc, deleteDoc, Timestamp, updateDoc, or } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Firebase Storage imports commented out - using base64 storage instead (free alternative)
// import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyA0I7HG0Z-W6Sbt7oTdgNDZiS-I1ECfW1E",
    authDomain: "candelita-pura.firebaseapp.com",
    projectId: "candelita-pura",
    storageBucket: "candelita-pura.firebasestorage.app",
    messagingSenderId: "405961040903",
    appId: "1:405961040903:web:a3d28c79a379f95952f6a2",
    measurementId: "G-Z1VW220PR3"
};

console.log('🔥 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// Storage initialization commented out - using base64 storage instead
// const storage = getStorage(app);
console.log('✅ Firebase initialized successfully');

// Set persistence to LOCAL (survives browser restarts)
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("❌ Error setting auth persistence:", error);
});

// Global variable to store current user
let currentUser = null;
let currentUserProfile = null;
let activityFeedUnsubscribe = null;

let chart = null;

// --- USER PROFILE HELPERS ---

function getDisplayNameForCurrentContext() {
    return currentUserProfile?.displayName || currentUser?.displayName || (localStorage.getItem('nombreUsuario') || '').trim();
}

function getPhotoURLForCurrentContext() {
    return currentUserProfile?.photoURL || currentUser?.photoURL || null;
}

function getUserInitials(displayName = 'Usuario') {
    return displayName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';
}

function generateDefaultAvatar(displayName = 'Usuario') {
    const initials = getUserInitials(displayName);
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#9B59B6', '#F39C12'];
    const colorIndex = displayName.length % colors.length;
    const bgColor = colors[colorIndex];

    const svg = `
        <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">
            <rect width="150" height="150" rx="75" ry="75" fill="${bgColor}"/>
            <text x="50%" y="50%"
                  font-family="Arial, sans-serif"
                  font-size="56"
                  font-weight="bold"
                  fill="white"
                  text-anchor="middle"
                  dominant-baseline="central">
                ${initials}
            </text>
        </svg>
    `.trim();

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function getAvatarURL(displayName, photoURL) {
    return photoURL || generateDefaultAvatar(displayName);
}

function setImagePreview(imgEl, displayName, photoURL) {
    if (!imgEl) return;
    imgEl.src = getAvatarURL(displayName, photoURL);
    imgEl.alt = `Avatar de ${displayName || 'usuario'}`;
}

function formatAccountDate(dateValue) {
    const date = dateValue?.toDate?.() || (dateValue instanceof Date ? dateValue : null);
    if (!date) return '—';
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function buildDefaultUserProfile(user, displayName) {
    return {
        uid: user.uid,
        email: user.email || '',
        displayName: displayName || user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario'),
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        settings: {
            notifications: true,
            publicProfile: true,
            theme: 'default'
        },
        stats: {
            totalCount: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastActivity: null
        }
    };
}

async function createUserProfile(user, displayName) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const existingProfile = await getDoc(userRef);

        if (existingProfile.exists()) {
            return existingProfile.data();
        }

        const profileData = buildDefaultUserProfile(user, displayName);
        await setDoc(userRef, profileData);
        return {
            ...profileData,
            createdAt: new Date(),
            lastActive: new Date()
        };
    } catch (error) {
        console.error('Error creating user profile:', error);
        throw error;
    }
}

async function getUserProfile(userId) {
    try {
        const profileSnap = await getDoc(doc(db, 'users', userId));
        return profileSnap.exists() ? profileSnap.data() : null;
    } catch (error) {
        console.error('Error loading user profile:', error);
        throw error;
    }
}

async function updateUserProfile(userId, updates) {
    try {
        await updateDoc(doc(db, 'users', userId), {
            ...updates,
            lastActive: serverTimestamp()
        });
        return await getUserProfile(userId);
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}

/**
 * BASE64 PROFILE PICTURE IMPLEMENTATION
 * =====================================
 * This implementation stores profile pictures as base64 strings directly in Firestore
 * instead of using Firebase Storage. This is a completely FREE alternative that:
 *
 * - Avoids Firebase Storage costs (no payment setup needed)
 * - Uses existing Firestore free tier (1GB storage, 50K reads/day, 20K writes/day)
 * - Compresses images to ~100KB to stay within Firestore document limits (1MB max)
 * - Supports up to 10,000 users with profile pictures in 1GB storage
 * - Works immediately without any Firebase Console configuration
 *
 * Trade-offs vs Firebase Storage:
 * - Slightly larger Firestore documents (but well within limits)
 * - Images loaded with user profile (no separate download needed)
 * - Better for small-medium apps with <10K users
 * - Simpler implementation, no Storage rules needed
 */

function validateProfileImage(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!file) {
        return { valid: false, error: 'Selecciona una imagen.' };
    }
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'La imagen debe ser JPG, PNG o WEBP.' };
    }
    if (file.size > 5 * 1024 * 1024) {
        return { valid: false, error: 'La imagen no puede superar 5MB.' };
    }
    return { valid: true };
}

/**
 * Convert image file to compressed base64 string
 * @param {File} file - Image file to convert
 * @param {number} maxSizeKB - Maximum size in KB (default 100KB to stay within Firestore limits)
 * @returns {Promise<string>} Base64 data URL (e.g., "data:image/jpeg;base64,...")
 */
async function imageToBase64(file, maxSizeKB = 100) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Resize to max 800x800 to reduce file size
                const maxDim = 800;
                if (width > height && width > maxDim) {
                    height = (height * maxDim) / width;
                    width = maxDim;
                } else if (height > maxDim) {
                    width = (width * maxDim) / height;
                    height = maxDim;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    reject(new Error('No se pudo procesar la imagen.'));
                    return;
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to target size by adjusting quality
                let quality = 0.9;
                let base64 = canvas.toDataURL('image/jpeg', quality);
                
                // Reduce quality iteratively if image is too large
                // Base64 encoding increases size by ~33%, so we target maxSizeKB * 1024 bytes
                while (base64.length > maxSizeKB * 1024 && quality > 0.1) {
                    quality -= 0.1;
                    base64 = canvas.toDataURL('image/jpeg', quality);
                }
                
                if (base64.length > maxSizeKB * 1024) {
                    reject(new Error(`No se pudo comprimir la imagen a menos de ${maxSizeKB}KB.`));
                    return;
                }
                
                console.log(`✅ Image compressed to ${Math.round(base64.length / 1024)}KB (quality: ${Math.round(quality * 100)}%)`);
                resolve(base64);
            };
            
            img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
        reader.readAsDataURL(file);
    });
}

/**
 * Upload profile picture as base64 string (FREE - no Storage needed)
 * Stores compressed image directly in Firestore user document
 * @param {string} userId - User ID
 * @param {File|null} file - Image file to upload (if uploading from file input)
 * @param {string|null} base64Image - Base64 image (if already cropped)
 * @returns {Promise<string>} Base64 data URL of uploaded image
 */
async function uploadProfilePicture(userId, file = null, base64Image = null) {
    try {
        let finalBase64;
        
        // If base64 is provided (from cropper), use it directly
        if (base64Image) {
            console.log('📸 Using pre-cropped base64 image...');
            finalBase64 = base64Image;
        }
        // If file is provided (direct upload without cropper), convert it
        else if (file) {
            console.log('📸 Converting image to base64...');
            // Validate file first
            validateProfileImage(file);
            // Convert image to base64 with max 100KB size
            finalBase64 = await imageToBase64(file, 100);
        }
        else {
            throw new Error('No image provided');
        }
        
        console.log('💾 Saving to Firestore...');
        // Store base64 string directly in user profile (Firestore only)
        // Note: We don't update Firebase Auth photoURL because base64 strings
        // exceed the character limit (~100KB vs ~2KB limit). The app uses
        // currentUserProfile.photoURL from Firestore instead via getPhotoURLForCurrentContext()
        await updateDoc(doc(db, 'users', userId), {
            photoURL: finalBase64,
            lastActive: serverTimestamp()
        });

        console.log('✅ Profile picture uploaded successfully (base64 in Firestore)');
        return finalBase64;
    } catch (error) {
        console.error('❌ Error uploading profile picture:', error);
        throw error;
    }
}

/**
 * Delete profile picture (base64 version - just clears Firestore field)
 * No Storage cleanup needed since image is stored in Firestore
 * Note: We don't update Firebase Auth photoURL - the app uses Firestore data
 * @param {string} userId - User ID
 * @returns {Promise<null>}
 */
async function deleteProfilePicture(userId) {
    try {
        console.log('🗑️ Deleting profile picture...');
        
        // Clear photoURL in Firestore only
        // Firebase Auth photoURL is not updated (app uses Firestore data)
        await updateDoc(doc(db, 'users', userId), {
            photoURL: null,
            lastActive: serverTimestamp()
        });

        console.log('✅ Profile picture deleted');
        return null;
    } catch (error) {
        console.error('❌ Error deleting profile picture:', error);
        throw error;
    }
}

/**
 * Preview profile picture before upload
 * Shows compressed image and size information
 * @param {File} file - Image file to preview
 */
async function previewProfilePicture(file) {
    const previewContainer = document.getElementById('profilePicturePreview');
    const previewImage = document.getElementById('previewImage');
    const previewSize = document.getElementById('previewSize');
    
    if (!file) {
        if (previewContainer) previewContainer.style.display = 'none';
        return;
    }
    
    try {
        // Show loading state
        if (previewSize) previewSize.textContent = 'Procesando...';
        if (previewContainer) previewContainer.style.display = 'block';
        
        // Get original size
        const originalSizeKB = (file.size / 1024).toFixed(0);
        
        // Convert to base64 (same compression as upload)
        const base64Image = await imageToBase64(file, 100);
        
        // Calculate compressed size (base64 is ~33% larger than binary)
        const compressedSizeKB = Math.round((base64Image.length * 0.75) / 1024);
        
        // Display preview
        if (previewImage) {
            previewImage.src = base64Image;
            // Fade in animation
            previewImage.style.opacity = '0';
            setTimeout(() => {
                previewImage.style.transition = 'opacity 0.3s ease';
                previewImage.style.opacity = '1';
            }, 10);
        }
        
        if (previewSize) {
            previewSize.textContent = `Tamaño original: ${originalSizeKB} KB → Comprimido: ${compressedSizeKB} KB`;
        }
        
    } catch (error) {
        console.error('Error previewing image:', error);
        if (previewSize) {
            previewSize.textContent = 'Error al procesar la imagen';
        }
    }
}

function updateHeaderProfileUI() {
    const displayName = getDisplayNameForCurrentContext() || 'Hola';
    const photoURL = getPhotoURLForCurrentContext();
    const saludo = document.getElementById('saludo');
    const headerAvatar = document.getElementById('headerAvatar');
    const headerAvatarMenu = document.getElementById('headerAvatarMenu');
    const profileMenuName = document.getElementById('profileMenuName');

    if (saludo) saludo.innerText = 'Hola ' + displayName + ' ✨';
    if (headerAvatar) setImagePreview(headerAvatar, displayName, photoURL);
    if (headerAvatarMenu) setImagePreview(headerAvatarMenu, displayName, photoURL);
    if (profileMenuName) profileMenuName.textContent = displayName;
}

function renderProfileSettings() {
    const profile = currentUserProfile;
    if (!profile) return;

    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileEmail = document.getElementById('profileEmail');
    const profileNotifications = document.getElementById('profileNotifications');
    const profilePublic = document.getElementById('profilePublic');
    const profileCreatedAt = document.getElementById('profileCreatedAt');
    const profileAvatar = document.getElementById('profileAvatar');

    if (profileDisplayName) profileDisplayName.value = profile.displayName || '';
    if (profileEmail) profileEmail.value = profile.email || '';
    if (profileNotifications) profileNotifications.checked = profile.settings?.notifications ?? true;
    if (profilePublic) profilePublic.checked = profile.settings?.publicProfile ?? true;
    if (profileCreatedAt) profileCreatedAt.textContent = formatAccountDate(profile.createdAt);
    if (profileAvatar) setImagePreview(profileAvatar, profile.displayName, profile.photoURL);
}

function setProfileStatus(message, isError = false) {
    const status = document.getElementById('profileStatus');
    if (!status) return;
    status.textContent = message || '';
    status.className = isError ? 'profile-status error' : 'profile-status success';
}

function setProfileLoading(isLoading, message = 'Cargando perfil...') {
    const loader = document.getElementById('profileLoading');
    if (!loader) return;
    loader.textContent = message;
    loader.style.display = isLoading ? 'block' : 'none';
}

async function syncCurrentUserProfile(user) {
    if (!user) {
        currentUserProfile = null;
        return null;
    }

    let profile = await getUserProfile(user.uid);

    if (!profile) {
        profile = await createUserProfile(user, user.displayName);
    }

    currentUserProfile = profile;
    localStorage.setItem('nombreUsuario', profile.displayName || user.displayName || '');

    updateHeaderProfileUI();
    renderProfileSettings();

    return profile;
}

async function touchUserActivity(userId) {
    if (!userId) return;
    try {
        await updateDoc(doc(db, 'users', userId), {
            lastActive: serverTimestamp()
        });
    } catch (error) {
        console.warn('Could not update lastActive:', error);
    }
}

async function updateUserStatsAfterToma(userId, activityDate = new Date()) {
    if (!userId) return;

    try {
        const profile = await getUserProfile(userId);
        if (!profile) return;

        const totalCount = (profile.stats?.totalCount || 0) + 1;
        const previousLastActivity = profile.stats?.lastActivity?.toDate?.() || null;
        const normalizedDate = new Date(activityDate);
        normalizedDate.setHours(0, 0, 0, 0);

        let currentStreak = profile.stats?.currentStreak || 0;
        let longestStreak = profile.stats?.longestStreak || 0;

        if (!previousLastActivity) {
            currentStreak = 1;
        } else {
            const prevDate = new Date(previousLastActivity);
            prevDate.setHours(0, 0, 0, 0);
            const diffDays = Math.round((normalizedDate - prevDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                currentStreak = profile.stats?.currentStreak || 1;
            } else if (diffDays === 1) {
                currentStreak = (profile.stats?.currentStreak || 0) + 1;
            } else if (diffDays > 1) {
                currentStreak = 1;
            }
        }

        longestStreak = Math.max(longestStreak, currentStreak);

        await updateDoc(doc(db, 'users', userId), {
            'stats.totalCount': totalCount,
            'stats.currentStreak': currentStreak,
            'stats.longestStreak': longestStreak,
            'stats.lastActivity': activityDate instanceof Date ? activityDate : new Date(activityDate),
            lastActive: serverTimestamp()
        });

        currentUserProfile = await getUserProfile(userId);
        updateHeaderProfileUI();
        renderProfileSettings();
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

// --- FIREBASE AUTHENTICATION FUNCTIONS ---

/**
 * Register a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password (min 8 chars)
 * @param {string} displayName - User's display name
 * @returns {Promise<Object>} User credential
 */
async function registerUser(email, password, displayName) {
    try {
        console.log('Registering user:', email);

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: displayName });
        await createUserProfile({ ...user, displayName }, displayName);

        console.log('User registered successfully:', user.uid);
        return userCredential;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

/**
 * Login existing user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} User credential
 */
async function loginUser(email, password) {
    try {
        console.log('Logging in user:', email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('User logged in successfully:', userCredential.user.uid);
        return userCredential;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
async function logoutUser() {
    try {
        console.log('Logging out user');
        await signOut(auth);
        console.log('User logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}

/**
 * Send password reset email
 * @param {string} email - User's email
 * @returns {Promise<void>}
 */
async function resetPassword(email) {
    try {
        console.log('Sending password reset email to:', email);
        await sendPasswordResetEmail(auth, email);
        console.log('Password reset email sent');
    } catch (error) {
        console.error('Password reset error:', error);
        throw error;
    }
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user or null
 */
function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Get user-friendly error message from Firebase error code
 * @param {string} errorCode - Firebase error code
 * @returns {string} User-friendly error message
 */
function getAuthErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'Este email ya está registrado. Por favor, inicia sesión.',
        'auth/invalid-email': 'El formato del email no es válido.',
        'auth/operation-not-allowed': 'Operación no permitida.',
        'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
        'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
        'auth/user-not-found': 'No existe una cuenta con este email.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde.',
        'auth/network-request-failed': 'Error de conexión. Verifica tu internet.',
        'auth/invalid-credential': 'Credenciales inválidas. Verifica tu email y contraseña.',
        'auth/missing-password': 'Debes introducir una contraseña.'
    };
    
    return errorMessages[errorCode] || 'Error de autenticación. Intenta de nuevo.';
}

async function hashString(str) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
// rango actual de la gráfica: 'week' | 'month' | 'year'
window.chartRange = 'month';

// --- 1. FUNCIONES DE NAVEGACIÓN (CONECTADAS AL HTML) ---
window.toggleMenu = () => {
    document.getElementById('menu').classList.toggle('active');
};

window.showSection = (id) => {
    const sections = ['main-sec', 'ranking-sec', 'stats-sec', 'achievements-sec', 'profile-sec', 'history-sec'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(id + '-sec');
    if (target) target.classList.remove('hidden');

    if (id === 'stats') setTimeout(() => renderChart(), 100);
    if (id === 'ranking') renderRanking();
    if (id === 'achievements') checkAchievements();
    if (id === 'profile') {
        setProfileLoading(!currentUserProfile, 'Cargando perfil...');
        renderProfileSettings();
    }
    if (id === 'history') {
        renderActivityHistory();
    }

    if (document.getElementById('menu').classList.contains('active')) window.toggleMenu();
};

// --- 2. LÓGICA DE USUARIO Y CALENDARIO ---
window.addEventListener('load', async () => {
    console.log('App loading...');
    setupAuthModal();
    setupProfileUI();
    setupCropperControls();

    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? user.email : 'No user');
        currentUser = user;

        if (activityFeedUnsubscribe) {
            activityFeedUnsubscribe();
            activityFeedUnsubscribe = null;
        }

        if (user) {
            console.log('User authenticated:', user.uid);
            setProfileLoading(true, 'Cargando perfil...');
            await syncCurrentUserProfile(user);
            setProfileLoading(false);

            const displayName = getDisplayNameForCurrentContext();
            generateCalendar(displayName);
            renderRanking();
            renderChart();
            if (window.actualizarRacha) window.actualizarRacha();
            if (window.listaListener) activityFeedUnsubscribe = window.listaListener();

            const modal = document.getElementById('nameModal');
            if (modal) {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        } else {
            currentUserProfile = null;
            updateHeaderProfileUI();

            console.log('No user authenticated, showing auth modal');
            const stored = (localStorage.getItem('nombreUsuario') || '').trim();

            if (stored) {
                console.log('Legacy user found:', stored);
                generateCalendar(stored);
                renderRanking();
                renderChart();
                if (window.actualizarRacha) window.actualizarRacha();
                if (window.listaListener) activityFeedUnsubscribe = window.listaListener();
            } else {
                await openAuthModal();
            }
        }
    });
});

// Open authentication modal
async function openAuthModal() {
    const modal = document.getElementById('nameModal');
    if (!modal) return;
    
    console.log('Opening auth modal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Show login form by default
    showLoginForm();
}

// Setup authentication modal event listeners
function setupAuthModal() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const toggleToRegister = document.getElementById('toggleToRegister');
    const toggleToLogin = document.getElementById('toggleToLogin');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    
    // Login button
    loginBtn?.addEventListener('click', handleLogin);
    
    // Register button
    registerBtn?.addEventListener('click', handleRegister);
    
    // Toggle between login and register forms
    toggleToRegister?.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });
    
    toggleToLogin?.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    
    // Forgot password
    forgotPasswordLink?.addEventListener('click', (e) => {
        e.preventDefault();
        handleForgotPassword();
    });
    
    // Allow Enter key to submit forms
    document.getElementById('loginEmail')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); loginBtn?.click(); }
    });
    document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); loginBtn?.click(); }
    });
    document.getElementById('registerEmail')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); registerBtn?.click(); }
    });
    document.getElementById('registerPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); registerBtn?.click(); }
    });
    document.getElementById('registerDisplayName')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); registerBtn?.click(); }
    });
}

// Show login form
function showLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    
    // Clear inputs
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    if (loginEmail) { loginEmail.value = ''; loginEmail.focus(); }
    if (loginPassword) loginPassword.value = '';
    
    // Clear error messages
    clearAuthErrors();
}

// Show register form
function showRegisterForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    
    // Clear inputs
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const registerDisplayName = document.getElementById('registerDisplayName');
    if (registerEmail) { registerEmail.value = ''; registerEmail.focus(); }
    if (registerPassword) registerPassword.value = '';
    if (registerDisplayName) registerDisplayName.value = '';
    
    // Clear error messages
    clearAuthErrors();
}

// Handle login
async function handleLogin() {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorDiv = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    
    // Validation
    if (!email) {
        showAuthError(errorDiv, 'Por favor, introduce tu email.');
        emailInput?.focus();
        return;
    }
    
    if (!password) {
        showAuthError(errorDiv, 'Por favor, introduce tu contraseña.');
        passwordInput?.focus();
        return;
    }
    
    // Show loading state
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Iniciando sesión...';
    }
    
    try {
        await loginUser(email, password);
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error('Login error:', error);
        showAuthError(errorDiv, getAuthErrorMessage(error.code));
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
        }
    }
}

// Handle registration
async function handleRegister() {
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const displayNameInput = document.getElementById('registerDisplayName');
    const errorDiv = document.getElementById('registerError');
    const registerBtn = document.getElementById('registerBtn');
    
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    const displayName = displayNameInput?.value.trim();
    
    // Validation
    if (!displayName) {
        showAuthError(errorDiv, 'Por favor, introduce tu nombre.');
        displayNameInput?.focus();
        return;
    }
    
    if (!email) {
        showAuthError(errorDiv, 'Por favor, introduce tu email.');
        emailInput?.focus();
        return;
    }
    
    if (!password) {
        showAuthError(errorDiv, 'Por favor, introduce una contraseña.');
        passwordInput?.focus();
        return;
    }
    
    if (password.length < 8) {
        showAuthError(errorDiv, 'La contraseña debe tener al menos 8 caracteres.');
        passwordInput?.focus();
        return;
    }
    
    // Show loading state
    if (registerBtn) {
        registerBtn.disabled = true;
        registerBtn.textContent = 'Registrando...';
    }
    
    try {
        await registerUser(email, password, displayName);
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error('Registration error:', error);
        showAuthError(errorDiv, getAuthErrorMessage(error.code));
    } finally {
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Registrarse';
        }
    }
}

// Handle forgot password
async function handleForgotPassword() {
    const emailInput = document.getElementById('loginEmail');
    const email = emailInput?.value.trim();
    
    if (!email) {
        alert('Por favor, introduce tu email en el campo de inicio de sesión.');
        emailInput?.focus();
        return;
    }
    
    try {
        await resetPassword(email);
        alert('Se ha enviado un email para restablecer tu contraseña. Revisa tu bandeja de entrada.');
    } catch (error) {
        console.error('Password reset error:', error);
        alert(getAuthErrorMessage(error.code));
    }
}

// Show authentication error
function showAuthError(errorDiv, message) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Clear authentication errors
function clearAuthErrors() {
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    
    if (loginError) {
        loginError.textContent = '';
        loginError.style.display = 'none';
    }
    if (registerError) {
        registerError.textContent = '';
        registerError.style.display = 'none';
    }
}

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth(); // 0-indexed

async function generateCalendar(user, year = currentCalendarYear, month = currentCalendarMonth) {
    const cal = document.getElementById("calendar");
    const title = document.getElementById("calendar-title");
    if (!cal) return;

    currentCalendarYear = year;
    currentCalendarMonth = month;

    let snap;
    if (currentUser?.uid) {
        snap = await getDocs(query(collection(db, "tomas"), where("userId", "==", currentUser.uid)));
    } else {
        snap = await getDocs(query(collection(db, "tomas"), where("usuario", "==", user)));
    }

    const tomasPorDia = {};

    snap.forEach(doc => {
        const data = doc.data();
        const dt = data.fecha && typeof data.fecha.toDate === 'function'
            ? data.fecha.toDate()
            : (data.fecha instanceof Date ? data.fecha : null);

        if (!dt) return;

        if (dt.getFullYear() === year && dt.getMonth() === month) {
            const dia = dt.getDate();
            tomasPorDia[dia] = (tomasPorDia[dia] || 0) + 1;
        }
    });


    // título del mes (en español) con primera letra mayúscula
    const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    if (title) title.innerText = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    // generar celdas del calendario alineadas empezando por Lunes
    cal.innerHTML = '';

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // weekday: 0=Dom..6=Sáb. Queremos empezar por Lunes => shift = (weekday+6)%7
    const firstWeekday = new Date(year, month, 1).getDay();
    const shift = (firstWeekday + 6) % 7;

    // añadir celdas vacías para ajustar inicio de mes
    for (let i = 0; i < shift; i++) {
        const empty = document.createElement('div');
        empty.className = 'day empty';
        cal.appendChild(empty);
    }

    // añadir días
    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'day';
        cell.innerText = d;
        const hoy = new Date();

        if (d === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear()) {
            cell.classList.add('today');
        }
        const cantidad = tomasPorDia[d] || 0;

        if (cantidad > 0) {
            cell.classList.add('active-day');
            cell.style.cursor = 'pointer';
            cell.onclick = () => verDetallesDia(d, month, year);
            
            // Aplicar clases de intensidad según el número de tomas
            if (cantidad === 2) {
                cell.classList.add('heat-2');
            } else if (cantidad === 3) {
                cell.classList.add('heat-3');
            } else if (cantidad >= 4) {
                cell.classList.add('heat-max');
            }
        }
        
        cal.appendChild(cell);
    }
}

// funciones de navegación del calendario
window.calendarPrevMonth = (user) => {
    let y = currentCalendarYear;
    let m = currentCalendarMonth - 1;
    if (m < 0) { m = 11; y -= 1; }
    generateCalendar(user || localStorage.getItem('nombreUsuario'), y, m);
};
window.calendarNextMonth = (user) => {
    let y = currentCalendarYear;
    let m = currentCalendarMonth + 1;
    if (m > 11) { m = 0; y += 1; }
    generateCalendar(user || localStorage.getItem('nombreUsuario'), y, m);
}

window.verDetallesDia = async (dia, mes, año) => {
    const title = document.getElementById("dayDetailsTitle");
    const list = document.getElementById("dayDetailsList");
    const modal = document.getElementById("dayDetailsModal");
    const userActual = localStorage.getItem('nombreUsuario') || '';
    
    title.innerText = `Día ${dia}/${mes + 1}/${año} 🍦`;
    list.innerHTML = "Cargando...";
    modal.style.display = 'flex';

    try {
        // Consultamos todas las tomas
        const q = query(collection(db, "tomas"), orderBy("fecha", "asc"));
        const snap = await getDocs(q);
        
        list.innerHTML = ""; // Limpiamos el "Cargando..."
        let encontradas = 0;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const idToma = docSnap.id;
            const dt = data.fecha?.toDate();
            
            if (dt && dt.getDate() === dia && dt.getMonth() === mes && dt.getFullYear() === año) {
                encontradas++;
                const hora = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                const item = document.createElement('div');
                item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee; font-size:14px;";
                
                // Si el deli es del usuario actual, le permitimos borrarlo
                const deleteBtn = (data.usuario === userActual) 
                    ? `<button onclick="borrarToma('${idToma}'); document.getElementById('dayDetailsModal').style.display='none';" 
                        style="background:none; border:none; cursor:pointer; font-size:14px; margin-left:10px;">🗑️</button>`
                    : "";

                item.innerHTML = `
                    <span><b>${data.usuario}</b> <small style="color:#888; margin-left:8px;">${hora}</small></span>
                    ${deleteBtn}
                `;
                list.appendChild(item);
            }
        });

        if (encontradas === 0) list.innerHTML = "No hay registros este día.";
    } catch (e) {
        console.error(e);
        list.innerHTML = "Error al cargar los datos.";
    }
};

window.registrarToma = async () => {
    const u = getDisplayNameForCurrentContext();
    if (!u) {
        alert("Debes introducir un nombre antes de registrar una toma.");
        return;
    }

    try {
        await addDoc(collection(db, "tomas"), {
            userId: currentUser?.uid || null,
            usuario: u,
            userPhotoURL: getPhotoURLForCurrentContext(),
            fecha: serverTimestamp()
        });

        if (currentUser?.uid) {
            await updateUserStatsAfterToma(currentUser.uid, new Date());
            await touchUserActivity(currentUser.uid);
        }

        window.celebrarToma();
        console.log("¡Toma registrada con éxito!");
    } catch (err) {
        console.error('Error guardando en Firestore:', err);
        alert('Error guardando en la base de datos. Revisa la consola.');
        return;
    }

    try {
        const notificationsEnabled = currentUserProfile?.settings?.notifications ?? true;
        if (notificationsEnabled) {
            const res = await fetch('https://ntfy.sh/candelita-pura', {
                method: 'POST',
                body: `🔥¡${u} ha cumplido!🔥`,
                headers: {
                    'Title': 'Candelita Pura',
                    'Icon': 'https://styles.redditmedia.com/t5_32uhe/styles/communityIcon_xnt6chtnr2j21.png',
                    'Click': window.location.href,
                    'Priority': 'max',
                    'Markdown': 'yes',
                    'Content-Type': 'text/markdown'
                }
            });
            console.log('ntfy POST status:', res.status, res.statusText);
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                console.warn('ntfy response body:', body);
                alert('No se pudo enviar la notificación (ntfy). Revisa la consola para más detalles.');
            } else {
                console.log('Delicioso registrado y notificación enviada a ntfy.');
            }
        }
    } catch (err) {
        console.error('Error enviando notificación ntfy:', err);
        alert('Error enviando notificación. Revisa la consola.');
    }

    setTimeout(() => {
        generateCalendar(u);
        renderRanking();
        renderChart();
        actualizarRacha();
    }, 1500);
};

// ---- Registrar toma pasada ----

// Abrir/Cerrar Modal Manual
window.openManualModal = () => {
    const modal = document.getElementById('manualModal');
    const input = document.getElementById('manualDateTime');
    
    // Ponemos por defecto la hora actual para facilitar la selección
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    input.value = ahora.toISOString().slice(0, 16);
    
    modal.style.display = 'flex';
};

window.closeManualModal = () => {
    document.getElementById('manualModal').style.display = 'none';
};

// Guardar toma con fecha personalizada
window.confirmarTomaPasada = async () => {
    const u = getDisplayNameForCurrentContext();
    const fechaInput = document.getElementById('manualDateTime').value;

    if (!u || !fechaInput) {
        alert("Falta el nombre o la fecha");
        return;
    }

    const fechaObjeto = new Date(fechaInput);

    if (fechaObjeto > new Date()) {
        alert("¡No puedes registrar deliciosos en el futuro! 🚀");
        return;
    }

    try {
        await addDoc(collection(db, "tomas"), {
            userId: currentUser?.uid || null,
            usuario: u,
            userPhotoURL: getPhotoURLForCurrentContext(),
            fecha: fechaObjeto
        });

        if (currentUser?.uid) {
            await updateUserStatsAfterToma(currentUser.uid, fechaObjeto);
            await touchUserActivity(currentUser.uid);
        }

        console.log("Toma pasada registrada");
        window.closeManualModal();
        window.celebrarToma();

        const txtFecha = fechaObjeto.toLocaleString('es-ES', { day:'2-digit', month:'2-digit'});
        const notificationsEnabled = currentUserProfile?.settings?.notifications ?? true;
        if (notificationsEnabled) {
            fetch('https://ntfy.sh/candelita-pura', {
                method: 'POST',
                body: `${u} ha registrado un deli del ${txtFecha} 🌋`,
                headers: {
                    'Title': 'Candelita Pura',
                    'Icon': 'https://styles.redditmedia.com/t5_32uhe/styles/communityIcon_xnt6chtnr2j21.png',
                    'Click': window.location.href
                }
            });
        }

        setTimeout(() => {
            generateCalendar(u);
            renderRanking();
            renderChart();
            actualizarRacha();
        }, 1000);

    } catch (err) {
        console.error('Error Firebase:', err);
        alert('Error de permisos: Asegúrate de haber actualizado las reglas en la consola de Firebase.');
    }
};


// --- 4. ÚLTIMOS MOVIMIENTOS (TIEMPO REAL) ---

window.listaListener = () => {
    const l = document.getElementById("lista");
    const userActual = getDisplayNameForCurrentContext();
    if (!l) return null;
    l.innerHTML = "";

    const q = query(collection(db, "tomas"), orderBy("fecha", "desc"), limit(6));
    return onSnapshot(q, (snap) => {
        l.innerHTML = "";
        snap.forEach(docSnap => {
            const d = docSnap.data() || {};
            const idToma = docSnap.id;
            const ts = d.fecha?.toDate?.() || (d.fecha instanceof Date ? d.fecha : null);
            const dateTime = ts
                ? `${ts.toLocaleDateString('es-ES')} ${ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : '...';

            const row = document.createElement('div');
            row.className = 'ranking-item';

            const left = document.createElement('div');
            left.className = 'ranking-user';

            const avatar = document.createElement('img');
            avatar.className = 'avatar avatar-small';
            setImagePreview(avatar, d.usuario || 'Usuario', d.userPhotoURL || null);

            const nameContainer = document.createElement('span');
            const nameBold = document.createElement('b');
            nameBold.textContent = d.usuario || '—';
            nameContainer.appendChild(nameBold);

            left.appendChild(avatar);
            left.appendChild(nameContainer);

            const right = document.createElement('span');
            right.style.cssText = 'font-size:10px; color:#888; display: flex; align-items: center;';
            right.textContent = dateTime;

            if (d.usuario === userActual) {
                const btn = document.createElement('button');
                btn.innerHTML = '🗑️';
                btn.style.cssText = 'background:none; border:none; cursor:pointer; margin-left:8px; font-size:12px; opacity:0.7;';
                btn.onclick = () => borrarToma(idToma);
                right.appendChild(btn);
            } else {
                const btn = document.createElement('button');
                btn.innerHTML = ' ';
                btn.style.cssText = 'background:none; border:none; cursor:pointer; margin-left:24px; font-size:12px; opacity:0.7;';
                btn.onclick = () => borrarToma(idToma);
                right.appendChild(btn);
            }

            row.appendChild(left);
            row.appendChild(right);
            l.appendChild(row);
        });

        actualizarRacha();
    });
};

// --- 5. RANKING Y LOGROS ---
async function renderRanking() {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

    const q = query(
        collection(db, "tomas"),
        where("fecha", ">=", Timestamp.fromDate(inicioMes)),
        where("fecha", "<=", Timestamp.fromDate(finMes))
    );

    const snap = await getDocs(q);

    console.log(`Tomas en el mes actual: ${snap.size}`);

    const counts = {};
    snap.forEach(docSnap => {
        const data = docSnap.data();
        const userKey = data.userId || data.usuario || '—';
        if (!counts[userKey]) {
            counts[userKey] = {
                name: data.usuario || '—',
                photoURL: data.userPhotoURL || null,
                count: 0
            };
        }
        counts[userKey].count += 1;
        if (!counts[userKey].photoURL && data.userPhotoURL) {
            counts[userKey].photoURL = data.userPhotoURL;
        }
    });

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    const listDiv = document.getElementById("ranking-list");
    if (!listDiv) return;
    listDiv.innerHTML = "";

    const medals = ['🥇', '🥈', '🥉'];
    let prevCount = null;
    let currentMedalIndex = -1;

    for (let i = 0; i < sorted.length; i++) {
        const { name, count, photoURL } = sorted[i];

        if (count !== prevCount) {
            currentMedalIndex++;
            prevCount = count;
        }

        const displayMedalIndex = (currentMedalIndex <= 2) ? currentMedalIndex : -1;

        const row = document.createElement('div');
        row.className = 'ranking-item';

        const left = document.createElement('div');
        left.className = 'ranking-user';

        const medalSpan = document.createElement('span');
        medalSpan.textContent = displayMedalIndex >= 0 ? (medals[displayMedalIndex] + ' ') : '';

        const avatar = document.createElement('img');
        avatar.className = 'avatar avatar-small';
        setImagePreview(avatar, name, photoURL);

        const nameBold = document.createElement('b');
        nameBold.textContent = name;

        left.appendChild(medalSpan);
        left.appendChild(avatar);
        left.appendChild(nameBold);

        const right = document.createElement('span');
        right.className = 'badge';
        right.textContent = count;

        row.appendChild(left);
        row.appendChild(right);
        listDiv.appendChild(row);
    }
}

async function checkAchievements() {
    const user = localStorage.getItem("nombreUsuario");
    if (!user) return;

    // obtener docs del usuario sin orderBy (evita necesidad de índice) y ordenar por fecha asc
    const rawSnap = await getDocs(query(collection(db, "tomas"), where("usuario", "==", user)));
    const docs = rawSnap.docs.slice().sort((a, b) => {
        const ad = a.data().fecha && typeof a.data().fecha.toDate === 'function' ? a.data().fecha.toDate().getTime() : 0;
        const bd = b.data().fecha && typeof b.data().fecha.toDate === 'function' ? b.data().fecha.toDate().getTime() : 0;
        return ad - bd;
    });

    const totalCount = docs.length;

    // construir lista de fechas únicas (YYYY-MM-DD) en orden ascendente y mapa de conteos por día
    const days = [];
    const countsPerDay = {}; // { 'YYYY-MM-DD': n }
    // además: agrupar todas las tomas por día para detectar retos entre usuarios
    const allDocsSnap = await getDocs(collection(db, "tomas")); // todas las tomas para retos que implican varios usuarios
    const allDocs = allDocsSnap.docs.slice().sort((a, b) => {
        const ad = a.data().fecha && typeof a.data().fecha.toDate === 'function' ? a.data().fecha.toDate().getTime() : 0;
        const bd = b.data().fecha && typeof b.data().fecha.toDate === 'function' ? b.data().fecha.toDate().getTime() : 0;
        return ad - bd;
    });
    const allUsers = new Set(allDocs.map(d => d.data().usuario).filter(Boolean));

    for (const d of docs) {
        const data = d.data();
        const dt = data.fecha && typeof data.fecha.toDate === 'function' ? data.fecha.toDate() : (data.fecha instanceof Date ? data.fecha : null);
        if (!dt) continue;
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        const ymd = `${y}-${m}-${day}`;
        if (!days.length || days[days.length - 1] !== ymd) days.push(ymd);
        countsPerDay[ymd] = (countsPerDay[ymd] || 0) + 1;
    }

    // Track unlocked achievements for persistence
    const unlockedAchievements = [];
    const existingAchievements = currentUserProfile?.achievements || [];
    
    // Helper to check and unlock achievement
    const checkAndUnlock = (id, condition) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('unlocked', !!condition);
        }
        if (condition && !existingAchievements.some(a => (typeof a === 'string' ? a : a.id) === id)) {
            unlockedAchievements.push({
                id: id,
                unlockedAt: serverTimestamp()
            });
        }
    };

    // helper para marcar visualmente (legacy support)
    const setUnlocked = (id, cond) => {
        checkAndUnlock(id, cond);
    };

    // Primera vez (ach-1)
    setUnlocked('ach-1', totalCount >= 1);

    // LOGROS POR TOTAL HISTÓRICO (contador acumulado)
    setUnlocked('ach-total-10', totalCount >= 10);
    setUnlocked('ach-total-25', totalCount >= 25);
    setUnlocked('ach-total-50', totalCount >= 50);
    setUnlocked('ach-total-75', totalCount >= 75);
    setUnlocked('ach-total-100', totalCount >= 100);
    setUnlocked('ach-total-250', totalCount >= 250);
    
    // calcular racha máxima de días consecutivos (histórica) y racha actual que termina hoy
    const msDay = 24 * 60 * 60 * 1000;
    let maxStreak = 0;
    let streak = 0;
    let prevDate = null;
    for (const ymd of days) {
        const [y, m, d] = ymd.split('-').map(Number);
        const cur = Date.UTC(y, m - 1, d);
        if (prevDate === null) {
            streak = 1;
        } else {
            const diff = (cur - prevDate) / msDay;
            if (diff === 1) streak++; else streak = 1;
        }
        if (streak > maxStreak) maxStreak = streak;
        prevDate = cur;
    }

    // rachas a desbloquear (conservamos 5,10,15,20 - ach-2/3 eliminados)
    const thresholds = [5, 10, 15, 20];
    thresholds.forEach(t => setUnlocked('ach-' + t, maxStreak >= t));

    // Mes perfecto
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const registeredDaysThisMonth = new Set();
    // contar registros (no solo días) en el mes actual
    let countThisMonth = 0;
    for (const d of docs) {
        const dt = d.data().fecha && typeof d.data().fecha.toDate === 'function' ? d.data().fecha.toDate() : (d.data().fecha instanceof Date ? d.data().fecha : null);
        if (!dt) continue;
        if (dt.getFullYear() === year && dt.getMonth() === month) registeredDaysThisMonth.add(dt.getDate());
        if (dt.getFullYear() === year && dt.getMonth() === month) countThisMonth++;
    }
    setUnlocked('ach-month-perfect', registeredDaysThisMonth.size === daysInMonth);

    // LOGROS POR CANTIDAD EN UN MES (solo contar registros dentro del mes actual)
    setUnlocked('ach-month-5',  countThisMonth >= 5);
    setUnlocked('ach-month-8',  countThisMonth >= 8);
    setUnlocked('ach-month-12', countThisMonth >= 12);
    setUnlocked('ach-month-15', countThisMonth >= 15);
    setUnlocked('ach-month-20', countThisMonth >= 20);
    setUnlocked('ach-month-25', countThisMonth >= 25);
    
    // Rachas (en un día): 2, 3, 5 tomas en un solo día
    const anyAtLeast = (n) => Object.values(countsPerDay).some(c => c >= n);
    setUnlocked('ach-sameday-2', anyAtLeast(2));
    setUnlocked('ach-sameday-3', anyAtLeast(3));
    setUnlocked('ach-sameday-5', anyAtLeast(5));
    setUnlocked('ach-sameday-7', anyAtLeast(7));


    // --- RETOS DIVERTIDOS ---

    // 1) Tomar con un amigo en < 60 min (cualquier día): buscar dos tomas de usuarios distintos con diff <= 60min
    let syncUnder60 = false;
    // agrupar allDocs por día
    const docsByDay = {};
    for (const d of allDocs) {
        const data = d.data();
        const dt = data.fecha && typeof data.fecha.toDate === 'function' ? data.fecha.toDate() : (data.fecha instanceof Date ? data.fecha : null);
        if (!dt) continue;
        const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2,'0'), day = String(dt.getDate()).padStart(2,'0');
        const ymd = `${y}-${m}-${day}`;
        docsByDay[ymd] = docsByDay[ymd] || [];
        docsByDay[ymd].push({ user: data.usuario || '—', time: dt.getTime() });
    }
    const sixtyMs = 60 * 60 * 1000;
    for (const dayKey of Object.keys(docsByDay)) {
        const list = docsByDay[dayKey].slice().sort((a,b) => a.time - b.time);
        for (let i = 0; i < list.length && !syncUnder60; i++) {
            for (let j = i + 1; j < list.length; j++) {
                if (
                        list[i].user !== list[j].user &&
                        Math.abs(list[j].time - list[i].time) <= sixtyMs &&
                        (list[i].user === user || list[j].user === user)
                    ){
                    syncUnder60 = true;
                    break;
                }
                // small optimization: if diff already > 60min break inner loop
                if (list[j].time - list[i].time > sixtyMs) break;
            }
        }
        if (syncUnder60) break;
    }
    setUnlocked('ach-sync-60', syncUnder60);

    // 2) Registrar toma 3 parejas en el mismo día: existe un día con >=3 usuarios distintos
    let threePairsDay = false;
    for (const dayKey of Object.keys(docsByDay)) {
        const usersSet = new Set(docsByDay[dayKey].map(x => x.user));
        if (!usersSet.has(user)) continue;
        if (usersSet.size >= 3 && usersSet.has(user)) { threePairsDay = true; break; }
    }
    setUnlocked('ach-3pairs-day', threePairsDay);

    // 3) Registrar entre 2am y 4am (hora local: 02:00..03:59)
    const anyBetween2and4 = docs.some(d => {
        const data = d.data();
        const dt = data.fecha?.toDate?.();
        if (!dt) return false;
        const h = dt.getHours();
        return h >= 2 && h < 4;
    });
    setUnlocked('ach-night-2-4', anyBetween2and4);

    // 4) Registrar entre 5am y 8am (05:00..07:59)
    const anyBetween5and8 = docs.some(d => {
        const data = d.data();
        const dt = data.fecha?.toDate?.();
        if (!dt) return false;
        const h = dt.getHours();
        return h >= 5 && h < 8;
    });
    setUnlocked('ach-morning-5-8', anyBetween5and8);

    // 5) Reto todos el mismo dia
    let allTogetherDay = false;

    for (const dayKey of Object.keys(docsByDay)) {
        const usersThatDay = new Set(docsByDay[dayKey].map(x => x.user));

        // comprobar si todos los usuarios están presentes ese día
        const everyonePresent = [...allUsers].every(u => usersThatDay.has(u));

        if (everyonePresent && usersThatDay.has(user)) {
            allTogetherDay = true;
            break;
        }
    }
    setUnlocked('ach-all-together', allTogetherDay);

    // Persist new achievements to user profile
    if (currentUser && unlockedAchievements.length > 0) {
        try {
            const allAchievements = [...existingAchievements, ...unlockedAchievements];
            await updateDoc(doc(db, 'users', currentUser.uid), {
                achievements: allAchievements,
                lastActive: serverTimestamp()
            });
            
            // Update local profile
            if (currentUserProfile) {
                currentUserProfile.achievements = allAchievements;
            }
            
            // Show notification for new achievements
            const newAchievementNames = unlockedAchievements.map(a => {
                const achievementNames = {
                    'ach-1': '🎉 Primera vez',
                    'ach-5': '🔥 5 días seguidos',
                    'ach-10': '🔥 10 días seguidos',
                    'ach-15': '🔥 15 días seguidos',
                    'ach-20': '🔥 20 días seguidos',
                    'ach-month-perfect': '🌋 Mes perfecto',
                    'ach-month-5': '🥉 5 en un mes',
                    'ach-month-8': '🥈 8 en un mes',
                    'ach-month-12': '🥇 12 en un mes',
                    'ach-month-15': '💎 15 en un mes',
                    'ach-month-20': '🚀 20 en un mes',
                    'ach-month-25': '👑 25 en un mes',
                    'ach-sameday-2': '⚡ 2 en un día',
                    'ach-sameday-3': '⚡ 3 en un día',
                    'ach-sameday-5': '⚡ 5 en un día',
                    'ach-sameday-7': '⚡⚡ 7 en un día',
                    'ach-total-10': '🎯 10 históricos',
                    'ach-total-25': '🎯 25 históricos',
                    'ach-total-50': '🎯 50 históricos',
                    'ach-total-75': '🎯 75 históricos',
                    'ach-total-100': '💯 100 históricos',
                    'ach-total-250': '🏆 250 históricos',
                    'ach-night-2-4': '🌙 Ñiqui ñiqui nocturno',
                    'ach-morning-5-8': '☀️ Ñiqui ñiqui matutino',
                    'ach-sync-60': '⏱️ Sincronizado',
                    'ach-3pairs-day': '👥 3 parejas en un día',
                    'ach-all-together': '👥 Todas las parejas'
                };
                return achievementNames[a.id] || a.id;
            });
            
            if (newAchievementNames.length > 0) {
                console.log('🏆 Nuevos logros desbloqueados:', newAchievementNames.join(', '));
            }
        } catch (error) {
            console.error('Error persisting achievements:', error);
        }
    }

    // opcional: devolver datos para UI/debug
    return { totalCount, maxStreak, countsPerDay, registeredDaysThisMonthSize: registeredDaysThisMonth.size, syncUnder60, threePairsDay, anyBetween2and4, anyBetween5and8 };
}

// --- 6. GRÁFICA (STATS) ---
async function renderChart(range = window.chartRange) {
    const ctx = document.getElementById('myChart');
    if (!ctx) return;
    if (chart) chart.destroy();

    const snap = await getDocs(collection(db, "tomas"));
    const miNombre = localStorage.getItem("nombreUsuario");
    const verTodos = document.getElementById('toggleOthersBtn')?.classList.contains('active');

    // Preparar buckets según rango
    const today = new Date();
    let labels = [];
    let bucketCount = 0;

    if (range === 'week') {
        // Semana actual: Lunes..Domingo
        const day = today.getDay(); // 0 (Dom) .. 6 (Sáb)
        const diffToMonday = (day + 6) % 7; // 0 si hoy es lunes
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
        for (let i = 0; i < 7; i++) {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            // weekday short en español (lun, mar, mié, ...)
            const wd = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
            labels.push(wd.charAt(0).toUpperCase() + wd.slice(1)); // Lun, Mar, ...
        }
        bucketCount = 7;
    } else if (range === 'year') {
        labels = Array.from({ length: 12 }, (_, i) =>
            new Date(today.getFullYear(), i, 1).toLocaleDateString('es-ES', { month: 'short' })
        );
        bucketCount = 12;
    } else {
        // month
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        labels = Array.from({ length: daysInMonth }, (_, k) => (k + 1).toString());
        bucketCount = daysInMonth;
    }

    const userMap = {};
    const msDay = 24 * 60 * 60 * 1000;

    snap.forEach(doc => {
        const d = doc.data() || {};
        const date = d.fecha && typeof d.fecha.toDate === 'function' ? d.fecha.toDate() : (d.fecha instanceof Date ? d.fecha : null);
        if (!date) return;

        let idx = -1;
        if (range === 'week') {
            // calcular diferencia en días desde el lunes de la semana actual
            const day = today.getDay();
            const diffToMonday = (day + 6) % 7;
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
            idx = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / msDay);
        } else if (range === 'year') {
            idx = date.getMonth();
        } else {
            // month: sólo contar si es el mes actual
            if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()) {
                idx = date.getDate() - 1;
            } else {
                return;
            }
        }

        if (idx < 0 || idx >= bucketCount) return;
        if (!userMap[d.usuario]) userMap[d.usuario] = new Array(bucketCount).fill(0);
        userMap[d.usuario][idx]++;
    });

    // colores con mejor contraste (evita tonos muy claros como amarillo pálido)
    const colors = ['#ff3cac', '#784ba0', '#2b86c5', '#0b8f5b', '#ff6b6b', '#6a5acd', '#ff8c00'];
    const datasets = [];
    let colorIdx = 0;
    for (const [name, data] of Object.entries(userMap)) {
        if (!verTodos && name !== miNombre) continue;
        const color = colors[colorIdx % colors.length];
        datasets.push({
            label: name,
            data,
            borderColor: color,
            backgroundColor: color + '33', // ligera transparencia si se usa fill
            pointBackgroundColor: color,
            pointBorderColor: color,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 1.5
        });
        colorIdx++;
    }

    // ajustar ticks según ancho
    const parentWidth = ctx.parentElement ? ctx.parentElement.clientWidth : window.innerWidth;
    const approxLabelWidth = 28;
    const maxTicks = Math.max(3, Math.floor(parentWidth / approxLabelWidth));
   
    // ajustar tamaño de la leyenda según ancho (evita que los nombres se salgan)
    const legendFontSize = parentWidth <= 420 ? 9 : 11;
    const legendBoxWidth = parentWidth <= 420 ? 8 : 12;

    chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: {
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: Math.min(labels.length, maxTicks),
                        maxRotation: 0,
                        minRotation: 0,
                        font: { size: 10 }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const i = items[0]?.dataIndex ?? 0;
                            // mostrar fecha completa en tooltip para semana/mes
                            if (range === 'week') {
                                // calcular fecha real para el índice
                                const day = today.getDay();
                                const diffToMonday = (day + 6) % 7;
                                const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
                                const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
                                return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' });
                            }
                            if (range === 'month') {
                                return 'Día ' + labels[i];
                            }
                            return labels[i];
                        }
                    }
                },

                // leyenda responsive para móviles
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: legendBoxWidth, font: { size: legendFontSize }, padding: 6 },
                    align: 'center'
                }
            },
            layout: { padding: { left: 4, right: 4 } }
        }
    });
}
 
 window.toggleGroupView = () => {
     const btn = document.getElementById('toggleOthersBtn');
     btn?.classList.toggle('active');
     renderChart();
 };
 
 // cambiar rango y actualizar botones UI
 window.setChartRange = (r) => {
     window.chartRange = r;
     ['rangeWeekBtn','rangeMonthBtn','rangeYearBtn'].forEach(id => {
         const b = document.getElementById(id);
         if (!b) return;
         if (b.id === 'range' + r.charAt(0).toUpperCase() + r.slice(1) + 'Btn' || (r === 'month' && b.id === 'rangeMonthBtn')) {
             b.classList.add('active');
             b.setAttribute('aria-pressed','true');
         } else {
             b.classList.remove('active');
             b.setAttribute('aria-pressed','false');
         }
     });
     renderChart();
 };

 window.celebrarToma = () => {
    const duration = 3 * 1000; // 3 segundos de confeti
    const end = Date.now() + duration;
    const audio = new Audio('success2.mp3');
    audio.volume = 0.5;
    audio.play();

    // Colores de tu marca (extraídos de tu CSS)
    const colors = ['#ff3cac', '#784ba0', '#2b86c5'];

    (function frame() {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
};

window.actualizarRacha = async () => {
    const rachaElement = document.getElementById('racha-texto');
    if (!rachaElement) return;

    const user = localStorage.getItem("nombreUsuario");
    if (!user) return;

    const snap = await getDocs(query(collection(db, "tomas"), where("usuario", "==", user)));
    const fechasConToma = new Set();
    
    snap.forEach(doc => {
        const d = doc.data().fecha?.toDate();
        if (d) {
            // Formato YYYY-MM-DD para evitar fallos de horas
            const idDia = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            fechasConToma.add(idDia);
        }
    });

    if (fechasConToma.size === 0) {
        rachaElement.innerHTML = `<span class="racha-neutral">¡Bienvenido al templo del placer!<br> ✨ Comienza hoy mismo ✨</span>`;
        return;
    }

    // Configurar HOY a medianoche
    let hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const obtenerID = (f) => `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;

    // 1. CALCULAR RACHA (Días seguidos desde hoy o ayer hacia atrás)
    let rachaCount = 0;
    let tempRacha = new Date(hoy);

    // Si no hubo hoy, probamos desde ayer
    if (!fechasConToma.has(obtenerID(tempRacha))) {
        tempRacha.setDate(tempRacha.getDate() - 1);
    }

    // Contar hacia atrás mientras haya registros
    console.log('Iniciando conteo de racha...');
    console.log('fechasConToma', fechasConToma);
    while (fechasConToma.has(obtenerID(tempRacha))) {
        rachaCount++;
        tempRacha.setDate(tempRacha.getDate() - 1);
    }
    console.log('Racha actual:', rachaCount);

    // 2. CALCULAR SEQUÍA (Días desde hoy hacia atrás hasta encontrar algo)
    let sequiaCount = 0;
    let tempSequia = new Date(hoy);
    while (!fechasConToma.has(obtenerID(tempSequia)) && sequiaCount < 365) {
        sequiaCount++;
        tempSequia.setDate(tempSequia.getDate() - 1);
    }

    // --- LÓGICA DE VISUALIZACIÓN ---

    // REGLA 1: Solo mostrar racha si son 2 o más días
    if (rachaCount >= 2) {
        rachaElement.innerHTML = `<span class="emoji-fuego">🔥</span> <span class="texto-fuego">¡Racha de ${rachaCount} días seguidos!</span><span class="emoji-fuego">🔥</span>`;
    } 
    // REGLA 2: Solo mostrar sequía si son 3 o más días
    else if (sequiaCount >= 3 && sequiaCount != 365) {
        rachaElement.innerHTML = `
        <span class="emoji-fuego">🧊</span>
        <span class="texto-hielo">Van ${sequiaCount} días de sequía...</span>
        <span class="emoji-fuego">🧊</span>
        <span class="texto-hielo" style="width:100%; text-align:center;">¡Ponte las pilas!</span>
        `;
    }
    // REGLA 3: Caso neutro (1 o 2 días sin nada, o racha de solo 1 día)
    else {
        rachaElement.innerHTML = `<span class="racha-neutral">¡Buen ritmo! Seguid así ✨</span>`;
    }
};


window.borrarToma = async (id) => {
    if (confirm("¿Quieres borrar este registro?")) {
        try {
            // 1. Elimina el documento de Firestore
            await deleteDoc(doc(db, "tomas", id));
            
            // 2. Update user statistics if authenticated
            if (currentUser?.uid) {
                await updateUserStatistics(currentUser.uid);
                currentUserProfile = await getUserProfile(currentUser.uid);
            }
            
            // 3. Recuperar el usuario para refrescar su vista
            const u = localStorage.getItem('nombreUsuario');
            if (u) {
                generateCalendar(u);
                renderRanking(); // <--- Importante: para que baje su contador en la lista
                renderChart();   // <--- Importante: para que la gráfica baje
                checkAchievements(); // <--- Añade esto aquí para recalcular logros después de borrar
                if (window.actualizarRacha) window.actualizarRacha();
            }

            // 4. Cerrar el modal si estaba abierto (opcional pero recomendado)
            const modal = document.getElementById("dayDetailsModal");
            if (modal) modal.style.display = 'none';

        } catch (e) {
            console.error("Error al borrar:", e);
            alert("No se pudo borrar el registro.");
        }
    } // <--- Aquí faltaba cerrar la función correctamente
};
 
// ============================================
// IMAGE CROPPER FUNCTIONALITY
// ============================================

let cropper = null;
let currentCropFile = null;

/**
 * Show image cropper modal
 * @param {File} file - Image file to crop
 */
function showImageCropper(file) {
    const modal = document.getElementById('cropperModal');
    const image = document.getElementById('cropperImage');
    
    if (!modal || !image) {
        console.error('Cropper modal elements not found');
        return;
    }
    
    currentCropFile = file;
    
    // Read file and display in cropper
    const reader = new FileReader();
    reader.onload = (e) => {
        image.src = e.target.result;
        modal.style.display = 'flex';
        
        // Initialize Cropper.js
        if (cropper) {
            cropper.destroy();
        }
        
        cropper = new Cropper(image, {
            aspectRatio: 1, // Square crop for circular display
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.65,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            minCropBoxWidth: 100,
            minCropBoxHeight: 100,
            // Make it visually circular
            ready: function() {
                const cropBox = document.querySelector('.cropper-crop-box');
                if (cropBox) {
                    cropBox.style.borderRadius = '50%';
                }
                const face = document.querySelector('.cropper-face');
                if (face) {
                    face.style.borderRadius = '50%';
                }
                const viewBox = document.querySelector('.cropper-view-box');
                if (viewBox) {
                    viewBox.style.borderRadius = '50%';
                }
            }
        });
    };
    reader.readAsDataURL(file);
}

/**
 * Get cropped image as base64
 * @returns {Promise<string|null>} Base64 encoded image
 */
async function getCroppedImage() {
    if (!cropper) return null;
    
    try {
        // Get cropped canvas
        const canvas = cropper.getCroppedCanvas({
            width: 800,
            height: 800,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        
        // Convert to base64 with compression
        let quality = 0.9;
        let base64 = canvas.toDataURL('image/jpeg', quality);
        
        // Compress to target size (~100KB)
        const targetSize = 100 * 1024; // 100KB
        while (base64.length > targetSize && quality > 0.1) {
            quality -= 0.1;
            base64 = canvas.toDataURL('image/jpeg', quality);
        }
        
        return base64;
    } catch (error) {
        console.error('Error getting cropped image:', error);
        return null;
    }
}

/**
 * Close and cleanup cropper modal
 */
function closeCropperModal() {
    const modal = document.getElementById('cropperModal');
    if (modal) {
        modal.style.display = 'none';
    }
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    currentCropFile = null;
}

/**
 * Setup cropper control event listeners
 */
function setupCropperControls() {
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const rotateLeftBtn = document.getElementById('rotateLeft');
    const resetCropBtn = document.getElementById('resetCrop');
    const cancelCropBtn = document.getElementById('cancelCrop');
    const acceptCropBtn = document.getElementById('acceptCrop');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (cropper) cropper.zoom(0.1);
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (cropper) cropper.zoom(-0.1);
        });
    }
    
    if (rotateLeftBtn) {
        rotateLeftBtn.addEventListener('click', () => {
            if (cropper) cropper.rotate(-90);
        });
    }
    
    if (resetCropBtn) {
        resetCropBtn.addEventListener('click', () => {
            if (cropper) cropper.reset();
        });
    }
    
    if (cancelCropBtn) {
        cancelCropBtn.addEventListener('click', () => {
            closeCropperModal();
        });
    }
    
    if (acceptCropBtn) {
        acceptCropBtn.addEventListener('click', async () => {
            if (!currentUser) {
                setProfileStatus('No hay usuario autenticado.', true);
                closeCropperModal();
                return;
            }
            
            try {
                setProfileLoading(true, 'Procesando imagen...');
                const base64Image = await getCroppedImage();
                
                if (!base64Image) {
                    throw new Error('No se pudo procesar la imagen.');
                }
                
                // Upload the cropped image
                await uploadProfilePicture(currentUser.uid, null, base64Image);
                currentUserProfile = await getUserProfile(currentUser.uid);
                updateHeaderProfileUI();
                renderProfileSettings();
                setProfileStatus('Foto de perfil actualizada.');
                
                closeCropperModal();
            } catch (error) {
                console.error('Error uploading cropped image:', error);
                setProfileStatus(error.message || 'No se pudo subir la imagen.', true);
            } finally {
                setProfileLoading(false);
            }
        });
    }
}

// ============================================
// PROFILE UI SETUP
// ============================================

function setupProfileUI() {
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const uploadProfileInput = document.getElementById('profilePictureInput');
    const deleteProfileBtn = document.getElementById('deleteProfilePictureBtn');

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            if (!currentUser || !currentUserProfile) return;

            const displayNameInput = document.getElementById('profileDisplayName');
            const notificationsInput = document.getElementById('profileNotifications');
            const publicInput = document.getElementById('profilePublic');

            const nextDisplayName = displayNameInput?.value.trim();
            if (!nextDisplayName) {
                setProfileStatus('El nombre no puede estar vacío.', true);
                return;
            }

            try {
                setProfileLoading(true, 'Guardando perfil...');
                await updateProfile(currentUser, { displayName: nextDisplayName });
                await updateUserProfile(currentUser.uid, {
                    displayName: nextDisplayName,
                    settings: {
                        ...(currentUserProfile.settings || {}),
                        notifications: notificationsInput?.checked ?? true,
                        publicProfile: publicInput?.checked ?? true,
                        theme: currentUserProfile.settings?.theme || 'default'
                    }
                });

                currentUserProfile = await getUserProfile(currentUser.uid);
                localStorage.setItem('nombreUsuario', currentUserProfile.displayName || nextDisplayName);
                updateHeaderProfileUI();
                renderProfileSettings();
                setProfileStatus('Perfil guardado correctamente.');
                
                // Redirect to main page after successful save
                setTimeout(() => {
                    showSection('main');
                }, 1000);
                
            } catch (error) {
                console.error('Error saving profile:', error);
                setProfileStatus('No se pudo guardar el perfil.', true);
            } finally {
                setProfileLoading(false);
            }
        });
    }

    if (uploadProfileInput) {
        uploadProfileInput.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file || !currentUser) return;

            try {
                setProfileStatus('');
                
                // Validate file before showing cropper
                const validation = validateProfileImage(file);
                if (!validation.valid) {
                    throw new Error(validation.error);
                }
                
                // Show cropper modal instead of direct upload
                showImageCropper(file);
                
            } catch (error) {
                console.error('Error with profile picture:', error);
                setProfileStatus(error.message || 'No se pudo procesar la imagen.', true);
            } finally {
                event.target.value = '';
            }
        });
    }

    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', async () => {
            if (!currentUser) return;

            try {
                setProfileLoading(true, 'Eliminando foto...');
                // Delete from Firestore only (no Auth profile update needed)
                await deleteProfilePicture(currentUser.uid);
                currentUserProfile = await getUserProfile(currentUser.uid);
                updateHeaderProfileUI();
                renderProfileSettings();
                setProfileStatus('Foto eliminada correctamente.');
            } catch (error) {
                console.error('Error deleting profile picture:', error);
                setProfileStatus('No se pudo eliminar la foto.', true);
            } finally {
                setProfileLoading(false);
            }
        });
    }
}

window.cerrarSesion = async () => {
    try {
        if (currentUser) {
            await logoutUser();
        }
        currentUserProfile = null;
        localStorage.clear();
        location.reload();
    } catch (error) {
        console.error('Error during logout:', error);
        currentUserProfile = null;
        localStorage.clear();
        location.reload();
    }
};

// --- ACTIVITY HISTORY & STATISTICS ---

/**
 * Calculate comprehensive user statistics
 * @param {string} userId - Firebase Auth UID
 * @returns {Object} Statistics object
 */
async function calculateUserStatistics(userId) {
    try {
        console.log('Calculating statistics for user:', userId);
        
        // Query all user's activities
        const q = query(
            collection(db, "tomas"),
            where("userId", "==", userId),
            orderBy("fecha", "asc")
        );
        
        const snapshot = await getDocs(q);
        const activities = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.fecha) {
                activities.push({
                    id: doc.id,
                    date: data.fecha.toDate(),
                    ...data
                });
            }
        });
        
        if (activities.length === 0) {
            return {
                totalCount: 0,
                currentStreak: 0,
                longestStreak: 0,
                lastActivity: null,
                firstActivity: null,
                activitiesByMonth: {},
                activitiesByDayOfWeek: [0, 0, 0, 0, 0, 0, 0],
                activitiesByHour: Array(24).fill(0),
                favoriteTime: null,
                mostActiveMonth: null,
                mostActiveDay: null,
                daysActive: 0
            };
        }
        
        // Basic counts
        const totalCount = activities.length;
        const firstActivity = activities[0].date;
        const lastActivity = activities[activities.length - 1].date;
        
        // Group by date (YYYY-MM-DD)
        const dateMap = new Map();
        const monthMap = new Map();
        const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        const hourCounts = Array(24).fill(0);
        
        activities.forEach(activity => {
            const date = activity.date;
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // Count by date
            dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
            
            // Count by month
            monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
            
            // Count by day of week (0 = Sunday, 6 = Saturday)
            dayOfWeekCounts[date.getDay()]++;
            
            // Count by hour
            hourCounts[date.getHours()]++;
        });
        
        const daysActive = dateMap.size;
        
        // Calculate current streak
        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(today);
        
        // Check if there's activity today or yesterday
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (!dateMap.has(todayKey)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }
        
        // Count consecutive days backwards
        while (true) {
            const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            if (dateMap.has(key)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        // Calculate longest streak
        let longestStreak = 0;
        let tempStreak = 0;
        const sortedDates = Array.from(dateMap.keys()).sort();
        
        for (let i = 0; i < sortedDates.length; i++) {
            if (i === 0) {
                tempStreak = 1;
            } else {
                const prevDate = new Date(sortedDates[i - 1]);
                const currDate = new Date(sortedDates[i]);
                const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        
        // Get last 12 months of activity
        const activitiesByMonth = {};
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            activitiesByMonth[key] = monthMap.get(key) || 0;
        }
        
        // Find favorite time (most common hour)
        const maxHourCount = Math.max(...hourCounts);
        const favoriteTime = maxHourCount > 0 ? hourCounts.indexOf(maxHourCount) : null;
        
        // Find most active month
        let mostActiveMonth = null;
        let maxMonthCount = 0;
        monthMap.forEach((count, month) => {
            if (count > maxMonthCount) {
                maxMonthCount = count;
                mostActiveMonth = month;
            }
        });
        
        // Find most active day of week
        const maxDayCount = Math.max(...dayOfWeekCounts);
        const mostActiveDay = dayOfWeekCounts.indexOf(maxDayCount);
        
        return {
            totalCount,
            currentStreak,
            longestStreak,
            lastActivity,
            firstActivity,
            activitiesByMonth,
            activitiesByDayOfWeek: dayOfWeekCounts,
            activitiesByHour: hourCounts,
            favoriteTime,
            mostActiveMonth,
            mostActiveDay,
            daysActive
        };
    } catch (error) {
        console.error('Error calculating statistics:', error);
        throw error;
    }
}

/**
 * Update cached statistics in user profile
 * @param {string} userId - Firebase Auth UID
 */
async function updateUserStatistics(userId) {
    try {
        const stats = await calculateUserStatistics(userId);
        
        await updateDoc(doc(db, 'users', userId), {
            stats: {
                totalCount: stats.totalCount,
                currentStreak: stats.currentStreak,
                longestStreak: stats.longestStreak,
                lastActivity: stats.lastActivity ? Timestamp.fromDate(stats.lastActivity) : null,
                firstActivity: stats.firstActivity ? Timestamp.fromDate(stats.firstActivity) : null,
                daysActive: stats.daysActive,
                favoriteTime: stats.favoriteTime,
                mostActiveMonth: stats.mostActiveMonth,
                mostActiveDay: stats.mostActiveDay
            },
            lastActive: serverTimestamp()
        });
        
        console.log('Statistics updated successfully');
        return stats;
    } catch (error) {
        console.error('Error updating statistics:', error);
        throw error;
    }
}

/**
 * Get user's recent activities
 * @param {string} userId - Firebase Auth UID
 * @param {number} limit - Number of activities to fetch
 * @returns {Array} Array of activities
 */
async function getUserRecentActivities(userId, limitCount = 30) {
    try {
        const q = query(
            collection(db, "tomas"),
            where("userId", "==", userId),
            orderBy("fecha", "desc"),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        const activities = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            activities.push({
                id: doc.id,
                date: data.fecha?.toDate() || null,
                userName: data.usuario || '',
                ...data
            });
        });
        
        return activities;
    } catch (error) {
        console.error('Error fetching recent activities:', error);
        throw error;
    }
}

/**
 * Export user data as JSON
 */
async function exportUserData() {
    if (!currentUser || !currentUserProfile) {
        alert('No hay datos de usuario para exportar.');
        return;
    }
    
    try {
        // Get all user activities
        const activities = await getUserRecentActivities(currentUser.uid, 1000);
        
        // Get statistics
        const stats = await calculateUserStatistics(currentUser.uid);
        
        // Get achievements from profile
        const achievements = currentUserProfile.achievements || [];
        
        // Build export data
        const exportData = {
            profile: {
                displayName: currentUserProfile.displayName,
                email: currentUserProfile.email,
                createdAt: currentUserProfile.createdAt?.toDate?.()?.toISOString() || null,
                photoURL: currentUserProfile.photoURL
            },
            statistics: {
                totalActivities: stats.totalCount,
                currentStreak: stats.currentStreak,
                longestStreak: stats.longestStreak,
                daysActive: stats.daysActive,
                firstActivity: stats.firstActivity?.toISOString() || null,
                lastActivity: stats.lastActivity?.toISOString() || null,
                favoriteTime: stats.favoriteTime,
                mostActiveMonth: stats.mostActiveMonth,
                mostActiveDay: stats.mostActiveDay
            },
            activities: activities.map(a => ({
                date: a.date?.toISOString() || null,
                userName: a.userName
            })),
            achievements: achievements,
            exportDate: new Date().toISOString()
        };
        
        // Create and download JSON file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `candelita-data-${currentUserProfile.displayName}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('Datos exportados correctamente.');
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error al exportar los datos.');
    }
}

window.exportUserData = exportUserData;
// --- ACTIVITY HISTORY CHARTS & RENDERING ---

let hourChartInstance = null;
let dayChartInstance = null;
let monthChartInstance = null;

/**
 * Render activity by hour chart
 */
function renderActivityByHourChart(hourData) {
    const ctx = document.getElementById('hourChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (hourChartInstance) {
        hourChartInstance.destroy();
    }
    
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    
    hourChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Actividades',
                data: hourData,
                backgroundColor: 'rgba(255, 60, 172, 0.6)',
                borderColor: 'rgba(255, 60, 172, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Render activity by day of week chart
 */
function renderActivityByDayChart(dayData) {
    const ctx = document.getElementById('dayChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (dayChartInstance) {
        dayChartInstance.destroy();
    }
    
    const labels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    dayChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Actividades',
                data: dayData,
                backgroundColor: 'rgba(120, 75, 160, 0.6)',
                borderColor: 'rgba(120, 75, 160, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 11 }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Render monthly trend chart
 */
function renderMonthlyTrendChart(monthData) {
    const ctx = document.getElementById('monthChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (monthChartInstance) {
        monthChartInstance.destroy();
    }
    
    const labels = Object.keys(monthData).map(key => {
        const [year, month] = key.split('-');
        const date = new Date(year, parseInt(month) - 1);
        return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    });
    
    const data = Object.values(monthData);
    
    monthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Actividades',
                data: data,
                backgroundColor: 'rgba(43, 134, 197, 0.2)',
                borderColor: 'rgba(43, 134, 197, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: 'rgba(43, 134, 197, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Render activity history page
 */
async function renderActivityHistory() {
    if (!currentUser) {
        console.log('No user logged in');
        return;
    }
    
    try {
        console.log('Rendering activity history...');
        
        // Calculate statistics
        const stats = await calculateUserStatistics(currentUser.uid);
        
        // Update overview cards
        document.getElementById('statTotalCount').textContent = stats.totalCount;
        document.getElementById('statCurrentStreak').textContent = stats.currentStreak;
        document.getElementById('statLongestStreak').textContent = stats.longestStreak;
        document.getElementById('statDaysActive').textContent = stats.daysActive;
        
        // Update favorite time
        const favoriteTimeEl = document.querySelector('.favorite-time-value');
        if (favoriteTimeEl) {
            if (stats.favoriteTime !== null) {
                favoriteTimeEl.textContent = `${stats.favoriteTime}:00 - ${stats.favoriteTime + 1}:00`;
            } else {
                favoriteTimeEl.textContent = 'Sin datos';
            }
        }
        
        // Render charts
        setTimeout(() => {
            renderActivityByHourChart(stats.activitiesByHour);
            renderActivityByDayChart(stats.activitiesByDayOfWeek);
            renderMonthlyTrendChart(stats.activitiesByMonth);
        }, 100);
        
        // Render unlocked achievements
        renderUnlockedAchievements();
        
        // Render recent activities
        await renderRecentActivities();
        
    } catch (error) {
        console.error('Error rendering activity history:', error);
    }
}

/**
 * Render unlocked achievements
 */
function renderUnlockedAchievements() {
    const container = document.getElementById('unlockedAchievements');
    if (!container) return;
    
    const achievements = currentUserProfile?.achievements || [];
    
    if (achievements.length === 0) {
        container.innerHTML = '<p class="empty-state">Aún no has desbloqueado ningún logro. ¡Sigue así!</p>';
        return;
    }
    
    container.innerHTML = '';
    
    // Achievement names mapping
    const achievementNames = {
        'first_time': '🎉 Primera vez',
        'ach-1': '🎉 Primera vez',
        'ach-5': '🔥 5 días seguidos',
        'ach-10': '🔥 10 días seguidos',
        'ach-15': '🔥 15 días seguidos',
        'ach-20': '🔥 20 días seguidos',
        'ach-month-perfect': '🌋 Mes perfecto',
        'ach-month-5': '🥉 5 en un mes',
        'ach-month-8': '🥈 8 en un mes',
        'ach-month-12': '🥇 12 en un mes',
        'ach-month-15': '💎 15 en un mes',
        'ach-month-20': '🚀 20 en un mes',
        'ach-month-25': '👑 25 en un mes',
        'ach-sameday-2': '⚡ 2 en un día',
        'ach-sameday-3': '⚡ 3 en un día',
        'ach-sameday-5': '⚡ 5 en un día',
        'ach-sameday-7': '⚡⚡ 7 en un día',
        'ach-total-10': '🎯 10 históricos',
        'ach-total-25': '🎯 25 históricos',
        'ach-total-50': '🎯 50 históricos',
        'ach-total-75': '🎯 75 históricos',
        'ach-total-100': '💯 100 históricos',
        'ach-total-250': '🏆 250 históricos',
        'ach-night-2-4': '🌙 Ñiqui ñiqui nocturno',
        'ach-morning-5-8': '☀️ Ñiqui ñiqui matutino',
        'ach-sync-60': '⏱️ Sincronizado',
        'ach-3pairs-day': '👥 3 parejas en un día',
        'ach-all-together': '👥 Todas las parejas'
    };
    
    achievements.forEach(ach => {
        const achId = typeof ach === 'string' ? ach : ach.id;
        const achDate = ach.unlockedAt ? new Date(ach.unlockedAt.seconds * 1000) : null;
        
        const div = document.createElement('div');
        div.className = 'achievement-item';
        div.innerHTML = `
            <div>${achievementNames[achId] || achId}</div>
            ${achDate ? `<div class="achievement-date">${achDate.toLocaleDateString('es-ES')}</div>` : ''}
        `;
        container.appendChild(div);
    });
}

/**
 * Render recent activities list
 */
async function renderRecentActivities() {
    const container = document.getElementById('recentActivityList');
    if (!container || !currentUser) return;
    
    try {
        const activities = await getUserRecentActivities(currentUser.uid, 30);
        
        if (activities.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay actividades recientes.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        activities.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            
            const date = activity.date;
            const dateStr = date ? date.toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            }) : '—';
            const timeStr = date ? date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : '—';
            
            // Calculate days ago
            const now = new Date();
            const diffTime = date ? Math.abs(now - date) : 0;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            let agoStr = '';
            if (diffDays === 0) agoStr = 'Hoy';
            else if (diffDays === 1) agoStr = 'Ayer';
            else agoStr = `Hace ${diffDays} días`;
            
            div.innerHTML = `
                <div class="activity-date">
                    <div class="activity-date-main">${dateStr} ${timeStr}</div>
                    <div class="activity-date-ago">${agoStr}</div>
                </div>
                <button class="activity-delete-btn" onclick="deleteActivityFromHistory('${activity.id}')">
                    🗑️
                </button>
            `;
            
            container.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error rendering recent activities:', error);
        container.innerHTML = '<p class="empty-state">Error al cargar actividades.</p>';
    }
}

/**
 * Delete activity from history
 */
async function deleteActivityFromHistory(activityId) {
    if (!confirm('¿Quieres borrar esta actividad?')) return;
    
    try {
        await deleteDoc(doc(db, 'tomas', activityId));
        
        // Update statistics
        if (currentUser) {
            await updateUserStatistics(currentUser.uid);
            currentUserProfile = await getUserProfile(currentUser.uid);
        }
        
        // Refresh history view
        await renderActivityHistory();
        
        // Refresh other views
        const displayName = getDisplayNameForCurrentContext();
        if (displayName) {
            generateCalendar(displayName);
            renderRanking();
            renderChart();
            if (window.actualizarRacha) window.actualizarRacha();
        }
        
        alert('Actividad eliminada correctamente.');
    } catch (error) {
        console.error('Error deleting activity:', error);
        alert('Error al eliminar la actividad.');
    }
}

window.deleteActivityFromHistory = deleteActivityFromHistory;

// Duplicate function removed - updateUserStatsAfterToma is already defined at line 352
