# 🤖 DTEmpire v2 Discord Bot

A feature-rich, multi-purpose Discord bot with AI capabilities, moderation tools, music streaming, economy system, and much more. Designed for modern Discord servers looking for an all-in-one solution.

---

## ✨ Features

### 📁 **AI Integration**
- **aichat** - Chat with various AI models
- **imagegen** - Generate AI-powered images
- **tts** - Convert text to speech
- **videogen** - Generate videos using AI

### 📁 **Music System**
- High-quality music playback from YouTube, Spotify, and more
- Queue management, volume control, and playback controls
- Now playing information and music queue display

### 📁 **Economy & Fun**
- Advanced economy system with properties, jobs, and lottery
- Giveaway management with customizable settings
- Message sniper and ghost ping detection
- Sticky message management for important announcements

### 📁 **Moderation & Administration**
- Comprehensive moderation tools (kick, ban, mute, warn)
- Automatic cleanup and message management
- Welcome/leave message configuration
- Essential log channel automation

### 📁 **Utility Tools**
- Server statistics and analytics
- User information lookup (whois)
- YouTube notification setup
- Auto voice room creation
- Direct messaging capabilities

---

## 🚀 Quick Setup

### Invite the Bot:
[![Invite DTEmpire](https://img.shields.io/badge/Invite-DTEmpire-blue?style=for-the-badge&logo=discord)](https://dsc.gg/dtempirev2)

### Support Server:
[![Support Server](https://img.shields.io/badge/Support-Server-purple?style=for-the-badge&logo=discord)](https://discord.gg/eVuKw3VrvX)

---

## 📋 Command Categories

### General Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `^help` | Shows all available commands | `^help [category]` |
| `^info` | Shows bot information | `^info` |
| `^uptime` | Shows bot uptime and system resources | `^uptime` |
| `^serverstats` | Get detailed server statistics | `^serverstats` |

### Music Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `^play` | Play music from various sources | `^play <song/url>` |
| `^pause` | Pause current song | `^pause` |
| `^resume` | Resume paused song | `^resume` |
| `^skip` | Skip current song | `^skip` |
| `^queue` | Show current music queue | `^queue` |
| `^volume` | Adjust music volume | `^volume <1-100>` |
| `^stop` | Stop music and clear queue | `^stop` |

### AI Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `^aichat` | Chat with AI models | `^aichat <message>` |
| `^imagegen` | Generate AI images | `^imagegen <prompt>` |
| `^tts` | Convert text to speech | `^tts <text>` |
| `^videogen` | Generate AI videos | `^videogen <prompt>` |

### Moderation Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `^mod` | Moderation command hub | `^mod <action> <user>` |
| `^cleanup` | Clean up messages | `^cleanup <amount>` |
| `^welcome` | Configure welcome messages | `^welcome setup` |

---

## ⚙️ Configuration

### Channel Setup
```bash
^setchannel <type> <#channel>
```
Configure specific channels for:
- Welcome messages
- Logging
- Giveaways
- Music commands

### Automatic Setup
```bash
^setlogs
```
Automatically creates essential log channels in a specified category.

---

## 🎮 Economy System

### Features:
- **Properties**: Own and manage virtual properties
- **Jobs**: Complete jobs to earn currency
- **Lottery**: Participate in regular lottery draws
- **Banking**: Safe storage for your earnings

```bash
^economy balance    # Check your balance
^economy work       # Complete a job
^economy properties # View available properties
```

---

## 🔧 Requirements

- **Node.js**: v16.9.0 or higher
- **Discord.js**: v14 or higher
- **Permissions**: Administrative permissions recommended
- **Python**: Required for some AI features (optional)

---

## 🛠️ Self-Hosting

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/DTEmpire.git
cd DTEmpire
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**
Create a `.env` file:
```env
DISCORD_TOKEN=your_bot_token_here
SPOTIFY_CLIENT_ID=your_spotify_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
```

4. **Start the bot:**
```bash
npm start
```

---

## 📊 Statistics

- **Version**: 2.6.9
- **Total Commands**: 33
- **Categories**: 8
- **Uptime**: 99.8%
- **Servers**: 500+ (example)

---

## 🤝 Support

- **Documentation**: [View Wiki](https://docs.ankitgupta.com.np/)
- **Bug Reports**: [GitHub Issues](https://github.com/hyperdargo/DTEmpire-v2/issues)
- **Feature Requests**: [Suggest Features](https://github.com/hyperdargo/DTEmpire-v2/discussions)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**DargoTamber**
- GitHub: [@DargoTamber](https://github.com/hyperdargo)
- Discord: DargoTamber

---

*Last Updated: v2.6.9 | Made with ❤️ for the Discord community*
```
