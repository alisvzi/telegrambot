const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !APP_URL) {
  console.error("❌ BOT_TOKEN یا APP_URL تنظیم نشده!");
  process.exit(1);
}

const app = express();
app.use(express.json());

const hookPath = `/webhook/${TOKEN}`;
const webhookUrl = `${APP_URL}${hookPath}`;

// Initialize bot with proper error handling
let bot;
try {
  bot = new TelegramBot(TOKEN, { webHook: true });

  bot
    .setWebHook(webhookUrl)
    .then(() => console.log("✅ Webhook ست شد:", webhookUrl))
    .catch((err) => console.error("❌ خطا در setWebHook:", err));
} catch (error) {
  console.error("❌ خطا در ایجاد ربات:", error);
  process.exit(1);
}

// داده‌ها
const userGroups = {};
const cheats = {};
const userPendingCheat = {};
// لیست ادمین‌ها (آیدی تلگرام خودتان را اینجا وارد کنید)
const ADMIN_IDS = ["YOUR_TELEGRAM_ID"]; // آیدی عددی خودتان را جایگزین کنید

app.post(hookPath, (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("❌ خطا در پردازش آپدیت:", error);
    res.sendStatus(500);
  }
});

// /start
bot.onText(/\/start/, (msg) => {
  try {
    const chatId = msg.chat.id;
    const welcomeMessage = `سلام 👋
من به شما کمک میکنم عدد رندم بسازید.
برای ساخت عدد رندم به این شکل درخواست خود را ارسال کنید:
/rand [عدد1] [عدد2]`;

    const inlineOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "دریافت عدد رندم", callback_data: "rand" }],
          [{ text: "درباره ربات", callback_data: "about" }],
          [{ text: "راهنما", callback_data: "help" }],
        ],
      },
    };

    const keyboardOptions = {
      reply_markup: {
        keyboard: [
          [{ text: "/start" }],
          [{ text: "/rand" }],
          [{ text: "/help" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };

    bot.sendMessage(chatId, welcomeMessage, inlineOptions);

    bot.sendMessage(
      chatId,
      "برای استفاده راحت‌تر می‌توانید از دکمه‌های زیر هم استفاده کنید:",
      keyboardOptions
    );

    // اگر کاربر ادمین باشد، دستورهای خاص را نمایش بده
    if (ADMIN_IDS.includes(msg.from.id.toString())) {
      bot.sendMessage(chatId, "شما ادمین هستید. دستورهای خاص:\n/cheat [عدد]");
    }
  } catch (error) {
    console.error("❌ خطا در /start:", error);
  }
});

// /register (فقط در گروه)
bot.onText(/\/register/, (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!msg.chat.type.endsWith("group")) {
      return bot.sendMessage(
        chatId,
        "❌ این دستور فقط باید در گروه‌ها استفاده شود."
      );
    }

    if (!userGroups[userId]) userGroups[userId] = {};
    userGroups[userId][chatId] = msg.chat.title || "گروه بدون نام";

    bot.sendMessage(
      chatId,
      `${msg.from.first_name} عزیز، گروه "${userGroups[userId][chatId]}" برای شما ثبت شد.\n\nحالا در پیام خصوصی با ربات دستور /mygroups را بزنید.`
    );
  } catch (error) {
    console.error("❌ خطا در /register:", error);
  }
});

// /mygroups (نمایش گروه‌ها در پیام خصوصی)
bot.onText(/\/mygroups/, (msg) => {
  try {
    if (msg.chat.type !== "private") return;

    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (!userGroups[userId] || Object.keys(userGroups[userId]).length === 0) {
      return bot.sendMessage(
        chatId,
        "❌ شما هنوز هیچ گروهی ثبت نکرده‌اید.\nلطفا ابتدا در گروه مورد نظر دستور /register را ارسال کنید."
      );
    }

    const groups = userGroups[userId];
    const inlineKeyboard = Object.keys(groups).map((gid) => [
      { text: groups[gid], callback_data: `selectgroup_${gid}` },
    ]);

    bot.sendMessage(chatId, "لطفا گروه مورد نظر را انتخاب کنید:", {
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  } catch (error) {
    console.error("❌ خطا در /mygroups:", error);
  }
});

bot.on("callback_query", (callbackQuery) => {
  try {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    if (data.startsWith("selectgroup_")) {
      const groupId = data.split("_")[1];

      if (userPendingCheat[userId] === undefined) {
        bot.sendMessage(
          chatId,
          `گروه "${userGroups[userId][groupId]}" انتخاب شد.`
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
      }

      cheats[groupId] = userPendingCheat[userId];
      delete userPendingCheat[userId];

      bot.sendMessage(
        chatId,
        `✅ عدد تقلب برای گروه "${userGroups[userId][groupId]}" با موفقیت ثبت شد.`
      );
      bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // callback های قبلی
    if (data === "rand") {
      bot.sendMessage(
        chatId,
        "لطفا دستور /rand را به شکل /rand [عدد1] [عدد2] وارد کنید."
      );
    } else if (data === "about") {
      bot.sendMessage(
        chatId,
        "این ربات به شما کمک می‌کند عدد رندم بین دو عدد مشخص تولید کنید.\nساخته شده توسط @alisvzi"
      );
    } else if (data === "help") {
      bot.sendMessage(
        chatId,
        `راهنما:
- /start : شروع کار با ربات
- /rand عدد1 عدد2 : تولید عدد رندم بین عدد1 و عدد2
- /help : نمایش راهنما
- /mygroups : نمایش گروه‌های ثبت شده شما
- /register : ثبت گروه (فقط در گروه‌ها)`
      );
    }

    bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error("❌ خطا در callback_query:", error);
  }
});

// دستور cheat فقط برای ادمین‌ها
bot.onText(/\/cheat (\d+)/, (msg, match) => {
  try {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;

    // بررسی اینکه کاربر ادمین است یا نه
    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "❌ شما مجاز به استفاده از این دستور نیستید."
      );
    }

    if (msg.chat.type !== "private") {
      return bot.sendMessage(
        chatId,
        "❌ این دستور فقط در پیام خصوصی قابل استفاده است."
      );
    }

    const cheatNumber = parseInt(match[1]);
    if (isNaN(cheatNumber)) {
      return bot.sendMessage(
        chatId,
        "❌ عدد تقلب نامعتبر است. لطفا عدد صحیح وارد کنید."
      );
    }

    if (!userGroups[userId] || Object.keys(userGroups[userId]).length === 0) {
      return bot.sendMessage(
        chatId,
        "❌ شما هنوز هیچ گروهی ثبت نکرده‌اید.\nلطفا ابتدا در گروه مورد نظر دستور /register را ارسال کنید."
      );
    }

    userPendingCheat[userId] = cheatNumber;

    const groups = userGroups[userId];
    const inlineKeyboard = Object.keys(groups).map((gid) => [
      { text: groups[gid], callback_data: `selectgroup_${gid}` },
    ]);

    bot.sendMessage(
      chatId,
      "عدد تقلب ثبت شد.\nلطفا گروه مورد نظر برای اعمال عدد تقلب را انتخاب کنید:",
      {
        reply_markup: { inline_keyboard: inlineKeyboard },
      }
    );
  } catch (error) {
    console.error("❌ خطا در /cheat:", error);
  }
});

bot.onText(/\/rand (\d+) (\d+)/, (msg, match) => {
  try {
    const chatId = msg.chat.id;
    let a = parseInt(match[1]);
    let b = parseInt(match[2]);

    if (isNaN(a) || isNaN(b)) {
      return bot.sendMessage(chatId, "❌ لطفا دو عدد صحیح وارد کنید.");
    }

    if (a === b) {
      return bot.sendMessage(
        chatId,
        "⚠️ دو عدد نمی‌توانند برابر باشند. لطفا دو عدد متفاوت وارد کنید."
      );
    }

    if (a > b) [a, b] = [b, a];

    if (cheats.hasOwnProperty(chatId.toString())) {
      const cheatNumber = cheats[chatId.toString()];
      // عدد تقلب را بدون هیچ اشاره‌ای ارسال می‌کنیم
      bot.sendMessage(
        chatId,
        `🎲 عدد رندم بین ${a} و ${b}:\n\n\n👉 ${cheatNumber}`
      );
      delete cheats[chatId.toString()];
    } else {
      const n = Math.floor(Math.random() * (b - a + 1)) + a;
      bot.sendMessage(chatId, `🎲 عدد رندم بین ${a} و ${b}:\n\n\n👉 ${n}`);
    }
  } catch (error) {
    console.error("❌ خطا در /rand:", error);
  }
});

// /help
bot.onText(/\/help/, (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    let helpMessage = `
دستورات ربات:
/start - شروع کار با ربات
/rand [عدد1] [عدد2] - تولید عدد رندم بین دو عدد
/help - نمایش این پیام راهنما
/mygroups - نمایش گروه‌های ثبت شده شما
/register - ثبت گروه (فقط در گروه‌ها)
`;

    // اگر کاربر ادمین باشد، دستورهای خاص را نمایش بده
    if (ADMIN_IDS.includes(userId)) {
      helpMessage +=
        "\nدستورهای ادمین:\n/cheat [عدد] - تنظیم عدد تقلب (فقط در پیام خصوصی)";
    }

    bot.sendMessage(chatId, helpMessage);
  } catch (error) {
    console.error("❌ خطا در /help:", error);
  }
});

app.get("/", (req, res) => {
  res.send("Bot is running! ✅");
});

app.get("/healthz", (req, res) => res.send("ok"));

// Export برای Vercel
module.exports = app;

// اجرای سرور فقط در محیط development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
}
