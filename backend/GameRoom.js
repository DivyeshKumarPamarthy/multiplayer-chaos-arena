const GAME_TICK = 1000 / 60; // 60 FPS
const MAP_SIZE = 800; // pixels
const PLAYER_RADIUS = 20;

let entityIdCounter = 0;

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.state = 'LOBBY'; 
    this.players = {};
    this.winner = null;
    this.loopInterval = null;
    this.countdown = 0;

    this.weapons = [];
    this.projectiles = [];
    this.meleeHitboxes = [];
    this.weaponSpawnTimer = 0;
  }

  addPlayer(id, username) {
    const colors = ['#FF3366', '#33CCFF', '#00FF99', '#FFFF33', '#CC33FF', '#FF9933'];
    const color = colors[Object.keys(this.players).length % colors.length];

    this.players[id] = {
      id,
      username,
      x: MAP_SIZE / 2 + (Math.random() - 0.5) * 100,
      y: MAP_SIZE / 2 + (Math.random() - 0.5) * 100,
      angle: Math.random() * Math.PI * 2, // Random starting direction
      color,
      isAlive: true,
      lives: 10,
      weapon: 'unarmed',
      attackCooldown: 0,
      input: { up: false, down: false, left: false, right: false, attack: false }
    };
  }

  removePlayer(id) {
    delete this.players[id];
    this.checkWinCondition();
  }

  handleInput(id, input) {
    if (this.players[id] && this.players[id].isAlive) {
      this.players[id].input = input;
    }
  }

  startGame() {
    if (this.state !== 'LOBBY') return;
    this.state = 'COUNTDOWN';
    this.countdown = 3;
    
    this.io.to(this.roomId).emit('roomState', this.getState());

    const countdownInterval = setInterval(() => {
      this.countdown -= 1;
      this.io.to(this.roomId).emit('roomState', this.getState());

      if (this.countdown <= 0) {
        clearInterval(countdownInterval);
        this.state = 'PLAYING';
        this.resetPositions();
        this.startLoop();
      }
    }, 1000);
  }

  resetPositions() {
    Object.values(this.players).forEach(p => {
       p.isAlive = true;
       p.lives = 10;
       p.weapon = 'unarmed';
       p.x = MAP_SIZE / 2 + (Math.random() - 0.5) * 200;
       p.y = MAP_SIZE / 2 + (Math.random() - 0.5) * 200;
       p.angle = Math.random() * Math.PI * 2;
       p.attackCooldown = 0;
    });
    this.weapons = [];
    this.projectiles = [];
    this.meleeHitboxes = [];
    this.weaponSpawnTimer = 0;
  }

  startLoop() {
    this.io.to(this.roomId).emit('roomState', this.getState());
    
    this.loopInterval = setInterval(() => {
      this.updatePhysics();
      this.io.to(this.roomId).emit('gameState', this.getGameState());
    }, GAME_TICK);
  }

  updatePhysics() {
    const alivePlayers = Object.values(this.players).filter(p => p.isAlive);
    const ISLAND_RADIUS = MAP_SIZE / 2 - 20;

    // 1. Move players (Continuous Velocity + Steering)
    // Speed is inversely proportional to number of players. Base speed block.
    // e.g. 1 player = 10, 5 players = 6.
    const speed = Math.max(4, 11 - alivePlayers.length * 1.5);
    const turnSpeed = 0.08;

    alivePlayers.forEach(p => {
      // 1. Absolute Steering
      let targetAngle = p.angle;
      let isSteering = false;

      let dx = 0;
      let dy = 0;
      
      if (p.input.joystickDx !== undefined && p.input.joystickDx !== null) {
         dx = p.input.joystickDx;
         dy = p.input.joystickDy;
      } else {
         if (p.input.left) dx -= 1;
         if (p.input.right) dx += 1;
         if (p.input.up) dy -= 1;
         if (p.input.down) dy += 1;
      }

      if (dx !== 0 || dy !== 0) {
         targetAngle = Math.atan2(dy, dx);
         isSteering = true;
      }

      if (isSteering) {
         let diff = targetAngle - p.angle;
         
         while (diff < -Math.PI) diff += Math.PI * 2;
         while (diff > Math.PI) diff -= Math.PI * 2;

         if (Math.abs(diff) < turnSpeed) {
            p.angle = targetAngle;
         } else {
            p.angle += Math.sign(diff) * turnSpeed;
         }
      }

      // Move forward constantly
      p.x += Math.cos(p.angle) * speed;
      p.y += Math.sin(p.angle) * speed;
      
      // Decrease cooldown
      if (p.attackCooldown > 0) p.attackCooldown--;
    });

    // 2. Collision (Player-Player Bumping)
    for (let i = 0; i < alivePlayers.length; i++) {
      for (let j = i + 1; j < alivePlayers.length; j++) {
        const p1 = alivePlayers[i];
        const p2 = alivePlayers[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PLAYER_RADIUS * 2) {
          const overlap = (PLAYER_RADIUS * 2) - dist;
          const nx = dx / dist; 
          const ny = dy / dist;

          // Push strictly outta boundaries so they don't clip through
          p1.x -= nx * (overlap / 2);
          p1.y -= ny * (overlap / 2);
          p2.x += nx * (overlap / 2);
          p2.y += ny * (overlap / 2);

          // Deflect angles slightly like bumper cars
          p1.angle += Math.PI / 4; 
          p2.angle -= Math.PI / 4;
        }
      }
    }

    // 3. Circle Boundary Perfect Reflection
    alivePlayers.forEach(p => {
      const dxCenter = p.x - MAP_SIZE / 2;
      const dyCenter = p.y - MAP_SIZE / 2;
      const distToCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
      
      if (distToCenter > ISLAND_RADIUS - PLAYER_RADIUS) {
         // Normal vector points inwards towards the center
         const nx = -dxCenter / distToCenter;
         const ny = -dyCenter / distToCenter;
         
         const vx = Math.cos(p.angle);
         const vy = Math.sin(p.angle);
         
         // Vector Reflection formula: V - 2(V dot N)N
         const dot = vx * nx + vy * ny;
         const reflectX = vx - 2 * dot * nx;
         const reflectY = vy - 2 * dot * ny;
         
         p.angle = Math.atan2(reflectY, reflectX);
         
         // Snap position completely back inside to avoid sticking
         const overlap = distToCenter - (ISLAND_RADIUS - PLAYER_RADIUS);
         p.x += nx * overlap * 1.5; // push a little extra
         p.y += ny * overlap * 1.5;
      }
    });

    // 4. Weapon Spawns ("Boxes" like Smash Karts!)
    this.weaponSpawnTimer++;
    if (this.weaponSpawnTimer > 60 * 4) { // every 4 seconds
       this.weaponSpawnTimer = 0;
       if (this.weapons.length < 6) { 
          // Drop a mystery box
          const spawnDist = Math.random() * (ISLAND_RADIUS - 50);
          const spawnAngle = Math.random() * Math.PI * 2;
          
          this.weapons.push({
             id: entityIdCounter++,
             type: 'box', // mystery box!
             x: MAP_SIZE / 2 + Math.cos(spawnAngle) * spawnDist,
             y: MAP_SIZE / 2 + Math.sin(spawnAngle) * spawnDist,
             spawnScale: 0 // Used for popup anim on client maybe
          });
       }
    }

    // 5. Weapon Pickup (Smash Karts style: gives random weapon)
    alivePlayers.forEach(p => {
       for (let i = this.weapons.length - 1; i >= 0; i--) {
          const w = this.weapons[i];
          const dist = Math.sqrt(Math.pow(w.x - p.x, 2) + Math.pow(w.y - p.y, 2));
          if (dist < PLAYER_RADIUS + 15) { 
             const available = ['sword', 'gun', 'sniper', 'machine_gun'];
             p.weapon = available[Math.floor(Math.random() * available.length)];
             this.weapons.splice(i, 1);
          }
       }
    });

    // 6. Player Attacks (Tap / Click / Spacebar target)
    alivePlayers.forEach(p => {
       if (p.input.attack && p.attackCooldown <= 0) {
          const angle = p.angle; // Note: using movement angle, not cursor angle anymore!
          
          if (p.weapon === 'unarmed') {
             p.attackCooldown = 30; // 0.5 sec
             this.meleeHitboxes.push({
                id: entityIdCounter++,
                ownerId: p.id,
                x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 15),
                y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 15),
                radius: 15,
                duration: 5,
                hitPlayers: []
             });
          } else if (p.weapon === 'sword') {
             p.attackCooldown = 35; 
             this.meleeHitboxes.push({
                id: entityIdCounter++,
                ownerId: p.id,
                x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 25),
                y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 25),
                radius: 35,
                duration: 8,
                hitPlayers: []
             });
          } else if (p.weapon === 'gun') {
             p.attackCooldown = 20; // fast fire
             this.projectiles.push({
                id: entityIdCounter++,
                ownerId: p.id,
                x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 10),
                y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 10),
                vx: Math.cos(angle) * (speed + 8),
                vy: Math.sin(angle) * (speed + 8),
                radius: 14,
                life: 90 
             });
          } else if (p.weapon === 'machine_gun') {
             p.attackCooldown = 30; // 3-round burst spread
             const angles = [angle - 0.15, angle, angle + 0.15];
             angles.forEach(a => {
               this.projectiles.push({
                  id: entityIdCounter++,
                  ownerId: p.id,
                  x: p.x + Math.cos(a) * (PLAYER_RADIUS + 10),
                  y: p.y + Math.sin(a) * (PLAYER_RADIUS + 10),
                  vx: Math.cos(a) * (speed + 12),
                  vy: Math.sin(a) * (speed + 12),
                  radius: 10,
                  life: 60 
               });
             });
          } else if (p.weapon === 'sniper') {
             p.attackCooldown = 60; // slow fire
             this.projectiles.push({
                id: entityIdCounter++,
                ownerId: p.id,
                x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 10),
                y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 10),
                vx: Math.cos(angle) * 25,
                vy: Math.sin(angle) * 25,
                radius: 8,
                life: 60 
             });
          }
       }
    });

    // 7. Process Hitboxes
    for (let i = this.meleeHitboxes.length - 1; i >= 0; i--) {
       const box = this.meleeHitboxes[i];
       
       box.duration--;
       // Move with player slightly
       const owner = this.players[box.ownerId];
       if (owner && owner.isAlive) {
          box.x = owner.x + Math.cos(owner.angle) * box.radius;
          box.y = owner.y + Math.sin(owner.angle) * box.radius;
       }
       
       alivePlayers.forEach(p => {
          if (p.id !== box.ownerId && !box.hitPlayers.includes(p.id)) {
             const dist = Math.sqrt(Math.pow(p.x - box.x, 2) + Math.pow(p.y - box.y, 2));
             if (dist < PLAYER_RADIUS + box.radius) {
                box.hitPlayers.push(p.id);
                this.takeDamage(p, box.x, box.y);
             }
          }
       });

       if (box.duration <= 0) {
          this.meleeHitboxes.splice(i, 1);
       }
    }

    // 8. Process Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
       const proj = this.projectiles[i];
       proj.x += proj.vx;
       proj.y += proj.vy;
       proj.life--;

       let destroyed = false;
       const distToCenter = Math.sqrt(Math.pow(proj.x - MAP_SIZE/2, 2) + Math.pow(proj.y - MAP_SIZE/2, 2));
       if (distToCenter > ISLAND_RADIUS) destroyed = true; // bullets don't reflect

       if (!destroyed) {
          alivePlayers.forEach(p => {
             if (p.id !== proj.ownerId) {
                const dist = Math.sqrt(Math.pow(p.x - proj.x, 2) + Math.pow(p.y - proj.y, 2));
                if (dist < PLAYER_RADIUS + proj.radius + 3) {
                   destroyed = true;
                   this.takeDamage(p, proj.x, proj.y);
                }
             }
          });
       }

       if (destroyed || proj.life <= 0) {
          this.projectiles.splice(i, 1);
       }
    }
  }

  takeDamage(player, originX, originY) {
      player.lives -= 1;

      // Knockback / Deflection instead of force
      player.angle += Math.PI; // completely turns them around if hit!

      if (player.lives <= 0) {
         player.lives = 0;
         player.isAlive = false;
         this.checkWinCondition();
      }
  }

  checkWinCondition() {
    if (this.state !== 'PLAYING') return;
    const alivePlayers = Object.values(this.players).filter(p => p.isAlive);
    const totalPlayers = Object.keys(this.players).length;
    
    if (totalPlayers >= 1 && alivePlayers.length <= (totalPlayers > 1 ? 1 : 0)) {
      this.endGame(alivePlayers);
    }
  }
  
  endGame(alivePlayers) {
      this.state = 'GAMEOVER';
      this.winner = alivePlayers.length === 1 ? alivePlayers[0].username : 'No one';
      clearInterval(this.loopInterval);
      this.io.to(this.roomId).emit('roomState', this.getState());
      
      setTimeout(() => {
        if (this.state === 'GAMEOVER') {
          this.state = 'LOBBY';
          this.winner = null;
          this.io.to(this.roomId).emit('roomState', this.getState());
        }
      }, 5000);
  }

  getState() {
    return {
      state: this.state,
      players: this.players,
      countdown: this.countdown,
      winner: this.winner,
      mapSize: MAP_SIZE,
      playerRadius: PLAYER_RADIUS
    };
  }

  getGameState() {
    return {
      players: this.players,
      weapons: this.weapons,
      projectiles: this.projectiles,
      meleeHitboxes: this.meleeHitboxes
    };
  }
}

module.exports = GameRoom;
