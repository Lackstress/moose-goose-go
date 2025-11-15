/**
 * Game Currency Synchronization Helper
 * This script ensures all games use the same currency system
 * and properly sync with the global userCoins variable from main.js
 */

// Wait for main.js to load
(function() {
  'use strict';
  
  // Ensure main.js variables are available
  let initAttempts = 0;
  const maxAttempts = 50;
  
  function waitForMainJS() {
    if (typeof window.userCoins !== 'undefined' && typeof window.currentUser !== 'undefined') {
      initializeGameSync();
    } else if (initAttempts < maxAttempts) {
      initAttempts++;
      setTimeout(waitForMainJS, 100);
    } else {
      console.error('main.js not loaded, using fallback values');
      // Fallback initialization
      if (typeof window.userCoins === 'undefined') window.userCoins = 1000;
      if (typeof window.currentUser === 'undefined') window.currentUser = null;
      if (typeof window.isGuest === 'undefined') window.isGuest = false;
      initializeGameSync();
    }
  }
  
  function initializeGameSync() {
    // Create global game currency helpers
    window.gameSync = {
      // Get the current user's coin balance
      getCoins: function() {
        return window.userCoins || 1000;
      },
      
      // Update coins (positive for wins, negative for bets)
      updateCoins: function(amount, gameId = 'unknown') {
        if (typeof window.updateCoins === 'function') {
          // Use main.js updateCoins which handles both guests and registered users
          window.updateCoins(amount, gameId, amount < 0 ? 'bet' : 'win');
        } else {
          // Fallback if main.js function not available
          window.userCoins = (window.userCoins || 1000) + amount;
          console.warn('updateCoins function not available from main.js');
        }
        return window.userCoins;
      },
      
      // Initialize game with user's current balance
      initGameBalance: function(gameStateObj, balanceKey = 'balance') {
        if (gameStateObj && typeof gameStateObj === 'object') {
          gameStateObj[balanceKey] = window.userCoins || 1000;
        }
        return window.userCoins || 1000;
      },
      
      // Sync game balance with global coins (call after wins/losses)
      syncBalance: function(gameStateObj, balanceKey = 'balance') {
        if (gameStateObj && typeof gameStateObj === 'object') {
          const diff = gameStateObj[balanceKey] - window.userCoins;
          if (diff !== 0) {
            this.updateCoins(diff);
            gameStateObj[balanceKey] = window.userCoins;
          }
        }
      },
      
      // Place a bet (deduct from balance)
      placeBet: function(amount, gameId = 'unknown') {
        if (amount > this.getCoins()) {
          return false; // Insufficient funds
        }
        this.updateCoins(-amount, gameId);
        return true;
      },
      
      // Award winnings (add to balance)
      addWinnings: function(amount, gameId = 'unknown') {
        this.updateCoins(amount, gameId);
      },
      
      // Get current user info
      getUser: function() {
        return window.currentUser;
      },
      
      // Check if user is guest
      isGuest: function() {
        return window.isGuest || false;
      }
    };
    
    // Listen for storage changes (when coins update in another tab/game)
    window.addEventListener('storage', function(e) {
      if (e.key === 'gameUser' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.userCoins !== undefined && data.userCoins !== window.userCoins) {
            window.userCoins = data.userCoins;
            // Trigger UI update if available
            if (typeof window.updateUI === 'function') {
              window.updateUI();
            }
            // Trigger custom event for games to listen to
            window.dispatchEvent(new CustomEvent('coinsUpdated', { 
              detail: { coins: window.userCoins } 
            }));
          }
        } catch (err) {
          console.error('Failed to sync coins from storage:', err);
        }
      }
    });
    
    console.log('Game currency sync initialized. Current balance:', window.userCoins);
  }
  
  // Start waiting for main.js
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForMainJS);
  } else {
    waitForMainJS();
  }
})();
