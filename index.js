const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 10000;

// ===============================
// BFLIX MOVIE DATABASE
// ===============================

const movies = [
  {
    id: "movie1",
    title: "Sample Movie",
    year: "2026",
    genre: "Action",
    rating: "8.5",
    description:
      "A sample movie entry for your BFlix catalog.",
    fileId: null
  }
];

// ===============================
// USER DATA
// ===============================

const favorites = new Map();

// ===============================
// MAIN MENU
// ===============================

function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔎 Search", "search"),
      Markup.button.callback("🎬 Movies", "movies")
    ],
    [
      Markup.button.callback("📺 Series", "series"),
      Markup.button.callback("🎭 Genres", "genres")
    ],
    [
      Markup.button.callback("🔥 Trending", "trending"),
      Markup.button.callback("⭐ Favorites", "favorites")
    ],
    [
      Markup.button.callback("ℹ️ Help", "help")
    ]
  ]);
}

// ===============================
// /START
// ===============================

bot.start(async (ctx) => {
  await ctx.reply(
    `🎬 Welcome to BFlix!\n\n` +
    `🍿 Discover movies and series.\n` +
    `🔎 Search for your next movie.\n` +
    `🎭 Explore different genres.\n` +
    `🔥 Find what's trending.\n` +
    `⭐ Save your favorite titles.\n\n` +
    `✨ Enjoy your cinematic experience!`,
    mainMenu()
  );
});

// ===============================
// MOVIES
// ===============================

bot.action("movies", async (ctx) => {
  await ctx.answerCbQuery();

  if (movies.length === 0) {
    return ctx.editMessageText(
      "🎬 No movies are available yet.",
      mainMenu()
    );
  }

  const buttons = movies.map((movie) => [
    Markup.button.callback(
      `🎬 ${movie.title}`,
      `movie_${movie.id}`
    )
  ]);

  buttons.push([
    Markup.button.callback("⬅️ Back", "home")
  ]);

  await ctx.editMessageText(
    "🎬 Movies\n\nChoose a movie:",
    Markup.inlineKeyboard(buttons)
  );
});

// ===============================
// MOVIE DETAILS
// ===============================

bot.action(/^movie_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const movie = movies.find((m) => m.id === ctx.match[1]);

  if (!movie) {
    return ctx.reply("❌ Movie not found.");
  }

  const buttons = [];

  if (movie.fileId) {
    buttons.push([
      Markup.button.callback("▶️ Watch Movie", `watch_${movie.id}`)
    ]);
  }

  buttons.push([
    Markup.button.callback("⭐ Add to Favorites", `fav_${movie.id}`)
  ]);

  buttons.push([
    Markup.button.callback("⬅️ Back to Movies", "movies")
  ]);

  await ctx.editMessageText(
    `🎬 ${movie.title}\n\n` +
    `📅 Year: ${movie.year}\n` +
    `🎭 Genre: ${movie.genre}\n` +
    `⭐ Rating: ${movie.rating}/10\n\n` +
    `📝 ${movie.description}`,
    Markup.inlineKeyboard(buttons)
  );
});

// ===============================
// WATCH MOVIE
// ===============================

bot.action(/^watch_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const movie = movies.find((m) => m.id === ctx.match[1]);

  if (!movie || !movie.fileId) {
    return ctx.reply(
      "🎬 This movie is not available for streaming yet."
    );
  }

  await ctx.replyWithVideo(movie.fileId, {
    caption:
      `🎬 ${movie.title}\n\n` +
      `Enjoy your movie on BFlix! 🍿`
  });
});

// ===============================
// FAVORITES
// ===============================

bot.action(/^fav_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery("Added to favorites ⭐");

  const userId = ctx.from.id;

  if (!favorites.has(userId)) {
    favorites.set(userId, []);
  }

  const list = favorites.get(userId);

  if (!list.includes(ctx.match[1])) {
    list.push(ctx.match[1]);
  }

  await ctx.reply("⭐ Added to your favorites!");
});

// ===============================
// FAVORITES MENU
// ===============================

bot.action("favorites", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;
  const list = favorites.get(userId) || [];

  if (list.length === 0) {
    return ctx.editMessageText(
      "⭐ Your favorites are empty.\n\nAdd movies to your favorites to see them here.",
      mainMenu()
    );
  }

  const buttons = [];

  list.forEach((id) => {
    const movie = movies.find((m) => m.id === id);

    if (movie) {
      buttons.push([
        Markup.button.callback(
          `🎬 ${movie.title}`,
          `movie_${movie.id}`
        )
      ]);
    }
  });

  buttons.push([
    Markup.button.callback("⬅️ Back", "home")
  ]);

  await ctx.editMessageText(
    "⭐ Your Favorites",
    Markup.inlineKeyboard(buttons)
  );
});

// ===============================
// SERIES
// ===============================

bot.action("series", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `📺 Series\n\n` +
    `Coming soon! 🚀\n\n` +
    `BFlix is preparing the series section.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Back", "home")]
    ])
  );
});

// ===============================
// GENRES
// ===============================

bot.action("genres", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🎭 Explore Genres\n\n` +
    `💥 Action\n` +
    `😂 Comedy\n` +
    `👻 Horror\n` +
    `❤️ Romance\n` +
    `🚀 Sci-Fi\n` +
    `🕵️ Thriller\n` +
    `🎭 Drama\n` +
    `🧙 Fantasy`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Back", "home")]
    ])
  );
});

// ===============================
// TRENDING
// ===============================

bot.action("trending", async (ctx) => {
  await ctx.answerCbQuery();

  const trending = movies.slice(0, 5);

  if (trending.length === 0) {
    return ctx.editMessageText(
      "🔥 No trending titles available yet.",
      mainMenu()
    );
  }

  const text =
    "🔥 Trending on BFlix\n\n" +
    trending
      .map(
        (movie, index) =>
          `${index + 1}. 🎬 ${movie.title} — ⭐ ${movie.rating}`
      )
      .join("\n");

  await ctx.editMessageText(
    text,
    Markup.inlineKeyboard([
      [Markup.button.callback("🎬 Browse Movies", "movies")],
      [Markup.button.callback("⬅️ Back", "home")]
    ])
  );
});

// ===============================
// SEARCH
// ===============================

bot.action("search", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🔎 Search\n\n` +
    `Send me the name of a movie or series.\n\n` +
    `Example:\n` +
    `Interstellar`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Back", "home")]
    ])
  );
});

// ===============================
// TEXT SEARCH
// ===============================

bot.on("text", async (ctx) => {
  const query = ctx.message.text.toLowerCase().trim();

  if (query.startsWith("/")) return;

  const results = movies.filter((movie) =>
    movie.title.toLowerCase().includes(query)
  );

  if (results.length === 0) {
    return ctx.reply(
      `🔎 No results found for "${ctx.message.text}".\n\n` +
      `Try another title.`
    );
  }

  const buttons = results.map((movie) => [
    Markup.button.callback(
      `🎬 ${movie.title}`,
      `movie_${movie.id}`
    )
  ]);

  await ctx.reply(
    `🔎 Search results for "${ctx.message.text}":`,
    Markup.inlineKeyboard(buttons)
  );
});

// ===============================
// HELP
// ===============================

bot.action("help", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `ℹ️ BFlix Help\n\n` +
    `🔎 Search — Find movies and series\n` +
    `🎬 Movies — Browse movies\n` +
    `📺 Series — Browse series\n` +
    `🎭 Genres — Explore genres\n` +
    `🔥 Trending — Popular titles\n` +
    `⭐ Favorites — Save your favorite titles\n\n` +
    `🎬 Enjoy BFlix!`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Back", "home")]
    ])
  );
});

// ===============================
// HOME BUTTON
// ===============================

bot.action("home", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🎬 Welcome to BFlix!\n\n` +
    `🍿 Discover movies and series.\n` +
    `🔎 Search for your next movie.\n` +
    `🎭 Explore genres.\n` +
    `🔥 Find what's trending.\n` +
    `⭐ Save your favorites.\n\n` +
    `✨ Enjoy your cinematic experience!`,
    mainMenu()
  );
});

// ===============================
// RENDER WEB SERVER
// ===============================

app.get("/", (req, res) => {
  res.send("🎬 BFlix Bot is online!");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BFlix server running on port ${PORT}`);
});

// ===============================
// START BOT
// ===============================

bot.launch()
  .then(() => {
    console.log("🎬 BFlix Bot started successfully!");
  })
  .catch((error) => {
    console.error("Bot startup error:", error);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
