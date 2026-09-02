const express = require("express");
const { Telegraf, Markup } = require("telegraf");
const OpenAI = require("openai");

const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 10000;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY
    })
  : null;

const TMDB_BASE_URL =
  "https://api.themoviedb.org/3";

const TMDB_IMAGE_URL =
  "https://image.tmdb.org/t/p/w500";

// ===============================
// CHECK ENVIRONMENT
// ===============================

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing!");
}

if (!TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY is missing!");
}

if (!OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY is missing!");
}

// ===============================
// USER DATA
// ===============================

const favorites = new Map();

const aiSupportUsers = new Set();
const aiConversations = new Map();

// ===============================
// MAIN MENU
// ===============================

function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔎 Search", "search"),
      Markup.button.callback("▶️ To Watch", "watch")
    ],
    [
      Markup.button.callback("🎬 Movies", "movies"),
      Markup.button.callback("📺 Series", "series")
    ],
    [
      Markup.button.callback("🎭 Genres", "genres"),
      Markup.button.callback("🔥 Trending", "trending")
    ],
    [
      Markup.button.callback("⭐ Favorites", "favorites"),
      Markup.button.callback("ℹ️ Help", "help")
    ]
  ]);
}

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
    (item) =>
      item.media_type === "movie" ||
      item.media_type === "tv"
  );
}

// ===============================
// MOVIE DETAILS
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
// TV DETAILS
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
// WATCH PROVIDERS
// ===============================

async function getWatchProviders(type, id) {
  const url =
    `${TMDB_BASE_URL}/${type}/${id}/watch/providers` +
    `?api_key=${encodeURIComponent(TMDB_API_KEY)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Watch providers error: ${response.status}`
    );
  }

  return await response.json();
}

// ===============================
// WATCH BUTTONS
// ===============================

function buildWatchButtons(country) {
  const buttons = [];

  const groups = [
    ["flatrate", "📺 Stream"],
    ["free", "🆓 Free"],
    ["ads", "📺 Free with Ads"],
    ["rent", "💳 Rent"],
    ["buy", "🛒 Buy"]
  ];

  for (const [group, label] of groups) {
    const providers = country[group];

    if (!providers || !providers.length) {
      continue;
    }

    const seen = new Set();

    for (const provider of providers.slice(0, 4)) {
      if (seen.has(provider.provider_id)) {
        continue;
      }

      seen.add(provider.provider_id);

      buttons.push([
        Markup.button.url(
          `${label}: ${provider.provider_name}`,
          country.link
        )
      ]);
    }
  }

  return buttons;
}

// ===============================
// JUSTWATCH FALLBACK
// ===============================

function justWatchSearch(title) {
  return (
    `https://www.justwatch.com/search?q=` +
    encodeURIComponent(title)
  );
}

// ===============================
// START
// ===============================

bot.start(async (ctx) => {
  const userId = ctx.from.id;

  aiSupportUsers.delete(userId);
  aiConversations.delete(userId);

  await ctx.reply(
    `🎬 Welcome to BFlix!\n\n` +
    `🍿 Discover movies and series.\n` +
    `🔎 Search for any title.\n` +
    `⭐ Check ratings and details.\n` +
    `▶️ Find legal watch options.\n` +
    `🔥 Explore trending titles.\n\n` +
    `✨ Enjoy your cinematic experience!`,
    mainMenu()
  );
});

// ===============================
// SEARCH
// ===============================

bot.action("search", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🔎 BFlix Search\n\n` +
    `Send me the name of a movie or series.\n\n` +
    `Example:\n` +
    `Interstellar`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("⬅️ Back", "home")
      ]
    ])
  );
});

// ===============================
// TO WATCH
// ===============================

bot.action("watch", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `▶️ To Watch\n\n` +
    `Send me the name of a movie or series.\n\n` +
    `BFlix will show legal viewing options when available.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("⬅️ Back", "home")
      ]
    ])
  );
});

// ===============================
// AI SUPPORT
// ===============================

bot.action("help", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;

  aiSupportUsers.add(userId);
  aiConversations.set(userId, []);

  await ctx.editMessageText(
    `🤖 BFlix AI Support\n\n` +
    `Hi! I'm BFlix's AI support assistant.\n\n` +
    `💬 Tell me what problem you're having and I'll help you.\n\n` +
    `You can ask about:\n` +
    `🔎 Search\n` +
    `🎬 Movies\n` +
    `📺 Series\n` +
    `⭐ Favorites\n` +
    `▶️ Watch options\n` +
    `⚙️ Using BFlix`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🔙 Exit Support",
          "exit_ai"
        )
      ]
    ])
  );
});

// ===============================
// EXIT AI SUPPORT
// ===============================

bot.action("exit_ai", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;

  aiSupportUsers.delete(userId);
  aiConversations.delete(userId);

  await ctx.editMessageText(
    `🎬 Welcome back to BFlix!\n\n` +
    `🍿 Discover movies and series.\n` +
    `🔎 Search your next title.\n` +
    `▶️ Find legal watch options.\n` +
    `🔥 Explore trending titles.\n` +
    `⭐ Save your favorites.`,
    mainMenu()
  );
});

// ===============================
// TEXT HANDLER
// ===============================

bot.on("text", async (ctx) => {
  const query = ctx.message.text.trim();

  if (!query || query.startsWith("/")) {
    return;
  }

  const userId = ctx.from.id;

  // =============================
  // AI SUPPORT MODE
  // =============================

  if (aiSupportUsers.has(userId)) {
    if (!openai) {
      return ctx.reply(
        `⚠️ BFlix AI Support is currently unavailable.\n\n` +
        `Please try again later.`
      );
    }

    try {
      await ctx.sendChatAction("typing");

      let history =
        aiConversations.get(userId) || [];

      history.push({
        role: "user",
        content: query
      });

      history = history.slice(-10);

      const response =
        await openai.responses.create({
          model: "gpt-5.6-luna",

          instructions:
            `You are BFlix AI Support, the official support assistant for the BFlix Telegram bot.\n\n` +

            `Help users with:\n` +
            `- Searching movies and series\n` +
            `- Movie and series details\n` +
            `- Ratings and release dates\n` +
            `- Legal watch options\n` +
            `- Favorites\n` +
            `- BFlix buttons and navigation\n` +
            `- General BFlix usage\n\n` +

            `Rules:\n` +
            `- Reply in the same language as the user.\n` +
            `- Be friendly and professional.\n` +
            `- Keep answers concise but useful.\n` +
            `- Never invent BFlix features.\n` +
            `- Never provide piracy or illegal streaming sources.\n` +
            `- Never reveal API keys, tokens, passwords or server secrets.\n` +
            `- If you don't know something, say so honestly.`,

          input: history
        });

      const answer =
        response.output_text ||
        "Sorry, I couldn't generate a response right now.";

      history.push({
        role: "assistant",
        content: answer
      });

      aiConversations.set(
        userId,
        history.slice(-10)
      );

      await ctx.reply(
        `🤖 ${answer}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🔙 Exit Support",
              "exit_ai"
            )
          ]
        ])
      );

    } catch (error) {
      console.error(
        "OpenAI Support Error:",
        error
      );

      await ctx.reply(
        `❌ BFlix AI Support is temporarily unavailable.\n\n` +
        `Please try again in a moment.`
      );
    }

    return;
  }

  // =============================
  // NORMAL SEARCH
  // =============================

  if (!TMDB_API_KEY) {
    return ctx.reply(
      "❌ TMDB API Key is not configured."
    );
  }

  try {
    await ctx.reply("🔎 Searching BFlix... 🍿");

    const results =
      await searchTMDB(query);

    if (!results.length) {
      return ctx.reply(
        `❌ No results found for "${query}".\n\n` +
        `Try another title.`
      );
    }

    const limitedResults =
      results.slice(0, 10);

    const buttons =
      limitedResults.map((item) => {
        const title =
          item.media_type === "movie"
            ? item.title
            : item.name;

        const year =
          item.media_type === "movie"
            ? item.release_date?.slice(0, 4)
            : item.first_air_date?.slice(0, 4);

        const icon =
          item.media_type === "movie"
            ? "🎬"
            : "📺";

        return [
          Markup.button.callback(
            `${icon} ${title}${year ? ` (${year})` : ""}`,
            `tmdb_${item.media_type}_${item.id}`
          )
        ];
      });

    await ctx.reply(
      `🔎 Results for "${query}":`,
      Markup.inlineKeyboard(buttons)
    );

  } catch (error) {
    console.error(
      "TMDB Search Error:",
      error
    );

    await ctx.reply(
      `❌ Search failed.\n\n` +
      `Please try again later.`
    );
  }
});

// ===============================
// MOVIE DETAILS
// ===============================

bot.action(
  /^tmdb_movie_(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    try {
      const movie =
        await getMovieDetails(ctx.match[1]);

      const title =
        movie.title || "Unknown";

      const year =
        movie.release_date?.slice(0, 4) ||
        "Unknown";

      const rating =
        movie.vote_average
          ? movie.vote_average.toFixed(1)
          : "N/A";

      const genres =
        movie.genres?.map(
          (genre) => genre.name
        ).join(", ") || "N/A";

      const overview =
        movie.overview ||
        "No description available.";

      const runtime =
        movie.runtime
          ? `${movie.runtime} min`
          : "N/A";

      const poster =
        movie.poster_path
          ? `${TMDB_IMAGE_URL}${movie.poster_path}`
          : null;

      let watchButtons = [];

      // Only Algeria
      try {
        const providerData =
          await getWatchProviders(
            "movie",
            movie.id
          );

        const country =
          providerData.results?.DZ;

        if (country?.link) {
          watchButtons =
            buildWatchButtons(country);

          if (!watchButtons.length) {
            watchButtons.push([
              Markup.button.url(
                "▶️ Watch legally",
                country.link
              )
            ]);
          }
        }
      } catch (error) {
        console.error(
          "Watch Provider Error:",
          error.message
        );
      }

      if (!watchButtons.length) {
        watchButtons.push([
          Markup.button.url(
            "🔎 Find legal options",
            justWatchSearch(title)
          )
        ]);
      }

      const buttons = [
        [
          Markup.button.callback(
            "⭐ Add to Favorites",
            `tmdbfav_movie_${movie.id}`
          )
        ],
        ...watchButtons,
        [
          Markup.button.callback(
            "⬅️ Back",
            "home"
          )
        ]
      ];

      const caption =
        `🎬 ${title}\n\n` +
        `📅 Release: ${year}\n` +
        `⭐ Rating: ${rating}/10\n` +
        `🎭 Genres: ${genres}\n` +
        `⏱️ Runtime: ${runtime}\n\n` +
        `📝 ${overview}\n\n` +
        `🎞️ BFlix`;

      if (poster) {
        await ctx.replyWithPhoto(
          { url: poster },
          {
            caption,
            ...Markup.inlineKeyboard(buttons)
          }
        );
      } else {
        await ctx.reply(
          caption,
          Markup.inlineKeyboard(buttons)
        );
      }

    } catch (error) {
      console.error(
        "Movie Details Error:",
        error
      );

      await ctx.reply(
        "❌ Couldn't load movie information."
      );
    }
  }
);

// ===============================
// TV DETAILS
// ===============================

bot.action(
  /^tmdb_tv_(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    try {
      const show =
        await getTVDetails(ctx.match[1]);

      const title =
        show.name || "Unknown";

      const year =
        show.first_air_date?.slice(0, 4) ||
        "Unknown";

      const rating =
        show.vote_average
          ? show.vote_average.toFixed(1)
          : "N/A";

      const genres =
        show.genres?.map(
          (genre) => genre.name
        ).join(", ") || "N/A";

      const overview =
        show.overview ||
        "No description available.";

      const seasons =
        show.number_of_seasons || "N/A";

      const episodes =
        show.number_of_episodes || "N/A";

      const poster =
        show.poster_path
          ? `${TMDB_IMAGE_URL}${show.poster_path}`
          : null;

      let watchButtons = [];

      try {
        const providerData =
          await getWatchProviders(
            "tv",
            show.id
          );

        const country =
          providerData.results?.DZ;

        if (country?.link) {
          watchButtons =
            buildWatchButtons(country);

          if (!watchButtons.length) {
            watchButtons.push([
              Markup.button.url(
                "▶️ Watch legally",
                country.link
              )
            ]);
          }
        }
      } catch (error) {
        console.error(
          "TV Provider Error:",
          error.message
        );
      }

      if (!watchButtons.length) {
        watchButtons.push([
          Markup.button.url(
            "🔎 Find legal options",
            justWatchSearch(title)
          )
        ]);
      }

      const buttons = [
        [
          Markup.button.callback(
            "⭐ Add to Favorites",
            `tmdbfav_tv_${show.id}`
          )
        ],
        ...watchButtons,
        [
          Markup.button.callback(
            "⬅️ Back",
            "home"
          )
        ]
      ];

      const caption =
        `📺 ${title}\n\n` +
        `📅 First aired: ${year}\n` +
        `⭐ Rating: ${rating}/10\n` +
        `🎭 Genres: ${genres}\n` +
        `📚 Seasons: ${seasons}\n` +
        `🎞️ Episodes: ${episodes}\n\n` +
        `📝 ${overview}\n\n` +
        `🎞️ BFlix`;

      if (poster) {
        await ctx.replyWithPhoto(
          { url: poster },
          {
            caption,
            ...Markup.inlineKeyboard(buttons)
          }
        );
      } else {
        await ctx.reply(
          caption,
          Markup.inlineKeyboard(buttons)
        );
      }

    } catch (error) {
      console.error(
        "TV Details Error:",
        error
      );

      await ctx.reply(
        "❌ Couldn't load series information."
      );
    }
  }
);

// ===============================
// FAVORITES
// ===============================

bot.action(
  /^tmdbfav_(movie|tv)_(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery(
      "Added to favorites ⭐"
    );

    const userId = ctx.from.id;

    if (!favorites.has(userId)) {
      favorites.set(userId, []);
    }

    const list =
      favorites.get(userId);

    const item =
      `${ctx.match[1]}_${ctx.match[2]}`;

    if (!list.includes(item)) {
      list.push(item);
    }

    await ctx.reply(
      "⭐ Added to your favorites!"
    );
  }
);

// ===============================
// MOVIES
// ===============================

bot.action("movies", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🎬 Movies\n\n` +
    `Search for any movie using BFlix.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🔎 Search Movies",
          "search"
        )
      ],
      [
        Markup.button.callback(
          "⬅️ Back",
          "home"
        )
      ]
    ])
  );
});

// ===============================
// SERIES
// ===============================

bot.action("series", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `📺 Series\n\n` +
    `Search for any series using BFlix.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🔎 Search Series",
          "search"
        )
      ],
      [
        Markup.button.callback(
          "⬅️ Back",
          "home"
        )
      ]
    ])
  );
});

// ===============================
// GENRES
// ===============================

bot.action("genres", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.editMessageText(
    `🎭 Genres\n\nChoose a category:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "😂 Comedy",
          "genre_comedy"
        ),
        Markup.button.callback(
          "💥 Action",
          "genre_action"
        )
      ],
      [
        Markup.button.callback(
          "👻 Horror",
          "genre_horror"
        ),
        Markup.button.callback(
          "❤️ Romance",
          "genre_romance"
        )
      ],
      [
        Markup.button.callback(
          "🚀 Sci-Fi",
          "genre_scifi"
        ),
        Markup.button.callback(
          "🕵️ Thriller",
          "genre_thriller"
        )
      ],
      [
        Markup.button.callback(
          "⬅️ Back",
          "home"
        )
      ]
    ])
  );
});

// ===============================
// GENRE SEARCH
// ===============================

const genreIds = {
  comedy: 35,
  action: 28,
  horror: 27,
  romance: 10749,
  scifi: 878,
  thriller: 53
};

bot.action(
  /^genre_(comedy|action|horror|romance|scifi|thriller)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const genre =
      ctx.match[1];

    const genreId =
      genreIds[genre];

    try {
      const url =
        `${TMDB_BASE_URL}/discover/movie` +
        `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
        `&with_genres=${genreId}` +
        `&sort_by=popular      `&language=en-US`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Genre error: ${response.status}`
        );
      }

      const data = await response.json();

      const results =
        (data.results || []).slice(0, 10);

      if (!results.length) {
        return ctx.reply(
          "❌ No movies found."
        );
      }

      const buttons = results.map((movie) => [
        Markup.button.callback(
          `🎬 ${movie.title}` +
            `${movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ""}`,
          `tmdb_movie_${movie.id}`
        )
      ]);

      await ctx.reply(
        `🎭 ${genre.toUpperCase()} Movies`,
        Markup.inlineKeyboard(buttons)
      );

    } catch (error) {
      console.error(
        "Genre Error:",
        error
      );

      await ctx.reply(
        "❌ Couldn't load this genre."
      );
    }
  }
);

// ===============================
// TRENDING
// ===============================

bot.action("trending", async (ctx) => {
  await ctx.answerCbQuery();

  try {
    const url =
      `${TMDB_BASE_URL}/trending/all/week` +
      `?api_key=${encodeURIComponent(TMDB_API_KEY)}` +
      `&language=en-US`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Trending error: ${response.status}`
      );
    }

    const data = await response.json();

    const results =
      (data.results || [])
        .filter(
          (item) =>
            item.media_type === "movie" ||
            item.media_type === "tv"
        )
        .slice(0, 10);

    const buttons = results.map((item) => {
      const title =
        item.media_type === "movie"
          ? item.title
          : item.name;

      const icon =
        item.media_type === "movie"
          ? "🎬"
          : "📺";

      return [
        Markup.button.callback(
          `${icon} ${title}`,
          `tmdb_${item.media_type}_${item.id}`
        )
      ];
    });

    await ctx.editMessageText(
      `🔥 Trending This Week`,
      Markup.inlineKeyboard([
        ...buttons,
        [
          Markup.button.callback(
            "⬅️ Back",
            "home"
          )
        ]
      ])
    );

  } catch (error) {
    console.error(
      "Trending Error:",
      error
    );

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

  const list =
    favorites.get(userId) || [];

  if (!list.length) {
    return ctx.editMessageText(
      `⭐ Favorites\n\n` +
      `You don't have any favorites yet.\n\n` +
      `Open a movie or series and press ⭐ Add to Favorites.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🔎 Search",
            "search"
          )
        ],
        [
          Markup.button.callback(
            "⬅️ Back",
            "home"
          )
        ]
      ])
    );
  }

  const buttons =
    list.slice(-20).map((item) => {
      const [type, id] =
        item.split("_");

      return [
        Markup.button.callback(
          type === "movie"
            ? `🎬 Movie #${id}`
            : `📺 Series #${id}`,
          `tmdb_${type}_${id}`
        )
      ];
    });

  await ctx.editMessageText(
    `⭐ Your Favorites\n\n` +
    `Saved titles: ${list.length}`,
    Markup.inlineKeyboard([
      ...buttons,
      [
        Markup.button.callback(
          "⬅️ Back",
          "home"
        )
      ]
    ])
  );
});

// ===============================
// HOME
// ===============================

bot.action("home", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;

  aiSupportUsers.delete(userId);
  aiConversations.delete(userId);

  await ctx.editMessageText(
    `🎬 Welcome back to BFlix!\n\n` +
    `🍿 Discover movies and series.\n` +
    `🔎 Search your next title.\n` +
    `▶️ Find legal watch options.\n` +
    `🔥 Explore trending titles.\n` +
    `⭐ Save your favorites.\n\n` +
    `✨ Enjoy your cinematic experience!`,
    mainMenu()
  );
});

// ===============================
// /HELP
// ===============================

bot.help(async (ctx) => {
  const userId = ctx.from.id;

  aiSupportUsers.add(userId);
  aiConversations.set(userId, []);

  await ctx.reply(
    `🤖 BFlix AI Support\n\n` +
    `Tell me what you need help with and I'll assist you.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🔙 Exit Support",
          "exit_ai"
        )
      ]
    ])
  );
});

// ===============================
// EXPRESS SERVER
// ===============================

app.get("/", (req, res) => {
  res.send(
    "🎬 BFlix Bot is running!"
  );
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "BFlix",
    ai: Boolean(openai),
    tmdb: Boolean(TMDB_API_KEY)
  });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(
    `🌐 BFlix server running on port ${PORT}`
  );
});

// ===============================
// START BOT
// ===============================

bot.launch()
  .then(() => {
    console.log(
      "🤖 BFlix bot started successfully!"
    );
  })
  .catch((error) => {
    console.error(
      "❌ Bot launch error:",
      error
    );
  });

// ===============================
// GRACEFUL SHUTDOWN
// ===============================

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);