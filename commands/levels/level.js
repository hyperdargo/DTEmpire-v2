// commands/levels/level.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'level',
    description: 'Level system - check your rank and progress',
    aliases: ['rank', 'xp', 'levels'],
    category: 'Leveling',
    
    async execute(message, args, client, db) {
        if (args.length === 0) {
            return showUserRank(message, client, db);
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case 'leaderboard':
            case 'lb':
                await showLeaderboard(message, client, db);
                break;
            case 'info':
                await showLevelInfo(message);
                break;
            case 'set':
                await setUserLevel(message, args.slice(1), client, db);
                break;
            default:
                message.reply('❌ Unknown subcommand. Use: leaderboard, info, set');
        }
    }
};

// ========== SHOW USER RANK ==========
async function showUserRank(message, client, db) {
    try {
        const user = message.author;
        const guild = message.guild;
        
        // Get user economy (which includes XP)
        const economy = await db.getUserEconomy(user.id, guild.id);
        
        // Calculate progress to next level
        const currentXP = economy.xp || 0;
        const currentLevel = economy.level || 1;
        const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
        const xpForCurrentLevel = calculateXPForLevel(currentLevel);
        const progress = currentXP - xpForCurrentLevel;
        const needed = xpForNextLevel - xpForCurrentLevel;
        const progressPercent = Math.floor((progress / needed) * 100);
        
        // Get rank position
        const allEconomy = await db.getAllEconomy(guild.id);
        const sortedByXP = allEconomy.sort((a, b) => b.xp - a.xp);
        const rank = sortedByXP.findIndex(e => e.user_id === user.id) + 1;
        
        // Create progress bar
        const progressBar = createProgressBar(progressPercent, 15);
        
        // Create rank embed
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle(`🏆 ${user.username}'s Rank`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '📊 Rank', value: `#${rank} of ${sortedByXP.length}`, inline: true },
                { name: '⭐ Level', value: currentLevel.toString(), inline: true },
                { name: '✨ XP', value: currentXP.toString(), inline: true },
                { 
                    name: '📈 Progress', 
                    value: `\`${progressBar}\` ${progressPercent}%\n${progress}/${needed} XP to level ${currentLevel + 1}`,
                    inline: false 
                },
                { name: '💬 Messages', value: (economy.messages || 0).toString(), inline: true },
                { name: '🎤 Voice Time', value: formatTime(economy.voice_time || 0), inline: true },
                { name: '🏅 Reputation', value: (economy.reputation || 0).toString(), inline: true }
            )
            .setFooter({ text: `Keep chatting to level up! • DTEmpire Level System` })
            .setTimestamp();
        
        // Create action buttons
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('level_leaderboard')
                    .setLabel('Leaderboard')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🏆'),
                new ButtonBuilder()
                    .setCustomId('level_info')
                    .setLabel('Level Info')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('ℹ️'),
                new ButtonBuilder()
                    .setCustomId('level_rewards')
                    .setLabel('Rewards')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎁')
            );
        
        await message.reply({ 
            embeds: [embed],
            components: [actionRow] 
        });
        
    } catch (error) {
        console.error('Show rank error:', error);
        message.reply('❌ Failed to load rank information.');
    }
}

// ========== SHOW LEADERBOARD ==========
async function showLeaderboard(message, client, db) {
    try {
        const guild = message.guild;
        const allEconomy = await db.getAllEconomy(guild.id);
        
        // Sort by XP (level)
        const sortedByXP = allEconomy.sort((a, b) => b.xp - a.xx).slice(0, 10);
        
        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 Level Leaderboard')
            .setDescription(`Top 10 members in ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'DTEmpire Level System • Updated in real-time' })
            .setTimestamp();
        
        // Add top 3 with special medals
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        
        for (let i = 0; i < Math.min(sortedByXP.length, 10); i++) {
            const userData = sortedByXP[i];
            const user = await client.users.fetch(userData.user_id).catch(() => ({ tag: 'Unknown User' }));
            const level = userData.level || 1;
            const xp = userData.xp || 0;
            
            embed.addFields({
                name: `${medals[i]} ${user.tag || 'Unknown User'}`,
                value: `Level ${level} • ${xp} XP • ${userData.messages || 0} messages`,
                inline: false
            });
        }
        
        // Add user's position if not in top 10
        const authorIndex = sortedByXP.findIndex(e => e.user_id === message.author.id);
        if (authorIndex >= 10) {
            const authorData = allEconomy.find(e => e.user_id === message.author.id);
            if (authorData) {
                embed.addFields({
                    name: `📊 Your Position: #${authorIndex + 1}`,
                    value: `Level ${authorData.level || 1} • ${authorData.xp || 0} XP`,
                    inline: false
                });
            }
        }
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Leaderboard error:', error);
        message.reply('❌ Failed to load leaderboard.');
    }
}

// ========== SHOW LEVEL INFO ==========
async function showLevelInfo(message) {
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('ℹ️ Level System Information')
        .setDescription('How the leveling system works')
        .addFields(
            {
                name: '✨ Earning XP',
                value: [
                    '• **Messages:** 15 XP per message (1 min cooldown)',
                    '• **Voice Chat:** 5 XP per minute (max 60 min/day)',
                    '• **Reactions:** 2 XP per reaction',
                    '• **Active Days:** 50 XP bonus per day'
                ].join('\n'),
                inline: false
            },
            {
                name: '📈 Level Formula',
                value: '`XP Required = Level² × 100`\nExample:\n• Level 1 → 100 XP\n• Level 2 → 400 XP\n• Level 5 → 2,500 XP\n• Level 10 → 10,000 XP',
                inline: false
            },
            {
                name: '🎁 Level Rewards',
                value: [
                    '• **Level 5:** Special role color',
                    '• **Level 10:** Access to exclusive channels',
                    '• **Level 20:** Custom nickname permission',
                    '• **Level 30:** Special badge in profile',
                    '• **Level 50:** VIP role with special perks'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Stay active to level up faster!' });
    
    await message.reply({ embeds: [embed] });
}

// ========== SET USER LEVEL (ADMIN) ==========
async function setUserLevel(message, args, client, db) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('❌ You need **Manage Server** permission to set levels.');
    }
    
    if (args.length < 2) {
        return message.reply('❌ Usage: `^level set @user <level>`\nExample: `^level set @user 10`');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user.');
    }
    
    const level = parseInt(args[1]);
    if (isNaN(level) || level < 1 || level > 100) {
        return message.reply('❌ Please provide a valid level (1-100).');
    }
    
    try {
        // Calculate XP for the level
        const xp = calculateXPForLevel(level);
        
        // Update user economy
        await db.updateUserEconomy(user.id, message.guild.id, {
            level: level,
            xp: xp,
            updated_at: Date.now()
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Level Updated')
            .addFields(
                { name: 'User', value: user.tag, inline: true },
                { name: 'New Level', value: level.toString(), inline: true },
                { name: 'New XP', value: xp.toString(), inline: true },
                { name: 'Updated by', value: message.author.tag, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Check for level up rewards
        await checkLevelRewards(message.guild.id, user, level, client, db);
        
    } catch (error) {
        console.error('Set level error:', error);
        message.reply('❌ Failed to update user level.');
    }
}

// ========== HELPER FUNCTIONS ==========

function calculateXPForLevel(level) {
    return Math.floor(Math.pow(level, 2) * 100);
}

function createProgressBar(percent, length) {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}

// ========== LEVEL UP REWARDS ==========
async function checkLevelRewards(guildId, user, newLevel, client, db) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;
        
        const rewards = {
            5: { roleName: 'Level 5', color: '#ff9900' },
            10: { roleName: 'Level 10', color: '#00ff00' },
            20: { roleName: 'Level 20', color: '#9900ff' },
            30: { roleName: 'Level 30', color: '#ff00ff' },
            50: { roleName: 'VIP', color: '#ffd700' }
        };
        
        if (rewards[newLevel]) {
            const reward = rewards[newLevel];
            let role = guild.roles.cache.find(r => r.name === reward.roleName);
            
            if (!role) {
                role = await guild.roles.create({
                    name: reward.roleName,
                    color: reward.color,
                    reason: `Level ${newLevel} reward role`
                });
            }
            
            await member.roles.add(role);
            
            // Send level up DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(reward.color)
                    .setTitle(`🎉 Level ${newLevel} Unlocked!`)
                    .setDescription(`Congratulations ${user.username}! You've reached level ${newLevel} in **${guild.name}**!`)
                    .addFields(
                        { name: '🎁 Reward', value: `You've received the **${reward.roleName}** role!`, inline: true },
                        { name: '🏆 Achievement', value: `Level ${newLevel} milestone`, inline: true }
                    )
                    .setThumbnail(guild.iconURL({ dynamic: true }))
                    .setFooter({ text: 'Keep leveling up for more rewards!' });
                
                await user.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log('Could not send level up DM:', dmError.message);
            }
            
            // Announce in level up channel if configured
            const config = await db.getGuildConfig(guildId);
            if (config.level_up_channel) {
                const levelChannel = guild.channels.cache.get(config.level_up_channel);
                if (levelChannel) {
                    const announceEmbed = new EmbedBuilder()
                        .setColor(reward.color)
                        .setTitle('🎉 Level Up!')
                        .setDescription(`${user.toString()} has reached **level ${newLevel}**!`)
                        .addFields(
                            { name: 'Achievement', value: `Level ${newLevel} milestone reached`, inline: true },
                            { name: 'Reward', value: reward.roleName, inline: true }
                        )
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    
                    await levelChannel.send({ embeds: [announceEmbed] });
                }
            }
        }
        
    } catch (error) {
        console.error('Level rewards error:', error);
    }
}

// Export for use in index.js
module.exports.checkLevelRewards = checkLevelRewards;