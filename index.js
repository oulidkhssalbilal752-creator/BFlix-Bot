const express = require("express");
const { Telegraf, Markup } = require("telegraf");
const OpenAI = require("openai");

const app = express();

const BOT_TOKEN = process.env.BOT_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PORT = process.env.PORT || 10000;

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing");
  process.exit(1);
}

if (!TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY is missing");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

// ==============================
// WEB SERVER
// ==============================

app.get("/", (req, res) => {
  res.send("🎬 BFlixBot is running!");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "BFlixBot"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ==============================
// TMDB REQUEST
// ==============================

async function tmdb(endpoint, params = {}) {
  const url = new URL(TMDB_BASE + endpoint);

  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB error: ${response.status}`);
  }

  return response.json();
}

// ==============================
// HELPERS
// ==============================

function formatTitle(item) {
  return item.title || item.name || "Unknown";
}

function formatDate(item) {
  return item.release_date || item.first_air_date || "Unknown";
}

function posterUrl(item) {
  if (!item.poster_path) return null;
  return TMDB_IMAGE + item.poster_path;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==============================
// SMART SEARCH NORMALIZATION
// ==============================

function normalizeTitle(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchScore(query, title, item) {
  const q = normalizeTitle(query);
  const t = normalizeTitle(title);

  if (!q || !t) return 0;

  // Exact match
  if (t === q) {
    return 1000;
  }

  // Exact phrase at beginning
  if (t.startsWith(q)) {
    return 800;
  }

  // Exact phrase somewhere
  if (t.includes(q)) {
    return 600;
  }

  const queryWords = q.split(" ").filter(Boolean);
  const titleWords = t.split(" ").filter(Boolean);

  let matched = 0;

  for (const word of queryWords) {
    if (titleWords.includes(word)) {
      matched++;
    }
  }

  let score = matched * 100;

  // Prefer titles with similar length
  const lengthDifference = Math.abs(q.length - t.length);

  score -= Math.min(lengthDifference, 50);

  // Small popularity bonus
  score += Math.min(item.popularity || 0, 50);

  return score;
}

// ==============================
// SMART MOVIE / TV SEARCH
// ==============================

async function smartSearch(query) {
  const [movies, tvShows] = await Promise.all([
    tmdb("/search/movie", {
      query,
      include_adult: "false",
      page: "1"
    }),

    tmdb("/search/tv", {
      query,
      include_adult: "false",
      page: "1"
    })
  ]);

  const movieResults = (movies.results || []).map(item => ({
    ...item,
    media_type: "movie"
  }));

  const tvResults = (tvShows.results || []).map(item => ({
    ...item,
    media_type: "tv"
  }));

  const combined = [...movieResults, ...tvResults];

  const scored = combined.map(item => ({
    ...item,
    _score: searchScore(
      query,
      formatTitle(item),
      item
    )
  }));

  scored.sort((a, b) => {
    if (b._score !== a._score) {
      return b._score - a._score;
    }

    return (b.popularity || 0) - (a.popularity || 0);
  });

  return scored
    .filter(item => item.poster_path || item.overview)
    .slice(0, 10);
}

// ==============================
// MOVIE DETAILS
// ==============================

async function sendMovie(ctx, item) {
  try {
    const type =
      item.media_type === "tv"
        ? "tv"
        : "movie";

    const details = await tmdb(`/${type}/${item.id}`, {
      append_to_response: "watch/providers"
    });

    const title = formatTitle(details);

    const rating =
      typeof details.vote_average === "number"
        ? details.vote_average.toFixed(1)
        : "N/A";

    const date = formatDate(details);

    const genres = details.genres?.length
      ? details.genres.map(g => g.name).join(", ")
      : "N/A";

    const overview =
      details.overview ||
      "No description available.";

    let text =
      `🎬 <b>${escapeHtml(title)}</b>\n\n` +
      `⭐ Rating: <b>${rating}/10</b>\n` +
      `📅 Release: <b>${escapeHtml(date)}</b>\n` +
      `🎭 Genres: <b>${escapeHtml(genres)}</b>\n` +
      `📺 Type: <b>${type === "tv" ? "TV Show" : "Movie"}</b>\n\n` +
      `📖 <b>Overview</b>\n` +
      `${escapeHtml(overview)}`;

    const buttons = [];

    buttons.push([
      Markup.button.url(
        "🎬 Open on TMDB",
        `https://www.themoviedb.org/${type}/${details.id}`
      )
    ]);

    // Legal watch providers - US
    const providers =
      details.watch_providers?.results?.US;

    if (providers?.link) {
      buttons.push([
        Markup.button.url(
          "▶️ Watch legally",
          providers.link
        )
      ]);
    }

    buttons.push([
      Markup.button.callback(
        "🔎 Search again",
        "SEARCH_AGAIN"
      )
    ]);

    const poster = posterUrl(details);

    if (poster) {
      await ctx.replyWithPhoto(
        { url: poster },
        {
          caption: text,
          parse_mode: "HTML",
          ...Markup.inlineKeyboard(buttons)
        }
      );
    } else {
      await ctx.reply(
        text,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard(buttons)
        }
      );
    }
  } catch (error) {
    console.error("Movie details error:", error);

    await ctx.reply(
      "❌ Sorry, I couldn't load this title right now."
    );
  }
}

// ==============================
// START
// ==============================

bot.start(async (ctx) => {
  await ctx.reply(
    `🎬 <b>Welcome to BFlix!</b>

🔎 Search for movies and TV shows.
⭐ Get ratings and detailed information.
🔥 Discover trending titles.
🎭 Browse popular genres.

🤖 Need help? Use /help

Just send me the name of a movie or TV show.`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🔎 Search",
            "SEARCH_AGAIN"
          ),
          Markup.button.callback(
            "🔥 Trending",
            "TRENDING"
          )
        ],
        [
          Markup.button.callback(
            "⭐ Popular",
            "POPULAR"
          ),
          Markup.button.callback(
            "🤖 AI Help",
            "AI_HELP"
          )
        ]
      ])
    }
  );
});

// ==============================
// AI HELP
// ==============================

async function aiHelp(ctx) {
  if (!openai) {
    console.error(
      "❌ OPENAI_API_KEY is missing"
    );

    return ctx.reply(
      "🤖 AI Help is currently unavailable because the OpenAI API key is not configured."
    );
  }

  try {
    await ctx.sendChatAction("typing");

    const response =
      await openai.responses.create({
        model: "gpt-5-mini",

        input: `
You are the AI assistant inside BFlix,
a Telegram movie and TV show bot.

Explain briefly and clearly how users can use BFlix.

Mention that users can:
- Search for movies and TV shows
- View ratings
- View release dates
- View genres
- Read descriptions
- Find legal viewing options

Reply in English.
Be friendly.
Use emojis.
Keep the answer short.
`
      });

    const answer =
      response.output_text?.trim();

    if (!answer) {
      return ctx.reply(
        "🤖 BFlix helps you discover movies and TV shows."
      );
    }

    await ctx.reply(answer);

  } catch (error) {
    console.error(
      "❌ OpenAI error:",
      error
    );

    const status =
      error?.status || "unknown";

    console.error(
      "OpenAI status:",
      status
    );

    await ctx.reply(
      "❌ AI Help is temporarily unavailable. Please try again later."
    );
  }
}

bot.help(aiHelp);

bot.action(
  "AI_HELP",
  async (ctx) => {
    await ctx.answerCbQuery();
    await aiHelp(ctx);
  }
);

// ==============================
// TRENDING
// ==============================

async function trending(ctx) {
  try {
    await ctx.sendChatAction("typing");

    const data =
      await tmdb("/trending/all/day");

    const results =
      data.results?.filter(
        item =>
          item.media_type === "movie" ||
          item.media_type === "tv"
      ).slice(0, 10) || [];

    if (!results.length) {
      return ctx.reply(
        "❌ No trending titles found."
      );
    }

    let message =
      "🔥 <b>Trending Today</b>\n\n";

    results.forEach((item, index) => {
      message +=
        `${index + 1}. ` +
        `<b>${escapeHtml(formatTitle(item))}</b>` +
        ` ⭐ ${item.vote_average?.toFixed(1) || "N/A"}\n`;
    });

    await ctx.reply(
      message,
      {
        parse_mode: "HTML"
      }
    );

  } catch (error) {
    console.error(
      "Trending error:",
      error
    );

    await ctx.reply(
      "❌ Failed to load trending titles."
    );
  }
}

// ==============================
// POPULAR
// ==============================

async function popular(ctx) {
  try {
    await ctx.sendChatAction("typing");

    const data =
      await tmdb("/movie/popular");

    const results =
      data.results?.slice(0, 10) || [];

    if (!results.length) {
      return ctx.reply(
        "❌ No popular movies found."
      );
    }

    let message =
      "⭐ <b>Popular Movies</b>\n\n";

    results.forEach((item, index) => {
      message +=
        `${index + 1}. ` +
        `<b>${escapeHtml(formatTitle(item))}</b>` +
        ` ⭐ ${item.vote_average?.toFixed(1) || "N/A"}\n`;
    });

    await ctx.reply(
      message,
      {
        parse_mode: "HTML"
      }
    );

  } catch (error) {
    console.error(
      "Popular error:",
      error
    );

    await ctx.reply(
      "❌ Failed to load popular movies."
    );
  }
}

// ==============================
// BUTTONS
// ==============================

bot.action(
  "TRENDING",
  async (ctx) => {
    await ctx.answerCbQuery();
    await trending(ctx);
  }
);

bot.action(
  "POPULAR",
  async (ctx) => {
    await ctx.answerCbQuery();
    await popular(ctx);
  }
);

bot.action(
  "SEARCH_AGAIN",
  async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      "🔎 Send me the name of a movie or TV show."
    );
  }
);

// ==============================
// TEXT SEARCH
// ==============================

bot.on("text", async (ctx) => {
  const query =
    ctx.message.text.trim();

  if (
    !query ||
    query.startsWith("/")
  ) {
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const results =
      await smartSearch(query);

    if (!results.length) {
      return ctx.reply(
        `❌ No results found for "<b>${escapeHtml(query)}</b>".`,
        {
          parse_mode: "HTML"
        }
      );
    }

    const buttons =
      results.map(item => [
        Markup.button.callback(
          `${item.media_type === "tv" ? "📺" : "🎬"} ${formatTitle(item).slice(0, 45)}`,
          `TITLE_${item.media_type}_${item.id}`
        )
      ]);

    await ctx.reply(
      `🔎 <b>Search results for:</b> ${escapeHtml(query)}\n\nChoose a title:`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard(buttons)
      }
    );

  } catch (error) {
    console.error(
      "Search error:",
      error
    );

    await ctx.reply(
      "❌ Search failed. Please try again."
    );
  }
});

// ==============================
// RESULT BUTTONS
// ==============================

bot.action(
  /^TITLE_(movie|tv)_(\d+)$/,
  async (ctx) => {

    await ctx.answerCbQuery();

    const type =
      ctx.match[1];

    const id =
      ctx.match[2];

    try {
      const data =
        await tmdb(`/${type}/${id}`, {
          append_to_response:
            "watch/providers"
        });

      await sendMovie(ctx, {
        ...data,
        media_type: type
      });

    } catch (error) {
      console.error(
        "Title button error:",
        error
      );

      await ctx.reply(
        "❌ Couldn't load this title."
      );
    }
  }
);

// ==============================
// COMMANDS
// ==============================

bot.command(
  "trending",
  trending
);

bot.command(
  "popular",
  popular
);

// ==============================
// BOT LAUNCH
// ==============================

bot.launch()
  .then(() => {
    console.log(
      "🎬 BFlixBot started successfully!"
    );
  })
  .catch(error => {
    console.error(
      "❌ Bot launch error:",
      error
    );
  });

// ==============================
// SHUTDOWN
// ==============================

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);