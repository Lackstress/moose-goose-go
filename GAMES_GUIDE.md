# 🎮 Games Library

## Currently Available Games

### 🤑 Casino Games (Betting with Coins)

#### 1. **Blackjack 21** `/games/blackjack`
- **Type:** Card game vs Dealer
- **Betting:** Yes (minimum 10 coins)
- **How to Win:** Get closer to 21 than the dealer without busting
- **Features:** Hit, Stand, Double Down
- **Multiplier:** Win = +bet amount, Lose = -bet amount
- **Coins per game:** $10-$1000

#### 2. **Plinko** `/games/plinko`
- **Type:** Arcade/Physics
- **Betting:** Yes
- **How to Win:** Drop ball through pegs, land in high multiplier slots
- **Multipliers:** 0.5x to 100x
- **Features:** 15 different outcome slots
- **Strategy:** Risk-reward based on starting position

#### 3. **Coin Flip** `/games/coinflip`
- **Type:** 50/50 Game
- **Betting:** Yes
- **How to Win:** Pick Heads or Tails, get it right to DOUBLE your bet
- **Odds:** 50% win rate
- **Features:** Animated coin flip, instant results
- **Simple:** Easiest game, fastest games

#### 4. **Roulette** `/games/roulette`
- **Type:** Wheel spin game
- **Betting:** Yes (multiple bets per spin)
- **How to Win:** Predict where wheel lands (0-36)
- **Bet Types:** Red/Black, Even/Odd
- **Payouts:** 2x your bet if correct
- **Strategy:** Multiple bets on same spin

#### 5. **Crossy Road** `/games/crossy-road`
- **Type:** Dodge/Action game
- **Betting:** Yes
- **How to Win:** Cross roads avoiding cars, further = more coins
- **Distance Multiplier:** Every 10 units forward = 1.1x multiplier
- **Controls:** Arrow keys or A/D to move
- **Challenge:** Increasing difficulty as you progress

#### 6. **Poker** (Coming Soon) 📋
- **Type:** Card game vs CPU
- **Betting:** Yes
- **How to Win:** Get better hand than opponent
- **Hands:** High card to Royal Flush
- **Features:** 5-card poker, betting rounds

---

### 🧠 Brain/Skill Games (No Betting)

#### 1. **Snake** `/games/snake`
- **Type:** Classic arcade
- **Difficulty:** Easy / Normal / Hard (controls speed)
- **How to Win:** Eat food, grow longer, don't hit walls or yourself
- **Scoring:** 10 points per food eaten
- **Features:** 
  - 3 difficulty levels
  - High score tracking (localStorage)
  - Grid-based movement
  - Time display
- **Best For:** Quick sessions, building high scores

#### 2. **Memory Match** `/games/memory`
- **Type:** Puzzle/Memory
- **Difficulty:** Easy (4x4) / Normal (4x4) / Hard (6x6)
- **How to Win:** Match all pairs of emoji cards
- **Scoring:** Fewer moves = better
- **Features:**
  - Move counter
  - Time tracker
  - Difficulty modes
  - Smooth animations
- **Challenge:** Remember card positions while flipping

---

### 🤝 Multiplayer Games

#### 1. **Tic Tac Toe** `/games/tic-tac-toe`
- **Type:** Turn-based strategy
- **Players:** 2
- **Modes:**
  - 🎮 vs Computer AI (single player)
  - 👥 Online Multiplayer (find real opponents)
- **How to Win:** Get 3 in a row (horizontal, vertical, or diagonal)
- **Features:**
  - Real-time WebSocket multiplayer
  - AI difficulty (random moves)
  - Turn indicator
  - Win detection
  - Draw detection
- **Speed:** Usually 1-5 minutes per game

---

## 🎮 Games Architecture

### Casino Game Flow
```
1. Player places bet (coins deducted immediately)
2. Player plays game (may take 10s - 5 minutes)
3. Result is determined
4. Coins are awarded/subtracted based on multiplier
5. Result saved to database
```

### Brain Game Flow
```
1. Player starts game
2. Play at own pace
3. Submit/finish when done
4. High score saved locally (and DB if logged in)
5. No coins involved
```

### Multiplayer Game Flow
```
1. Player joins lobby for game
2. Wait for second player to join
3. Match starts (WebSocket connection)
4. Take turns making moves (real-time sync)
5. Someone wins/draw
6. Return to lobby (optional rematch)
```

---

## 💰 Coin System Details

### Earning Coins
| Game | Win Condition | Payout |
|------|---------------|--------|
| Blackjack | Beat dealer | +bet |
| Plinko | Land in slot | +multiplier × bet |
| Coin Flip | Correct choice | +bet (double) |
| Roulette | Correct bet | +bet |
| Crossy Road | Survive distance | +base × distance_multiplier |

### Betting Rules
- **Minimum:** 10 coins
- **Maximum:** Your available coins (or 1000 for new players)
- **Instant Deduction:** Bet taken immediately
- **Instant Credit:** Winnings added immediately
- **Transactions Logged:** All bets tracked in database

### Coin Management
- **Starting:** 1000 coins per account
- **Guest Mode:** 1000 coins (not saved)
- **Reset Button:** Back to 1000 (⚠️ wipes progress)
- **No Real Money:** 100% fake coins for fun
- **Unlimited Plays:** Never locked out, always reset button

---

## 🎯 Recommended Gaming Sessions

### Quick Session (5-10 min)
- **Snake** (Easy)
- **Coin Flip** (3-5 quick rounds)
- **Memory Match** (Easy)

### Medium Session (15-30 min)
- **Blackjack** (10-15 hands)
- **Tic Tac Toe** (vs AI, 5-10 games)
- **Plinko** (5-10 drops)

### Long Session (30+ min)
- **Crossy Road** (keep pushing distance)
- **Memory Match** (Hard mode)
- **Roulette** (patient betting strategy)
- **Multiplayer Tic Tac Toe** (tournament)

---

## 🏆 Winning Strategies

### Blackjack
- Stand on 17+
- Always split Aces and 8s
- Never split 10s or 5s
- Take insurance rarely

### Plinko
- Higher multipliers on sides (risky)
- Center drops more predictable
- Average 1-2x return

### Coin Flip
- 50/50 odds - pure luck
- Best for quick doubles
- Bet small, play many times

### Roulette
- Even money bets = safe
- Single number = risky
- Combine multiple bet types

### Crossy Road
- Dodge traffic timing
- Don't rush - go steady
- Longer distance = higher payout

### Tic Tac Toe
- Control center (5)
- Block opponent's winning moves
- Create double threats

---

## 📊 Game Statistics

### Games by Type
- **Arcade Games:** 1 (Snake)
- **Casino Games:** 5 (Blackjack, Plinko, Coin Flip, Roulette, Crossy Road)
- **Puzzle Games:** 1 (Memory Match)
- **Multiplayer Games:** 1 (Tic Tac Toe)

### Playtime by Game
| Game | Avg Playtime | Max Playtime |
|------|-------------|------------|
| Coin Flip | 30 sec | 2 min |
| Tic Tac Toe | 2 min | 10 min |
| Blackjack | 1-2 min | 10 min |
| Snake | 2-5 min | ∞ |
| Memory | 2-5 min | 15 min |
| Plinko | 30 sec | 2 min |
| Roulette | 1-3 min | ∞ |
| Crossy Road | 2-5 min | ∞ |

---

## 🔜 Games Coming Soon

1. **Poker** - 5-card poker vs AI/players
2. **Go Fish** - Multiplayer card game
3. **UNO** - Card game with variations
4. **Flappy Bird** - Classic clone
5. **2048** - Puzzle game
6. **[Your suggestions!]** - What would you like to see?

---

## 🎮 How to Access

### From Home Page
- All games shown in grid on main page
- Click game card to start
- Click "Back to Lobby" to return

### Direct URL
```
http://localhost:3000/games/[game-name]

Examples:
http://localhost:3000/games/snake
http://localhost:3000/games/blackjack
http://localhost:3000/games/tic-tac-toe
```

---

## 💡 Game Tips

### General Tips
- ✅ Login to save progress
- ✅ Use guest mode to try before committing
- ✅ Reset coins if you lose them all
- ✅ Use small bets to learn games
- ✅ High scores are tracked locally

### Casino Tips
- 🎰 Start with low bets
- 🎰 Plinko has 0.5x multipliers (risky!)
- 🎰 Coin Flip is 50/50 - pure luck
- 🎰 Roulette bets are independent
- 🎰 Blackjack has best odds if you play well

### Multiplayer Tips
- 👥 Tic Tac Toe vs AI for practice
- 👥 Online matches can take 5-10 min
- 👥 Strategy matters more than luck
- 👥 You can rematch same opponent

---

## 🚀 Have Fun!

Pick a game and start playing now! All games are ready to go at:

**http://localhost:3000**

Enjoy! 🎉
