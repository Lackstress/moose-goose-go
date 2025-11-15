const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, 'public', 'games');
const games = [
  'roulette.html',
  'poker.html',
  'mines.html',
  'plinko.html',
  'rocket.html',
  'go-fish.html',
  'uno.html',
  'tic-tac-toe.html',
  'snake.html',
  'flappy-bird.html',
  'crossy-road.html',
  'memory.html',
  '2048.html'
];

console.log('🔧 Patching game files for unified currency system...\n');

games.forEach(gameFile => {
  const filePath = path.join(gamesDir, gameFile);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${gameFile} (not found)`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already patched
    if (content.includes('game-sync.js') && content.includes('universal-game-patch.js')) {
      console.log(`✅ ${gameFile} already patched`);
      return;
    }
    
    // Find the socket.io script tag
    const socketIOPattern = /<script src="https:\/\/cdn\.socket\.io\/[^"]+socket\.io\.min\.js"><\/script>/;
    const mainJSPattern = /<script src="\/js\/main\.js"><\/script>/;
    
    if (content.match(socketIOPattern)) {
      // Add game-sync.js and universal-game-patch.js after main.js
      if (content.match(mainJSPattern)) {
        content = content.replace(
          mainJSPattern,
          `<script src="/js/main.js"></script>\n  <script src="/js/game-sync.js"></script>\n  <script src="/js/universal-game-patch.js"></script>`
        );
      } else {
        // Add after socket.io if main.js not found
        content = content.replace(
          socketIOPattern,
          `$&\n  <script src="/js/main.js"></script>\n  <script src="/js/game-sync.js"></script>\n  <script src="/js/universal-game-patch.js"></script>`
        );
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Patched ${gameFile}`);
    } else {
      console.log(`⚠️  ${gameFile} - Could not find script injection point`);
    }
  } catch (error) {
    console.log(`❌ Error patching ${gameFile}:`, error.message);
  }
});

console.log('\n✅ Batch patching complete!');
