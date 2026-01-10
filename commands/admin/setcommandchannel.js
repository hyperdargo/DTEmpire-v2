const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
    name: 'setcommandchannel',
    description: 'Set which channels specific command categories can be used in',
    aliases: ['scc', 'commandchannel', 'restrictcommands'],
    category: 'Admin',
    
    async execute(message, args, client, db) {
        // Check if user has Administrator permission or is bot owner
        const isBotOwner = client.botInfo.admins?.includes(message.author.id) || 
                          message.author.id === client.botInfo.ownerId;
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isBotOwner) {
            return message.reply('❌ You need **Administrator** permission or be a bot owner to use this command!');
        }
        
        const subCommand = args[0]?.toLowerCase();
        
        // Available command categories
        const categories = {
            'ai': { name: 'AI Commands', emoji: '🤖', examples: ['aichat', 'imagegen', 'tts', 'videogen'] },
            'admin': { name: 'Admin Commands', emoji: '⚙️', examples: ['setchannel', 'setlogs', 'setmusicchannel'] },
            'economy': { name: 'Economy Commands', emoji: '💰', examples: ['economy', 'eco', 'money'] },
            'fun': { name: 'Fun Commands', emoji: '🎮', examples: ['giveaway', 'snipe', 'sticky'] },
            'info': { name: 'Info Commands', emoji: '📊', examples: ['getguilds', 'servers', 'serverstats'] },
            'leveling': { name: 'Leveling Commands', emoji: '⭐', examples: ['level', 'rank', 'xp'] },
            'moderation': { name: 'Moderation Commands', emoji: '🛡️', examples: ['mod', 'cleanup', 'welcome'] },
            'music': { name: 'Music Commands', emoji: '🎵', examples: ['play', 'queue', 'skip', 'stop'] },
            'ticket': { name: 'Ticket Commands', emoji: '🎫', examples: ['ticket', 'support'] },
            'utility': { name: 'Utility Commands', emoji: '🔧', examples: ['help', 'poll', 'suggest', 'announce'] }
        };
        
        if (!subCommand) {
            // Show current restrictions and help
            const restrictions = await db.getChannelRestrictions(message.guild.id);
            
            let restrictionsList = '';
            let hasRestrictions = false;
            
            for (const [category, data] of Object.entries(categories)) {
                if (restrictions[category] && restrictions[category].length > 0) {
                    hasRestrictions = true;
                    const channels = restrictions[category]
                        .map(id => message.guild.channels.cache.get(id))
                        .filter(ch => ch)
                        .map(ch => ch.toString())
                        .join(', ');
                    
                    restrictionsList += `\n${data.emoji} **${data.name}**: ${channels || 'None'}`;
                }
            }
            
            if (!hasRestrictions) {
                restrictionsList = '\n*No channel restrictions set. Commands can be used anywhere.*';
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🔒 Command Channel Restrictions')
                .setDescription('Control which channels specific command categories can be used in.')
                .addFields(
                    { 
                        name: '📝 Usage', 
                        value: '```\n' +
                               '^setcommandchannel set <category> <#channel1> [#channel2] [...]\n' +
                               '^setcommandchannel remove <category>\n' +
                               '^setcommandchannel clear\n' +
                               '^setcommandchannel list\n' +
                               '```', 
                        inline: false 
                    },
                    { 
                        name: '📋 Available Categories', 
                        value: Object.entries(categories)
                            .map(([key, data]) => `${data.emoji} \`${key}\` - ${data.name}`)
                            .join('\n'), 
                        inline: false 
                    },
                    { 
                        name: '🔒 Current Restrictions', 
                        value: restrictionsList, 
                        inline: false 
                    }
                )
                .addFields(
                    { 
                        name: '💡 Examples', 
                        value: '`^scc set music #music-commands #bot-spam`\n' +
                               '`^scc set economy #economy #general`\n' +
                               '`^scc remove music`\n' +
                               '`^scc clear` - Remove all restrictions', 
                        inline: false 
                    },
                    {
                        name: '⚠️ Important Notes',
                        value: '• Users with Administrator permission bypass restrictions\n' +
                               '• Bot owners always bypass restrictions\n' +
                               '• When restricted, bot sends a temporary message showing where commands should be used\n' +
                               '• You can set multiple channels for each category',
                        inline: false
                    }
                )
                .setFooter({ text: 'DTEmpire Command Channel Restrictions' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Handle subcommands
        switch (subCommand) {
            case 'set':
            case 'add':
                await handleSetChannels(message, args.slice(1), db, categories);
                break;
                
            case 'remove':
            case 'delete':
                await handleRemoveChannels(message, args.slice(1), db, categories);
                break;
                
            case 'clear':
            case 'reset':
                await handleClearAll(message, db);
                break;
                
            case 'list':
            case 'view':
                // Show list (same as no args)
                return this.execute(message, [], client, db);
                
            default:
                return message.reply('❌ Invalid subcommand! Use: `set`, `remove`, `clear`, or `list`');
        }
    }
};

async function handleSetChannels(message, args, db, categories) {
    const category = args[0]?.toLowerCase();
    
    if (!category || !categories[category]) {
        return message.reply(`❌ Invalid category! Available categories:\n${Object.keys(categories).map(c => `\`${c}\``).join(', ')}`);
    }
    
    // Get mentioned channels
    const channels = message.mentions.channels.filter(ch => ch.type === ChannelType.GuildText);
    
    if (channels.size === 0) {
        return message.reply('❌ Please mention at least one text channel!\nExample: `^scc set music #music-commands #bot-spam`');
    }
    
    const channelIds = Array.from(channels.keys());
    
    try {
        await db.setCommandChannels(message.guild.id, category, channelIds);
        
        const channelList = channels.map(ch => ch.toString()).join(', ');
        const categoryData = categories[category];
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Channel Restrictions Updated')
            .setDescription(`${categoryData.emoji} **${categoryData.name}** can now only be used in:`)
            .addFields(
                { name: '📍 Allowed Channels', value: channelList, inline: false },
                { name: '📝 Commands Affected', value: categoryData.examples.map(cmd => `\`${cmd}\``).join(', '), inline: false },
                { name: '💡 Note', value: 'Users with Administrator permission will bypass this restriction.', inline: false }
            )
            .setFooter({ text: 'Command restrictions saved successfully' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error setting channel restrictions:', error);
        return message.reply('❌ An error occurred while saving the restrictions. Please try again.');
    }
}

async function handleRemoveChannels(message, args, db, categories) {
    const category = args[0]?.toLowerCase();
    
    if (!category || !categories[category]) {
        return message.reply(`❌ Invalid category! Available categories:\n${Object.keys(categories).map(c => `\`${c}\``).join(', ')}`);
    }
    
    try {
        const success = await db.removeCommandChannels(message.guild.id, category);
        
        if (!success) {
            return message.reply(`❌ No restrictions found for **${categories[category].name}**.`);
        }
        
        const categoryData = categories[category];
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('✅ Channel Restrictions Removed')
            .setDescription(`${categoryData.emoji} **${categoryData.name}** can now be used in any channel.`)
            .setFooter({ text: 'Restrictions removed successfully' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error removing channel restrictions:', error);
        return message.reply('❌ An error occurred while removing the restrictions. Please try again.');
    }
}

async function handleClearAll(message, db) {
    try {
        const restrictions = await db.getChannelRestrictions(message.guild.id);
        
        if (!restrictions || Object.keys(restrictions).length === 0) {
            return message.reply('❌ No channel restrictions are currently set for this server.');
        }
        
        const success = await db.clearAllChannelRestrictions(message.guild.id);
        
        if (!success) {
            return message.reply('❌ No restrictions found to clear.');
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('✅ All Restrictions Cleared')
            .setDescription('All command channel restrictions have been removed. Commands can now be used in any channel.')
            .setFooter({ text: 'All restrictions cleared successfully' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error clearing all restrictions:', error);
        return message.reply('❌ An error occurred while clearing the restrictions. Please try again.');
    }
}
