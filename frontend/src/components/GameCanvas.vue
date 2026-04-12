<template>
  <div class="canvas-container">
    <canvas 
      ref="gameCanvas" 
      width="800" 
      height="800"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @contextmenu.prevent="handleRightClick"
      @touchstart.prevent="handleTouchStart"
      @touchend.prevent="handleTouchEnd"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  gameState: Object,
  socket: Object
});

const gameCanvas = ref(null);
let animationFrameId = null;

const MAP_SIZE = 800; 

const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
  Space: false
};

const inputState = {
  isAttacking: false
};

const updateInput = () => {
  if (!props.socket) return;
  props.socket.emit('playerInput', {
    up: keys.w || keys.ArrowUp,
    down: keys.s || keys.ArrowDown,
    left: keys.a || keys.ArrowLeft,
    right: keys.d || keys.ArrowRight,
    attack: inputState.isAttacking || keys.Space
  });
};

const handleKeyDown = (e) => {
  if (e.code === 'Space') keys.Space = true;
  if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
  updateInput();
};

const handleKeyUp = (e) => {
  if (e.code === 'Space') keys.Space = false;
  if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
  updateInput();
};

const handleRightClick = (e) => {
  // Just prevent default so they don't open the browser context menu.
  // The mousedown handles the attack invocation.
};

const handleMouseDown = (e) => {
  // Allow right click (button 2) or left click (button 0)
  inputState.isAttacking = true;
  updateInput();
};

const handleMouseUp = (e) => {
  inputState.isAttacking = false;
  updateInput();
};

const handleTouchStart = (e) => {
  inputState.isAttacking = true;
  updateInput();
};

const handleTouchEnd = (e) => {
  inputState.isAttacking = false;
  updateInput();
};

const draw = () => {
  if (!gameCanvas.value) return;
  const ctx = gameCanvas.value.getContext('2d');
  
  ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

  if (!props.gameState) {
    animationFrameId = requestAnimationFrame(draw);
    return;
  }

  // Draw Background Pattern
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  
  // Boundary Floor
  const ISLAND_RADIUS = MAP_SIZE / 2 - 20;
  ctx.beginPath();
  ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, ISLAND_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b'; 
  ctx.fill();
  
  // Outer boundary wall
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();

  // Draw Mystery Boxes (Weapons) with popup scale animation
  if (props.gameState.weapons) {
    // Pulse ratio between 0.8 and 1.2
    const pulse = 1 + Math.sin(Date.now() / 150) * 0.2; 
    
    props.gameState.weapons.forEach(w => {
       ctx.save();
       ctx.translate(w.x, w.y);
       ctx.scale(pulse, pulse);
       
       // Glowing Mystery Box
       ctx.shadowColor = '#fbbf24';
       ctx.shadowBlur = 15;
       
       ctx.fillStyle = '#fbbf24';
       ctx.beginPath();
       ctx.roundRect(-12, -12, 24, 24, 4);
       ctx.fill();
       
       ctx.fillStyle = '#000';
       ctx.font = 'bold 16px Inter';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       ctx.fillText('?', 0, 1);

       ctx.restore();
    });
  }

  // Draw Players
  if (props.gameState.players) {
    Object.values(props.gameState.players).forEach(p => {
      if (!p.isAlive) return;

      ctx.save();
      ctx.translate(p.x, p.y);

      // Body
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Draw Steering Direction Triangle
      ctx.rotate(p.angle || 0);
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(24, 0);
      ctx.lineTo(8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // UI
      ctx.fillStyle = 'white';
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(p.username, p.x, p.y - 45);
      
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 12px Inter';
      ctx.fillText(`Lives: ${p.lives}`, p.x, p.y - 30);
      
      if (p.weapon !== 'unarmed') {
         ctx.fillStyle = '#a78bfa';
         ctx.font = '11px Inter';
         ctx.fillText(p.weapon.toUpperCase(), p.x, p.y + 35);
      }
      
      if (p.id === props.socket.id) {
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y - 70);
        ctx.lineTo(p.x + 5, p.y - 70);
        ctx.lineTo(p.x, p.y - 65);
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
      }
    });
  }

  // Draw Projectiles
  if (props.gameState.projectiles) {
    props.gameState.projectiles.forEach(proj => {
       ctx.beginPath();
       ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
       ctx.fillStyle = '#f43f5e';
       ctx.fill();
    });
  }

  // Draw Hitboxes
  if (props.gameState.meleeHitboxes) {
    props.gameState.meleeHitboxes.forEach(box => {
       ctx.beginPath();
       ctx.arc(box.x, box.y, box.radius, 0, Math.PI * 2);
       ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
       ctx.fill();
    });
  }

  animationFrameId = requestAnimationFrame(draw);
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  draw();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<style scoped>
.canvas-container {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  background: #0f172a;
  max-width: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
  touch-action: none; /* Helps prevent mobile scrolling when tapping */
}

canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
