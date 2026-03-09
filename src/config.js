require('dotenv').config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
  },
  rust: {
    serverIp: process.env.RUST_SERVER_IP,
    serverPort: process.env.RUST_SERVER_PORT,
    playerId: process.env.RUST_PLAYER_ID,
    playerToken: process.env.RUST_PLAYER_TOKEN,
  },
};
