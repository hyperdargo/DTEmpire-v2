<p align="center">
  <img src="https://i.imgur.com/exDGDGc.png" alt="DTEmpire Banner" />
</p>

<h1 align="center">🤖 DTEmpire v2</h1>

<p align="center">
  A powerful, all-in-one Discord bot featuring AI chat, music, moderation, economy, and utilities.
</p>

<p align="center">
  <a href="https://dsc.gg/dtempirev2">
    <img src="https://img.shields.io/badge/Invite-DTEmpire-blue?style=for-the-badge&logo=discord" />
  </a>
  <a href="https://discord.gg/eVuKw3VrvX">
    <img src="https://img.shields.io/badge/Support-Server-purple?style=for-the-badge&logo=discord" />
  </a>
  <img src="https://img.shields.io/badge/Version-2.8.0-green?style=for-the-badge" />
</p>

---

## 📌 Overview

**DTEmpire** is a feature-rich Discord bot with **54 commands** across **12 categories**.

- **Prefix:** `^`
- **Stack:** Discord.js v14 + Riffy (Lavalink) + Axios
- **AI:** 9router API (OpenAI-compatible)
- **Music:** YouTube, Spotify (scrape-backed), SoundCloud

---

## ✨ Features

- 🤖 **AI Chat** — Powered by 9router API (Discord model combo with fallback)
- 🖼️ **AI Image Generation** — Flux, Pollinations
- 🔊 **Text-to-Speech** — Google TTS fallback
- 🎵 **Music System** — YouTube, Spotify playlists/tracks, SoundCloud, DJ mode, AI recommendations
- 🛠️ **Moderation** — Auto-mod, link protection, bad words, logging
- 💰 **Economy** — Jobs, properties, bank, lottery, loans, tax giveaways
- 🎫 **Ticket System** — Full support ticket management
- 📊 **Leveling** — XP, rank, leaderboard
- 📈 **Server Stats** — Detailed analytics
- ⚙️ **Automation** — Auto rooms, YouTube alerts, sticky messages

---

## 🚀 Quick Start

```bash
git clone https://github.com/hyperdargo/DTEmpire-v2.git
cd DTEmpire-v2
cp .env.example .env
# Edit .env with your tokens
npm install
npm start
```

### Required Environment Variables

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Discord bot token |
| `SPOTIFY_CLIENT_ID` | Spotify API client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify API client secret |
| `LAVALINK_HOST` | Lavalink server host |
| `LAVALINK_PASSWORD` | Lavalink server password |
| `AI_API_KEY` | 9router API key |
| `BOT_OWNER_ID` | Your Discord user ID |

---

## 🆕 Recent Changes (v2.8.0)

- **AI Chat reworked** — Switched to OpenAI-compatible 9router API with Discord model combo
- **Spotify playback** — Works without Spotify Premium (scrapes metadata, plays via YouTube source)
- **CORS + rate limiting** added to Express API
- **Input sanitization** for user-submitted content
- **Secrets removed from source** — All tokens/keys moved to environment variables
- **Retry logic removed** — API calls wait indefinitely for response

---

## 🤝 Support

- [Discord Server](https://discord.gg/eVuKw3VrvX)
- [Docs](https://docs.ankitgupta.com.np/)
- GitHub Issues for bug reports

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  Built with ❤️ by DargoTamber
</p>

