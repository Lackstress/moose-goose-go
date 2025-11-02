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
    
    // Install dependencies and build
    process.chdir(radonPath);
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
