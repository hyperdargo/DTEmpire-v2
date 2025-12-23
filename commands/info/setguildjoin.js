// commands/config/setguildjoin.js
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'setguildjoin',
    description: 'Set a channel to see new servers the bot is joining',
    aliases: ['setjoinchannel', 'guildjoinchannel'],
    category: 'Config',
    
    async execute(message, args, client, db) {
        try {
            if (!message.guild) {
                return message.reply('❌ This command can only be used in a server.');
            }
            
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ You need **Administrator** permission to use this command.');
            }
            
            const channel = message.mentions.channels.first();
            if (!channel) {
                return message.reply('❌ Please mention a channel to set as the guild join notification channel.');
            }
            
            if (channel.type !== ChannelType.GuildText) {
                return message.reply('❌ Please select a text channel.');
            }
            
            // Check bot permissions in the channel
            const botPermissions = channel.permissionsFor(client.user);
            if (!botPermissions.has(PermissionFlagsBits.SendMessages) || 
                !botPermissions.has(PermissionFlagsBits.EmbedLinks)) {
                return message.reply(`❌ I need **Send Messages** and **Embed Links** permissions in ${channel.toString()}`);
            }
            
            // Save to database
            await db.updateGuildConfig(message.guild.id, {
                guild_join_channel: channel.id
            });
            
            // Send confirmation
            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('✅ Guild Join Channel Set')
                .setDescription(`New servers that the bot joins will now be announced in ${channel.toString()}`)
                .addFields(
                    {
                        name: '📁 Channel',
                        value: channel.toString(),
                        inline: true
                    },
                    {
                        name: '👤 Set By',
                        value: message.author.toString(),
                        inline: true
                    },
                    {
                        name: '⚙️ Settings',
                        value: '• Bot join notifications\n• Server statistics\n• Quick action buttons',
                        inline: false
                    }
                )
                .setFooter({ text: 'You can change this anytime using the same command' })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            
            // Test notification
            const testEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🧪 Test Notification')
                .setDescription('This is a test notification for guild join announcements.')
                .addFields(
                    {
                        name: 'ℹ️ Information',
                        value: 'When the bot joins a new server, a similar notification will appear here with server details.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Test successful! Guild join notifications are enabled.' })
                .setTimestamp();
            
            await channel.send({ embeds: [testEmbed] });
            
        } catch (error) {
            console.error('Setguildjoin command error:', error);
            message.reply('❌ An error occurred while setting the guild join channel.');
        }
    }
};