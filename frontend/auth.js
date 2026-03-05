/* global AmazonCognitoIdentity, CONFIG */

const authStatusEl = document.getElementById('authStatus');
const loginForm = document.getElementById('loginForm');
const loginEmailEl = document.getElementById('loginEmail');
const loginPasswordEl = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Sign-up elements
const signupForm = document.getElementById('signupForm');
const signupEmailEl = document.getElementById('signupEmail');
const signupPasswordEl = document.getElementById('signupPassword');
const signupConfirmPasswordEl = document.getElementById('signupConfirmPassword');
const signupBtn = document.getElementById('signupBtn');
const signupConfirmSection = document.getElementById('signupConfirmSection');
const signupCodeEl = document.getElementById('signupCode');
const signupConfirmBtn = document.getElementById('signupConfirmBtn');

// New password elements
const newPasswordSection = document.getElementById('newPasswordSection');
const newPasswordEl = document.getElementById('newPassword');
const newPasswordConfirmEl = document.getElementById('newPasswordConfirm');
const newPasswordBtn = document.getElementById('newPasswordBtn');

// Tab toggle
const showSignupLink = document.getElementById('showSignup');
const showLoginLink = document.getElementById('showLogin');
const loginSection = document.getElementById('loginSection');
const signupSection = document.getElementById('signupSection');

const TOKEN_KEY = 'attendance_id_token';
let _pendingCognitoUser = null; // holds user during newPasswordRequired flow

function getIdToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setIdToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  updateAuthUI();
}

function updateAuthUI() {
  const token = getIdToken();
  if (token) {
    authStatusEl.textContent = 'Logged in';
    authStatusEl.classList.add('logged-in');
    logoutBtn.classList.remove('hidden');
    loginSection.classList.add('hidden');
    signupSection.classList.add('hidden');
    newPasswordSection.classList.add('hidden');
  } else {
    authStatusEl.textContent = 'Not logged in';
    authStatusEl.classList.remove('logged-in');
    logoutBtn.classList.add('hidden');
    loginSection.classList.remove('hidden');
  }
}

function _getUserPool() {
  return new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId: CONFIG.COGNITO_USER_POOL_ID,
    ClientId: CONFIG.COGNITO_USER_POOL_CLIENT_ID,
  });
}

function requireCognitoConfig() {
  if (!CONFIG.COGNITO_USER_POOL_ID || !CONFIG.COGNITO_USER_POOL_CLIENT_ID) {
    throw new Error('Cognito not configured. Set COGNITO_USER_POOL_ID and COGNITO_USER_POOL_CLIENT_ID in config.env.js');
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(email, password) {
  requireCognitoConfig();

  const userPool = _getUserPool();
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });
  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (result) => {
        const idToken = result.getIdToken().getJwtToken();
        setIdToken(idToken);
        resolve({ idToken });
      },
      onFailure: (err) => reject(err),
      newPasswordRequired: (userAttributes) => {
        // Store the cognitoUser so we can complete the challenge
        _pendingCognitoUser = cognitoUser;
        // Show the new-password form
        loginSection.classList.add('hidden');
        signupSection.classList.add('hidden');
        newPasswordSection.classList.remove('hidden');
        authStatusEl.textContent = 'Set a new password to continue';
        resolve({ newPasswordRequired: true });
      },
    });
  });
}

function completeNewPassword(newPassword) {
  return new Promise((resolve, reject) => {
    if (!_pendingCognitoUser) {
      return reject(new Error('No pending password challenge'));
    }
    _pendingCognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (result) => {
        _pendingCognitoUser = null;
        const idToken = result.getIdToken().getJwtToken();
        setIdToken(idToken);
        newPasswordSection.classList.add('hidden');
        resolve({ idToken });
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

// ─── Sign Up ─────────────────────────────────────────────────────────────────

async function signUp(email, password) {
  requireCognitoConfig();

  const userPool = _getUserPool();
  const emailAttr = new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email });

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, [emailAttr], null, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function confirmSignUp(email, code) {
  requireCognitoConfig();

  const userPool = _getUserPool();
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

  return new Promise((resolve, reject) => {
    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// ─── Logout ──────────────────────────────────────────────────────────────────

function logout() {
  setIdToken('');
}

function authHeaders(extra = {}) {
  const token = getIdToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// expose to app.js
window.AttendanceAuth = { getIdToken, setIdToken, login, logout, authHeaders };

// ─── Event Listeners ─────────────────────────────────────────────────────────

// Toggle Login ↔ Sign Up
showSignupLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginSection.classList.add('hidden');
  signupSection.classList.remove('hidden');
  signupConfirmSection.classList.add('hidden');
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  signupSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
});

// Login form
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  try {
    const result = await login(loginEmailEl.value.trim(), loginPasswordEl.value);
    if (result.newPasswordRequired) {
      // UI is already showing the new-password form
    }
  } catch (err) {
    alert(err?.message || 'Login failed');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

// New password form
newPasswordBtn.addEventListener('click', async () => {
  const pw = newPasswordEl.value;
  const pw2 = newPasswordConfirmEl.value;
  if (!pw || pw.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }
  if (pw !== pw2) {
    alert('Passwords do not match');
    return;
  }
  newPasswordBtn.disabled = true;
  newPasswordBtn.textContent = 'Setting password...';
  try {
    await completeNewPassword(pw);
  } catch (err) {
    alert(err?.message || 'Failed to set new password');
  } finally {
    newPasswordBtn.disabled = false;
    newPasswordBtn.textContent = 'Set Password & Login';
  }
});

// Sign-up form
let _signupEmail = '';
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = signupEmailEl.value.trim();
  const pw = signupPasswordEl.value;
  const pw2 = signupConfirmPasswordEl.value;
  if (pw !== pw2) {
    alert('Passwords do not match');
    return;
  }
  signupBtn.disabled = true;
  signupBtn.textContent = 'Signing up...';
  try {
    const result = await signUp(email, pw);
    _signupEmail = email;
    if (!result.userConfirmed) {
      signupConfirmSection.classList.remove('hidden');
      authStatusEl.textContent = 'Check your email for a verification code';
    } else {
      alert('Account created! You can now log in.');
      signupSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
    }
  } catch (err) {
    alert(err?.message || 'Sign-up failed');
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
});

// Confirm sign-up code
signupConfirmBtn.addEventListener('click', async () => {
  const code = signupCodeEl.value.trim();
  if (!code) { alert('Enter the verification code'); return; }
  signupConfirmBtn.disabled = true;
  signupConfirmBtn.textContent = 'Verifying...';
  try {
    await confirmSignUp(_signupEmail, code);
    alert('Email verified! You can now log in.');
    signupSection.classList.add('hidden');
    signupConfirmSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
  } catch (err) {
    alert(err?.message || 'Verification failed');
  } finally {
    signupConfirmBtn.disabled = false;
    signupConfirmBtn.textContent = 'Verify';
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  logout();
});

updateAuthUI();
