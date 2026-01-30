const TelegramBot = require("node-telegram-bot-api");
const redis = require("./redis");

// ✅ Bot instance فقط یک‌بار ساخته می‌شود
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: true,
});

// --------------------
// Helper functions
// --------------------
const getUserGroups = async (userId) => {
  return (await redis.get(`userGroups:${userId}`)) || {};
};

const setUserGroups = async (userId, data) => {
  await redis.set(`userGroups:${userId}`, data);
};

// --------------------
// Command handlers (ONCE)
// --------------------

// /register
bot.onText(/\/register/, async (msg) => {
  if (!msg.chat.type.endsWith("group")) return;

  const userId = msg.from.id;
  const chatId = msg.chat.id;

  const groups = await getUserGroups(userId);
  groups[chatId] = msg.chat.title || "گروه بدون نام";

  await setUserGroups(userId, groups);

  await bot.sendMessage(
    chatId,
    "✅ گروه برای شما ثبت شد.\nدر پیام خصوصی دستور /mygroups را بزنید"
  );
});

// /mygroups
bot.onText(/\/mygroups/, async (msg) => {
  if (msg.chat.type !== "private") return;

  const groups = await getUserGroups(msg.from.id);

  if (!groups || Object.keys(groups).length === 0) {
    return bot.sendMessage(msg.chat.id, "❌ گروهی ثبت نشده");
  }

  const keyboard = Object.entries(groups).map(([gid, title]) => [
    { text: title, callback_data: `select_${gid}` },
  ]);

  await bot.sendMessage(msg.chat.id, "گروه را انتخاب کنید:", {
    reply_markup: { inline_keyboard: keyboard },
  });
});

// /rand a b
bot.onText(/\/rand (\d+) (\d+)/, async (msg, match) => {
  let a = parseInt(match[1]);
  let b = parseInt(match[2]);
  if (a > b) [a, b] = [b, a];

  const cheat = await redis.get(`cheat:${msg.chat.id}`);

  if (cheat !== null) {
    await redis.del(`cheat:${msg.chat.id}`);
    return bot.sendMessage(msg.chat.id, `👉 ${cheat}`);
  }

  const n = Math.floor(Math.random() * (b - a + 1)) + a;
  await bot.sendMessage(msg.chat.id, `👉 ${n}`);
});

// /cheat
bot.onText(/\/cheat (\d+)/, async (msg, match) => {
  if (msg.chat.type !== "private") return;

  const num = parseInt(match[1]);
  await redis.set(`pendingCheat:${msg.from.id}`, num);

  await bot.sendMessage(msg.chat.id, "✅ عدد ثبت شد، حالا گروه را انتخاب کنید");
});

// Callback query
bot.on("callback_query", async (q) => {
  if (!q.data.startsWith("select_")) return;

  const groupId = q.data.replace("select_", "");
  const cheat = await redis.get(`pendingCheat:${q.from.id}`);

  if (cheat === null) {
    return bot.answerCallbackQuery(q.id, {
      text: "❌ عددی ثبت نشده",
      show_alert: true,
    });
  }

  await redis.set(`cheat:${groupId}`, cheat);
  await redis.del(`pendingCheat:${q.from.id}`);

  await bot.sendMessage(q.message.chat.id, "✅ عدد تقلب اعمال شد");
  await bot.answerCallbackQuery(q.id);
});

// --------------------
// Webhook entry handler
// --------------------
module.exports = async function handleUpdate(update) {
  await bot.processUpdate(update);
};
