<template>
  <div class="glass-panel lobby-panel">
    <h1>Multiplayer Chaos</h1>
    <p class="subtitle">Join the arena. Push your friends. Survive.</p>

    <div class="error-msg" v-if="error">{{ error }}</div>

    <form @submit.prevent="joinRoom" class="lobby-form">
      <div class="input-group">
        <label class="input-label">Username</label>
        <input 
          v-model="username" 
          type="text" 
          class="input-field" 
          placeholder="Enter a cool name..."
          required
          maxlength="15"
        />
      </div>
      
      <div class="input-group">
        <label class="input-label">Room Code</label>
        <input 
          v-model="roomId" 
          type="text" 
          class="input-field" 
          placeholder="e.g. ROOM-123"
          required
          pattern="[A-Za-z0-9-]+"
          title="Alphanumeric and dashes only"
        />
      </div>

      <button type="submit" class="btn btn-block">Enter Arena</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  error: String
});

const emit = defineEmits(['joinRoom']);

const username = ref('');
const roomId = ref(Math.random().toString(36).substring(2, 8).toUpperCase()); // Random default room

const joinRoom = () => {
  if (username.value.trim() && roomId.value.trim()) {
    emit('joinRoom', {
      username: username.value.trim(),
      roomId: roomId.value.trim()
    });
  }
};
</script>

<style scoped>
.lobby-panel {
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.lobby-form {
  margin-top: 2rem;
  text-align: left;
}

.btn-block {
  width: 100%;
  margin-top: 1rem;
  padding: 1rem;
  font-size: 1.1rem;
  letter-spacing: 1px;
}

.error-msg {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
</style>
