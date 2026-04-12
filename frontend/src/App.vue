<template>
  <div class="app-container">
    <Lobby 
      v-if="!gameState" 
      @joinRoom="onJoinRoom" 
      :error="errorMsg"
    />
    
    <div v-else class="glass-panel game-panel">
      <!-- Header for Lobby / Countdown mode -->
      <div class="game-header">
        <h2>Room: {{ currentRoom }}</h2>
        <div v-if="gameState.state === 'LOBBY'" class="controls">
          <p>Waiting for players... ({{ Object.keys(gameState.players).length }})</p>
          <button class="btn btn-accent" @click="startGame">Start Game</button>
        </div>
        <div v-else-if="gameState.state === 'COUNTDOWN'" class="countdown">
           Game starting in: <span>{{ gameState.countdown }}</span>
        </div>
        <div v-else-if="gameState.state === 'PLAYING'" class="status">
           <span class="hearts-display">
              <span v-for="n in (gameState.players[socket.id]?.lives || 0)" :key="n" class="heart">❤️</span>
           </span>
           <span class="alive-counter">(Alive: {{ aliveCount }})</span>
        </div>
        <div v-else-if="gameState.state === 'GAMEOVER'" class="status gameover-text">
           Winner: {{ gameState.winner }}
        </div>
        <button class="btn leave-btn" @click="leaveRoom">Leave</button>
      </div>

      <div v-if="gameState.state === 'PLAYING'" class="player-hud">
         <div class="hud-username">
            <span class="hud-label">Player:</span>
            <span class="hud-value">{{ gameState.players[socket.id]?.username }}</span>
         </div>
         <div class="hud-weapon">
            <span class="hud-label">Weapon:</span>
            <span class="hud-value" :class="gameState.players[socket.id]?.weapon">{{ gameState.players[socket.id]?.weapon?.toUpperCase() || 'UNARMED' }}</span>
         </div>
      </div>
      
      <!-- The Canvas Component -->
      <GameCanvas 
        class="canvas-area"
        v-if="gameState.state === 'PLAYING' || gameState.state === 'GAMEOVER'"
        :gameState="gameState" 
        :socket="socket" 
      />

      <!-- Pre-Game Visualization area (Lobby Preview) -->
      <div v-if="gameState.state === 'LOBBY' || gameState.state === 'COUNTDOWN'" class="lobby-players">
         <div v-for="player in gameState.players" :key="player.id" class="player-avatar" :style="{ backgroundColor: player.color }">
            {{ player.username.substring(0, 2).toUpperCase() }}
         </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { socket } from './socket';
import Lobby from './components/Lobby.vue';
import GameCanvas from './components/GameCanvas.vue';

const gameState = ref(null);
const currentRoom = ref('');
const errorMsg = ref('');

const aliveCount = computed(() => {
  if (!gameState.value || !gameState.value.players) return 0;
  return Object.values(gameState.value.players).filter(p => p.isAlive).length;
});

const onJoinRoom = ({ username, roomId }) => {
  errorMsg.value = '';
  currentRoom.value = roomId;
  
  socket.connect();
  socket.emit('joinRoom', { username, roomId });
};

const startGame = () => {
  socket.emit('startGame');
};

const leaveRoom = () => {
  socket.emit('leaveRoom');
  socket.disconnect();
  gameState.value = null;
  currentRoom.value = '';
};

onMounted(() => {
  socket.on('roomState', (state) => {
    // When the room state updates entirely (Lobby, Countdown, Gameover)
    if (!gameState.value) {
      gameState.value = state;
    } else {
      // Merge only structural things if playing, else replace
      gameState.value.state = state.state;
      gameState.value.countdown = state.countdown;
      gameState.value.winner = state.winner;
      if (state.state !== 'PLAYING') {
         gameState.value.players = state.players;
      }
    }
  });

  socket.on('gameState', (state) => {
    // 60fps tick update to player positions and physics arrays
    if (gameState.value) {
      gameState.value.players = state.players;
      gameState.value.weapons = state.weapons;
      gameState.value.projectiles = state.projectiles;
      gameState.value.meleeHitboxes = state.meleeHitboxes;
    }
  });

  socket.on('errorMsg', (msg) => {
     errorMsg.value = msg;
     socket.disconnect();
  });
});

onUnmounted(() => {
  socket.disconnect();
});
</script>

<style scoped>
.game-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 900px;
  width: 90%;
  aspect-ratio: auto;
}
.game-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.controls, .countdown, .status {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 600;
}
.countdown span {
  font-size: 1.5rem;
  color: var(--accent-color);
  font-weight: bold;
}
.leave-btn {
  background: transparent;
  border: 1px solid var(--glass-border);
}
.leave-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.lobby-players {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  width: 100%;
  min-height: 200px;
}
.player-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 1.2rem;
  color: #111;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  animation: popIn 0.3s ease-out;
}

.gameover-text {
  color: #fca5a5;
  text-shadow: 0 0 10px rgba(248, 113, 113, 0.8);
  font-size: 1.5rem;
}

@keyframes popIn {
  0% { transform: scale(0); opacity: 0; }
  80% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.canvas-area {
  width: 100%;
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}

.hearts-display {
  display: flex;
  gap: 4px;
}
.heart {
  font-size: 1.2rem;
  animation: pulseBeat 1s infinite alternate;
}
.alive-counter {
  font-size: 0.85rem;
  opacity: 0.8;
  margin-left: 10px;
}
@keyframes pulseBeat {
  0% { transform: scale(1); }
  100% { transform: scale(1.15); }
}

.player-hud {
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  border: 1px solid var(--glass-border);
}
.hud-label {
  color: #94a3b8;
  margin-right: 0.5rem;
  font-size: 0.9rem;
}
.hud-value {
  font-weight: bold;
  font-size: 1rem;
  color: #f8fafc;
}
.hud-value.sword { color: #cbd5e1; }
.hud-value.gun { color: #ef4444; }
.hud-value.sniper { color: #10b981; }
</style>
