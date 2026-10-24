// Loopback-only recording of the real app. Recorder uses only static replay and labeled simulations.
import app from '../src/index.js';
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address === 'object') process.send?.({ url: `http://127.0.0.1:${address.port}` });
});
process.on('SIGTERM', () => server.close(() => process.exit()));
