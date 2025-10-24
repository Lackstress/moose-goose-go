// Global game state
let currentUser = null;
let userCoins = 1000;
let isGuest = false;
const socket = io();

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadUserFromStorage();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Auth modal
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const guestBtn = document.getElementById('guestBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const resetCoinsBtn = document.getElementById('resetCoinsBtn');

  if (loginBtn) loginBtn.addEventListener('click', showLoginModal);
  if (registerBtn) registerBtn.addEventListener('click', showRegisterModal);
  if (guestBtn) guestBtn.addEventListener('click', loginAsGuest);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (resetCoinsBtn) resetCoinsBtn.addEventListener('click', resetCoins);

  // Auth form submissions
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
}

// Show login modal
function showLoginModal() {
  const modal = document.getElementById('authModal');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <div class="auth-form">
      <h2>Login</h2>
      <form id="loginForm">
        <input type="text" id="loginUsername" placeholder="Username" required />
        <input type="password" id="loginPassword" placeholder="Password" required />
        <button type="submit" class="btn">Login</button>
      </form>
      <button onclick="showRegisterModal()" class="btn secondary">Create Account</button>
      <button onclick="closeModal()" class="btn secondary">Close</button>
    </div>
  `;

  modal.style.display = 'block';
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

// Show register modal
function showRegisterModal() {
  const modal = document.getElementById('authModal');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <div class="auth-form">
      <h2>Create Account</h2>
      <form id="registerForm">
        <input type="text" id="regUsername" placeholder="Username" required />
        <input type="password" id="regPassword" placeholder="Password (min 6 chars)" minlength="6" required />
        <input type="password" id="regConfirm" placeholder="Confirm Password" required />
        <button type="submit" class="btn">Register</button>
      </form>
      <button onclick="showLoginModal()" class="btn secondary">Already have account?</button>
      <button onclick="closeModal()" class="btn secondary">Close</button>
    </div>
  `;

  modal.style.display = 'block';
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = { id: data.userId, username: data.username };
      userCoins = data.coins;
      isGuest = false;
      saveUserToStorage();
      updateUI();
      closeModal();
      showNotification(`Welcome back, ${data.username}!`);
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Login failed', 'error');
  }
}

// Handle register
async function handleRegister(e) {
  e.preventDefault();

  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (password !== confirm) {
    showNotification('Passwords do not match', 'error');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = { id: data.userId, username: data.username };
      userCoins = 1000;
      isGuest = false;
      saveUserToStorage();
      updateUI();
      closeModal();
      showNotification(`Account created! Welcome, ${data.username}!`);
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Registration failed', 'error');
  }
}

// Login as guest
function loginAsGuest() {
  currentUser = {
    id: 'guest_' + Math.random().toString(36).substr(2, 9),
    username: 'Guest',
  };
  userCoins = 1000;
  isGuest = true;
  saveUserToStorage();
  updateUI();
  showNotification('Logged in as Guest (progress not saved)');
}

// Logout
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    currentUser = null;
    userCoins = 1000;
    isGuest = false;
    localStorage.removeItem('gameUser');
    updateUI();
    showNotification('Logged out');
  }
}

// Reset coins
function resetCoins() {
  if (confirm('Reset coins to 1000? This cannot be undone!')) {
    fetch('/api/auth/reset-coins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          userCoins = 1000;
          updateUI();
          showNotification('Coins reset to 1000');
        }
      });
  }
}

// Update coins (for games)
async function updateCoins(amount, gameId, type = 'bet') {
  if (isGuest) return;

  try {
    const response = await fetch('/api/auth/update-coins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, amount, gameId, type }),
    });

    const data = await response.json();
    if (data.success) {
      userCoins = data.coins;
      updateUI();
    }
  } catch (err) {
    console.error('Failed to update coins:', err);
  }
}

// Update UI
function updateUI() {
  const authSection = document.getElementById('authSection');
  const userInfo = document.getElementById('userInfo');

  if (currentUser) {
    authSection.innerHTML = `
      <div class="user-panel">
        <div class="user-info">
          <span>👤 ${currentUser.username}</span>
          <span class="coins">💰 ${userCoins}</span>
        </div>
        <button onclick="logout()" class="btn small">Logout</button>
        ${!isGuest ? `<button onclick="resetCoinsBtn.click()" class="btn small">Reset</button>` : ''}
      </div>
    `;

    if (userInfo) {
      userInfo.innerHTML = `
        <div class="profile-card">
          <h3>${currentUser.username}</h3>
          <p>💰 Coins: <strong>${userCoins}</strong></p>
          ${isGuest ? '<p style="color: orange;">⚠️ Guest Mode - Progress Not Saved</p>' : ''}
        </div>
      `;
    }
  } else {
    authSection.innerHTML = `
      <div class="auth-buttons">
        <button onclick="showLoginModal()" class="btn">Login</button>
        <button onclick="showRegisterModal()" class="btn">Register</button>
        <button onclick="loginAsGuest()" class="btn secondary">Play as Guest</button>
      </div>
    `;

    if (userInfo) {
      userInfo.innerHTML = `
        <div class="profile-card">
          <p>Login or Register to save your progress!</p>
        </div>
      `;
    }
  }
}

// Modal management
function closeModal() {
  document.getElementById('authModal').style.display = 'none';
}

window.addEventListener('click', (event) => {
  const modal = document.getElementById('authModal');
  if (event.target === modal) {
    closeModal();
  }
});

// Notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  const container = document.getElementById('notificationContainer');
  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Local storage
function saveUserToStorage() {
  localStorage.setItem('gameUser', JSON.stringify({ currentUser, userCoins, isGuest }));
}

function loadUserFromStorage() {
  const stored = localStorage.getItem('gameUser');
  if (stored) {
    const data = JSON.parse(stored);
    currentUser = data.currentUser;
    userCoins = data.userCoins;
    isGuest = data.isGuest;
  }
  updateUI();
}

// Join multiplayer lobby
function joinMultiplayerGame(gameId) {
  if (!currentUser) {
    showNotification('Please login to play multiplayer', 'error');
    return;
  }

  socket.emit('join-lobby', {
    gameId,
    userId: currentUser.id,
    username: currentUser.username,
  });

  window.location.href = `/games/${gameId}`;
}
