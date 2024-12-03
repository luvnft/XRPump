const express = require('express');
const router = express.Router();
const WalletModel = require('../models/Wallet');

router.get('/:telegramId', async (req, res) => {
  try {
    const userDoc = await WalletModel.findOne({ 
      userId: req.params.telegramId 
    });

    if (!userDoc) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const activeWallet = userDoc.wallets[userDoc.activeWalletIndex];
    
    res.json({
      address: activeWallet.address,
      balance: activeWallet.balance,
      name: activeWallet.name
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add endpoint for token creation
router.post('/:telegramId/create-token', async (req, res) => {
  try {
    const userDoc = await WalletModel.findOne({ 
      userId: req.params.telegramId 
    });

    if (!userDoc) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const activeWallet = userDoc.wallets[userDoc.activeWalletIndex];
    const { seed } = userDoc.decryptData(activeWallet.encryptedSeed);

    // Create token using the wallet
    // ... token creation logic

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating token:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 