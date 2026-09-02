const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const app = express();

// ==============================
// ENV
// ==============================

const BOT_TOKEN = process.env.BOT_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const PORT = process.env.PORT || 10000;

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

// ==============================
// CHECK KEYS
// ==============================

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing");
  process.exit(1);
}

if (!TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY is missing");
  process.exit(1);
}

console.log("✅ Environment OK");

// ==============================
// TELEGRAM BOT
// ==============================

const bot = new Telegraf(BOT_TOKEN);

// ==============================
// HOME MENU
// ==============================

function homeMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔎 Search", "search")
    ],
    [
      Markup.button.callback("🎬 Movies", "movies"),
      Markup.button.callback("📺 Series", "series")
    ]
  ]);
}

// ==============================
// START
// ==============================

bot.start(async (ctx) => {
  try {
    await ctx.reply(
      "🎬 Welcome to BFlix!\n\n" +
      "🍿 Find movies and series easily.\n\n" +
      "🔎 Send me the name of a movie or series.",
      homeMenu()
    );
  } catch (error) {
    console.error("START ERROR:", error);
  }
});

// ==============================
// SEARCH BUTTON
// ==============================

bot.action("search", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "🔎 BFlix Search\n\n" +
    "✍️ Send me the name of a movie or series.\n\n" +
    "Example:\n" +
    "Interstellar"
  );
});

// ==============================
// MOVIES BUTTON
// ==============================

bot.action("movies", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "🎬 Movies\n\n" +
    "Send me the name of the movie you want to search for."
  );
});

// ==============================
// SERIES BUTTON
// ==============================

bot.action("series", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "📺 Series\n\n" +
    "Send me the name of the series you want to search for."
  );
});

// ==============================
// TMDB SEARCH
// ==============================

async function searchTMDB(query) {
  const url =
    `${TMDB_BASE}/search/multi` +
    `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&query=${encodeURIComponent(query)}` +
    `&language=en-US` +
    `&include_adult=false` +
    `&page=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `TMDB Search Error: ${response.status}`
    );
  }

  const data = await response.json();

  return (data.results || []).filter(
    (item) =>
      item.media_type === "movie" ||
      item.media_type === "tv"
  );
}

// ==============================
// MOVIE DETAILS
// ==============================

async function getMovie(id) {
  const url =
    `${TMDB_BASE}/movie/${id}` +
    `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&language=en-US`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `TMDB Movie Error: ${response.status}`
    );
  }

  return await response.json();
}

// ==============================
// SERIES DETAILS
// ==============================

async function getSeries(id) {
  const url =
    `${TMDB_BASE}/tv/${id}` +
    `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
    `&language=en-US`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `TMDB TV Error: ${response.status}`
    );
  }

  return await response.json();
}

// ==============================
// TEXT SEARCH
// ==============================

bot.on("text", async (ctx) => {
  const query = ctx.message.text.trim();

  // Ignore commands
  if (!query || query.startsWith("/")) {
    return;
  }

  try {
    // Show typing
    await ctx.sendChatAction("typing");

    // Search TMDB
    const results = await searchTMDB(query);

    if (!results.length) {
      await ctx.reply(
        `❌ No results found for:\n"${query}"\n\n` +
        "Try another name."
      );

      return;
    }

    // Maximum 8 results
    const limited = results.slice(0, 8);

    const buttons = [];

    for (const item of limited) {
      const isMovie = item.media_type === "movie";

      const title = isMovie
        ? item.title
        : item.name;

      const date = isMovie
        ? item.release_date
        : item.first_air_date;

      const year = date
        ? date.substring(0, 4)
        : "";

      const icon = isMovie
        ? "🎬"
        : "📺";

      buttons.push([
        Markup.button.callback(
          `${icon} ${title}${year ? ` (${year})` : ""}`,
          `details_${item.media_type}_${item.id}`
        )
      ]);
    }

    await ctx.reply(
      `🔎 Search results for:\n"${query}"`,
      Markup.inlineKeyboard(buttons)
    );

  } catch (error) {
    console.error("SEARCH ERROR:", error);

    await ctx.reply(
      "❌ Something went wrong while searching.\n\n" +
      "Please try again."
    );
  }
});

// ==============================
// MOVIE DETAILS BUTTON
// ==============================

bot.action(
  /^details_movie_(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    try {
      await ctx.sendChatAction("typing");

      const movie = await getMovie(ctx.match[1]);

      const title =
        movie.title || "Unknown";

      const year =
        movie.release_date
          ? movie.release_date.substring(0, 4)
          : "Unknown";

      const rating =
        typeof movie.vote_average === "number"
          ? movie.vote_average.toFixed(1)
          : "N/A";

      const genres =
        movie.genres &&
        movie.genres.length
          ? movie.genres
              .map((g) => g.name)
              .join(", ")
          : "N/A";

      const overview =
        movie.overview ||
        "No description available.";

      const runtime =
        movie.runtime
          ? `${movie.runtime} min`
          : "N/A";

      const poster =
        movie.poster_path
          ? `${TMDB_IMAGE}${movie.poster_path}`
          : null;

      const message =
        `🎬 ${title}\n\n` +
        `📅 Release: ${year}\n` +
        `⭐ Rating: ${rating}/10\n` +
        `🎭 Genres: ${genres}\n` +
        `⏱️ Runtime: ${runtime}\n\n` +
        `📝 ${overview}\n\n` +
        `🎞️ BFlix`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "⬅️ Back to results",
            "back"
          )
        ]
      ]);

      if (poster) {
        await ctx.replyWithPhoto(
          { url: poster },
          {
            caption: message,
            ...keyboard
          }
        );
      } else {
        await ctx.reply(
          message,
          keyboard
        );
      }

    } catch (error) {
      console.error("MOVIE DETAILS ERROR:", error);

      await ctx.reply(
        "❌ Couldn't load movie information."
      );
    }
  }
);

// ==============================
// SERIES DETAILS BUTTON
// ==============================

bot.action(
  /^details_tv_(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    try {
      await ctx.sendChatAction("typing");

      const show = await getSeries(ctx.match[1]);

      const title =
        show.name || "Unknown";

      const year =
        show.first_air_date
          ? show.first_air_date.substring(0, 4)
          : "Unknown";

      const rating =
        typeof show.vote_average === "number"
          ? show.vote_average.toFixed(1)
          : "N/A";

      const genres =
        show.genres &&
        show.genres.length
          ? show.genres
              .map((g) => g.name)
              .join(", ")
          : "N/A";

      const seasons =
        show.number_of_seasons || "N/A";

      const episodes =
        show.number_of_episodes || "N/A";

      const overview =
        show.overview ||
        "No description available.";

      const poster =
        show.poster_path
          ? `${TMDB_IMAGE}${show.poster_path}`
          : null;

      const message =
        `📺 ${title}\n\n` +
        `📅 First aired: ${year}\n` +
        `⭐ Rating: ${rating}/10\n` +
        `🎭 Genres: ${genres}\n` +
        `📚 Seasons: ${seasons}\n` +
        `🎞️ Episodes: ${episodes}\n\n` +
        `📝 ${overview}\n\n` +
        `🎞️ BFlix`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "⬅️ Back",
            "back"
          )
        ]
      ]);

      if (poster) {
        await ctx.replyWithPhoto(
          { url: poster },
          {
            caption: message,
            ...keyboard
          }
        );
      } else {
        await ctx.reply(
          message,
          keyboard
        );
      }

    } catch (error) {
      console.error("SERIES DETAILS ERROR:", error);

      await ctx.reply(
        "❌ Couldn't load series information."
      );
    }
  }
);

// ==============================
// BACK BUTTON
// ==============================

bot.action("back", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "🎬 BFlix\n\n" +
    "🔎 Send me another movie or series name.",
    homeMenu()
  );
});

// ==============================
// TELEGRAM ERROR
// ==============================

bot.catch((error) => {
  console.error("BOT ERROR:", error);
});

// ==============================
// EXPRESS SERVER
// ==============================

app.get("/", (req, res) => {
  res.send("🎬 BFlix Bot is running!");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ==============================
// START BOT
// ==============================

bot.launch()
  .then(() => {
    console.log("🤖 BFlix Telegram Bot is running!");
  })
  .catch((error) => {
    console.error("❌ Bot failed to start:", error);
  });

// ==============================
// GRACEFUL STOP
// ==============================

process.once("SIGINT", () => {
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
});