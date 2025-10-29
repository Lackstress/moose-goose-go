#!/usr/bin/env node

/**
 * Gaming Hub Platform - Universal Installation Script
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GAMES = [
    '2048.html',
    'blackjack.html',
    'coinflip.html',
    'crossy-road.html',
    'flappy-bird.html',
    'go-fish.html',
    'memory.html',
    'mines.html',
    'plinko.html',
    'poker.html',
    'rocket.html',
    'roulette.html',
    'slots.html',
    'snake.html',
    'tic-tac-toe.html',
    'uno.html',
];

const EXTERNAL_REPOS = [
    { name: 'DuckMath', url: 'https://github.com/duckmath/duckmath.github.io.git', dir: 'duckmath' },
    { name: 'Radon Games', url: 'https://github.com/Radon-Games/Radon-Games.git', dir: 'radon-games' },
];

const CORE_FILES = [
    'server.js',
    'multiplayer-manager.js',
    'public/index.html',
    'public/landing.html',
    'public/styles.css',
    'public/js/main.js',
    'routes/auth.js',
];

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('');
    log('==================================', 'cyan');
    log(title, 'cyan');
    log('==================================', 'cyan');
    console.log('');
}

function checkNodeInstalled() {
    try {
        const version = execSync('node -v', { encoding: 'utf8' }).trim();
        log(`✅ Node.js version: ${version}`, 'green');
        
        const npmVersion = execSync('npm -v', { encoding: 'utf8' }).trim();
        log(`✅ npm version: ${npmVersion}`, 'green');
        return true;
    } catch (error) {
        log('❌ Node.js is not installed!', 'red');
        log('Please install Node.js v14+ from https://nodejs.org/', 'red');
        return false;
    }
}

function installDependencies() {
    log('📦 Installing main dependencies...', 'cyan');
    try {
        execSync('npm install', { stdio: 'inherit' });
        log('✅ Main dependencies installed', 'green');
        return true;
    } catch (error) {
        log('❌ npm install failed!', 'red');
        return false;
    }
}

function verifyDatabase() {
    log('🗄️  Initializing database...', 'cyan');
    const dbPath = path.join(process.cwd(), 'database', 'db.js');
    
    if (!fs.existsSync(dbPath)) {
        log('❌ database/db.js not found!', 'red');
        return false;
    }
    
    log('✅ Database configuration ready', 'green');
    return true;
}

function verifyGames() {
    log('🎮 Verifying game files...', 'cyan');
    let missingCount = 0;
    
    for (const game of GAMES) {
        const gamePath = path.join(process.cwd(), 'public', 'games', game);
        if (fs.existsSync(gamePath)) {
            log(`  ✅ ${game}`, 'green');
        } else {
            log(`  ⚠️  ${game} (not found)`, 'yellow');
            missingCount++;
        }
    }
    
    if (missingCount > 0) {
        console.log('');
        log(`⚠️  Note: Some games are missing (${missingCount}/${GAMES.length})`, 'yellow');
    }
    
    return true;
}

function verifyCoreFiles() {
    log('📋 Verifying core files...', 'cyan');
    let allFound = true;
    
    for (const file of CORE_FILES) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            log(`  ✅ ${file}`, 'green');
        } else {
            log(`  ❌ ${file} (missing!)`, 'red');
            allFound = false;
        }
    }
    
    return allFound;
}

function cloneExternalRepos() {
    log('📥 Setting up external game repositories...', 'cyan');
    
    for (const repo of EXTERNAL_REPOS) {
        const repoPath = path.join(process.cwd(), '..', repo.dir);
        
        try {
            if (fs.existsSync(repoPath)) {
                log(`  ℹ️  ${repo.name} already exists at ../${repo.dir}`, 'yellow');
                log(`      To update: cd ../${repo.dir} && git pull`, 'yellow');
            } else {
                log(`  ⏳ Cloning ${repo.name}...`, 'cyan');
                execSync(`git clone ${repo.url} ../${repo.dir}`, { stdio: 'pipe' });
                log(`  ✅ ${repo.name} cloned successfully`, 'green');
            }
        } catch (error) {
            log(`  ⚠️  Failed to clone ${repo.name}:`, 'yellow');
            log(`      ${error.message}`, 'yellow');
            log(`      You can clone manually: git clone ${repo.url}`, 'yellow');
        }
    }
    
    return true;
}

async function main() {
    logSection('🎮 Gaming Hub Platform Setup');
    
    // Step 1: Check Node.js
    if (!checkNodeInstalled()) {
        process.exit(1);
    }
    console.log('');
    
    // Step 2: Install dependencies
    if (!installDependencies()) {
        process.exit(1);
    }
    console.log('');
    
    // Step 3: Verify database
    if (!verifyDatabase()) {
        process.exit(1);
    }
    console.log('');
    
    // Step 4: Verify games
    verifyGames();
    console.log('');
    
    // Step 5: Verify core files
    if (!verifyCoreFiles()) {
        process.exit(1);
    }
    console.log('');
    
    // Step 6: Clone external repos
    cloneExternalRepos();
    console.log('');
    
    // Success message
    logSection('✅ Installation Complete!');
    log('📝 Next Steps:', 'cyan');
    log('  1. Start the server: npm start', 'green');
    log('  2. Open http://localhost:3000 in your browser', 'green');
    log('  3. Create an account or login as guest', 'green');
    console.log('');
    log('🎮 Available Game Platforms:', 'cyan');
    log('  • GameHub (/ghub) - 16 built-in games', 'green');
    log('  • DuckMath (/duckmath) - Educational games (if cloned)', 'green');
    log('  • Radon Games (/radon-g3mes) - 200+ games (if cloned)', 'green');
    console.log('');
    log('🌐 For domain setup, see README.md', 'cyan');
    console.log('');
}

main().catch(error => {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
});
