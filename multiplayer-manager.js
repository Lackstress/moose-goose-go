const { v4: uuidv4 } = require('uuid');

class MultiplayerManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.players = new Map();
    this.matchmaking = new Map(); // gameType -> queue of players
    this.gameStates = new Map(); // roomId -> game state
    this.recentCreations = new Map(); // userId -> timestamp of last room creation
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);
      
      // Room management
      socket.on('create-room', (data) => this.handleCreateRoom(socket, data));
      socket.on('join-room', (data) => this.handleJoinRoom(socket, data));
      socket.on('leave-room', (data) => this.handleLeaveRoom(socket, data));
      socket.on('get-rooms', (data) => this.handleGetRooms(socket, data));
      
      // Matchmaking
      socket.on('find-match', (data) => this.handleFindMatch(socket, data));
      socket.on('cancel-matchmaking', (data) => this.handleCancelMatchmaking(socket, data));
      
      // Game actions
      socket.on('game-action', (data) => this.handleGameAction(socket, data));
      socket.on('game-chat', (data) => this.handleGameChat(socket, data));
      
      // Connection handling
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  // Room Management
  handleCreateRoom(socket, data) {
    try {
      const { gameType, playerData, settings = {} } = data;
      
      if (!gameType || !playerData) {
        socket.emit('error', { message: 'Missing required data' });
        return;
      }

      // Anti-spam: prevent user from creating multiple rooms in quick succession
      const userId = playerData.userId;
      const lastCreation = this.recentCreations.get(userId) || 0;
      const now = Date.now();
      
      if (now - lastCreation < 2000) { // 2 second cooldown
        socket.emit('error', { message: 'Please wait before creating another server' });
        return;
      }
      
      this.recentCreations.set(userId, now);

      const roomId = uuidv4();
      const room = {
        id: roomId,
        gameType,
        host: playerData,
        players: [playerData],
        settings: {
          name: settings.name || `${playerData.username}'s Room`,
          maxPlayers: settings.maxPlayers || 2,
          isPrivate: settings.isPrivate || false,
          ...settings
        },
        status: 'waiting',
        createdAt: new Date(),
        gameState: null
      };

      this.rooms.set(roomId, room);
      this.players.set(socket.id, { socketId: socket.id, ...playerData, roomId });

      socket.join(roomId);
      socket.emit('room-created', { success: true, room });
      this.broadcastRoomsUpdate();

      console.log(`Room created: ${roomId} by ${playerData.username}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  }

  handleJoinRoom(socket, data) {
    try {
      const { roomId, playerData } = data;
      
      if (!roomId || !playerData) {
        socket.emit('error', { message: 'Missing required data' });
        return;
      }

      const room = this.rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.players.length >= room.settings.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      if (room.players.some(p => p.userId === playerData.userId)) {
        socket.emit('error', { message: 'Already in this room' });
        return;
      }

      // Add player to room
      room.players.push(playerData);
      this.players.set(socket.id, { socketId: socket.id, ...playerData, roomId });

      socket.join(roomId);
      socket.emit('room-joined', { success: true, room });
      
      // Notify all players in room
      this.io.to(roomId).emit('room-updated', room);

      // Start game if room is full
      if (room.players.length === room.settings.maxPlayers) {
        this.startGame(roomId);
      }

      this.broadcastRoomsUpdate();
      console.log(`Player ${playerData.username} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  handleLeaveRoom(socket, data) {
    try {
      const player = this.players.get(socket.id);
      if (!player || !player.roomId) return;

      const roomId = player.roomId;
      const room = this.rooms.get(roomId);
      if (!room) return;

      // Remove player from room
      room.players = room.players.filter(p => p.socketId !== socket.id);
      this.players.delete(socket.id);

      socket.leave(roomId);
      socket.emit('room-left', { success: true });

      // Notify remaining players
      this.io.to(roomId).emit('room-updated', room);

      // Handle room empty or game interruption
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        this.gameStates.delete(roomId);
      } else if (room.status === 'playing') {
        // Handle player disconnect during game
        this.handlePlayerDisconnectGame(roomId, player);
      }

      this.broadcastRoomsUpdate();
      console.log(`Player left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }

  handleGetRooms(socket, data) {
    try {
      const { gameType } = data;
      let rooms = Array.from(this.rooms.values());

      // Filter by game type if specified
      if (gameType) {
        rooms = rooms.filter(room => room.gameType === gameType);
      }

      // Don't include private rooms in public list
      rooms = rooms.filter(room => !room.settings.isPrivate);

      socket.emit('rooms-list', { rooms });
    } catch (error) {
      console.error('Error getting rooms:', error);
      socket.emit('error', { message: 'Failed to get rooms' });
    }
  }

  // Matchmaking
  handleFindMatch(socket, data) {
    try {
      const { gameType, playerData } = data;
      
      if (!gameType || !playerData) {
        socket.emit('error', { message: 'Missing required data' });
        return;
      }

      // Add to matchmaking queue
      if (!this.matchmaking.has(gameType)) {
        this.matchmaking.set(gameType, []);
      }

      const queue = this.matchmaking.get(gameType);
      
      // Check if player is already in queue
      if (queue.some(p => p.userId === playerData.userId)) {
        socket.emit('error', { message: 'Already in matchmaking' });
        return;
      }

      queue.push({ socketId: socket.id, ...playerData });
      this.players.set(socket.id, { socketId: socket.id, ...playerData, matchmaking: true });

      socket.emit('matchmaking-joined', { gameType });

      // Try to find a match
      this.tryFindMatch(gameType);
      
      console.log(`Player ${playerData.username} joined matchmaking for ${gameType}`);
    } catch (error) {
      console.error('Error in matchmaking:', error);
      socket.emit('error', { message: 'Failed to join matchmaking' });
    }
  }

  handleCancelMatchmaking(socket, data) {
    try {
      const player = this.players.get(socket.id);
      if (!player || !player.matchmaking) return;

      // Remove from all matchmaking queues
      for (const [gameType, queue] of this.matchmaking.entries()) {
        const index = queue.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          queue.splice(index, 1);
          if (queue.length === 0) {
            this.matchmaking.delete(gameType);
          }
          break;
        }
      }

      delete player.matchmaking;
      socket.emit('matchmaking-left', { success: true });
      
      console.log(`Player cancelled matchmaking`);
    } catch (error) {
      console.error('Error cancelling matchmaking:', error);
    }
  }

  tryFindMatch(gameType) {
    const queue = this.matchmaking.get(gameType);
    if (!queue || queue.length < 2) return;

    // Get first two players for simple matchmaking
    const player1 = queue.shift();
    const player2 = queue.shift();

    // Create a room for them
    const roomId = uuidv4();
    const room = {
      id: roomId,
      gameType,
      host: player1,
      players: [player1, player2],
      settings: {
        name: 'Matchmade Game',
        maxPlayers: 2,
        isPrivate: true
      },
      status: 'playing',
      createdAt: new Date(),
      gameState: null
    };

    this.rooms.set(roomId, room);
    
    // Update player data
    delete player1.matchmaking;
    delete player2.matchmaking;
    player1.roomId = roomId;
    player2.roomId = roomId;

    // Join sockets to room
    this.io.sockets.sockets.get(player1.socketId)?.join(roomId);
    this.io.sockets.sockets.get(player2.socketId)?.join(roomId);

    // Notify players
    this.io.to(player1.socketId).emit('match-found', { room, opponent: player2 });
    this.io.to(player2.socketId).emit('match-found', { room, opponent: player1 });

    // Start the game
    this.startGame(roomId);

    console.log(`Match found for ${gameType}: ${player1.username} vs ${player2.username}`);
  }

  // Game Management
  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'playing';
    room.gameState = this.initializeGameState(room.gameType, room.players);

    // Notify all players
    this.io.to(roomId).emit('game-started', { 
      room, 
      gameState: room.gameState 
    });

    this.broadcastRoomsUpdate();
  }

  initializeGameState(gameType, players) {
    // Return initial game state based on game type
    switch (gameType) {
      case 'tic-tac-toe':
        return {
          board: Array(9).fill(''),
          currentPlayer: players[0].userId,
          players: players.map(p => ({ 
            userId: p.userId, 
            username: p.username,
            symbol: p.socketId === players[0].socketId ? 'X' : 'O'
          })),
          status: 'playing'
        };
      
      case 'uno':
        return {
          deck: this.createUnoDeck(),
          discardPile: [],
          hands: {},
          currentPlayer: players[0].userId,
          direction: 1,
          status: 'playing'
        };
      
      case 'poker':
        return {
          deck: this.createPokerDeck(),
          communityCards: [],
          hands: {},
          pot: 0,
          currentBet: 0,
          currentPlayer: players[0].userId,
          status: 'playing'
        };
      
      default:
        return { status: 'playing' };
    }
  }

  handleGameAction(socket, data) {
    try {
      const player = this.players.get(socket.id);
      if (!player || !player.roomId) {
        socket.emit('error', { message: 'Not in a game' });
        return;
      }

      const room = this.rooms.get(player.roomId);
      if (!room || room.status !== 'playing') {
        socket.emit('error', { message: 'Game not active' });
        return;
      }

      // Process game action based on game type
      const processedAction = this.processGameAction(room.gameType, room.gameState, data, player.userId);
      
      if (processedAction.success) {
        room.gameState = processedAction.gameState;
        
        // Broadcast to all players in room
        this.io.to(player.roomId).emit('game-action', {
          action: data.action,
          playerId: player.userId,
          gameState: room.gameState,
          ...processedAction.data
        });

        // Check for game end
        if (processedAction.gameEnd) {
          this.endGame(player.roomId, processedAction.winner, processedAction.scores);
        }
      } else {
        socket.emit('error', { message: processedAction.error || 'Invalid action' });
      }
    } catch (error) {
      console.error('Error handling game action:', error);
      socket.emit('error', { message: 'Failed to process action' });
    }
  }

  processGameAction(gameType, gameState, action, playerId) {
    switch (gameType) {
      case 'tic-tac-toe':
        return this.processTicTacToeAction(gameState, action, playerId);
      case 'uno':
        return this.processUnoAction(gameState, action, playerId);
      case 'poker':
        return this.processPokerAction(gameState, action, playerId);
      default:
        return { success: false, error: 'Unknown game type' };
    }
  }

  processTicTacToeAction(gameState, action, playerId) {
    const { index } = action;
    
    if (gameState.currentPlayer !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    
    if (gameState.board[index] !== '') {
      return { success: false, error: 'Cell already taken' };
    }

    const player = gameState.players.find(p => p.userId === playerId);
    gameState.board[index] = player.symbol;

    // Check for winner
    const winner = this.checkTicTacToeWinner(gameState.board);
    
    if (winner) {
      return {
        success: true,
        gameState,
        gameEnd: true,
        winner: winner.symbol,
        scores: { [winner.userId]: 1 }
      };
    }

    // Check for draw
    if (gameState.board.every(cell => cell !== '')) {
      return {
        success: true,
        gameState,
        gameEnd: true,
        winner: 'draw',
        scores: {}
      };
    }

    // Switch turns
    gameState.currentPlayer = gameState.players.find(p => p.userId !== playerId).userId;
    
    return { success: true, gameState };
  }

  checkTicTacToeWinner(board) {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { symbol: board[a], pattern };
      }
    }

    return null;
  }

  // Chat functionality
  handleGameChat(socket, data) {
    try {
      const player = this.players.get(socket.id);
      if (!player || !player.roomId) return;

      const room = this.rooms.get(player.roomId);
      if (!room) return;

      const message = {
        userId: player.userId,
        username: player.username,
        text: data.message,
        timestamp: new Date()
      };

      this.io.to(player.roomId).emit('game-chat', message);
    } catch (error) {
      console.error('Error handling chat:', error);
    }
  }

  // Utility methods
  createUnoDeck() {
    const colors = ['red', 'blue', 'green', 'yellow'];
    const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    const deck = [];

    for (const color of colors) {
      for (const value of values) {
        deck.push({ color, value });
        if (value !== '0') {
          deck.push({ color, value }); // Add duplicates except for 0
        }
      }
    }

    // Add wild cards
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value: 'wild' });
      deck.push({ color: 'wild', value: 'wild4' });
    }

    return this.shuffleDeck(deck);
  }

  createPokerDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank, value: this.getCardValue(rank) });
      }
    }

    return this.shuffleDeck(deck);
  }

  getCardValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
  }

  shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  endGame(roomId, winner, scores) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'finished';
    
    this.io.to(roomId).emit('game-ended', { 
      winner, 
      scores, 
      room 
    });

    // Remove room after a delay
    setTimeout(() => {
      this.rooms.delete(roomId);
      this.gameStates.delete(roomId);
      this.broadcastRoomsUpdate();
    }, 30000); // 30 seconds
  }

  handlePlayerDisconnectGame(roomId, disconnectedPlayer) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Notify remaining players
    this.io.to(roomId).emit('player-disconnected', { 
      player: disconnectedPlayer 
    });

    // End game if not enough players
    if (room.players.length < 2) {
      this.endGame(roomId, 'abandoned', {});
    }
  }

  handleDisconnect(socket) {
    try {
      const player = this.players.get(socket.id);
      if (!player) return;

      console.log(`Player disconnected: ${socket.id}`);

      // Remove from matchmaking
      if (player.matchmaking) {
        this.handleCancelMatchmaking(socket, {});
      }

      // Leave room if in one
      if (player.roomId) {
        this.handleLeaveRoom(socket, {});
      }

      this.players.delete(socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  broadcastRoomsUpdate() {
    const rooms = Array.from(this.rooms.values()).filter(room => !room.settings.isPrivate);
    this.io.emit('rooms-list-update', { rooms });
  }

  // Get room statistics
  getRoomStats() {
    const rooms = Array.from(this.rooms.values());
    return {
      totalRooms: rooms.length,
      activeGames: rooms.filter(r => r.status === 'playing').length,
      waitingRooms: rooms.filter(r => r.status === 'waiting').length,
      totalPlayers: rooms.reduce((sum, room) => sum + room.players.length, 0)
    };
  }
}

module.exports = MultiplayerManager;