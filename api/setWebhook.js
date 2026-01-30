const fetch = require("node-fetch");

module.exports = async (req, res) => {
  const url = `${process.env.APP_URL}/api/webhook`;

  const r = await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }
  );

  res.json(await r.json());
};
