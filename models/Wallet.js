const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config/config');

const WalletSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  wallets: [{
    address: String,
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

// Updated encryption methods with better error handling
WalletSchema.methods.encryptData = function(data) {
  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(config.encryptionKey, 'hex');
    
    if (key.length !== 32) {
      throw new Error('Invalid encryption key length');
    }

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag: authTag.toString('hex')
    });
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

WalletSchema.methods.decryptData = function(encryptedJson) {
  try {
    const { iv, encryptedData, authTag } = JSON.parse(encryptedJson);
    const key = Buffer.from(config.encryptionKey, 'hex');
    
    if (key.length !== 32) {
      throw new Error('Invalid encryption key length');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

module.exports = mongoose.model('Wallet', WalletSchema); 