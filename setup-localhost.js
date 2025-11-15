#!/usr/bin/env node

/**
 * Universal Setup Script for Localhost
 * Works on both Windows and Linux
 * Sets up all required servers and clones necessary repositories
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';

console.log('🎮 Gaming Hub - Localhost Setup');
console.log('================================\n');

// Helper function to run commands
function runCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} - Done\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} - Failed`);
    console.error(error.message);
    return false;
  }
}

// Check if Node.js is installed
function checkNodeJS() {
  try {
    const version = execSync('node --version').toString().trim();
    console.log(`✅ Node.js ${version} is installed\n`);
    return true;
  } catch {
    console.error('❌ Node.js is not installed. Please install Node.js first.');
    process.exit(1);
  }
}

// Check if Git is installed
function checkGit() {
  try {
    const version = execSync('git --version').toString().trim();
    console.log(`✅ ${version} is installed\n`);
    return true;
  } catch {
    console.error('❌ Git is not installed. Please install Git first.');
    process.exit(1);
  }
}

// Install dependencies for main project
function installMainDependencies() {
  return runCommand('npm install', 'Installing main project dependencies');
}

// Clone and setup Radon Games
function setupRadonGames() {
  const radonPath = path.join(__dirname, '..', 'radon-games');
  
  if (fs.existsSync(radonPath)) {
    console.log('✅ Radon Games already exists\n');
    // Apply base path patches to ensure it works from /radon-g3mes
    process.chdir(radonPath);
    try {
      const vitePath = path.join(radonPath, 'vite.config.ts');
      if (fs.existsSync(vitePath)) {
        let viteCfg = fs.readFileSync(vitePath, 'utf8');
        if (!/base:\s*['"]\/radon-g3mes\//.test(viteCfg)) {
          viteCfg = viteCfg.replace(/export\s+default\s+defineConfig\(\{/, match => `${match}\n  base: '/radon-g3mes/',`);
          fs.writeFileSync(vitePath, viteCfg);
          console.log('  ✓ Patched vite.config.ts base to /radon-g3mes/');
        }
      }

      const mainPath = path.join(radonPath, 'src', 'main.tsx');
      if (fs.existsSync(mainPath)) {
        let mainTsx = fs.readFileSync(mainPath, 'utf8');
        if (!/basepath:\s*['"]\/radon-g3mes['"]/.test(mainTsx)) {
          mainTsx = mainTsx.replace(
            /const\s+router\s*=\s*createRouter\(\{\s*routeTree,\s*defaultPreload:\s*['"][^'"]+['"]\s*\}\);/,
            `const router = createRouter({ routeTree, defaultPreload: 'viewport', basepath: '/radon-g3mes' });`
          );
          fs.writeFileSync(mainPath, mainTsx);
          console.log('  ✓ Patched src/main.tsx router basepath to /radon-g3mes');
        }
      }

      // Patch CDN references to go through our server proxy path
      const gameRoutePath = path.join(radonPath, 'src', 'routes', 'game', '$gameid.tsx');
      if (fs.existsSync(gameRoutePath)) {
        let file = fs.readFileSync(gameRoutePath, 'utf8');
        const replaced = file.replace(/src=\{`\/cdn\//g, "src={`\/radon-g3mes/cdn/");
        if (replaced !== file) {
          fs.writeFileSync(gameRoutePath, replaced);
          console.log('  ✓ Patched src/routes/game/$gameid.tsx CDN path');
        }
      }

      const gameCardPath = path.join(radonPath, 'src', 'components', 'GameCard.tsx');
      if (fs.existsSync(gameCardPath)) {
        let file = fs.readFileSync(gameCardPath, 'utf8');
        const replaced = file.replace(/src=\{`\/cdn\//g, "src={`\/radon-g3mes/cdn/");
        if (replaced !== file) {
          fs.writeFileSync(gameCardPath, replaced);
          console.log('  ✓ Patched src/components/GameCard.tsx CDN path');
        }
      }
    } catch (e) {
      console.warn('⚠️  Failed to apply Radon base/CDN patches:', e.message);
    }

    // Install dependencies and build
    if (!runCommand('npm install', 'Installing Radon Games dependencies')) {
      return false;
    }
    if (!runCommand('npm run build', 'Building Radon Games')) {
      return false;
    }
    process.chdir(__dirname);
    return true;
  }
  
  console.log('📥 Cloning Radon Games repository...');
  const parentDir = path.join(__dirname, '..');
  process.chdir(parentDir);
  
  if (!runCommand('git clone https://github.com/Radon-Games/Radon-Games.git radon-games', 'Cloning Radon Games')) {
    return false;
  }
  
  process.chdir(radonPath);
  // Apply patches after clone
  try {
    const vitePath = path.join(radonPath, 'vite.config.ts');
    if (fs.existsSync(vitePath)) {
      let viteCfg = fs.readFileSync(vitePath, 'utf8');
      if (!/base:\s*['"]\/radon-g3mes\//.test(viteCfg)) {
        viteCfg = viteCfg.replace(/export\s+default\s+defineConfig\(\{/, match => `${match}\n  base: '/radon-g3mes/',`);
        fs.writeFileSync(vitePath, viteCfg);
        console.log('  ✓ Patched vite.config.ts base to /radon-g3mes/');
      }
    }
    const mainPath = path.join(radonPath, 'src', 'main.tsx');
    if (fs.existsSync(mainPath)) {
      let mainTsx = fs.readFileSync(mainPath, 'utf8');
      if (!/basepath:\s*['"]\/radon-g3mes['"]/.test(mainTsx)) {
        mainTsx = mainTsx.replace(
          /const\s+router\s*=\s*createRouter\(\{\s*routeTree,\s*defaultPreload:\s*['"][^'"]+['"]\s*\}\);/,
          `const router = createRouter({ routeTree, defaultPreload: 'viewport', basepath: '/radon-g3mes' });`
        );
        fs.writeFileSync(mainPath, mainTsx);
        console.log('  ✓ Patched src/main.tsx router basepath to /radon-g3mes');
      }
    }
    const gameRoutePath = path.join(radonPath, 'src', 'routes', 'game', '$gameid.tsx');
    if (fs.existsSync(gameRoutePath)) {
      let file = fs.readFileSync(gameRoutePath, 'utf8');
      const replaced = file.replace(/src=\{`\/cdn\//g, "src={`\/radon-g3mes/cdn/");
      if (replaced !== file) {
        fs.writeFileSync(gameRoutePath, replaced);
        console.log('  ✓ Patched src/routes/game/$gameid.tsx CDN path');
      }
    }
    const gameCardPath = path.join(radonPath, 'src', 'components', 'GameCard.tsx');
    if (fs.existsSync(gameCardPath)) {
      let file = fs.readFileSync(gameCardPath, 'utf8');
      const replaced = file.replace(/src=\{`\/cdn\//g, "src={`\/radon-g3mes/cdn/");
      if (replaced !== file) {
        fs.writeFileSync(gameCardPath, replaced);
        console.log('  ✓ Patched src/components/GameCard.tsx CDN path');
      }
    }
  } catch (e) {
    console.warn('⚠️  Failed to apply Radon base/CDN patches:', e.message);
  }
  if (!runCommand('npm install', 'Installing Radon Games dependencies')) {
    return false;
  }
  if (!runCommand('npm run build', 'Building Radon Games')) {
    return false;
  }
  
  process.chdir(__dirname);
  return true;
}

// Clone and setup DuckMath
function setupDuckMath() {
  const duckmathPath = path.join(__dirname, '..', 'duckmath');
  
  if (fs.existsSync(duckmathPath)) {
    console.log('✅ DuckMath already exists\n');
    return true;
  }
  
  console.log('📥 Cloning DuckMath repository...');
  const parentDir = path.join(__dirname, '..');
  process.chdir(parentDir);
  
  if (!runCommand('git clone https://github.com/DuckMathGames/duckmath.git duckmath', 'Cloning DuckMath')) {
    console.log('⚠️  DuckMath clone failed - continuing without it\n');
  }
  
  process.chdir(__dirname);
  return true;
}

// Start the server
function startServer() {
  console.log('\n🚀 Starting Gaming Hub Server...\n');
  console.log('================================');
  console.log('Server will start on http://localhost:3000');
  console.log('');
  console.log('Available routes:');
  console.log('  - Landing Page: http://localhost:3000/');
  console.log('  - GameHub:      http://localhost:3000/ghub');
  console.log('  - DuckMath:     http://localhost:3000/duckmath');
  console.log('  - Radon Portal: http://localhost:3000/radon-g3mes');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('================================\n');
  
  try {
    execSync('npm start', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Server failed to start');
    process.exit(1);
  }
}

// Main setup function
async function main() {
  console.log('Step 1: Checking prerequisites...\n');
  checkNodeJS();
  checkGit();
  
  console.log('Step 2: Installing main project dependencies...\n');
  if (!installMainDependencies()) {
    console.error('❌ Setup failed at main dependencies installation');
    process.exit(1);
  }
  
  console.log('Step 3: Setting up Radon Games...\n');
  if (!setupRadonGames()) {
    console.error('⚠️  Radon Games setup failed - continuing without it\n');
  }
  
  console.log('Step 4: Setting up DuckMath...\n');
  setupDuckMath();
  
  console.log('✅ Setup complete!\n');
  
  // Ask if user wants to start the server
  console.log('Do you want to start the server now? (Y/n)');
  
  if (process.argv.includes('--start') || process.argv.includes('-s')) {
    startServer();
  } else {
    console.log('\nTo start the server later, run: npm start');
    console.log('Or run: node setup-localhost.js --start\n');
  }
}

// Run the setup
main().catch(error => {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
});
