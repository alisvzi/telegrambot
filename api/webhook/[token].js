// api/webhook/[token].js
const TelegramBot = require("node-telegram-bot-api");
const { kv } = require("@vercel/kv");

const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;

if (!TOKEN || !APP_URL) {
  throw new Error("BOT_TOKEN یا APP_URL تنظیم نشده است.");
}

const HOOK_PATH = `/api/webhook/${TOKEN}`;
const WEBHOOK_URL = `${APP_URL}${HOOK_PATH}`;

let bot;
let botInitialized = false;

function getBotInstance() {
  if (!bot) {
    bot = new TelegramBot(TOKEN, { webHook: true });
  }
  return bot;
}

async function ensureWebhook() {
  const bot = getBotInstance();
  const webhookInfo = await bot.getWebHookInfo();
  if (webhookInfo.url !== WEBHOOK_URL) {
    await bot.setWebHook(WEBHOOK_URL);
  }
}

async function loadUserGroups(userId) {
  return (await kv.hgetall(`user:${userId}:groups`)) || {};
}

async function saveUserGroup(userId, chatId, chatTitle) {
  await kv.hset(`user:${userId}:groups`, { [chatId]: chatTitle });
}

async function popCheat(chatId) {
  const cheat = await kv.get(`cheat:${chatId}`);
  if (cheat !== null) {
    await kv.del(`cheat:${chatId}`);
  }
  return cheat;
}

async function setCheatForGroup(chatId, value) {
  await kv.set(`cheat:${chatId}`, value);
}

async function setPendingCheat(userId, value) {
  await kv.set(`pending-cheat:${userId}`, value);
}

async function getPendingCheat(userId) {
  const value = await kv.get(`pending-cheat:${userId}`);
  return value === null ? undefined : value;
}

async function clearPendingCheat(userId) {
  await kv.del(`pending-cheat:${userId}`);
}

async function ensureHandlers() {
  if (botInitialized) return;
  const bot = getBotInstance();
  await ensureWebhook();

  bot.onText(/\/start/, async (msg) => {
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

    await bot.sendMessage(chatId, welcomeMessage, inlineOptions);
    await bot.sendMessage(
      chatId,
      "برای استفاده راحت‌تر می‌توانید از دکمه‌های زیر هم استفاده کنید:",
      keyboardOptions,
    );
  });

  bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!msg.chat.type.endsWith("group")) {
      await bot.sendMessage(
        chatId,
        "❌ این دستور فقط باید در گروه‌ها استفاده شود.",
      );
      return;
    }

    await saveUserGroup(userId, chatId, msg.chat.title || "گروه بدون نام");

    await bot.sendMessage(
      chatId,
      `${msg.from.first_name} عزیز، گروه "${msg.chat.title || "گروه بدون نام"}" برای شما ثبت شد.\n\nحالا در پیام خصوصی با ربات دستور /mygroups را بزنید.`,
    );
  });

  bot.onText(/\/mygroups/, async (msg) => {
    if (msg.chat.type !== "private") return;

    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const groups = await loadUserGroups(userId);
    if (!groups || Object.keys(groups).length === 0) {
      await bot.sendMessage(
        chatId,
        "❌ شما هنوز هیچ گروهی ثبت نکرده‌اید.\nلطفا ابتدا در گروه مورد نظر دستور /register را ارسال کنید.",
      );
      return;
    }

    const inlineKeyboard = Object.keys(groups).map((gid) => [
      { text: groups[gid], callback_data: `selectgroup_${gid}` },
    ]);

    await bot.sendMessage(chatId, "لطفا گروه مورد نظر را انتخاب کنید:", {
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  });

  bot.on("callback_query", async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    if (data.startsWith("selectgroup_")) {
      const groupId = data.split("_")[1];
      const groups = await loadUserGroups(userId);
      const pendingCheat = await getPendingCheat(userId);

      if (!pendingCheat) {
        await bot.sendMessage(chatId, `گروه "${groups[groupId]}" انتخاب شد.`);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
      }

      await setCheatForGroup(groupId, pendingCheat);
      await clearPendingCheat(userId);

      await bot.sendMessage(
        chatId,
        `✅ عدد تقلب برای گروه "${groups[groupId]}" با موفقیت ثبت شد.`,
      );
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    if (data === "rand") {
      await bot.sendMessage(
        chatId,
        "لطفا دستور /rand را به شکل /rand [عدد1] [عدد2] وارد کنید.",
      );
    } else if (data === "about") {
      await bot.sendMessage(
        chatId,
        "این ربات به شما کمک می‌کند عدد رندم بین دو عدد مشخص تولید کنید.\nساخته شده توسط @alisvzi",
      );
    } else if (data === "help") {
      await bot.sendMessage(
        chatId,
        `راهنما:
- /start : شروع کار با ربات
- /rand عدد1 عدد2 : تولید عدد رندم بین عدد1 و عدد2
- /help : نمایش راهنما`,
      );
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  });

  bot.onText(/\/cheat (\d+)/, async (msg, match) => {
    if (msg.chat.type !== "private") return;

    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const cheatNumber = parseInt(match[1], 10);
    if (Number.isNaN(cheatNumber)) {
      await bot.sendMessage(
        chatId,
        "❌ عدد تقلب نامعتبر است. لطفا عدد صحیح وارد کنید.",
      );
      return;
    }

    const groups = await loadUserGroups(userId);
    if (!groups || Object.keys(groups).length === 0) {
      await bot.sendMessage(
        chatId,
        "❌ شما هنوز هیچ گروهی ثبت نکرده‌اید.\nلطفا ابتدا در گروه مورد نظر دستور /register را ارسال کنید.",
      );
      return;
    }

    await setPendingCheat(userId, cheatNumber);

    const inlineKeyboard = Object.keys(groups).map((gid) => [
      { text: groups[gid], callback_data: `selectgroup_${gid}` },
    ]);

    await bot.sendMessage(
      chatId,
      "عدد تقلب ثبت شد.\nلطفا گروه مورد نظر برای اعمال عدد تقلب را انتخاب کنید:",
      {
        reply_markup: { inline_keyboard: inlineKeyboard },
      },
    );
  });

  bot.onText(/\/rand (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let a = parseInt(match[1], 10);
    let b = parseInt(match[2], 10);

    if (Number.isNaN(a) || Number.isNaN(b)) {
      await bot.sendMessage(chatId, "❌ لطفا دو عدد صحیح وارد کنید.");
      return;
    }

    if (a === b) {
      await bot.sendMessage(
        chatId,
        "⚠️ دو عدد نمی‌توانند برابر باشند. لطفا دو عدد متفاوت وارد کنید.",
      );
      return;
    }

    if (a > b) [a, b] = [b, a];

    const cheatNumber = await popCheat(chatId);
    if (cheatNumber !== null && cheatNumber !== undefined) {
      await bot.sendMessage(
        chatId,
        `🎲 عدد رندم بین ${a} و ${b}:\n\n\n👉 ${cheatNumber}`,
      );
      return;
    }

    const n = Math.floor(Math.random() * (b - a + 1)) + a;
    await bot.sendMessage(chatId, `🎲 عدد رندم بین ${a} و ${b}:\n\n\n👉 ${n}`);
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      `
دستورات ربات:
/start - شروع کار با ربات
/rand [عدد1] [عدد2] - تولید عدد رندم بین دو عدد
/help - نمایش این پیام راهنما
/mygroups - نمایش گروه‌های ثبت شده شما
/register - ثبت گروه (فقط در گروه‌ها)
`.trim(),
    );
  });

  botInitialized = true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  if (req.query.token !== TOKEN) {
    res.status(403).json({ ok: false, error: "Invalid token" });
    return;
  }

  try {
    await ensureHandlers();
    const bot = getBotInstance();
    await bot.processUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ ok: false });
  }
};
