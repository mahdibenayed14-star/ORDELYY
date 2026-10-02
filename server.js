import 'dotenv/config';
import { createOrdelyServer } from './src/server.js';
const port = Number(process.env.PORT || 10000);
const { server } = createOrdelyServer();
server.listen(port, '0.0.0.0', () => {
  console.log(`Ordely V10 : http://localhost:${port}`);
  console.log('Téléphone : publiez public/ sur GitHub Pages (HTTPS). Ne pas utiliser une IP locale HTTP pour le micro.');
});
function shutdown() { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
