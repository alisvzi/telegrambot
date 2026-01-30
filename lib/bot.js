const TelegramBot = require("node-telegram-bot-api");
const redis = require("./redis");

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

// دستور /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "سلام! ربات انتخاب تصادفی فعال است.\n\nدستورات:\n/register - ثبت گروه\n/mygroups - گروه‌های ثبت‌شده\n/cheat - دریافت کلید تقلب"
  );
});

// دستور /register
bot.onText(/\/register/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (msg.chat.type === "private") {
    await bot.sendMessage(chatId, "این دستور فقط در گروه قابل استفاده است.");
    return;
  }

  const groupId = msg.chat.id;
  const groupTitle = msg.chat.title || `Group ${groupId}`;

  try {
    await redis.registerGroup(userId, groupId, groupTitle);
    await bot.sendMessage(chatId, `گروه "${groupTitle}" با موفقیت ثبت شد.`);
  } catch (error) {
    console.error("Register error:", error);
    await bot.sendMessage(chatId, "خطا در ثبت گروه.");
  }
});

// دستور /mygroups
bot.onText(/\/mygroups/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const groups = await redis.getUserGroups(userId);
    if (groups.length === 0) {
      await bot.sendMessage(chatId, "شما هیچ گروهی ثبت نکرده‌اید.");
      return;
    }
    const list = groups.map((g) => `- ${g.title} (ID: ${g.id})`).join("\n");
    await bot.sendMessage(chatId, `گروه‌های شما:\n${list}`);
  } catch (error) {
    console.error("MyGroups error:", error);
    await bot.sendMessage(chatId, "خطا در دریافت گروه‌ها.");
  }
});

// دستور /cheat
bot.onText(/\/cheat/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const cheatKey = await redis.generateCheatKey(userId);
    await bot.sendMessage(
      chatId,
      `کلید تقلب شما:\n\`${cheatKey}\`\n\nاین کلید را در گروه ارسال کنید تا برنده شوید.`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Cheat error:", error);
    await bot.sendMessage(chatId, "خطا در تولید کلید تقلب.");
  }
});

// پردازش پیام‌های معمولی (برای تشخیص کلید تقلب)
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  try {
    const userId = await redis.getCheatKeyOwner(text);
    if (userId) {
      await redis.consumeCheatKey(text);
      await bot.sendMessage(
        chatId,
        `تبریک! کاربر ${msg.from.first_name} با کلید تقلب برنده شد!`
      );
      // می‌توانید پیام خصوصی به برنده هم بفرستید
      await bot.sendMessage(
        userId,
        `کلید تقلب شما در گروه "${msg.chat.title}" استفاده شد.`
      );
    }
  } catch (error) {
    console.error("Cheat detection error:", error);
  }
});

// تابع اصلی هندل آپدیت (برای webhook)
async function handleUpdate(update) {
  try {
    await bot.processUpdate(update);
  } catch (error) {
    console.error("Error processing update:", error);
  }
}

module.exports = handleUpdate;
