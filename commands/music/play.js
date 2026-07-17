// commands/music/play.js - UPDATED VERSION WITH FIX
const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
// Use native global fetch (available in Node 21)
const spotifyInfo = require('spotify-url-info')(globalThis.fetch);

module.exports = {
    name: 'play',
    description: 'Play music from YouTube, Spotify, etc.',
    aliases: ['p'],
    category: 'music',
    
    async execute(message, args, client, db) {
        try {
            console.log(`[PLAY] Command called by ${message.author.tag}: ${args.join(' ')}`);
            
            if (!message.member.voice.channel) {
                console.log('[PLAY] User not in voice channel');
                return message.reply('❌ You need to be in a voice channel to play music!');
            }

            if (!args.length) {
                console.log('[PLAY] No query provided');
                return message.reply('❌ Please provide a song name or URL!');
            }

            const query = args.join(' ');
            console.log(`[PLAY] Query: ${query}`);
            
            // Check if player manager and Riffy are available
            if (!client.playerManager || !client.playerManager.riffy) {
                console.log('[PLAY] Music system not available');
                return message.reply('❌ Music system is not available right now. Please try again later.');
            }

            console.log('[PLAY] Riffy is available, getting/creating player...');
            
            // Get existing player or create new one
            let player = client.playerManager.riffy.players.get(message.guild.id);
            
            if (!player) {
                console.log('[PLAY] Creating new player...');
                // Create new player connection
                player = client.playerManager.riffy.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: message.member.voice.channel.id,
                    textChannel: message.channel.id,
                    deaf: true,
                    selfDeaf: true
                });
                
                console.log(`[PLAY] Player created: ${player.guildId}`);
                
                // Connect to voice channel
                try {
                    await player.connect();
                    console.log(`✅ Connected to voice channel in guild ${message.guild.id}`);
                } catch (connectError) {
                    console.error('[PLAY] Voice connect error:', connectError);
                    return message.reply('❌ Failed to connect to voice channel. Please try again.');
                }
            } else {
                console.log(`[PLAY] Player already exists in guild ${message.guild.id}`);
                // If player exists but not in same voice channel, move to new channel
                if (player.voiceChannel !== message.member.voice.channel.id) {
                    try {
                        await player.switchChannel(message.member.voice.channel.id);
                        console.log(`✅ Moved to new voice channel in guild ${message.guild.id}`);
                    } catch (moveError) {
                        console.error('[PLAY] Move channel error:', moveError);
                        return message.reply('❌ Failed to move to your voice channel. Make sure I have permission to join.');
                    }
                }
            }

            console.log('[PLAY] Resolving query...');
            let resolve;
            
            // Check if it's a Spotify link - bypass the broken riffy plugin
            if (query.includes('spotify.com')) {
                console.log('[PLAY] Spotify URL detected, bypassing plugin and scraping metadata...');
                try {
                    if (query.includes('/track/')) {
                        const track = await spotifyInfo.getPreview(query);
                        console.log(`[PLAY] Scraped Spotify track: ${track.title} by ${track.artist}`);
                        // Ask Riffy to search for it on youtube
                        resolve = await client.playerManager.riffy.resolve({ 
                            query: `ytsearch:${track.title} ${track.artist}`, 
                            requester: message.author 
                        });
                    } else if (query.includes('/playlist/') || query.includes('/album/')) {
                        const playlistName = (await spotifyInfo.getPreview(query)).title;
                        const tracks = await spotifyInfo.getTracks(query);
                        console.log(`[PLAY] Scraped Spotify playlist: ${playlistName} (${tracks.length} tracks)`);
                        
                        await message.reply(`⏳ Loading Spotify playlist **${playlistName}** (${tracks.length} tracks). This might take a moment...`);
                        
                        let firstTrack = null;
                        const trackObjs = [];
                        let errorCount = 0;
                        
                        // Load top 30 tracks to prevent huge delays
                        const tracksToLoad = tracks.slice(0, 30);
                        
                        for (const t of tracksToLoad) {
                            try {
                                const trRes = await client.playerManager.riffy.resolve({ 
                                    query: `ytsearch:${t.name} ${t.artists?.[0]?.name || ''}`, 
                                    requester: message.author 
                                });
                                
                                if (trRes && trRes.tracks && trRes.tracks.length > 0) {
                                    trackObjs.push(trRes.tracks[0]);
                                    if (!firstTrack) firstTrack = trRes.tracks[0];
                                } else {
                                    errorCount++;
                                }
                            } catch (e) {
                                errorCount++;
                            }
                        }
                        
                        if (trackObjs.length > 0) {
                            resolve = {
                                loadType: 'playlist',
                                playlistInfo: { name: playlistName },
                                tracks: trackObjs
                            };
                            if (errorCount > 0) {
                                message.channel.send(`⚠️ Could not load ${errorCount} tracks from the playlist.`);
                            }
                        } else {
                            throw new Error("Could not find any tracks from this playlist on YouTube.");
                        }
                    } else {
                        // Let Riffy try normal resolve for other spotify links
                        resolve = await client.playerManager.riffy.resolve({ query, requester: message.author });
                    }
                } catch (scrapeErr) {
                    console.error('[PLAY] Spotify scrape error:', scrapeErr);
                    throw new Error("Failed to load Spotify link. Make sure it's public.");
                }
            } else {
                // Normal Riffy resolve for YouTube, SoundCloud, etc.
                resolve = await client.playerManager.riffy.resolve({ 
                    query, 
                    requester: message.author 
                }).catch(err => {
                    console.error('[PLAY] Resolve error full object:', err);
                    throw new Error(`Failed to resolve query: ${err.message}`);
                });
            }

            console.log(`[PLAY] Resolve result - loadType: ${resolve.loadType}, exception:`, resolve.exception);
            
            const { loadType, tracks, playlistInfo } = resolve;

            if (loadType === "LOAD_FAILED" || loadType === "NO_MATCHES" || !tracks || tracks.length === 0) {
                console.log('[PLAY] No results found');
                return message.reply('❌ No results found for your query!');
            }

            let addedCount = 0;
            let playlistName = '';
            const wasPlaying = player.playing && !player.paused;
            const hadQueue = player.queue.length > 0;
            
            if (loadType === "playlist") {
                console.log(`[PLAY] Adding playlist: ${playlistInfo.name} with ${tracks.length} tracks`);
                playlistName = playlistInfo.name;
                
                // Add all tracks from playlist
                for (const track of tracks) {
                    try {
                        track.info.requester = message.author;
                        player.queue.add(track);
                        addedCount++;
                    } catch (trackError) {
                        console.error('[PLAY] Error adding track:', trackError);
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('📁 Playlist Added')
                    .setDescription(`**${playlistName}**`)
                    .addFields(
                        { name: 'Tracks Added', value: `${addedCount} songs`, inline: true },
                        { name: 'Duration', value: client.playerManager.formatTime(
                            tracks.reduce((total, track) => total + (track.info.length || 0), 0)
                        ), inline: true },
                        { name: 'Position in Queue', value: player.queue.length === addedCount && !wasPlaying ? 'Now Playing' : `Starting at #${hadQueue ? player.queue.length - addedCount + 1 : 1}`, inline: true }
                    )
                    .setFooter({ text: `Requested by ${message.author.tag}` })
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });
                
            } else if (loadType === "search" || loadType === "track") {
                console.log(`[PLAY] Adding single track: ${tracks[0].info.title}`);
                // Add single track
                const track = tracks[0];
                track.info.requester = message.author;
                player.queue.add(track);
                addedCount = 1;

                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('🎵 Added to Queue')
                    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                    .addFields(
                        { name: 'Artist', value: track.info.author || 'Unknown', inline: true },
                        { name: 'Duration', value: client.playerManager.formatTime(track.info.length), inline: true },
                        { name: 'Position', value: player.queue.length === 1 && !wasPlaying ? 'Now Playing' : `#${player.queue.length}`, inline: true }
                    )
                    .setThumbnail(track.info.thumbnail || null)
                    .setFooter({ text: `Requested by ${message.author.tag}` })
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });
            }

            // ========== FIX: Handle current track when adding to playing queue ==========
            // If player is playing but has no current track, try to get it from Riffy
            if (player.playing && !player.paused && !player.queue.current && player.queue.length > 0) {
                console.log('[PLAY] Player is playing but queue.current is null, trying to fix...');
                
                try {
                    // Try to get the first track from Riffy's internal queue
                    const firstTrack = player.queue[0];
                    if (firstTrack) {
                        console.log('[PLAY] Found first track in queue:', firstTrack.info.title);
                        
                        // Try to manually set current track for nowplaying command
                        // This is a workaround for Riffy's current track tracking
                        player.currentTrack = firstTrack;
                        
                        // Update now playing message if available
                        const npMessage = client.playerManager.nowPlayingMessages.get(message.guild.id);
                        if (npMessage && client.playerManager.updateNowPlayingProgress) {
                            setTimeout(() => {
                                client.playerManager.updateNowPlayingProgress(message.guild.id);
                            }, 1000);
                        }
                    }
                } catch (trackError) {
                    console.error('[PLAY] Error fixing current track:', trackError);
                }
            }

            // Start playing if not already
            if (!player.playing && !player.paused) {
                console.log('[PLAY] Starting playback...');
                try {
                    await player.play();
                    console.log(`✅ Started playing in guild ${message.guild.id}`);
                    // Note: The trackStart event in playerManager will send the Now Playing message
                    // No need to send it here to avoid duplicates
                    
                } catch (playError) {
                    console.error('[PLAY] Play error:', playError);
                    message.reply('❌ Failed to start playback. Please try again.');
                }
            } else {
                console.log(`[PLAY] Player already playing or paused: playing=${player.playing}, paused=${player.paused}`);
                console.log(`[PLAY] Queue length: ${player.queue.length}`);
                console.log(`[PLAY] Current track: ${player.queue.current?.info?.title || 'None'}`);
                
                // Player already playing - don't send duplicate now playing message
                // The existing now playing message will update automatically via progress tracker
            }

        } catch (error) {
            logger.error(`Play command error: ${error.message}`);
            console.error('[PLAY] Full play error:', error);
            
            let errorMessage = '❌ An error occurred while trying to play music.';
            
            if (error.message.includes('No nodes connected')) {
                errorMessage = '❌ Lavalink node is not connected. Please contact the bot owner.';
            } else if (error.message.includes('initialize')) {
                errorMessage = '❌ Music system is still starting up. Please try again in a few seconds.';
            } else if (error.message.includes('Player connection is not initiated')) {
                errorMessage = '❌ Failed to establish voice connection. Please make sure the bot has proper permissions.';
            } else if (error.message.includes('Failed to resolve query')) {
                errorMessage = '❌ Failed to process your request. The service might be down or the URL is invalid.';
            } else if (error.message.includes('Spotify')) {
                errorMessage = '❌ Spotify integration error. Please try a YouTube link or song name instead.';
            } else if (error.message.includes('429')) {
                errorMessage = '❌ Rate limited. Please wait a moment before trying again.';
            }
            
            // Try to clean up broken player
            try {
                const player = client.playerManager?.riffy?.players.get(message.guild.id);
                if (player && (!player.playing || player.error)) {
                    player.destroy();
                }
            } catch (cleanupError) {
                console.error('[PLAY] Cleanup error:', cleanupError);
            }
            
            return message.reply(errorMessage);
        }
    }
};

// Helper function to format duration (keep as backup)
function formatTime(ms) {
    if (!ms || ms < 0 || typeof ms !== 'number') return '0:00';
    
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}