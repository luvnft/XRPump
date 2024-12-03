require('dotenv').config();

module.exports = {
  encryptionKey: process.env.ENCRYPTION_KEY || 'd7a8f3b2e1c9d8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3',
  botToken: process.env.BOT_TOKEN,
  mongoUri: process.env.MONGO_URI,
  webappUrl: process.env.REACT_APP_WEBAPP_URL,
  xrplNetwork: process.env.REACT_APP_XRPL_NETWORK || 'wss://xrplcluster.com',
  xamanApiKey: process.env.REACT_APP_XAMAN_API_KEY,
  xamanApiSecret: process.env.REACT_APP_XAMAN_API_SECRET
}; 