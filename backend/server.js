const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const GameRoom = require('./GameRoom');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 3000;

// Simple room management
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, username }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = new GameRoom(roomId, io);
    }
    
    const room = rooms[roomId];
    if (room.state === 'PLAYING') {
      socket.emit('errorMsg', 'Game already in progress');
      return;
    }

    socket.join(roomId);
    room.addPlayer(socket.id, username);

    // Notify others
    io.to(roomId).emit('roomState', room.getState());

    // Listen for events
    socket.on('playerInput', (input) => {
      if (rooms[roomId]) {
        rooms[roomId].handleInput(socket.id, input);
      }
    });

    socket.on('startGame', () => {
      if (rooms[roomId] && rooms[roomId].players[socket.id]) {
         rooms[roomId].startGame();
      }
    });
    
    socket.on('leaveRoom', () => {
        socket.leave(roomId);
        if (rooms[roomId]) {
            rooms[roomId].removePlayer(socket.id);
            io.to(roomId).emit('roomState', rooms[roomId].getState());
            if (Object.keys(rooms[roomId].players).length === 0) {
              if (rooms[roomId].loopInterval) clearInterval(rooms[roomId].loopInterval);
              delete rooms[roomId];
            }
        }
    });

    socket.on('disconnect', () => {
      if (rooms[roomId]) {
        rooms[roomId].removePlayer(socket.id);
        io.to(roomId).emit('roomState', rooms[roomId].getState());
        if (Object.keys(rooms[roomId].players).length === 0) {
          if (rooms[roomId].loopInterval) clearInterval(rooms[roomId].loopInterval);
          delete rooms[roomId];
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
