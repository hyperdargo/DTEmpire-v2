const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'errorlog',
    description: 'View bot error logs (Owner/Admin only)',
    aliases: ['errors', 'logs', 'crashlog'],
    category: 'owner',

    async execute(message, args, client, db) {
        try {
            // Check if user is bot owner
            if (message.author.id !== client.botInfo.ownerId) {
                return message.reply({
                    content: '❌ This command is only available to the bot owner.',
                    ephemeral: true
                });
            }

            const subcommand = args[0]?.toLowerCase() || 'recent';
            const logDir = path.join(__dirname, '../../data/logs');

            // Ensure logs directory exists
            if (!fs.existsSync(logDir)) {
                return message.reply('📭 No logs directory found. No errors have been logged yet.');
            }

            const errorLogFile = path.join(logDir, 'error.log');
            const crashLogFile = path.join(logDir, 'crash.log');

            switch (subcommand) {
                case 'errors':
                case 'error': {
                    if (!fs.existsSync(errorLogFile)) {
                        return message.reply('✅ No error logs found. Everything is clean!');
                    }

                    const errorContent = fs.readFileSync(errorLogFile, 'utf8');
                    const errorLines = errorContent.split('\n').filter(line => line.trim());

                    if (errorLines.length === 0) {
                        return message.reply('✅ No error logs found. Everything is clean!');
                    }

                    // Split into chunks for Discord's message limit
                    const chunks = [];
                    let currentChunk = '';

                    for (const line of errorLines.slice(-100)) { // Last 100 errors
                        if ((currentChunk + line + '\n').length > 1900) {
                            chunks.push(currentChunk);
                            currentChunk = line + '\n';
                        } else {
                            currentChunk += line + '\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);

                    // Send embeds with chunks
                    for (let i = 0; i < chunks.length; i++) {
                        const embed = new EmbedBuilder()
                            .setTitle(`📋 Error Logs (${i + 1}/${chunks.length})`)
                            .setColor('#FF6B6B')
                            .setDescription(`\`\`\`\n${chunks[i]}\`\`\``)
                            .setFooter({ text: `Total errors: ${errorLines.length}` });
                        
                        await message.reply({ embeds: [embed] });
                    }
                    break;
                }

                case 'crashes':
                case 'crash': {
                    if (!fs.existsSync(crashLogFile)) {
                        return message.reply('✅ No crash logs found. Bot has been stable!');
                    }

                    const crashContent = fs.readFileSync(crashLogFile, 'utf8');
                    const crashLines = crashContent.split('\n').filter(line => line.trim());

                    if (crashLines.length === 0) {
                        return message.reply('✅ No crash logs found. Bot has been stable!');
                    }

                    const chunks = [];
                    let currentChunk = '';

                    for (const line of crashLines.slice(-100)) { // Last 100 crashes
                        if ((currentChunk + line + '\n').length > 1900) {
                            chunks.push(currentChunk);
                            currentChunk = line + '\n';
                        } else {
                            currentChunk += line + '\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);

                    for (let i = 0; i < chunks.length; i++) {
                        const embed = new EmbedBuilder()
                            .setTitle(`🔴 Crash Logs (${i + 1}/${chunks.length})`)
                            .setColor('#FF0000')
                            .setDescription(`\`\`\`\n${chunks[i]}\`\`\``)
                            .setFooter({ text: `Total crashes: ${crashLines.length}` });
                        
                        await message.reply({ embeds: [embed] });
                    }
                    break;
                }

                case 'clear': {
                    const confirmButton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm_clear_logs')
                            .setLabel('Confirm Clear')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('cancel_clear_logs')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const confirmMsg = await message.reply({
                        content: '⚠️ Are you sure you want to clear all logs? This cannot be undone.',
                        components: [confirmButton]
                    });

                    const filter = i => i.user.id === message.author.id;
                    const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30000 });

                    collector.on('collect', async (i) => {
                        if (i.customId === 'confirm_clear_logs') {
                            try {
                                if (fs.existsSync(errorLogFile)) fs.unlinkSync(errorLogFile);
                                if (fs.existsSync(crashLogFile)) fs.unlinkSync(crashLogFile);
                                
                                await i.update({
                                    content: '✅ All logs have been cleared.',
                                    components: []
                                });
                            } catch (error) {
                                await i.update({
                                    content: `❌ Failed to clear logs: ${error.message}`,
                                    components: []
                                });
                            }
                        } else {
                            await i.update({
                                content: '❌ Log clear cancelled.',
                                components: []
                            });
                        }
                    });

                    collector.on('end', () => {
                        confirmMsg.edit({ components: [] }).catch(() => {});
                    });
                    break;
                }

                case 'stats':
                case 'status': {
                    let errorCount = 0;
                    let crashCount = 0;
                    let lastError = 'None';
                    let lastCrash = 'None';

                    if (fs.existsSync(errorLogFile)) {
                        const errorContent = fs.readFileSync(errorLogFile, 'utf8');
                        const errorLines = errorContent.split('\n').filter(line => line.trim());
                        errorCount = errorLines.length;
                        if (errorLines.length > 0) {
                            lastError = errorLines[errorLines.length - 1].split('\n')[0];
                        }
                    }

                    if (fs.existsSync(crashLogFile)) {
                        const crashContent = fs.readFileSync(crashLogFile, 'utf8');
                        const crashLines = crashContent.split('\n').filter(line => line.trim());
                        crashCount = crashLines.length;
                        if (crashLines.length > 0) {
                            lastCrash = crashLines[crashLines.length - 1].split('\n')[0];
                        }
                    }

                    const statusEmbed = new EmbedBuilder()
                        .setTitle('📊 Error Log Statistics')
                        .setColor(crashCount > 0 ? '#FF0000' : '#00FF00')
                        .addFields(
                            { name: '🔴 Total Crashes', value: String(crashCount), inline: true },
                            { name: '⚠️ Total Errors', value: String(errorCount), inline: true },
                            { name: '📅 Bot Uptime', value: `<t:${Math.floor(client.botInfo.startedAt / 1000)}:R>`, inline: false },
                            { name: '🔴 Last Crash', value: lastCrash.substring(0, 100) || 'None', inline: false },
                            { name: '⚠️ Last Error', value: lastError.substring(0, 100) || 'None', inline: false }
                        )
                        .setFooter({ text: 'Use: ^errorlog [errors|crashes|clear|status]' });

                    await message.reply({ embeds: [statusEmbed] });
                    break;
                }

                default: {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('📋 Error Log Commands')
                        .setColor('#5865F2')
                        .addFields(
                            { name: '^errorlog errors', value: 'View recent error logs', inline: false },
                            { name: '^errorlog crashes', value: 'View recent crash logs', inline: false },
                            { name: '^errorlog status', value: 'View error statistics', inline: false },
                            { name: '^errorlog clear', value: 'Clear all logs (with confirmation)', inline: false }
                        )
                        .setFooter({ text: 'Owner only command' });

                    await message.reply({ embeds: [helpEmbed] });
                }
            }
        } catch (error) {
            console.error('Error in errorlog command:', error);
            message.reply('❌ An error occurred while fetching logs.');
        }
    }
};
