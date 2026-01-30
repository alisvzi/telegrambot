const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

// کلیدهای مورد نیاز
const USER_GROUPS_KEY = (userId) => `user:${userId}:groups`;
const GROUP_INFO_KEY = (groupId) => `group:${groupId}`;
const CHEAT_KEY_PREFIX = "cheat:";

// ثبت گروه
async function registerGroup(userId, groupId, groupTitle) {
  const userKey = USER_GROUPS_KEY(userId);
  const groupKey = GROUP_INFO_KEY(groupId);

  // ذخیره اطلاعات گروه
  await redis.hset(groupKey, {
    id: groupId,
    title: groupTitle,
    owner: userId,
    createdAt: Date.now(),
  });

  // افزودن به لیست گروه‌های کاربر
  await redis.sadd(userKey, groupId);
}

// دریافت گروه‌های کاربر
async function getUserGroups(userId) {
  const userKey = USER_GROUPS_KEY(userId);
  const groupIds = await redis.smembers(userKey);

  const groups = [];
  for (const gid of groupIds) {
    const info = await redis.hgetall(GROUP_INFO_KEY(gid));
    if (info && info.id) {
      groups.push({ id: info.id, title: info.title });
    }
  }
  return groups;
}

// تولید کلید تقلب
async function generateCheatKey(userId) {
  const key = CHEAT_KEY_PREFIX + Math.random().toString(36).substring(2, 15);
  // ذخیره به مدت 24 ساعت
  await redis.setex(key, 86400, userId);
  return key;
}

// بررسی مالک کلید تقلب
async function getCheatKeyOwner(cheatKey) {
  const fullKey = CHEAT_KEY_PREFIX + cheatKey;
  const owner = await redis.get(fullKey);
  return owner;
}

// مصرف کلید تقلب (حذف پس از استفاده)
async function consumeCheatKey(cheatKey) {
  const fullKey = CHEAT_KEY_PREFIX + cheatKey;
  await redis.del(fullKey);
}

module.exports = {
  registerGroup,
  getUserGroups,
  generateCheatKey,
  getCheatKeyOwner,
  consumeCheatKey,
};
