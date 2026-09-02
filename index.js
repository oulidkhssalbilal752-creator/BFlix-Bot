const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 10000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

// ===============================
// CHECK ENVIRONMENT VARIABLES
// ===============================

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing!");
}

if (!TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY is missing!");
}

// ===============================
// USER DATA
// ===============================

const favorites = new Map();

// ===============================
// TMDB SEARCH
// ===============================

async function searchTMDB(query) {
  const url =
    `${TMDB_BASE_URL}/search/multi` +
    `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&query=${encodeURIComponent(query)}` +
    `&language=en-US` +
    `&include_adult=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.results || []).filter(
    (item) => item.media_type === "movie" || item.media_type === "tv"
  );
}

// ===============================
// GET MOVIE DETAILS
// ===============================

async function getMovieDetails(id) {
  const url =
    `${TMDB_BASE_URL}/movie/${id}` +
    `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&language=en-US`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB movie error: ${response.status}`);
  }

  return await response.json();
}

// ===============================
// GET TV DETAILS
// ===============================

async function getTVDetails(id) {
  const url =
    `${TMDB_BASE_URL}/tv/${id}` +
    `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&language=en-US`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB TV error: ${response.status}`);
  }

  return await response.json();
}

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
// SEARCH BUTTON
// ===============================

bot.action("search", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🔎 Search BFlix\n\n` +
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
  const query = ctx.message.text.trim();

  if (!query || query.startsWith("/")) return;

  if (!TMDB_API_KEY) {
    return ctx.reply(
      "❌ TMDB API Key is not configured on the server."
    );
  }

  try {
    await ctx.reply("🔎 Searching TMDB... 🍿");

    const results = await searchTMDB(query);

    if (results.length === 0) {
      return ctx.reply(
        `❌ No results found for "${query}".\n\n` +
        `Try another movie or series name.`
      );
    }

    const limitedResults = results.slice(0, 10);

    const buttons = limitedResults.map((item) => {
      const title =
        item.media_type === "movie"
          ? item.title
          : item.name;

      const year =
        item.media_type === "movie"
          ? item.release_date?.slice(0, 4)
          : item.first_air_date?.slice(0, 4);

      const type =
        item.media_type === "movie" ? "🎬" : "📺";

      return [
        Markup.button.callback(
          `${type} ${title}${year ? ` (${year})` : ""}`,
          `tmdb_${item.media_type}_${item.id}`
        )
      ];
    });

    await ctx.reply(
      `🔎 Results for "${query}":`,
      Markup.inlineKeyboard(buttons)
    );

  } catch (error) {
    console.error("TMDB Search Error:", error);

    await ctx.reply(
      "❌ An error occurred while searching TMDB.\n\n" +
      "Please try again later."
    );
  }
});

// ===============================
// TMDB MOVIE DETAILS
// ===============================

bot.action(/^tmdb_movie_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  try {
    const movie = await getMovieDetails(ctx.match[1]);

    const title = movie.title || "Unknown";
    const year = movie.release_date?.slice(0, 4) || "Unknown";
    const rating = movie.vote_average
      ? movie.vote_average.toFixed(1)
      : "N/A";

    const overview =
      movie.overview ||
      "No description available.";

    const poster = movie.poster_path
      ? `${TMDB_IMAGE_URL}${movie.poster_path}`
      : null;

    const caption =
      `🎬 ${title}\n\n` +
      `📅 Release: ${year}\n` +
      `⭐ Rating: ${rating}/10\n\n` +
      `📝 ${overview}\n\n` +
      `🎞️ BFlix`;

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "⭐ Add to Favorites",
          `tmdbfav_movie_${movie.id}`
        )
      ],
      [
        Markup.button.callback("⬅️ Back", "home")
      ]
    ]);

    if (poster) {
      await ctx.replyWithPhoto(
        { url: poster },
        {
          caption,
          ...buttons
        }
      );
    } else {
      await ctx.reply(caption, buttons);
    }

  } catch (error) {
    console.error("Movie Details Error:", error);

    await ctx.reply(
      "❌ Couldn't load movie information."
    );
  }
});

// ===============================
// TMDB TV DETAILS
// ===============================

bot.action(/^tmdb_tv_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  try {
    const show = await getTVDetails(ctx.match[1]);

    const title = show.name || "Unknown";
    const year = show.first_air_date?.slice(0, 4) || "Unknown";

    const rating = show.vote_average
      ? show.vote_average.toFixed(1)
      : "N/A";

    const overview =
      show.overview ||
      "No description available.";

    const poster = show.poster_path
      ? `${TMDB_IMAGE_URL}${show.poster_path}`
      : null;

    const caption =
      `📺 ${title}\n\n` +
      `📅 First aired: ${year}\n` +
      `⭐ Rating: ${rating}/10\n\n` +
      `📝 ${overview}\n\n` +
      `🎞️ BFlix`;

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "⭐ Add to Favorites",
          `tmdbfav_tv_${show.id}`
        )
      ],
      [
        Markup.button.callback("⬅️ Back", "home")
      ]
    ]);

    if (poster) {
      await ctx.replyWithPhoto(
        { url: poster },
        {
          caption,
          ...buttons
        }
      );
    } else {
      await ctx.reply(caption, buttons);
    }

  } catch (error) {
    console.error("TV Details Error:", error);

    await ctx.reply(
      "❌ Couldn't load series information."
    );
  }
});

// ===============================
// FAVORITES
// ===============================

bot.action(/^tmdbfav_(movie|tv)_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery("Added to favorites ⭐");

  const userId = ctx.from.id;

  if (!favorites.has(userId)) {
    favorites.set(userId, []);
  }

  const list = favorites.get(userId);

  const item = `${ctx.match[1]}_${ctx.match[2]}`;

  if (!list.includes(item)) {
    list.push(item);
  }

  await ctx.reply("⭐ Added to your favorites!");
});

// ===============================
// MOVIES MENU
// ===============================

bot.action("movies", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🎬 Movies\n\n` +
    `Use the Search button to find any movie from TMDB.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔎 Search Movies", "search")],
      [Markup.button.callback("⬅️ Back", "home")]
    ])
  );
});

// ===============================
// SERIES MENU
// ===============================

bot.action("series", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `📺 Series\n\n` +
    `Use the Search button to find any series from TMDB.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔎 Search Series", "search")],
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

  try {
    const url =
      `${TMDB_BASE_URL}/trending/all/day` +
      `?api_key=${encodeURIComponent(TMDB_API_KEY)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TMDB error: ${response.status}`);
    }

    const data = await response.json();

    const results = (data.results || [])
      .filter(
        (item) =>
          item.media_type === "movie" ||
          item.media_type === "tv"
      )
      .slice(0, 10);

    if (results.length === 0) {
      return ctx.editMessageText(
        "🔥 No trending titles available.",
        mainMenu()
      );
    }

    const buttons = results.map((item) => {
      const title =
        item.media_type === "movie"
          ? item.title
          : item.name;

      return [
        Markup.button.callback(
          `${item.media_type === "movie" ? "🎬" : "📺"} ${title}`,
          `tmdb_${item.media_type}_${item.id}`
        )
      ];
    });

    buttons.push([
      Markup.button.callback("⬅️ Back", "home")
    ]);

    await ctx.editMessageText(
      "🔥 Trending on TMDB",
      Markup.inlineKeyboard(buttons)
    );

  } catch (error) {
    console.error("Trending Error:", error);

    await ctx.reply(
      "❌ Couldn't load trending titles."
    );
  }
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
      "⭐ Your favorites are empty.",
      mainMenu()
    );
  }

  await ctx.editMessageText(
    `⭐ Your Favorites\n\n` +
    `You have ${list.length} saved title(s).\n\n` +
    `Favorites are currently stored temporarily.`,
    mainMenu()
  );
});

// ===============================
// HELP
// ===============================

bot.action("help", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `ℹ️ BFlix Help\n\n` +
    `🔎 Search — Find movies and series using TMDB\n` +
    `🎬 Movies — Movie section\n` +
    `📺 Series — Series section\n` +
    `🎭 Genres — Explore genres\n` +
    `🔥 Trending — Trending titles\n` +
    `⭐ Favorites — Save titles\n\n` +
    `🎬 Enjoy BFlix!`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Back", "home")]
    ])
  );
});

// ===============================
// HOME
// ===============================

bot.action("home", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🎬 Welcome to BFlix!\n\n` +
    `🍿 Discover movies and series.\n` +
    `🔎 Search your next movie.\n` +
    `🎭 Explore genres.\n` +
    `🔥 Find what's trending.\n` +
    `⭐ Save your favorites.\n\n` +
    `✨ Enjoy your cinematic experience!`,
    mainMenu()
  );
});

// ===============================
// WEB SERVER
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
