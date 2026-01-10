# Command Channel Restrictions System

## Overview
The Command Channel Restrictions system allows server administrators and bot owners to control which channels specific command categories can be used in. This helps keep your server organized by preventing commands from being used in wrong channels (e.g., music commands in economy channels, economy commands in music channels, etc.).

## Features
✅ **Category-based restrictions**: Set restrictions for entire command categories
✅ **Multiple channels**: Allow each category in multiple channels
✅ **Smart notifications**: Users get a friendly message showing where they should use the command
✅ **Auto-cleanup**: Restriction messages auto-delete after 5 seconds
✅ **Permission bypass**: Admins and bot owners bypass all restrictions
✅ **Easy management**: Simple commands to set, remove, and view restrictions

## How It Works
1. When a user tries to use a command in a restricted channel:
   - Their command message is deleted
   - Bot sends an embed showing where the command should be used
   - The notification automatically deletes after 5 seconds

2. Users with Administrator permission or bot owners always bypass restrictions

## Available Command Categories
- 🤖 **ai** - AI Commands (aichat, imagegen, tts, videogen)
- ⚙️ **admin** - Admin Commands (setchannel, setlogs, setmusicchannel)
- 💰 **economy** - Economy Commands (economy, eco, money)
- 🎮 **fun** - Fun Commands (giveaway, snipe, sticky)
- 📊 **info** - Info Commands (getguilds, servers, serverstats)
- ⭐ **leveling** - Leveling Commands (level, rank, xp)
- 🛡️ **moderation** - Moderation Commands (mod, cleanup, welcome)
- 🎵 **music** - Music Commands (play, queue, skip, stop)
- 🎫 **ticket** - Ticket Commands (ticket, support)
- 🔧 **utility** - Utility Commands (help, poll, suggest, announce)

## Commands

### View Current Restrictions
```
^setcommandchannel
^scc
```
Shows all current channel restrictions and available categories.

### Set Channel Restrictions
```
^setcommandchannel set <category> <#channel1> [#channel2] [...]
^scc set <category> <#channel1> [#channel2] [...]
```

**Examples:**
```
^scc set music #music-commands #bot-spam
^scc set economy #economy #general #chat
^scc set ai #ai-chat
^scc set fun #fun-commands #games
```

### Remove Category Restrictions
```
^setcommandchannel remove <category>
^scc remove <category>
```

**Examples:**
```
^scc remove music
^scc remove economy
```

### Clear All Restrictions
```
^setcommandchannel clear
^scc clear
```
Removes all channel restrictions for the server.

### List Restrictions
```
^setcommandchannel list
^scc list
```
Same as viewing with no arguments.

## Permission Requirements
- **Server Admins**: Users with Administrator permission can manage restrictions
- **Bot Owners**: Bot owners can always manage restrictions
- **Bypass**: Both admins and bot owners bypass channel restrictions when using commands

## Examples Scenarios

### Scenario 1: Keep Music Commands in Music Channels
```
^scc set music #music-bot #music-commands
```
Now users can only use music commands in those two channels. If they try elsewhere, they get a notification.

### Scenario 2: Economy Commands in Specific Channels
```
^scc set economy #economy #casino #general
```
Economy commands like ^eco, ^money, etc. can only be used in these channels.

### Scenario 3: AI Commands in Designated Channel
```
^scc set ai #ai-chat
```
All AI commands restricted to one channel to avoid spam.

### Scenario 4: Remove Music Restriction
```
^scc remove music
```
Music commands can now be used anywhere again.

### Scenario 5: Start Fresh
```
^scc clear
```
Removes all restrictions, allowing all commands everywhere.

## What Users See When Restricted

When a user tries to use a restricted command in the wrong channel, they see:

```
🚫 Command Restricted
Music Commands can only be used in specific channels!

📍 Use this command in:
#music-commands, #bot-spam

This message will be deleted in 5 seconds
```

Their original command message is also deleted automatically.

## Technical Details

### Database Storage
Channel restrictions are stored in `database.json` under the `channelRestrictions` object:
```json
{
  "channelRestrictions": {
    "guild_id_here": {
      "music": ["channel_id_1", "channel_id_2"],
      "economy": ["channel_id_3"],
      "ai": ["channel_id_4"]
    }
  }
}
```

### Code Files Modified
1. **utils/database.js** - Added channel restrictions methods
2. **events/messageCreate.js** - Added restriction check before command execution
3. **commands/admin/setcommandchannel.js** - New command file

### Command Aliases
The command has multiple aliases for convenience:
- `setcommandchannel`
- `scc` (short form)
- `commandchannel`
- `restrictcommands`

## Tips
1. **Start Specific**: Begin with the most problematic categories (usually music and economy)
2. **Multiple Channels**: Don't be afraid to allow categories in multiple channels
3. **Test It**: After setting restrictions, test with a non-admin account
4. **Clear If Needed**: If restrictions become too complex, use `^scc clear` and start over
5. **Document For Users**: Let your server members know which commands go where

## Troubleshooting

**Q: Commands still work in restricted channels for me**
A: You likely have Administrator permission or are a bot owner. Test with a regular user account.

**Q: How do I see current restrictions?**
A: Use `^scc` or `^setcommandchannel` with no arguments.

**Q: Can I set restrictions for specific commands instead of categories?**
A: Currently, the system works with categories only. This keeps it simple and manageable.

**Q: What if I delete a restricted channel?**
A: The restriction will remain but won't cause errors. You can remove the category restriction with `^scc remove <category>`.

**Q: Can I restrict the help command?**
A: Yes, it's part of the utility category. However, consider leaving utility commands accessible everywhere.

## Version
Command Channel Restrictions System v1.0
Added to DTEmpire v2.8.0
