import { io } from 'socket.io-client';

// Use environment variables or default to localhost for development
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export const socket = io(SERVER_URL, {
  autoConnect: false // We will connect manually when the user joins a room
});
