const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// /start
bot.start(async (ctx) => {
  await ctx.reply(
    `🎬 أهلاً بك في BFlix!\n\n` +
    `🍿 اكتشف عالم الأفلام والمسلسلات\n` +
    `🔎 ابحث عن فيلم أو مسلسل\n` +
    `🎭 استكشف التصنيفات\n` +
    `🔥 اكتشف الأكثر رواجاً\n\n` +
    `✨ استمتع بتجربتك السينمائية!`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🔎 البحث", "search"),
        Markup.button.callback("🎬 الأفلام", "movies")
      ],
      [
        Markup.button.callback("📺 المسلسلات", "series"),
        Markup.button.callback("🎭 التصنيفات", "genres")
      ],
      [
        Markup.button.callback("🔥 الأكثر رواجاً", "trending")
      ],
      [
        Markup.button.callback("⭐ المفضلة", "favorites"),
        Markup.button.callback("ℹ️ المساعدة", "help")
      ]
    ])
  );
});

// البحث
bot.action("search", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("🔎 اكتب اسم الفيلم أو المسلسل الذي تبحث عنه:");
});

// الأفلام
bot.action("movies", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("🎬 قسم الأفلام\n\nقريباً سنضيف قائمة الأفلام هنا 🍿");
});

// المسلسلات
bot.action("series", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("📺 قسم المسلسلات\n\nقريباً سنضيف قائمة المسلسلات هنا 🎞️");
});

// التصنيفات
bot.action("genres", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "🎭 التصنيفات:\n\n" +
    "☺️ كوميديا\n" +
    "💥 أكشن\n" +
    "👻 رعب\n" +
    "❤️ رومانسي\n" +
    "🚀 خيال علمي\n" +
    "🕵️ غموض"
  );
});

// الأكثر رواجاً
bot.action("trending", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("🔥 الأكثر رواجاً\n\nسيتم إضافة الأفلام والمسلسلات الرائجة قريباً.");
});

// المفضلة
bot.action("favorites", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("⭐ المفضلة\n\nلم تقم بإضافة أي فيلم إلى المفضلة بعد.");
});

// المساعدة
bot.action("help", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "ℹ️ مساعدة BFlix\n\n" +
    "🔎 البحث — ابحث عن فيلم أو مسلسل\n" +
    "🎬 الأفلام — تصفح الأفلام\n" +
    "📺 المسلسلات — تصفح المسلسلات\n" +
    "🎭 التصنيفات — اختر نوعك المفضل\n" +
    "🔥 الأكثر رواجاً — شاهد الأعمال الرائجة\n" +
    "⭐ المفضلة — أعمالك المحفوظة"
  );
});

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("BFlix Bot is running 🎬");
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BFlix running on port ${PORT}`);
});

// تشغيل البوت
bot.launch().then(() => {
  console.log("BFlix bot started 🎬");
});

// إيقاف آمن
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
