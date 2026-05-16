import app from './app';
import { env } from './config/env';
console.log('Starting debug server on', env.PORT);
const server = app.listen(env.PORT, () => {
  console.log('Server is listening');
});
server.on('error', (err) => console.error('Server error:', err));
server.on('close', () => console.log('Server closed'));
console.log('After listen call');

// Keep process alive
setInterval(() => {
  console.log('Heartbeat...');
}, 5000);
