const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ReputationService = require('../../utils/reputationService');

module.exports = {
    name: 'rep',
    aliases: ['reputation', 'karma'],
    category: 'reputation',
    description: 'Reputation/Karma system - Give and track reputation points',
    usage: '^rep <give|check|leaderboard|info> [args]',
    examples: [
        '^rep give @user Great help with coding!',
        '^rep check',
        '^rep check @user',
        '^rep leaderboard',
        '^rep info'
    ],

    async execute(message, args, client, db) {
        try {
            // Initialize reputation service
            const repService = new ReputationService(db);

            // Get subcommand
            const subcommand = args[0]?.toLowerCase();

            if (!subcommand) {
                return this.showHelp(message);
            }

            // Route to appropriate subcommand
            switch (subcommand) {
                case 'give':
                case 'add':
                case '+':
                    await this.handleGiveRep(message, args.slice(1), repService, client);
                    break;

                case 'check':
                case 'view':
                case 'show':
                    await this.handleCheckRep(message, args.slice(1), repService, client);
                    break;

                case 'leaderboard':
                case 'lb':
                case 'top':
                    await this.handleLeaderboard(message, args.slice(1), repService, client);
                    break;

                case 'info':
                case 'help':
                case 'about':
                    await this.handleInfo(message, repService);
                    break;

                case 'history':
                case 'logs':
                    await this.handleHistory(message, args.slice(1), repService, client);
                    break;

                case 'reset':
                    await this.handleReset(message, args.slice(1), repService, client, db);
                    break;

                default:
                    return this.showHelp(message);
            }

        } catch (error) {
            console.error('Reputation command error:', error);
            await message.reply('❌ An error occurred while processing your request.').catch(() => {});
        }
    },

    /**
     * Handle: ^rep give @user reason
     */
    async handleGiveRep(message, args, repService, client) {
        // Check if user mentioned someone
        const mentionedUser = message.mentions.members.first();
        
        if (!mentionedUser) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Invalid Usage')
                .setDescription('You must mention a user to give reputation to!')
                .addFields({
                    name: '📝 Correct Usage',
                    value: '`^rep give @user <reason>`',
                    inline: false
                })
                .addFields({
                    name: '📌 Example',
                    value: '`^rep give @John Helped me solve a bug!`',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Get reason (everything after the mention)
        const reason = args.slice(1).join(' ').trim();

        if (!reason) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Reason Required')
                .setDescription('You must provide a reason for giving reputation!')
                .addFields({
                    name: '📝 Correct Usage',
                    value: '`^rep give @user <reason>`',
                    inline: false
                })
                .addFields({
                    name: '⚠️ Requirements',
                    value: '• Reason must be 5-200 characters\n• Be specific and meaningful\n• Explain why they deserve reputation',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Give reputation
        const result = await repService.giveRep(
            message.member,
            mentionedUser,
            message.guild,
            reason,
            message.channel.id
        );

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Cannot Give Reputation')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Success! Send confirmation embed
        const { receiver, newRepTotal, rank, reason: cleanReason } = result.data;

        // Log reputation action to logging system
        if (client.loggingSystem) {
            await client.loggingSystem.logReputationAction(
                message.guild.id,
                'give',
                message.author,
                receiver,
                cleanReason,
                message.channel.id,
                {
                    newTotal: newRepTotal,
                    rank: rank
                }
            );
        }

        const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Reputation Given!')
            .setDescription(`${message.author.username} gave reputation to ${receiver.username}!`)
            .setThumbnail(receiver.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '👤 Giver',
                    value: `${message.author.toString()}\n\`${message.author.tag}\``,
                    inline: true
                },
                {
                    name: '🎯 Receiver',
                    value: `${receiver.toString()}\n\`${receiver.tag}\``,
                    inline: true
                },
                {
                    name: '⭐ New Total',
                    value: `**${newRepTotal}** reputation`,
                    inline: true
                },
                {
                    name: '🏆 Server Rank',
                    value: rank > 0 ? `#${rank}` : 'Unranked',
                    inline: true
                },
                {
                    name: '📝 Reason',
                    value: `"${cleanReason}"`,
                    inline: false
                }
            )
            .setFooter({ text: 'Thank you for making the community better! 💖' })
            .setTimestamp();

        await message.reply({ embeds: [successEmbed] });
    },

    /**
     * Handle: ^rep check [@user]
     */
    async handleCheckRep(message, args, repService, client) {
        // Check if user mentioned someone, otherwise check their own rep
        const targetMember = message.mentions.members.first() || message.member;
        const targetUser = targetMember.user;

        const result = await repService.getRep(targetUser, message.guild.id);

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const { rep, rank, lastReceivedAt } = result.data;

        // Build embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`⭐ ${targetUser.username}'s Reputation`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(targetUser.id === message.author.id 
                ? 'Here is your reputation information!' 
                : `Viewing ${targetUser.username}'s reputation`)
            .addFields(
                {
                    name: '⭐ Total Reputation',
                    value: `**${rep}** points`,
                    inline: true
                },
                {
                    name: '🏆 Server Rank',
                    value: rank > 0 ? `#${rank}` : 'Unranked',
                    inline: true
                },
                {
                    name: '📊 Status',
                    value: rep >= 50 ? '🌟 Highly Trusted' 
                        : rep >= 20 ? '⭐ Trusted' 
                        : rep >= 10 ? '✨ Active Member'
                        : rep >= 5 ? '📈 Growing'
                        : '🌱 New',
                    inline: true
                }
            );

        // Add last received timestamp if available
        if (lastReceivedAt) {
            embed.addFields({
                name: '🕒 Last Received',
                value: `<t:${Math.floor(lastReceivedAt / 1000)}:R>`,
                inline: false
            });
        }

        embed.setFooter({ text: `Use ^rep leaderboard to see top members` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },

    /**
     * Handle: ^rep leaderboard [page]
     */
    async handleLeaderboard(message, args, repService, client) {
        const page = parseInt(args[0]) || 1;
        const perPage = 10;

        // Get full leaderboard
        const result = await repService.getLeaderboard(message.guild.id, 100);

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const leaderboard = result.data;

        if (leaderboard.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('📊 Reputation Leaderboard')
                .setDescription('No one has any reputation yet! Be the first to give some with `^rep give @user <reason>`!')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Calculate pagination
        const maxPage = Math.ceil(leaderboard.length / perPage);
        const currentPage = Math.min(Math.max(1, page), maxPage);
        const startIndex = (currentPage - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageData = leaderboard.slice(startIndex, endIndex);

        // Build leaderboard description
        let description = '';
        for (let i = 0; i < pageData.length; i++) {
            const entry = pageData[i];
            const position = startIndex + i + 1;
            
            // Medal emojis for top 3
            let medal = '';
            if (position === 1) medal = '🥇';
            else if (position === 2) medal = '🥈';
            else if (position === 3) medal = '🥉';
            else medal = `**${position}.**`;

            try {
                const user = await client.users.fetch(entry.user_id);
                description += `${medal} **${user.username}** - \`${entry.rep}\` rep\n`;
            } catch (error) {
                description += `${medal} Unknown User - \`${entry.rep}\` rep\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 Reputation Leaderboard')
            .setDescription(description || 'No entries found')
            .setFooter({ text: `Page ${currentPage}/${maxPage} • Total Members: ${leaderboard.length}` })
            .setTimestamp();

        // Add pagination buttons if needed
        if (maxPage > 1) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rep_lb_${currentPage - 1}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️')
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`rep_lb_${currentPage + 1}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️')
                        .setDisabled(currentPage === maxPage)
                );

            await message.reply({ embeds: [embed], components: [row] });
        } else {
            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep info
     */
    async handleInfo(message, repService) {
        const stats = await repService.getStats(message.guild.id);

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('📊 Reputation System Information')
            .setDescription('The reputation system allows members to acknowledge and appreciate helpful community members.')
            .addFields(
                {
                    name: '✅ How It Works',
                    value: '• Use `^rep give @user <reason>` to give reputation\n• Each user can give 1 reputation per day\n• You can\'t give rep to the same user for 7 days\n• You cannot give reputation to yourself or bots',
                    inline: false
                },
                {
                    name: '📝 Requirements',
                    value: '• Account must be at least 7 days old\n• Must be in server for at least 3 days\n• Must provide a reason (5-200 characters)',
                    inline: false
                },
                {
                    name: '🎯 Commands',
                    value: '`^rep give @user <reason>` - Give reputation\n`^rep check [@user]` - Check reputation\n`^rep leaderboard` - View top members\n`^rep history [@user]` - View rep history',
                    inline: false
                }
            );

        if (stats.success) {
            embed.addFields({
                name: '📊 Server Statistics',
                value: `**Total Users:** ${stats.data.totalUsers}\n**Total Rep Given:** ${stats.data.totalRepGiven}\n**Average Rep:** ${stats.data.averageRep}\n**Reps Last 24h:** ${stats.data.repsLast24h}`,
                inline: false
            });
        }

        embed.setFooter({ text: 'Make the community better, one reputation at a time! 💖' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },

    /**
     * Handle: ^rep history [@user]
     * Staff-only when viewing other users
     */
    async handleHistory(message, args, repService, client) {
        // Check if user mentioned someone
        const targetMember = message.mentions.members.first();
        const targetUser = targetMember ? targetMember.user : message.member.user;
        
        // If checking someone else's history, require staff permissions
        if (targetMember && targetMember.id !== message.member.id) {
            const hasPermission = message.member.permissions.has('ManageMessages') || 
                                 message.member.permissions.has('Administrator');
            
            if (!hasPermission) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Permission Denied')
                    .setDescription('You need **Manage Messages** permission or higher to view other users\' reputation history!')
                    .addFields({
                        name: '💡 Tip',
                        value: 'You can view your own history with `^rep history` (without mentioning anyone)',
                        inline: false
                    })
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }
        }

        const result = await repService.getRepHistory(targetUser, message.guild.id, 10);

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const history = result.data;

        if (history.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('📜 Reputation History')
                .setDescription(`${targetUser.username} hasn't received any reputation yet!`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Build history description
        let description = `**Recent reputation received by ${targetUser.username}:**\n\n`;
        
        for (const entry of history) {
            try {
                const giver = await client.users.fetch(entry.giver_id);
                const timestamp = `<t:${Math.floor(entry.created_at / 1000)}:R>`;
                description += `⭐ From **${giver.username}** ${timestamp}\n`;
                description += `   *"${entry.reason}"*\n\n`;
            } catch (error) {
                description += `⭐ From Unknown User\n   *"${entry.reason}"*\n\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📜 Reputation History')
            .setDescription(description)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Showing last ${history.length} reputation entries` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },

    /**
     * Handle: ^rep reset @user
     * Admin-only command to reset a user's reputation
     */
    async handleReset(message, args, repService, client, db) {
        // Check for admin permissions
        const hasPermission = message.member.permissions.has('Administrator');
        
        if (!hasPermission) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Permission Denied')
                .setDescription('You need **Administrator** permission to reset reputation!')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Check if user mentioned someone
        const targetMember = message.mentions.members.first();
        
        if (!targetMember) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Invalid Usage')
                .setDescription('You must mention a user to reset their reputation!')
                .addFields({
                    name: '📝 Correct Usage',
                    value: '`^rep reset @user`',
                    inline: false
                })
                .addFields({
                    name: '📌 Example',
                    value: '`^rep reset @John`',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const targetUser = targetMember.user;

        try {
            // Get current reputation before reset
            const currentRep = await db.getUserReputation(targetUser.id, message.guild.id);
            const oldRepValue = currentRep.rep || 0;

            // Reset reputation to 0
            await db.updateUserReputation(targetUser.id, message.guild.id, -oldRepValue);

            // Log the reset action
            if (client.loggingSystem) {
                await client.loggingSystem.logReputationAction(
                    message.guild.id,
                    'reset',
                    message.author,
                    targetUser,
                    `Reset by administrator (previous: ${oldRepValue})`,
                    message.channel.id,
                    {
                        newTotal: 0,
                        moderator: message.author
                    }
                );
            }

            // Send confirmation
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🔄 Reputation Reset')
                .setDescription(`Successfully reset reputation for ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    {
                        name: '🎯 Target User',
                        value: `${targetUser.toString()}\n\`${targetUser.tag}\``,
                        inline: true
                    },
                    {
                        name: '📊 Previous Reputation',
                        value: `${oldRepValue} points`,
                        inline: true
                    },
                    {
                        name: '⭐ New Reputation',
                        value: '0 points',
                        inline: true
                    },
                    {
                        name: '🛡️ Administrator',
                        value: `${message.author.toString()}\n\`${message.author.tag}\``,
                        inline: false
                    }
                )
                .setFooter({ text: 'Reputation System • Admin Action' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Reset reputation error:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while resetting reputation. Please try again.')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Show help message
     */
    showHelp(message) {
        const isStaff = message.member.permissions.has('ManageMessages');
        const isAdmin = message.member.permissions.has('Administrator');

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('⭐ Reputation System - Help')
            .setDescription('Give and track reputation/karma points to appreciate helpful community members!')
            .addFields(
                {
                    name: '📝 Commands',
                    value: '`^rep give @user <reason>` - Give reputation to a user\n`^rep check [@user]` - Check your or someone\'s reputation\n`^rep leaderboard` - View the top members\n`^rep history` - View your reputation history\n`^rep info` - Learn more about the system',
                    inline: false
                },
                {
                    name: '📌 Examples',
                    value: '`^rep give @John Helped me fix a bug!`\n`^rep check`\n`^rep check @John`\n`^rep leaderboard`',
                    inline: false
                },
                {
                    name: '⚠️ Rules',
                    value: '• You can give 1 rep per day\n• 7 day cooldown per user\n• Cannot rep yourself or bots\n• Reason must be 5-200 characters',
                    inline: false
                }
            );

        // Add staff commands if user has permissions
        if (isStaff) {
            embed.addFields({
                name: '🛡️ Staff Commands',
                value: '`^rep history @user` - View any user\'s reputation history',
                inline: false
            });
        }

        // Add admin commands if user has permissions
        if (isAdmin) {
            embed.addFields({
                name: '⚙️ Admin Commands',
                value: '`^rep reset @user` - Reset a user\'s reputation to 0',
                inline: false
            });
        }

        embed.setFooter({ text: 'Reputation System • Use ^rep info for more details' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
