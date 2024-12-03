const mongoose = require('mongoose');
const crypto = require('crypto');

const WalletSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  wallets: [{
    address: String,
    // Encrypt sensitive data
    encryptedSeed: String,
    encryptedPrivateKey: String,
    publicKey: String,
    name: String,
    balance: {
      type: String,
      default: '0'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeWalletIndex: {
    type: Number,
    default: 0
  }
});

// Add encryption methods
WalletSchema.methods.encryptData = function(data) {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

WalletSchema.methods.decryptData = function(encryptedData) {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = mongoose.model('Wallet', WalletSchema); 