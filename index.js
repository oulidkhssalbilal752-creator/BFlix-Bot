const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    `🎬 أهلاً بك في BFlix!\n\n` +
    `🍿 اكتشف عالم الأفلام والمسلسلات\n\n` +
    `🔎 ابحث عن فيلم أو مسلسل\n` +
    `🎭 استكشف التصنيفات\n` +
    `🔥 الأكثر رواجاً\n\n` +
    `استمتع بتجربتك السينمائية ✨`
  );
});

app.get("/", (req, res) => {
  res.send("BFlix Bot is running 🎬");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BFlix running on port ${PORT}`);
});

bot.launch();
