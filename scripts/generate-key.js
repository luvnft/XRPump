const crypto = require('crypto');

// Generate a random 32-byte (256-bit) key
const key = crypto.randomBytes(32).toString('hex');
console.log('Your encryption key:', key); 