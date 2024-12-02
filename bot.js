const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

app.use(cors());
app.use(express.json());

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const keyboard = {
    inline_keyboard: [[
      {
        text: ' Launch App',
        web_app: { url: process.env.REACT_APP_WEBAPP_URL }
      }
    ]]
  };

  bot.sendMessage(chatId, 
    'Welcome to XRPump! Click the button below to launch the app:', 
    { reply_markup: keyboard }
  );
});

// Start Express server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
}); 