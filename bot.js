const TelegramBot = require('node-telegram-bot-api');
const { Client, Wallet: XRPLWallet } = require('xrpl');
const crypto = require('crypto');
const config = require('./config/config');
const WalletModel = require('./models/Wallet');
const connectDB = require('./config/database');
const express = require('express');
const app = express();
const port = 5000;

// Add before bot initialization
app.use(express.json());

// Add a basic route for the root URL
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'XRPump API is running',
    version: '1.0.0',
    endpoints: [
      '/api/telegram-wallet/:telegramId',
      '/api/telegram-wallet/:telegramId/create-token'
    ]
  });
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Add your API endpoints
app.get('/api/telegram-wallet/:telegramId', async (req, res) => {
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
    
    // Return only public info
    res.json({
      success: true,
      wallet: {
        address: activeWallet.address,
        balance: activeWallet.balance,
        name: activeWallet.name
      }
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

app.post('/api/telegram-wallet/:telegramId/create-token', async (req, res) => {
  try {
    const userDoc = await WalletModel.findOne({ 
      userId: req.params.telegramId 
    });

    if (!userDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }

    const activeWallet = userDoc.wallets[userDoc.activeWalletIndex];
    const seed = userDoc.decryptData(activeWallet.encryptedSeed);

    // Create token using XRPL
    const wallet = XRPLWallet.fromSeed(seed);
    const tokenData = req.body;

    // Create token transaction
    const tx = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: "rrrrrrrrrrrrrrrrrrrrrhoLvTp", // Burn address
      Amount: "2000000", // 2 XRP in drops
      Memos: [{
        Memo: {
          MemoType: Buffer.from("Token Creation", "utf8").toString("hex"),
          MemoData: Buffer.from(JSON.stringify(tokenData), "utf8").toString("hex")
        }
      }]
    };

    const prepared = await xrplClient.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await xrplClient.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      res.json({ 
        success: true,
        txHash: result.result.hash
      });
    } else {
      throw new Error("Transaction failed");
    }

  } catch (error) {
    console.error('Error creating token:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error' 
    });
  }
});

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.REACT_APP_WEBAPP_URL);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Start Express server
app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});

// Initialize bot with config
const bot = new TelegramBot(config.botToken, { polling: true });
const xrplClient = new Client('wss://xrplcluster.com');

// Store user wallets (in memory cache)
const userWallets = new Map();
const activeWallets = new Map();

// Add loadWallets function
async function loadWallets() {
  try {
    const walletDocs = await WalletModel.find({});
    walletDocs.forEach(doc => {
      const activeWallet = doc.wallets[doc.activeWalletIndex];
      if (activeWallet) {
        userWallets.set(doc.userId, {
          ...activeWallet,
          seed: doc.decryptData(activeWallet.encryptedSeed),
          privateKey: doc.decryptData(activeWallet.encryptedPrivateKey)
        });
        activeWallets.set(doc.userId, doc.activeWalletIndex);
      }
    });
    console.log('Wallets loaded from database');
  } catch (error) {
    console.error('Error loading wallets:', error);
    throw error; // Re-throw to be caught by startBot
  }
}

// Add this function to migrate old wallets
async function migrateExistingWallets() {
  try {
    for (const [userId, wallet] of userWallets.entries()) {
      // Check if wallet already exists in DB
      let userDoc = await WalletModel.findOne({ userId: userId.toString() });
      
      if (!userDoc) {
        // Create new wallet document with encryption
        userDoc = new WalletModel({
          userId: userId.toString(),
          wallets: [{
            address: wallet.address,
            encryptedSeed: WalletModel.prototype.encryptData(wallet.seed),
            encryptedPrivateKey: WalletModel.prototype.encryptData(wallet.privateKey),
            publicKey: wallet.publicKey,
            name: wallet.name || `Wallet 1`,
            balance: wallet.balance || '0'
          }],
          activeWalletIndex: 0
        });
        await userDoc.save();
        console.log(`Migrated wallet for user ${userId}`);
      }
    }
    console.log('Wallet migration complete');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Connect to MongoDB and start bot
async function startBot() {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Initialize XRPL client
    await xrplClient.connect();
    console.log('Connected to XRPL');

    // Migrate any existing wallets
    await migrateExistingWallets();
    
    // Then load all wallets
    await loadWallets();
    
    console.log('Bot is running...');
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

// Start the bot
startBot().catch(console.error);

// Add recovery command
bot.onText(/\/recover (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const oldSeed = match[1];

  try {
    // Check if user already has a wallet in DB
    const existingWallet = await WalletModel.findOne({ userId: userId.toString() });
    if (existingWallet) {
      bot.sendMessage(msg.chat.id, "You already have a wallet in the new system!");
      return;
    }

    // Create wallet from seed
    const recoveredWallet = XRPLWallet.fromSeed(oldSeed);
    
    // Create new wallet document
    const newWalletDoc = new WalletModel({
      userId: userId.toString(),
      wallets: [{
        address: recoveredWallet.address,
        encryptedSeed: WalletModel.prototype.encryptData(recoveredWallet.seed),
        encryptedPrivateKey: WalletModel.prototype.encryptData(recoveredWallet.privateKey),
        publicKey: recoveredWallet.publicKey,
        name: 'Recovered Wallet',
        balance: '0'
      }],
      activeWalletIndex: 0
    });

    await newWalletDoc.save();
    
    bot.sendMessage(msg.chat.id,
      "✅ *Wallet Recovered Successfully!*\n\n" +
      `Address: \`${recoveredWallet.address}\`\n\n` +
      "Your wallet is now securely stored in the new system.",
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('Recovery error:', error);
    bot.sendMessage(msg.chat.id, "Failed to recover wallet. Please check your seed phrase.");
  }
});

// Start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const webAppUrl = 'https://xr-pump.vercel.app/';

  console.log('Using WebApp URL:', webAppUrl);

  try {
    await bot.sendMessage(chatId, 
      "*Welcome to XRPump!*\n\n" +
      "Click the button below to open the app:",
      { parse_mode: 'Markdown' }
    );

    const keyboard = {
      inline_keyboard: [
        [{
          text: '🌐 Open XRPump',
          web_app: { url: webAppUrl }
        }]
      ]
    };

    await bot.sendMessage(chatId, 
      "Choose an option:",
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('Start command error:', error);
    bot.sendMessage(chatId, 
      "Sorry, there was an error. Please try again or contact support."
    );
  }
});

// Add error handler for the bot
bot.on('polling_error', (error) => {
  console.error('Bot polling error:', error);
});

bot.on('error', (error) => {
  console.error('Bot error:', error);
});

// Handle callback queries
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  switch (query.data) {
    case 'create_wallet':
      try {
        // Check if user already has wallets
        const existingDoc = await WalletModel.findOne({ userId: userId.toString() });
        
        if (existingDoc) {
          bot.sendMessage(chatId, 
            "You already have a wallet!\n\n" +
            "Use /mywallets to view your wallets or /deletewallet to remove existing wallet.",
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // Generate new wallet
        const newWallet = XRPLWallet.generate();
        
        // Create new wallet document
        const userDoc = new WalletModel({
          userId: userId.toString(),
          wallets: [{
            address: newWallet.address,
            encryptedSeed: WalletModel.prototype.encryptData(newWallet.seed),
            encryptedPrivateKey: WalletModel.prototype.encryptData(newWallet.privateKey),
            publicKey: newWallet.publicKey,
            name: 'My Wallet',
            balance: '0'
          }],
          activeWalletIndex: 0
        });

        await userDoc.save();

        // Update in-memory map
        userWallets.set(userId, {
          ...userDoc.wallets[0],
          seed: newWallet.seed,
          privateKey: newWallet.privateKey
        });

        // Send public info
        bot.sendMessage(chatId, 
          "✅ *Wallet Created Successfully!*\n\n" +
          `Address: \`${newWallet.address}\`\n\n` +
          "🔐 Check your private messages for your seed phrase.",
          { parse_mode: 'Markdown' }
        );

        // Send private info in DM
        bot.sendMessage(userId,
          "🔐 *IMPORTANT: Your Wallet Secret Information*\n\n" +
          "Keep this information safe and private!\n\n" +
          `Seed Phrase: \`${newWallet.seed}\`\n\n` +
          `Private Key: \`${newWallet.privateKey}\`\n\n` +
          "⚠️ NEVER share these with anyone!\n" +
          "⚠️ Store them safely and delete this message!",
          { parse_mode: 'Markdown' }
        );

      } catch (error) {
        console.error('Wallet creation error:', error);
        if (error.code === 11000) {
          bot.sendMessage(chatId, 
            "You already have a wallet! Use /mywallets to view it or /deletewallet to remove it."
          );
        } else {
          bot.sendMessage(chatId, "❌ Failed to create wallet. Please try again.");
        }
      }
      break;

    case 'view_wallets':
      try {
        const userDoc = await WalletModel.findOne({ userId: userId.toString() });
        if (!userDoc || !userDoc.wallets.length) {
          const keyboard = {
            inline_keyboard: [[{
              text: '➕ Create Wallet',
              callback_data: 'create_wallet'
            }]]
          };
          bot.sendMessage(chatId, 
            "You don't have any wallets yet. Create one now!", 
            { reply_markup: keyboard }
          );
          return;
        }

        const walletList = userDoc.wallets.map((wallet, index) => 
          `${index === userDoc.activeWalletIndex ? '✅ ' : ''}` +
          `*${wallet.name}*\n` +
          `Address: \`${wallet.address}\`\n` +
          `Balance: ${wallet.balance} XRP\n`
        ).join('\n');

        bot.sendMessage(chatId,
          "*Your Wallets*\n\n" + walletList,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error fetching wallets:', error);
        bot.sendMessage(chatId, "Failed to fetch wallets. Please try again.");
      }
      break;

    case 'recover_wallet':
      bot.sendMessage(chatId,
        "*Recover Your Wallet*\n\n" +
        "To recover your wallet, send your seed phrase using:\n" +
        "`/recover YOUR_SEED_PHRASE`\n\n" +
        "⚠️ Only do this in a private message to the bot!",
        { parse_mode: 'Markdown' }
      );
      break;

    case 'confirm_delete':
      try {
        const result = await WalletModel.findOneAndDelete({ 
          userId: userId.toString() 
        });

        if (result) {
          // Clear from memory cache
          userWallets.delete(userId);
          activeWallets.delete(userId);

          bot.sendMessage(chatId,
            "✅ *Wallet Deleted Successfully*\n\n" +
            "Your wallet has been removed from the bot.\n" +
            "You can create a new wallet using /createwallet\n" +
            "or import an existing one using /import",
            { parse_mode: 'Markdown' }
          );
        } else {
          bot.sendMessage(chatId, "No wallet found to delete.");
        }
      } catch (error) {
        console.error('Delete wallet error:', error);
        bot.sendMessage(chatId, "Failed to delete wallet. Please try again.");
      }
      break;

    case 'cancel_delete':
      bot.sendMessage(chatId, 
        "Wallet deletion cancelled. Your wallet is safe.",
        { parse_mode: 'Markdown' }
      );
      break;

    case 'delete_wallet':
      // Trigger the delete wallet command
      bot.emit('text', { ...query.message, text: '/deletewallet' });
      break;

    default:
      bot.sendMessage(chatId, "Unknown command");
  }
});

// Add after other command handlers
bot.onText(/\/deletewallet/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    const userDoc = await WalletModel.findOne({ userId: userId.toString() });
    
    if (!userDoc) {
      bot.sendMessage(chatId, "You don't have any wallets to delete.");
      return;
    }

    // Show confirmation keyboard with warning
    const keyboard = {
      inline_keyboard: [
        [
          { text: '❌ Yes, Delete Wallet', callback_data: 'confirm_delete' }
        ],
        [
          { text: '↩️ Cancel', callback_data: 'cancel_delete' }
        ]
      ]
    };

    const activeWallet = userDoc.wallets[userDoc.activeWalletIndex];
    
    bot.sendMessage(chatId,
      "⚠️ *WARNING: Delete Wallet*\n\n" +
      `Current Wallet:\n` +
      `Name: *${activeWallet.name}*\n` +
      `Address: \`${activeWallet.address}\`\n` +
      `Balance: ${activeWallet.balance} XRP\n\n` +
      "Are you sure you want to delete this wallet?\n\n" +
      "⚠️ This action:\n" +
      "• Cannot be undone\n" +
      "• Will remove all wallet data\n" +
      "• Will require seed phrase to recover\n\n" +
      "Make sure you have:\n" +
      "• Backed up your seed phrase\n" +
      "• Saved your private key\n" +
      "• Moved any funds\n",
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  } catch (error) {
    console.error('Delete wallet error:', error);
    bot.sendMessage(chatId, "Failed to process wallet deletion. Please try again.");
  }
});

// Add test connection command
bot.onText(/\/testconnection/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    const userDoc = await WalletModel.findOne({ userId: userId.toString() });
    
    if (!userDoc) {
      bot.sendMessage(chatId, "No wallet found. Create a wallet first!");
      return;
    }

    const activeWallet = userDoc.wallets[userDoc.activeWalletIndex];
    
    bot.sendMessage(chatId,
      "🔄 *Testing Connection*\n\n" +
      `Wallet Address: \`${activeWallet.address}\`\n` +
      `Balance: ${activeWallet.balance} XRP\n\n` +
      "To test in app:\n" +
      "1. Open the web app\n" +
      "2. Click 'Connect Wallet'\n" +
      "3. Your wallet should connect automatically",
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Test connection error:', error);
    bot.sendMessage(chatId, "Failed to test connection. Please try again.");
  }
});

// Rest of your bot code...

console.log('Config loaded:', {
  ENCRYPTION_KEY: config.encryptionKey ? 'Found' : 'Not found',
  BOT_TOKEN: config.botToken ? 'Found' : 'Not found',
  MONGO_URI: config.mongoUri ? 'Found' : 'Not found'
});
