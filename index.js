const { Client, Collection, GatewayIntentBits, ActivityType, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ========== LOAD ENVIRONMENT VARIABLES ==========
require('dotenv').config();

// Load config
const config = require('./config.json');

// Override sensitive config values with environment variables
if (process.env.BOT_TOKEN) {
    config.bot.token = process.env.BOT_TOKEN;
}
if (process.env.SPOTIFY_CLIENT_ID) {
    config.music.spotify.clientId = process.env.SPOTIFY_CLIENT_ID;
}
if (process.env.SPOTIFY_CLIENT_SECRET) {
    config.music.spotify.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
}

// Import LoggingSystem
const LoggingSystem = require('./utils/LoggingSystem');

// Import Sticky Handler
const stickyHandler = require('./events/stickyHandler');

// Create client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// Collections
client.commands = new Collection();
client.aliases = new Collection();
client.snipes = new Map(); // For deleted messages
client.editSnipes = new Map(); // For edited messages
client.cooldowns = new Collection();

// Initialize TTS cache
client.ttsCache = new Map();

// Bot info
client.botInfo = {
    name: config.bot.name,
    version: config.bot.version,
    creator: "DargoTamber",
    prefix: config.bot.prefix,
    startedAt: Date.now()
};

// Create necessary directories
function setupDirectories() {
    const dirs = ['data', 'commands', 'events', 'utils'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
}

// Load commands
function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    
    // Check if commands directory exists
    if (!fs.existsSync(commandsPath)) {
        console.log('Commands directory not found, creating...');
        setupDirectories();
        return;
    }
    
    // Load all command categories
    const categories = fs.readdirSync(commandsPath).filter(cat => 
        fs.statSync(path.join(commandsPath, cat)).isDirectory()
    );
    
    console.log(`Found ${categories.length} command categories`);
    
    categories.forEach(category => {
        const categoryPath = path.join(commandsPath, category);
        const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        
        console.log(`Loading ${commandFiles.length} commands from ${category}`);
        
        commandFiles.forEach(file => {
            try {
                const commandPath = path.join(categoryPath, file);
                delete require.cache[require.resolve(commandPath)];
                const command = require(commandPath);
                
                if (command.name) {
                    client.commands.set(command.name, command);
                    
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => {
                            client.aliases.set(alias, command.name);
                        });
                    }
                    
                    console.log(`✅ Loaded command: ${command.name} from ${category}/${file}`);
                }
            } catch (error) {
                console.error(`❌ Failed to load command ${file}:`, error.message);
            }
        });
    });
}

// ========== LOAD SPECIFIC MUSIC COMMANDS MANUALLY ==========
function loadMusicCommands() {
    console.log('🎵 Loading music commands...');
    
    const musicCommands = [
        'music', 'play', 'pause', 'resume', 'queue', 
        'skip', 'stop', 'volume', 'nowplaying'
    ];
    
    // Check if music commands directory exists
    const musicCommandsPath = path.join(__dirname, 'commands', 'music');
    if (!fs.existsSync(musicCommandsPath)) {
        console.error('❌ Music commands directory not found!');
        console.log('Creating music commands directory...');
        fs.mkdirSync(musicCommandsPath, { recursive: true });
        console.log('✅ Created music commands directory');
        return;
    }
    
    let loadedCount = 0;
    for (const cmd of musicCommands) {
        try {
            const commandPath = path.join(musicCommandsPath, `${cmd}.js`);
            
            // Check if file exists
            if (!fs.existsSync(commandPath)) {
                console.log(`⚠️  Music command file not found: ${cmd}.js`);
                console.log(`Creating template for: ${cmd}.js`);
                
                // Create a basic template for missing command
                const template = `const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: '${cmd}',
    description: '${cmd.charAt(0).toUpperCase() + cmd.slice(1)} command',
    aliases: [],
    category: 'music',
    
    async execute(message, args, client, db) {
        try {
            message.reply('🎵 This command is under development!');
        } catch (error) {
            console.error('${cmd} command error:', error);
            message.reply('❌ An error occurred.');
        }
    }
};`;
                
                fs.writeFileSync(commandPath, template);
                console.log(`✅ Created template for ${cmd}.js`);
            }
            
            delete require.cache[require.resolve(commandPath)];
            const command = require(commandPath);
            
            if (command.name) {
                client.commands.set(command.name, command);
                
                // Register aliases
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => {
                        client.aliases.set(alias, command.name);
                    });
                }
                
                console.log(`✅ Loaded music command: ${command.name}`);
                loadedCount++;
            }
        } catch (error) {
            console.error(`❌ Failed to load music command ${cmd}:`, error.message);
        }
    }
    
    console.log(`🎵 Music commands loaded: ${loadedCount}/${musicCommands.length}`);
}

// ========== INTERACTION HANDLER ==========
client.on('interactionCreate', async (interaction) => {
    // Handle button interactions
    if (interaction.isButton()) {
        console.log(`[Button] Clicked: ${interaction.customId}`);
        
        try {
            // Initialize database if needed
            if (!client.db) {
                const Database = require('./utils/database');
                const dbInstance = new Database();
                client.db = await dbInstance.initialize();
            }
            
            // ========== TICKET BUTTON HANDLER ==========
            // Check for ticket buttons first (support and bug report)
            if (interaction.customId === 'open_support_ticket' || 
                interaction.customId === 'open_bug_report' ||
                interaction.customId.startsWith('close_ticket_')) {
                
                // Get the ticket command module
                const ticketCommand = client.commands.get('ticket');
                if (ticketCommand && ticketCommand.handleInteraction) {
                    await ticketCommand.handleInteraction(interaction, client, client.db);
                    return;
                } else {
                    console.log('❌ Ticket command or handleInteraction method not found');
                    // Fall back to direct handling if command not loaded properly
                    await handleTicketFallback(interaction, client, client.db);
                    return;
                }
            }
            
            // ========== TTS PLAY AGAIN BUTTONS ==========
            if (interaction.customId.startsWith('tts_replay_')) {
                await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral flag
                
                try {
                    const ttsCommand = require('./commands/ai/tts.js');
                    
                    if (ttsCommand.handleTTSButton) {
                        await ttsCommand.handleTTSButton(interaction, client);
                    } else {
                        // Fallback direct handler
                        const cached = client.ttsCache?.get(interaction.customId);
                        
                        if (!cached) {
                            return interaction.editReply({
                                content: '❌ TTS data expired. Please generate a new one.',
                                flags: 64 // Ephemeral
                            });
                        }
                        
                        const apiClient = require('./utils/apiClient');
                        const ttsResult = await apiClient.textToSpeech(cached.text, cached.language);
                        
                        await interaction.editReply({
                            content: `🔊 Playing again for ${interaction.user.username}`,
                            files: [{
                                attachment: ttsResult.buffer,
                                name: cached.useAI ? 'ai-tts-again.mp3' : 'tts-again.mp3'
                            }]
                        });
                    }
                } catch (error) {
                    console.error('TTS Button Error:', error);
                    await interaction.editReply({
                        content: '❌ Failed to play TTS again',
                        flags: 64 // Ephemeral
                    });
                }
                return;
            }
            
            // ========== IMAGE REGENERATION BUTTONS ==========
            if (interaction.customId.startsWith('regenerate_')) {
                const [, model, prompt] = interaction.customId.split('_');
                const decodedPrompt = decodeURIComponent(prompt);
                
                await interaction.deferReply({ flags: 64 }); // Ephemeral
                
                try {
                    const imagegenCommand = require('./commands/ai/imagegen.js');
                    if (imagegenCommand.generateAndSendImage) {
                        await imagegenCommand.generateAndSendImage(interaction, model, decodedPrompt);
                    }
                } catch (error) {
                    console.error('Regeneration error:', error);
                    await interaction.editReply({
                        content: '❌ Failed to regenerate image',
                        flags: 64 // Ephemeral
                    });
                }
                return;
            }
            
            // ========== GIVEAWAY BUTTON HANDLER ==========
            if (interaction.customId.startsWith('giveaway_enter_')) {
                try {
                    const giveawayModule = require('./commands/fun/giveaways.js');
                    if (giveawayModule.handleButtonInteraction) {
                        await giveawayModule.handleButtonInteraction(interaction, client, client.db);
                    }
                } catch (error) {
                    console.error('Giveaway button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred while processing giveaway entry.',
                            flags: 64 // Ephemeral
                        }).catch(() => {});
                    }
                }
                return;
            }
            
            // ========== ECONOMY BUTTON HANDLER ==========
            if (interaction.customId.startsWith('eco_')) {
                try {
                    // Initialize database if needed
                    if (!client.db) {
                        const Database = require('./utils/database');
                        const dbInstance = new Database();
                        client.db = await dbInstance.initialize();
                    }
                    
                    // Get economy command
                    let economyCommand;
                    try {
                        economyCommand = require('./commands/Economy/economy.js');
                    } catch (error) {
                        console.error('[Economy] Failed to load economy command:', error.message);
                        await interaction.reply({
                            content: '❌ Economy system not available.',
                            flags: 64 // Ephemeral
                        });
                        return;
                    }
                    
                    // Handle different economy buttons
                    const buttonType = interaction.customId.replace('eco_', '');
                    
                    // Create a mock message object for the command functions
                    const mockMessage = {
                        author: interaction.user,
                        guild: interaction.guild,
                        channel: interaction.channel,
                        reply: async (content) => {
                            if (typeof content === 'object' && content.embeds) {
                                return interaction.reply(content);
                            } else {
                                return interaction.reply({ content });
                            }
                        }
                    };
                    
                    switch (buttonType) {
                        case 'work':
                            await economyCommand.workJob(mockMessage, client, client.db);
                            break;
                        case 'properties':
                            await economyCommand.showProperties(mockMessage, client, client.db);
                            break;
                        case 'lottery':
                            await economyCommand.lotteryInfo(mockMessage, client, client.db);
                            break;
                        case 'bank':
                            await economyCommand.bankManagement(mockMessage, [], client, client.db);
                            break;
                        default:
                            await interaction.reply({
                                content: '❌ Unknown button action.',
                                flags: 64 // Ephemeral
                            });
                    }
                    
                    // Defer update to prevent interaction timeout
                    if (!interaction.replied) {
                        await interaction.deferUpdate();
                    }
                    
                } catch (error) {
                    console.error('Economy button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred processing your request.',
                            flags: 64 // Ephemeral
                        }).catch(() => {});
                    }
                }
                return;
            }
            
            // ========== OLD TICKET BUTTON HANDLER (Legacy) ==========
            if (interaction.customId.startsWith('ticket_')) {
                try {
                    const ticketModule = require('./commands/ticket/ticket.js');

                    // Handle different ticket interactions
                    if (interaction.customId === 'ticket_staff_apply') {
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'Staff Application', 'Staff Position Application', client, client.db);
                    }
                    else if (interaction.customId === 'ticket_bug_report') {
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'Bug Report', 'Bug/Issue Report', client, client.db);
                    }
                    else if (interaction.customId === 'ticket_user_report') {
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'User Report', 'User Behavior Report', client, client.db);
                    }
                    else if (interaction.customId.startsWith('ticket_close_')) {
                        const channelId = interaction.customId.split('_').pop();
                        const channel = interaction.guild.channels.cache.get(channelId);

                        if (!channel) {
                            return interaction.reply({
                                content: '❌ Ticket channel not found.',
                                flags: 64 // Ephemeral
                            });
                        }

                        // Check permissions
                        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && 
                            !channel.permissionsFor(interaction.user).has(PermissionFlagsBits.ViewChannel)) {
                            return interaction.reply({
                                content: '❌ You cannot close this ticket.',
                                flags: 64 // Ephemeral
                            });
                        }

                        // Send closing message
                        const closingEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🔒 Ticket Closing')
                            .setDescription(`This ticket will be deleted in 10 seconds...`)
                            .setFooter({ text: 'Thank you for using our support system' });

                        await channel.send({ embeds: [closingEmbed] });

                        // Delete channel after delay
                        setTimeout(() => {
                            channel.delete('Ticket closed').catch(console.error);
                        }, 10000);

                        await interaction.reply({
                            content: '✅ Ticket scheduled for closure.',
                            flags: 64 // Ephemeral
                        });
                    }
                    else if (interaction.customId.startsWith('ticket_add_user_')) {
                        await interaction.reply({
                            content: '👥 Use `/ticket add @user` to add users to the ticket.',
                            flags: 64 // Ephemeral
                        });
                    }
                    else if (interaction.customId === 'ticket_reason_support') {
                        // Support ticket reason select menu
                        const reason = interaction.values[0];
                        const reasons = {
                            'general_support': 'General Support Request',
                            'technical': 'Technical Issues',
                            'account': 'Account Help',
                            'purchase': 'Purchase Help',
                            'other': 'Other Support'
                        };
                        const reasonText = reasons[reason] || 'Support Request';
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'Support', reasonText, client, client.db);
                    }

                } catch (error) {
                    console.error('Ticket interaction error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred',
                            flags: 64 // Ephemeral
                        });
                    }
                }
                return;
            }
            
            // ========== MUSIC BUTTON HANDLER ==========
            if (interaction.customId === 'music_pause_resume' || 
                interaction.customId === 'music_skip' || 
                interaction.customId === 'music_stop' || 
                interaction.customId === 'music_shuffle' || 
                interaction.customId === 'music_loop') {
                
                try {
                    if (!client.playerManager || !client.playerManager.riffy) {
                        return interaction.reply({ 
                            content: '❌ Music system not available', 
                            flags: 64 
                        });
                    }

                    const player = client.playerManager.riffy.players.get(interaction.guild.id);
                    if (!player) {
                        return interaction.reply({ 
                            content: '❌ No music playing', 
                            flags: 64 
                        });
                    }

                    const member = interaction.guild.members.cache.get(interaction.user.id);
                    if (member.voice.channelId !== player.voiceChannel) {
                        return interaction.reply({ 
                            content: '❌ Join the voice channel first!', 
                            flags: 64 
                        });
                    }

                    switch (interaction.customId) {
                        case 'music_pause_resume':
                            player.pause(!player.paused);
                            await interaction.reply({ 
                                content: player.paused ? '⏸️ Paused!' : '▶️ Resumed!', 
                                flags: 64 
                            });
                            
                            // Update now playing message
                            if (client.playerManager.updateNowPlayingProgress) {
                                client.playerManager.updateNowPlayingProgress(interaction.guild.id);
                            }
                            break;

                        case 'music_skip':
                            if (!player.queue.length) {
                                return interaction.reply({ 
                                    content: '❌ No more tracks in queue!', 
                                    flags: 64 
                                });
                            }
                            player.stop();
                            await interaction.reply({ 
                                content: '⏭️ Skipped!', 
                                flags: 64 
                            });
                            break;

                        case 'music_stop':
                            player.destroy();
                            if (client.playerManager.stopProgressUpdates) {
                                client.playerManager.stopProgressUpdates(interaction.guild.id);
                                client.playerManager.nowPlayingMessages.delete(interaction.guild.id);
                            }
                            await interaction.reply({ 
                                content: '⏹️ Stopped!', 
                                flags: 64 
                            });
                            break;

                        case 'music_shuffle':
                            if (player.queue.length < 2) {
                                return interaction.reply({ 
                                    content: '❌ Need at least 2 tracks to shuffle!', 
                                    flags: 64 
                                });
                            }
                            player.queue.shuffle();
                            await interaction.reply({ 
                                content: '🔀 Shuffled!', 
                                flags: 64 
                            });
                            break;

                        case 'music_loop':
                            const newMode = player.loop === "none" ? "queue" : "none";
                            player.setLoop(newMode);
                            await interaction.reply({ 
                                content: newMode === "queue" ? '🔁 Loop enabled!' : '🔁 Loop disabled!', 
                                flags: 64 
                            });
                            break;
                    }
                } catch (error) {
                    console.error('Music button error:', error);
                    await interaction.reply({ 
                        content: '❌ An error occurred', 
                        flags: 64 
                    });
                }
                return;
            }
            
            // If no handler matched
            console.log(`[Button] No handler for: ${interaction.customId}`);
            
        } catch (error) {
            console.error('Button interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred',
                    flags: 64 // Ephemeral
                }).catch(() => {});
            }
        }
        return;
    }
});

// ========== FALLBACK TICKET HANDLER (if ticket command not loaded properly) ==========
async function handleTicketFallback(interaction, client, db) {
    try {
        if (interaction.customId === 'open_support_ticket') {
            await interaction.deferReply({ flags: 64 });
            
            const guild = interaction.guild;
            const user = interaction.user;
            
            // Find or create category
            let category = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && 
                c.name.toLowerCase().includes('tickets')
            );
            
            if (!category) {
                category = await guild.channels.create({
                    name: '🎫 Tickets',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }
            
            // Create ticket channel
            const ticketNumber = Date.now().toString().slice(-6);
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username.toLowerCase()}-${ticketNumber}`,
                type: ChannelType.GuildText,
                parent: category.id,
                topic: `Support ticket for ${user.tag} (${user.id}) | Created: ${new Date().toISOString()}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });
            
            // Find staff role
            const staffRole = guild.roles.cache.find(r => 
                r.name.toLowerCase().includes('staff') || 
                r.name.toLowerCase().includes('mod') ||
                r.name.toLowerCase().includes('admin') ||
                r.name.toLowerCase().includes('support')
            );
            
            if (staffRole) {
                await ticketChannel.permissionOverwrites.create(staffRole.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    ManageMessages: true,
                    ManageChannels: true
                });
            }
            
            // Send welcome message
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎫 Support Ticket Created')
                .setDescription(`Hello ${user.toString()}! Our support team will assist you shortly.`)
                .addFields(
                    { name: '👤 Created By', value: user.tag, inline: true },
                    { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                    { name: '📅 Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { 
                        name: '📝 How to Get Help', 
                        value: 'Please describe your issue in detail.', 
                        inline: false 
                    }
                )
                .setFooter({ text: 'DTEmpire Support System' })
                .setTimestamp();
            
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketChannel.id}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await ticketChannel.send({
                content: `${user.toString()} ${staffRole ? staffRole.toString() : ''}`,
                embeds: [welcomeEmbed],
                components: [closeButton]
            });
            
            await interaction.editReply({
                content: `✅ Your support ticket has been created: ${ticketChannel.toString()}`
            });
        }
        
        else if (interaction.customId === 'open_bug_report') {
            await interaction.deferReply({ flags: 64 });
            
            const guild = interaction.guild;
            const user = interaction.user;
            
            // Find or create bug category
            let bugCategory = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && 
                c.name.toLowerCase().includes('bug')
            );
            
            if (!bugCategory) {
                bugCategory = await guild.channels.create({
                    name: '🐛 Bug Reports',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }
            
            // Create bug report channel
            const bugNumber = Date.now().toString().slice(-6);
            const bugChannel = await guild.channels.create({
                name: `bug-${user.username.toLowerCase()}-${bugNumber}`,
                type: ChannelType.GuildText,
                parent: bugCategory.id,
                topic: `Bug report from ${user.tag} (${user.id}) | Created: ${new Date().toISOString()}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });
            
            // Find developer/admin role
            const devRole = guild.roles.cache.find(r => 
                r.name.toLowerCase().includes('dev') || 
                r.name.toLowerCase().includes('developer') ||
                r.name.toLowerCase().includes('admin') ||
                r.name.toLowerCase().includes('staff')
            );
            
            if (devRole) {
                await bugChannel.permissionOverwrites.create(devRole.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    ManageMessages: true,
                    ManageChannels: true
                });
            }
            
            // Send bug report form
            const bugEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🐛 Bug Report Created')
                .setDescription(`Hello ${user.toString()}! Please describe the bug you encountered.`)
                .addFields(
                    { 
                        name: '📋 Required Information', 
                        value: 'Please include:\n• What happened\n• Steps to reproduce\n• Expected behavior\n• Actual behavior\n• Screenshots if available', 
                        inline: false 
                    },
                    { name: '👤 Reported By', value: user.tag, inline: true },
                    { name: '🆔 User ID', value: `\`${user.id}\``, inline: true }
                )
                .setFooter({ text: 'DTEmpire Bug Report System' })
                .setTimestamp();
            
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${bugChannel.id}`)
                        .setLabel('Close Report')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await bugChannel.send({
                content: `${user.toString()} ${devRole ? devRole.toString() : ''}`,
                embeds: [bugEmbed],
                components: [closeButton]
            });
            
            await interaction.editReply({
                content: `✅ Your bug report has been created: ${bugChannel.toString()}`
            });
        }
        
        else if (interaction.customId.startsWith('close_ticket_')) {
            const channelId = interaction.customId.replace('close_ticket_', '');
            const channel = interaction.guild.channels.cache.get(channelId);
            
            if (!channel) {
                return await interaction.reply({
                    content: '❌ Ticket channel not found.',
                    flags: 64 // Ephemeral
                });
            }
            
            // Check permissions
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                                 interaction.member.roles.cache.some(role => 
                                     role.name.toLowerCase().includes('staff') ||
                                     role.name.toLowerCase().includes('mod') ||
                                     role.name.toLowerCase().includes('admin')
                                 ) ||
                                 channel.topic?.includes(`(${interaction.user.id})`);
            
            if (!hasPermission) {
                return await interaction.reply({
                    content: '❌ You do not have permission to close this ticket.',
                    flags: 64 // Ephemeral
                });
            }
            
            const closeEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🎫 Ticket Closed')
                .setDescription(`This ticket has been closed by ${interaction.user.tag}`)
                .addFields(
                    { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: 'Ticket', value: channel.name, inline: true }
                )
                .setFooter({ text: 'This channel will be deleted in 10 seconds' })
                .setTimestamp();
            
            await channel.send({ embeds: [closeEmbed] });
            
            await interaction.reply({
                content: '✅ Ticket closed. Channel will be deleted shortly.',
                flags: 64 // Ephemeral
            });
            
            // Delete channel after delay
            setTimeout(async () => {
                try {
                    await channel.delete('Ticket closed by user');
                } catch (error) {
                    console.log('Could not delete channel:', error.message);
                }
            }, 10000);
        }
        
    } catch (error) {
        console.error('Fallback ticket handler error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                flags: 64 // Ephemeral
            });
        }
    }
}

// ========== LOGGING EVENT LISTENERS ==========

// Member join/leave logs
client.on('guildMemberAdd', async (member) => {
    if (client.loggingSystem) {
        await client.loggingSystem.logMemberJoin(member.guild.id, member);
    }
});

client.on('guildMemberRemove', async (member) => {
    if (client.loggingSystem) {
        await client.loggingSystem.logMemberLeave(member.guild.id, member);
    }
});

// ========== RIFFY RAW EVENT HANDLER ==========
client.on("raw", d => {
    // Only handle voice state updates for Riffy
    if (!d.t) return;
    
    // Pass to Riffy if it exists
    if (client.playerManager && client.playerManager.riffy) {
        client.playerManager.riffy.updateVoiceState(d);
    }
});

// Message delete/edit logs
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    // Save to snipe (existing functionality)
    client.snipes.set(message.channel.id, {
        author: message.author.tag,
        content: message.content,
        timestamp: Date.now()
    });
    
    // Save to database if available
    if (client.db) {
        try {
            await client.db.saveSnipe(
                message.guild.id,
                message.channel.id,
                {
                    author: message.author.tag,
                    content: message.content,
                    author_id: message.author.id
                }
            );
        } catch (error) {
            console.error('Error saving snipe:', error);
        }
    }
    
    // Log to logging system
    if (client.loggingSystem) {
        await client.loggingSystem.logMessageDelete(message.guild.id, message);
    }
    
    // ========== ADDED: Handle sticky message deletion ==========
    if (client.db && stickyHandler) {
        await stickyHandler.handleMessageDelete(message, client, client.db);
    }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author.bot || !newMessage.content) return;
    
    // Save to edit snipe (existing functionality)
    client.editSnipes.set(oldMessage.channel.id, {
        author: oldMessage.author.tag,
        oldContent: oldMessage.content,
        newContent: newMessage.content,
        timestamp: Date.now()
    });
    
    // Log to logging system
    if (client.loggingSystem && oldMessage.content !== newMessage.content) {
        await client.loggingSystem.logMessageEdit(oldMessage.guild.id, oldMessage, newMessage);
    }
});

// Role change logs
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!client.loggingSystem) return;
    
    const guildId = oldMember.guild.id;
    
    // Check for role changes
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        
        for (const role of addedRoles.values()) {
            await client.loggingSystem.logRoleAdd(guildId, newMember, role);
        }
        
        for (const role of removedRoles.values()) {
            await client.loggingSystem.logRoleRemove(guildId, newMember, role);
        }
    }
});

// Channel logs
client.on('channelCreate', async (channel) => {
    if (!client.loggingSystem || !channel.guild) return;
    await client.loggingSystem.logChannelCreate(channel.guild.id, channel);
});

client.on('channelDelete', async (channel) => {
    if (!client.loggingSystem || !channel.guild) return;
    await client.loggingSystem.logChannelDelete(channel.guild.id, channel);
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!client.loggingSystem || !oldChannel.guild) return;
    await client.loggingSystem.logChannelUpdate(oldChannel.guild.id, oldChannel, newChannel);
});

// Voice logs
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!client.loggingSystem || !oldState.guild) return;
    
    const guildId = oldState.guild.id;
    
    // User joined voice channel
    if (!oldState.channelId && newState.channelId) {
        await client.loggingSystem.logVoiceJoin(guildId, newState.member, newState.channel);
    }
    // User left voice channel
    else if (oldState.channelId && !newState.channelId) {
        await client.loggingSystem.logVoiceLeave(guildId, oldState.member, oldState.channel);
    }
    // User moved voice channels
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await client.loggingSystem.logVoiceMove(guildId, oldState.member, oldState.channel, newState.channel);
    }
});

// Invite logs
client.on('inviteCreate', async (invite) => {
    if (!client.loggingSystem || !invite.guild) return;
    await client.loggingSystem.logInviteCreate(invite.guild.id, invite);
});

client.on('inviteDelete', async (invite) => {
    if (!client.loggingSystem || !invite.guild) return;
    await client.loggingSystem.logInviteDelete(invite.guild.id, invite);
});

// Role create/delete logs
client.on('roleCreate', async (role) => {
    if (!client.loggingSystem) return;
    await client.loggingSystem.logRoleCreate(role.guild.id, role);
});

client.on('roleDelete', async (role) => {
    if (!client.loggingSystem) return;
    await client.loggingSystem.logRoleDelete(role.guild.id, role);
});

// ========== AUTO-MODERATION MESSAGE HANDLER ==========
client.on('messageCreate', async (message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;
    
    // ========== AUTO-MOD BAD WORDS CHECK ==========
    try {
        // Check if moderation module exists
        let modModule;
        try {
            modModule = require('./commands/moderation/mod.js');
        } catch (error) {
            // Mod module not loaded yet, skip check
            console.log('[Auto-Mod] Module not loaded yet, skipping check');
            modModule = null;
        }
        
        // Only check if module is loaded and user doesn't have Manage Messages permission
        if (modModule && modModule.checkBadWords && 
            !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            
            const result = await modModule.checkBadWords(message);
            
            if (result && result.found) {
                // Delete the message
                await message.delete().catch(() => {});
                
                // Send warning to user
                try {
                    const warnEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚫 Message Removed')
                        .setDescription('Your message contained inappropriate content.')
                        .addFields(
                            { name: 'Bad Word', value: `\`${result.word}\``, inline: true },
                            { name: 'Action', value: 'Message Deleted', inline: true }
                        )
                        .setFooter({ text: 'Please follow server rules' });
                    
                    await message.author.send({ embeds: [warnEmbed] }).catch(() => {
                        // If can't DM, send ephemeral message in channel
                        if (message.channel.permissionsFor(client.user).has('SendMessages')) {
                            message.channel.send({
                                content: `${message.author}, your message was removed for containing inappropriate content.`,
                                flags: 64 // Ephemeral
                            }).catch(() => {});
                        }
                    });
                    
                    console.log(`[Auto-Mod] Deleted message from ${message.author.tag}: ${message.content.substring(0, 50)}...`);
                    return; // Stop processing this message
                    
                } catch (error) {
                    console.error('Auto-mod warning error:', error);
                }
            }
        }
    } catch (error) {
        console.error('Auto-mod check error:', error);
    }
    
    // ========== ADDED: Handle sticky messages ==========
    if (client.db && stickyHandler) {
        await stickyHandler.handleMessageCreate(message, client, client.db);
    }
    
    // ========== COMMAND HANDLER ==========
    const prefix = client.botInfo.prefix;
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = client.commands.get(commandName) || 
                   client.commands.get(client.aliases.get(commandName));
    
    if (!command) return;
    
    try {
        // Initialize database if needed
        if (!client.db) {
            const Database = require('./utils/database');
            const dbInstance = new Database();
            client.db = await dbInstance.initialize();
        }
        
        // Execute command with database
        await command.execute(message, args, client, client.db);
    } catch (error) {
        console.error('Command error:', error);
        
        // Try without database for fallback
        try {
            await command.execute(message, args, client, null);
        } catch (error2) {
            message.reply('❌ An error occurred while executing the command.').catch(() => {});
        }
    }
});

// ========== AUTO-UNMUTE CHECKER ==========
function startMuteChecker() {
    setInterval(async () => {
        try {
            if (!client.db || !client.db.getActiveMutes) return;
            
            const activeMutes = await client.db.getActiveMutes();
            const now = Date.now();
            
            for (const mute of activeMutes) {
                if (mute.unmuteTime <= now) {
                    try {
                        const guild = client.guilds.cache.get(mute.guildId);
                        if (guild) {
                            const member = await guild.members.fetch(mute.userId).catch(() => null);
                            if (member && member.isCommunicationDisabled()) {
                                await member.timeout(null, 'Auto-unmute');
                                console.log(`[Auto-Unmute] Unmuted ${member.user.tag} in ${guild.name}`);
                                
                                // Remove from database
                                await client.db.removeMute(mute.guildId, mute.userId);
                            }
                        }
                    } catch (error) {
                        console.error('Auto-unmute error:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Mute checker error:', error);
        }
    }, 60000); // Check every minute
}

// ========== GIVEAWAY CHECKER ==========
function startGiveawayInterval(client) {
    setInterval(async () => {
        try {
            if (!client.db) {
                console.log('[Giveaway] Database not initialized, skipping check');
                return;
            }
            
            // Try to load giveaway command
            let giveawayCommand;
            try {
                giveawayCommand = require('./commands/fun/giveaways.js');
            } catch (error) {
                console.error('[Giveaway] Failed to load giveaway command:', error.message);
                return;
            }
            
            // Use the new checkGiveaways function
            if (giveawayCommand.checkGiveaways) {
                await giveawayCommand.checkGiveaways(client, client.db);
            }
        } catch (error) {
            console.error('Giveaway interval error:', error);
        }
    }, 60000); // Check every minute
}

// ========== BAD WORDS INITIALIZATION ==========
async function initializeBadWords() {
    try {
        const fsPromises = require('fs').promises;
        const dataDir = path.join(__dirname, 'data');
        const badWordsFile = path.join(dataDir, 'bad-words.json');
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            await fsPromises.mkdir(dataDir, { recursive: true });
        }
        
        // Create default bad words file if it doesn't exist
        if (!fs.existsSync(badWordsFile)) {
            const defaultBadWords = {
                "default": {
                    "en": [
                        "fuck", "shit", "asshole", "bitch", "bastard", 
                        "cunt", "dick", "pussy", "whore", "slut",
                        "nigger", "nigga", "retard", "faggot", "kys",
                        "kill yourself", "die", "fucking", "motherfucker"
                    ],
                    "hi": [
                        "madarchod", "behenchod", "bhosdike", "lund", "chutiya",
                        "gaandu", "bhenchod", "mc", "bc", "lauda",
                        "lavde", "gandu", "randi", "kutta", "kutti"
                    ],
                    "ne": [
                        "kukur", "randi", "jatha", "jhant", "khattam",
                        "muji", "beshya", "chakka", "hijo", "khattam"
                    ]
                }
            };
            
            await fsPromises.writeFile(badWordsFile, JSON.stringify(defaultBadWords, null, 2));
            console.log('✅ Created default bad words database');
        }
        
        console.log('✅ Auto-moderation system initialized');
        
    } catch (error) {
        console.error('Failed to initialize bad words:', error);
    }
}

// ========== AUTO-INITIALIZE ALL SERVERS WITH GLOBAL WORDS ==========
async function initializeAllServersWithGlobalWords() {
    try {
        console.log('🔄 Initializing all servers with global bad words...');
        
        const fsPromises = require('fs').promises;
        const badWordsFile = path.join(__dirname, 'data', 'bad-words.json');
        
        // Check if file exists
        if (!fs.existsSync(badWordsFile)) {
            console.log('❌ Bad words file not found');
            return;
        }
        
        // Load bad words data
        const data = JSON.parse(await fsPromises.readFile(badWordsFile, 'utf8'));
        
        // Get all global words
        const globalWords = [];
        if (data.default) {
            if (data.default.en) globalWords.push(...data.default.en);
            if (data.default.hi) globalWords.push(...data.default.hi);
            if (data.default.ne) globalWords.push(...data.default.ne);
        }
        
        const uniqueWords = [...new Set(globalWords)];
        
        // Initialize all guilds the bot is in
        const guilds = client.guilds.cache;
        let initializedCount = 0;
        
        for (const guild of guilds.values()) {
            const guildId = guild.id;
            
            if (!data[guildId]) {
                data[guildId] = {
                    words: uniqueWords,
                    enabled: true
                };
                initializedCount++;
            }
        }
        
        // Save back to file
        await fsPromises.writeFile(badWordsFile, JSON.stringify(data, null, 2));
        
        console.log(`✅ Auto-initialized ${initializedCount} servers with ${uniqueWords.length} global bad words`);
        
    } catch (error) {
        console.error('Failed to initialize servers with global words:', error);
    }
}

// ========== SIMPLE WELCOME SYSTEM (NO CANVAS) ==========
client.on('guildMemberAdd', async (member) => {
    try {
        if (!client.db) return;
        
        const config = await client.db.getGuildConfig(member.guild.id);
        
        // Auto role
        if (config.auto_role) {
            try {
                const role = member.guild.roles.cache.get(config.auto_role);
                if (role) {
                    await member.roles.add(role);
                }
            } catch (error) {
                console.error('Auto role error:', error);
            }
        }
        
        // Welcome channel messages
        if (config.welcome_channel) {
            const channel = member.guild.channels.cache.get(config.welcome_channel);
            if (channel) {
                // Send embed if enabled
                if (config.welcome_embed !== false) {
                    const embed = new EmbedBuilder()
                        .setColor('#43B581')
                        .setTitle(`🎉 Welcome to ${member.guild.name}!`)
                        .setDescription(`**${member.user.username}** just joined the server!\nWe're now **${member.guild.memberCount}** members strong! 🎊`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            {
                                name: '👤 Username',
                                value: member.user.tag,
                                inline: true
                            },
                            {
                                name: '📅 Account Created',
                                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                                inline: true
                            },
                            {
                                name: '🎊 Member #',
                                value: `#${member.guild.memberCount}`,
                                inline: true
                            }
                        )
                        .setFooter({ 
                            text: `Member #${member.guild.memberCount} • Welcome to the server! 🎉` 
                        })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
                
                // Send text message
                if (config.welcome_message) {
                    const welcomeText = config.welcome_message
                        .replace(/{user}/g, member.user.username)
                        .replace(/{server}/g, member.guild.name)
                        .replace(/{count}/g, member.guild.memberCount.toString())
                        .replace(/{mention}/g, `<@${member.user.id}>`);
                    
                    await channel.send(welcomeText);
                }
            }
        }
        
    } catch (error) {
        console.error('Welcome system error:', error);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        if (!client.db) return;
        
        const config = await client.db.getGuildConfig(member.guild.id);
        
        // Leave channel messages
        if (config.leave_channel) {
            const channel = member.guild.channels.cache.get(config.leave_channel);
            if (channel) {
                // Send embed if enabled
                if (config.welcome_embed !== false) {
                    const embed = new EmbedBuilder()
                        .setColor('#F04747')
                        .setTitle(`👋 Goodbye from ${member.guild.name}!`)
                        .setDescription(`**${member.user.username}** has left the server.\nWe're now **${member.guild.memberCount}** members. 😢`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            {
                                name: '👤 Username',
                                value: member.user.tag,
                                inline: true
                            },
                            {
                                name: '📅 Account Age',
                                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                                inline: true
                            },
                            {
                                name: '🎊 Was Member #',
                                value: `#${member.guild.memberCount + 1}`,
                                inline: true
                            }
                        )
                        .setFooter({ 
                            text: `Was member #${member.guild.memberCount + 1} • We'll miss you! 😢` 
                        })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
                
                // Send text message
                if (config.leave_message) {
                    const leaveText = config.leave_message
                        .replace(/{user}/g, member.user.username)
                        .replace(/{server}/g, member.guild.name)
                        .replace(/{count}/g, member.guild.memberCount.toString())
                        .replace(/{mention}/g, `<@${member.user.id}>`);
                    
                    await channel.send(leaveText);
                }
            }
        }
        
    } catch (error) {
        console.error('Leave system error:', error);
    }
});

// ========== READY EVENT ==========
client.on('ready', async () => {
    console.log(`\n══════════════════════════════════════════════════════`);
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`👥 Users: ${client.users.cache.size}`);
    console.log(`⚡ Commands: ${client.commands.size}`);
    console.log(`🔧 Version: ${client.botInfo.version}`);
    console.log(`👨‍💻 Creator: ${client.botInfo.creator}`);
    console.log(`══════════════════════════════════════════════════════\n`);
    
    // Set presence
    client.user.setPresence({
        activities: [{
            name: `${client.botInfo.prefix}help | v${client.botInfo.version}`,
            type: ActivityType.Playing
        }],
        status: 'online'
    });
    
    // ========== INITIALIZE RIFFY ==========
    if (client.playerManager && client.playerManager.riffy) {
        try {
            client.playerManager.riffy.init(client.user.id);
            console.log('✅ Riffy initialized with client ID');
        } catch (error) {
            console.error('❌ Failed to initialize Riffy:', error.message);
        }
    }
    

    // Start interval checkers with client reference
    startGiveawayInterval(client);
    startMuteChecker();
    
    // Initialize all servers with global bad words
    setTimeout(() => {
        initializeAllServersWithGlobalWords();
    }, 5000); // Wait 5 seconds for everything to load
    
    // ========== ADDED: Initialize sticky messages on startup ==========
    if (client.db && client.db.data && client.db.data.stickyMessages) {
        console.log('🔄 Initializing sticky messages...');
        let initializedCount = 0;
        
        for (const [channelId, stickyData] of Object.entries(client.db.data.stickyMessages)) {
            try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    // Check if sticky message still exists
                    if (stickyData.lastMessageId) {
                        const existingMsg = await channel.messages.fetch(stickyData.lastMessageId).catch(() => null);
                        if (!existingMsg) {
                            // Sticky was deleted, recreate it
                            let newStickyMsg;
                            
                            if (stickyData.embedData) {
                                try {
                                    const embedData = JSON.parse(stickyData.embedData);
                                    const embed = new EmbedBuilder(embedData);
                                    newStickyMsg = await channel.send({ embeds: [embed] });
                                } catch (error) {
                                    console.error('Error recreating embed sticky:', error);
                                    // Fallback to text
                                    const embed = new EmbedBuilder()
                                        .setColor('#ffff00')
                                        .setDescription(stickyData.content || 'Sticky Message')
                                        .setFooter({ text: '📌 Sticky Message' });
                                    newStickyMsg = await channel.send({ embeds: [embed] });
                                }
                            } else {
                                const embed = new EmbedBuilder()
                                    .setColor('#ffff00')
                                    .setTitle('📌 Sticky Message')
                                    .setDescription(stickyData.content || 'Sticky Message')
                                    .setFooter({ text: 'This message will stay at the bottom of the channel' })
                                    .setTimestamp();
                                
                                newStickyMsg = await channel.send({ embeds: [embed] });
                            }
                            
                            await client.db.updateStickyMessage(channelId, { lastMessageId: newStickyMsg.id });
                            initializedCount++;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error initializing sticky for channel ${channelId}:`, error);
            }
        }
        
        if (initializedCount > 0) {
            console.log(`✅ Recreated ${initializedCount} sticky messages`);
        }
    }
    
    console.log('✅ Interval checkers started');
});

// ========== START BOT ==========
async function startBot() {
    try {
        console.log('🚀 Starting DTEmpire v2.6.9...');
        
        // ========== CHECK FOR REQUIRED ENVIRONMENT VARIABLES ==========
        if (!process.env.BOT_TOKEN) {
            console.error('❌ BOT_TOKEN environment variable is not set!');
            process.exit(1);
        }
        
        console.log('✅ Environment variables loaded');
        
        // Setup directories
        setupDirectories();
        
        // Load commands
        loadCommands();
        
        // Load music commands separately (to ensure they load)
        loadMusicCommands();
        
        console.log(`📦 Total commands loaded: ${client.commands.size}`);
        
        // Initialize auto-mod bad words
        await initializeBadWords();
        
        // Initialize database
        const Database = require('./utils/database');
        const dbInstance = new Database();
        client.db = await dbInstance.initialize();
        console.log('✅ Database initialized');
        
        // Initialize logging system
        client.loggingSystem = new LoggingSystem(client, client.db);
        console.log('✅ Logging system initialized');
        
        // ========== INITIALIZE MUSIC PLAYER MANAGER WITH RIFFY ==========
        try {
            const PlayerManager = require('./utils/playerManager');
            client.playerManager = new PlayerManager(client);
            
            // Check if player manager initialized successfully
            setTimeout(() => {
                if (client.playerManager && client.playerManager.riffy) {
                    console.log('✅ Music Player Manager initialized with Riffy');
                } else {
                    console.log('⚠️  Music Player Manager may not have initialized properly');
                    console.log('⚠️  Check Lavalink node configuration in config.json');
                }
            }, 2000);
        } catch (playerError) {
            console.error('❌ Failed to initialize player manager:', playerError.message);
            console.log('⚠️  Music features will be disabled');
            client.playerManager = null;
        }
        
        // ========== INITIALIZE AUTOROOM MANAGER ==========
        const AutoRoomManager = require('./utils/autoroomManager');
        client.autoroomManager = new AutoRoomManager(client, client.db);
        
        // Start periodic check (safety net)
        setTimeout(() => {
            if (client.autoroomManager && client.autoroomManager.startPeriodicCheck) {
                client.autoroomManager.startPeriodicCheck();
                console.log('✅ AutoRoom periodic check started');
            }
        }, 5000); // Start after 5 seconds
        
        console.log('✅ AutoRoom Manager initialized');
        
        // Login with environment variable token
        await client.login(config.bot.token);
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGINT', async () => {
    console.log('\n🔴 Shutting down DTEmpire...');
    
    // Clear TTS cache
    if (client.ttsCache) {
        client.ttsCache.clear();
    }
    
    // Clean up music player
    if (client.playerManager && client.playerManager.cleanup) {
        client.playerManager.cleanup();
    }
    
    if (client.db && client.db.close) {
        await client.db.close();
    }
    if (client.destroy) {
        client.destroy();
    }
    console.log('✅ Bot shutdown complete');
    process.exit(0);
});

// Start the bot
startBot();