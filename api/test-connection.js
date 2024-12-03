const express = require('express');
const router = express.Router();
const WalletModel = require('../models/Wallet');

router.get('/test-connection/:telegramId', async (req, res) => {
  try {
    const userDoc = await WalletModel.findOne({ 
      userId: req.params.telegramId 
    });

    if (!userDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'No wallet found' 
      });
    }

    const activeWallet = userDoc.wallets[userDoc.activeWalletIndex];
    
    res.json({
      success: true,
      wallet: {
        address: activeWallet.address,
        balance: activeWallet.balance,
        name: activeWallet.name
      }
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router; 