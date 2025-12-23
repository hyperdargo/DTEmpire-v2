// commands/info/servers.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, userMention, channelMention } = require('discord.js');
const ms = require('ms');

module.exports = {
    name: 'servers',
    description: 'Display all servers the bot is in',
    aliases: ['guilds', 'listservers'],
    category: 'Info',
    
    async execute(message, args, client, db) {
        try {
            const guilds = client.guilds.cache;
            const totalGuilds = guilds.size;
            
            // Pagination
            const page = parseInt(args[0]) || 1;
            const perPage = 10;
            const totalPages = Math.ceil(totalGuilds / perPage);
            
            if (page < 1 || page > totalPages) {
                return message.reply(`❌ Invalid page number. Please choose between 1 and ${totalPages}.`);
            }
            
            const startIndex = (page - 1) * perPage;
            const endIndex = startIndex + perPage;
            const pageGuilds = Array.from(guilds.values()).slice(startIndex, endIndex);
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🌐 Bot Servers')
                .setDescription(`The bot is in **${totalGuilds}** servers\nPage **${page}** of **${totalPages}**`)
                .setFooter({ text: `Use ${client.botInfo.prefix}servers [page] to navigate` })
                .setTimestamp();
            
            // Add server list
            let serverList = '';
            for (let i = 0; i < pageGuilds.length; i++) {
                const guild = pageGuilds[i];
                const owner = await guild.fetchOwner().catch(() => ({ user: { tag: 'Unknown' } }));
                
                // Get bot's member in this guild
                const botMember = guild.members.cache.get(client.user.id);
                const joinedDate = botMember ? botMember.joinedAt : null;
                
                serverList += `**${startIndex + i + 1}.** **[${guild.name}](https://discord.com/channels/${guild.id})**\n`;
                serverList += `   👑 **Owner:** ${owner.user.tag}\n`;
                serverList += `   👥 **Members:** ${guild.memberCount}\n`;
                serverList += `   🆔 **ID:** \`${guild.id}\`\n`;
                if (joinedDate) {
                    serverList += `   📅 **Bot joined:** <t:${Math.floor(joinedDate.getTime() / 1000)}:R>\n`;
                }
                serverList += '\n';
            }
            
            embed.addFields({
                name: '📋 Server List',
                value: serverList || 'No servers found.',
                inline: false
            });
            
            // Add stats
            const totalMembers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
            const avgMembers = Math.round(totalMembers / totalGuilds);
            
            embed.addFields(
                {
                    name: '📊 Statistics',
                    value: `**Total Servers:** ${totalGuilds}\n**Total Members:** ${totalMembers}\n**Avg. per Server:** ${avgMembers}`,
                    inline: true
                }
            );
            
            // Create navigation buttons
            const actionRows = [];
            const navigationRow = new ActionRowBuilder();
            
            if (page > 1) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`servers_${page - 1}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                );
            }
            
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('servers_current')
                    .setLabel(`Page ${page} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            
            if (page < totalPages) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`servers_${page + 1}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('➡️')
                );
            }
            
            actionRows.push(navigationRow);
            
            // Add quick actions row
            const actionsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Invite Bot')
                        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🤖'),
                    new ButtonBuilder()
                        .setLabel('Support Server')
                        .setURL('https://discord.gg/zGxRRE3MS9')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🆘'),
                    new ButtonBuilder()
                        .setCustomId('refresh_servers')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🔄')
                );
            
            actionRows.push(actionsRow);
            
            const sentMessage = await message.channel.send({ 
                embeds: [embed],
                components: actionRows 
            });
            
            // Create collector for button interactions
            const collector = sentMessage.createMessageComponentCollector({ 
                time: 60000 
            });
            
            collector.on('collect', async (interaction) => {
                if (!interaction.customId.startsWith('servers_') && interaction.customId !== 'refresh_servers') return;
                
                if (interaction.customId === 'refresh_servers') {
                    await interaction.deferUpdate();
                    await message.channel.send('🔄 Refreshing server list...');
                    return this.execute(message, [page], client, db);
                }
                
                const requestedPage = parseInt(interaction.customId.split('_')[1]);
                if (requestedPage) {
                    await interaction.deferUpdate();
                    await this.execute(message, [requestedPage], client, db);
                }
            });
            
            collector.on('end', () => {
                sentMessage.edit({ components: [] }).catch(() => {});
            });
            
        } catch (error) {
            console.error('Servers command error:', error);
            message.reply('❌ An error occurred while fetching server information.');
        }
    }
};