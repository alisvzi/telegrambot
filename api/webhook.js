const handleUpdate = require("../lib/bot");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  await handleUpdate(req.body);
  res.status(200).send("OK");
};
