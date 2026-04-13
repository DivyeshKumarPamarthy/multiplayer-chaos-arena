import { io } from 'socket.io-client';

// Use environment variables or default to localhost for development
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://chaos-arena-backend-krs7.onrender.com';

export const socket = io(SERVER_URL, {
  autoConnect: false // We will connect manually when the user joins a room
});
