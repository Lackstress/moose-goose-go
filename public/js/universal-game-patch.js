/**
 * Universal Game Patch Script
 * Add this script tag to all game HTML files: <script src="/js/universal-game-patch.js"></script>
 * This ensures all games work with the unified currency system
 */

(function() {
  'use strict';
  
  console.log('🔧 Universal Game Patch loading...');
  
  // Wait for game initialization
  const patchInterval = setInterval(() => {
    // Check if gameState exists (most games use this)
    if (typeof window.gameState !== 'undefined' && typeof window.gameSync !== 'undefined') {
      clearInterval(patchInterval);
      applyPatch();
    }
  }, 100);
  
  // Timeout after 10 seconds
  setTimeout(() => {
    clearInterval(patchInterval);
    if (typeof window.gameState !== 'undefined') {
      console.warn('⚠️ gameSync not loaded, applying basic patch');
      applyBasicPatch();
    }
  }, 10000);
  
  function applyPatch() {
    console.log('✅ Applying game currency patch...');
    
    const gameState = window.gameState;
    
    // Find the balance/bankroll property
    let balanceKey = null;
    if ('balance' in gameState) balanceKey = 'balance';
    else if ('bankroll' in gameState) balanceKey = 'bankroll';
    else if ('coins' in gameState) balanceKey = 'coins';
    
    if (balanceKey) {
      // Sync initial balance
      gameState[balanceKey] = window.gameSync.getCoins();
      console.log(`💰 Synced ${balanceKey}: ${gameState[balanceKey]}`);
      
      // Listen for coin updates
      window.addEventListener('coinsUpdated', (e) => {
        gameState[balanceKey] = e.detail.coins;
        console.log(`💰 Coins updated to: ${e.detail.coins}`);
        
        // Trigger UI update if function exists
        if (typeof window.updateDisplay === 'function') {
          window.updateDisplay();
        } else if (typeof window.updateStats === 'function') {
          window.updateStats();
        } else if (typeof window.updateUI === 'function') {
          window.updateUI();
        }
      });
      
      // Patch common game functions
      patchGameFunctions(balanceKey);
    }
    
    console.log('✅ Game currency patch applied successfully');
  }
  
  function applyBasicPatch() {
    console.log('⚙️ Applying basic patch without gameSync...');
    
    const gameState = window.gameState;
    if (!gameState) return;
    
    // Find balance key
    let balanceKey = null;
    if ('balance' in gameState) balanceKey = 'balance';
    else if ('bankroll' in gameState) balanceKey = 'bankroll';
    else if ('coins' in gameState) balanceKey = 'coins';
    
    if (balanceKey && typeof window.userCoins !== 'undefined') {
      gameState[balanceKey] = window.userCoins;
      console.log(`💰 Basic sync ${balanceKey}: ${gameState[balanceKey]}`);
    }
  }
  
  function patchGameFunctions(balanceKey) {
    const gameState = window.gameState;
    
    // Store original functions if they exist
    const originals = {
      updateCoins: window.updateCoins,
      placeBet: window.placeBet,
      addWinnings: window.addWinnings
    };
    
    // Ensure updateCoins always syncs
    if (typeof window.updateCoins === 'function') {
      const originalUpdateCoins = window.updateCoins;
      window.updateCoins = function(amount, gameId, type) {
        // Call original
        originalUpdateCoins.call(this, amount, gameId, type);
        // Sync game state
        if (gameState && balanceKey) {
          gameState[balanceKey] = window.userCoins || gameState[balanceKey];
        }
      };
    }
    
    // Intercept common betting patterns
    const originalSetTimeout = window.setTimeout;
    let betTracking = { lastBet: 0, lastWin: 0 };
    
    // Monitor balance changes
    let lastBalance = gameState[balanceKey];
    setInterval(() => {
      if (gameState[balanceKey] !== lastBalance) {
        const diff = gameState[balanceKey] - lastBalance;
        
        // Sync with global coins if significant change
        if (Math.abs(diff) > 0) {
          if (window.gameSync) {
            if (diff < 0) {
              // Likely a bet
              window.gameSync.placeBet(Math.abs(diff), getCurrentGameId());
            } else {
              // Likely a win
              window.gameSync.addWinnings(diff, getCurrentGameId());
            }
          } else if (typeof window.updateCoins === 'function') {
            window.updateCoins(diff, getCurrentGameId(), diff < 0 ? 'bet' : 'win');
          }
        }
        
        lastBalance = gameState[balanceKey];
      }
    }, 500);
  }
  
  function getCurrentGameId() {
    // Extract game ID from URL or page title
    const path = window.location.pathname;
    const match = path.match(/\/games\/([^.\/]+)/);
    if (match) return match[1];
    
    const title = document.title.toLowerCase();
    if (title.includes('blackjack')) return 'blackjack';
    if (title.includes('slots')) return 'slots';
    if (title.includes('coin')) return 'coinflip';
    if (title.includes('roulette')) return 'roulette';
    if (title.includes('poker')) return 'poker';
    if (title.includes('mine')) return 'mines';
    if (title.includes('plinko')) return 'plinko';
    if (title.includes('rocket')) return 'rocket';
    
    return 'unknown';
  }
})();
