/**
 * Enhanced Multiplayer Manager for GameHub
 * Handles rooms, matchmaking, chat, spectators, and game state
 */

class MultiplayerManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomId => Room object
    this.players = new Map(); // socketId => Player object
    this.queue = new Map(); // gameType => Queue of waiting players
    this.spectators = new Map(); // roomId => Set of spectator socketIds
  }

  // Create a new game room
  createRoom(gameType, hostSocketId, options = {}) {
    const roomId = `${gameType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const room = {
      id: roomId,
      gameType,
      host: hostSocketId,
      players: [],
      maxPlayers: options.maxPlayers || 2,
      status: 'waiting', // waiting, playing, finished
      gameState: {},
      spectators: new Set(),
      chat: [],
      createdAt: Date.now(),
      settings: options.settings || {}
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // Add player to room
  addPlayerToRoom(roomId, socketId, playerData) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found' };
    
    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    const player = {
      socketId,
      userId: playerData.userId,
      username: playerData.username,
      avatar: playerData.avatar || '👤',
      coins: playerData.coins || 1000,
      joinedAt: Date.now(),
      ready: false
    };

    room.players.push(player);
    this.players.set(socketId, { roomId, player });

    // Join socket room
    this.io.sockets.sockets.get(socketId)?.join(roomId);

    // Notify all players in room
    this.io.to(roomId).emit('room-update', this.getRoomData(roomId));

    // Auto-start if room is full
    if (room.players.length === room.maxPlayers) {
      this.startGame(roomId);
    }

    return { success: true, room: this.getRoomData(roomId) };
  }

  // Remove player from room
  removePlayerFromRoom(socketId) {
    const playerData = this.players.get(socketId);
    if (!playerData) return;

    const { roomId } = playerData;
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Remove player
    room.players = room.players.filter(p => p.socketId !== socketId);
    this.players.delete(socketId);

    // Leave socket room
    this.io.sockets.sockets.get(socketId)?.leave(roomId);

    // If room is empty or game was in progress, end the game
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    } else {
      if (room.status === 'playing') {
        this.endGame(roomId, 'player_left');
      }
      this.io.to(roomId).emit('room-update', this.getRoomData(roomId));
    }
  }

  // Matchmaking - find or create a game
  findMatch(gameType, socketId, playerData) {
    // Check if player is already in a room
    if (this.players.has(socketId)) {
      const { roomId } = this.players.get(socketId);
      return { success: false, error: 'Already in a room', roomId };
    }

    // Look for available room
    for (const [roomId, room] of this.rooms) {
      if (room.gameType === gameType && 
          room.status === 'waiting' && 
          room.players.length < room.maxPlayers) {
        return this.addPlayerToRoom(roomId, socketId, playerData);
      }
    }

    // No available room, create new one
    const room = this.createRoom(gameType, socketId);
    return this.addPlayerToRoom(room.id, socketId, playerData);
  }

  // Start the game
  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'playing';
    room.startedAt = Date.now();

    // Initialize game state based on game type
    switch(room.gameType) {
      case 'tic-tac-toe':
        room.gameState = {
          board: Array(9).fill(null),
          currentPlayer: 0,
          winner: null
        };
        break;
      
      case 'uno':
        room.gameState = this.initializeUNO(room);
        break;
      
      case 'poker':
        room.gameState = this.initializePoker(room);
        break;
      
      case 'go-fish':
        room.gameState = this.initializeGoFish(room);
        break;
      
      case 'plinko-multiplayer':
        room.gameState = {
          bets: [],
          results: []
        };
        break;
    }

    this.io.to(roomId).emit('game-start', {
      roomId,
      gameType: room.gameType,
      players: room.players,
      gameState: room.gameState
    });
  }

  // Handle game move
  handleMove(socketId, moveData) {
    const playerData = this.players.get(socketId);
    if (!playerData) return { success: false, error: 'Not in a room' };

    const { roomId } = playerData;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    // Process move based on game type
    const result = this.processMove(room, socketId, moveData);
    
    if (result.success) {
      // Broadcast move to all players
      this.io.to(roomId).emit('game-move', {
        playerId: socketId,
        move: moveData,
        gameState: room.gameState
      });

      // Check for game end
      if (result.gameEnded) {
        this.endGame(roomId, result.winner);
      }
    }

    return result;
  }

  // Process move based on game type
  processMove(room, socketId, moveData) {
    switch(room.gameType) {
      case 'tic-tac-toe':
        return this.processTicTacToeMove(room, socketId, moveData);
      case 'uno':
        return this.processUNOMove(room, socketId, moveData);
      case 'poker':
        return this.processPokerMove(room, socketId, moveData);
      default:
        return { success: false, error: 'Unknown game type' };
    }
  }

  // Process Tic Tac Toe move
  processTicTacToeMove(room, socketId, moveData) {
    const { position } = moveData;
    const playerIndex = room.players.findIndex(p => p.socketId === socketId);
    
    if (playerIndex !== room.gameState.currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    if (room.gameState.board[position] !== null) {
      return { success: false, error: 'Position already taken' };
    }

    // Make move
    room.gameState.board[position] = playerIndex;
    
    // Check for winner
    const winner = this.checkTicTacToeWinner(room.gameState.board);
    if (winner !== null) {
      room.gameState.winner = winner;
      return { success: true, gameEnded: true, winner: room.players[winner] };
    }

    // Check for tie
    if (room.gameState.board.every(cell => cell !== null)) {
      return { success: true, gameEnded: true, winner: 'tie' };
    }

    // Next player's turn
    room.gameState.currentPlayer = (room.gameState.currentPlayer + 1) % room.players.length;
    
    return { success: true, gameEnded: false };
  }

  // Check Tic Tac Toe winner
  checkTicTacToeWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const [a, b, c] of lines) {
      if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  // Initialize UNO game
  initializeUNO(room) {
    const colors = ['red', 'yellow', 'green', 'blue'];
    const deck = [];

    // Create deck
    colors.forEach(color => {
      deck.push({ color, value: 0 }); // One 0 per color
      for (let i = 1; i <= 9; i++) {
        deck.push({ color, value: i });
        deck.push({ color, value: i }); // Two of each 1-9
      }
      // Special cards
      ['skip', 'reverse', '+2'].forEach(special => {
        deck.push({ color, value: special });
        deck.push({ color, value: special });
      });
    });

    // Wild cards
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value: 'wild' });
      deck.push({ color: 'wild', value: '+4' });
    }

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal cards
    const hands = room.players.map(() => deck.splice(0, 7));
    const discardPile = [deck.pop()];

    return {
      deck,
      hands,
      discardPile,
      currentPlayer: 0,
      direction: 1,
      gameMode: room.settings.gameMode || 'classic'
    };
  }

  // Process UNO move
  processUNOMove(room, socketId, moveData) {
    // UNO move logic would go here
    return { success: true, gameEnded: false };
  }

  // Initialize Poker game
  initializePoker(room) {
    // Poker initialization would go here
    return {
      pot: 0,
      communityCards: [],
      playerHands: [],
      currentBet: 0,
      dealer: 0
    };
  }

  // Process Poker move
  processPokerMove(room, socketId, moveData) {
    // Poker move logic would go here
    return { success: true, gameEnded: false };
  }

  // Initialize Go Fish game
  initializeGoFish(room) {
    const deck = [];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['♠', '♥', '♦', '♣'];

    // Create deck
    ranks.forEach(rank => {
      suits.forEach(suit => {
        deck.push({ rank, suit });
      });
    });

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal 7 cards to each player
    const hands = room.players.map(() => deck.splice(0, 7));

    return {
      deck,
      hands,
      currentPlayer: 0,
      books: room.players.map(() => [])
    };
  }

  // End game
  endGame(roomId, winner) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'finished';
    room.winner = winner;
    room.endedAt = Date.now();

    this.io.to(roomId).emit('game-end', {
      winner,
      gameState: room.gameState,
      duration: room.endedAt - room.startedAt
    });

    // Clean up room after 30 seconds
    setTimeout(() => {
      this.rooms.delete(roomId);
      room.players.forEach(p => this.players.delete(p.socketId));
    }, 30000);
  }

  // Chat message
  sendChatMessage(socketId, message) {
    const playerData = this.players.get(socketId);
    if (!playerData) return { success: false };

    const { roomId } = playerData;
    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    const chatMessage = {
      playerId: socketId,
      username: playerData.player.username,
      message: message.trim(),
      timestamp: Date.now()
    };

    room.chat.push(chatMessage);
    this.io.to(roomId).emit('chat-message', chatMessage);

    return { success: true };
  }

  // Add spectator
  addSpectator(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found' };

    room.spectators.add(socketId);
    this.io.sockets.sockets.get(socketId)?.join(roomId);

    this.io.to(roomId).emit('spectator-joined', { socketId });

    return { success: true, room: this.getRoomData(roomId) };
  }

  // Get room data for client
  getRoomData(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      gameType: room.gameType,
      players: room.players.map(p => ({
        username: p.username,
        avatar: p.avatar,
        coins: p.coins,
        ready: p.ready
      })),
      status: room.status,
      spectatorCount: room.spectators.size,
      settings: room.settings
    };
  }

  // Get all active rooms for a game type
  getRoomsList(gameType) {
    const rooms = [];
    for (const [roomId, room] of this.rooms) {
      if (room.gameType === gameType && room.status === 'waiting') {
        rooms.push(this.getRoomData(roomId));
      }
    }
    return rooms;
  }
}

module.exports = MultiplayerManager;
