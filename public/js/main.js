// Global game state
let currentUser = null;
let userCoins = 1000;
let isGuest = false;
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Initialize socket connection with reconnection logic
function initializeSocket() {
  try {
    socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      reconnectAttempts = 0;
      showNotification('Connected to server', 'success');
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect manually
        socket.connect();
      }
      showNotification('Connection lost. Reconnecting...', 'warning');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      reconnectAttempts++;
      if (reconnectAttempts >= maxReconnectAttempts) {
        showNotification('Failed to connect to server. Please refresh the page.', 'error');
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      showNotification('Reconnected to server', 'success');
    });

    socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect');
      showNotification('Failed to reconnect. Please refresh the page.', 'error');
    });
  } catch (error) {
    console.error('Failed to initialize socket:', error);
    showNotification('Failed to connect to multiplayer server', 'error');
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadUserFromStorage();
  initializeSocket();
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
          saveUserToStorage(); // Update localStorage with new balance
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
      // Persist updated coins so other pages reflect the new balance
      try { saveUserToStorage(); } catch (_) {}
    }
  } catch (err) {
    console.error('Failed to update coins:', err);
  }
}

// Update UI
function updateUI() {
  const authSection = document.getElementById('authSection');
  const userInfo = document.getElementById('userInfo');
  const authCheck = document.getElementById('authCheck');

  if (currentUser) {
    // Hide the auth check modal when user is logged in
    if (authCheck) {
      authCheck.classList.remove('show');
    }

    // Only render auth UI if the container exists on this page
    if (authSection) {
      authSection.innerHTML = `
        <div class="user-panel">
          <div class="user-info">
            <span>👤 ${currentUser.username}</span>
            <span class="coins">💰 ${userCoins}</span>
          </div>
          <button onclick="logout()" class="btn small">Logout</button>
          ${!isGuest ? `<button onclick="resetCoins()" class="btn small">Reset</button>` : ''}
        </div>
      `;
    }

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
    if (authSection) {
      authSection.innerHTML = `
        <div class="auth-buttons">
          <button onclick="showLoginModal()" class="btn">Login</button>
          <button onclick="showRegisterModal()" class="btn">Register</button>
          <button onclick="loginAsGuest()" class="btn secondary">Play as Guest</button>
        </div>
      `;
    }

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

  let container = document.getElementById('notificationContainer');
  // Create a minimal container on pages that don't include one (e.g., game pages)
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
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

async function loadUserFromStorage() {
  const stored = localStorage.getItem('gameUser');
  if (stored) {
    const data = JSON.parse(stored);
    currentUser = data.currentUser;
    userCoins = data.userCoins;
    isGuest = data.isGuest;
    
    // Fetch fresh balance from backend for registered users
    if (!isGuest && currentUser && currentUser.id) {
      try {
        const response = await fetch(`/api/auth/profile/${currentUser.id}`);
        const profile = await response.json();
        if (profile && profile.coins !== undefined) {
          userCoins = profile.coins;
          saveUserToStorage(); // Update localStorage with fresh data
        }
      } catch (err) {
        console.error('Failed to fetch fresh balance:', err);
      }
    }
  }
  updateUI();
}

// Join multiplayer lobby
function joinMultiplayerGame(gameId) {
  if (!currentUser) {
    showNotification('Please login to play multiplayer', 'error');
    return;
  }

  if (!socket || !socket.connected) {
    showNotification('Connection to server failed. Reconnecting...', 'error');
    initializeSocket();
    setTimeout(() => joinMultiplayerGame(gameId), 2000);
    return;
  }

  try {
    socket.emit('join-lobby', {
      gameId,
      userId: currentUser.id,
      username: currentUser.username,
    });

    window.location.href = `/games/${gameId}`;
  } catch (error) {
    console.error('Failed to join multiplayer game:', error);
    showNotification('Failed to join game. Please try again.', 'error');
  }
}
