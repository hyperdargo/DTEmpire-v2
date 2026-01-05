const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store birthdays (in production, use database)
const birthdays = new Map();
const birthdayChannels = new Map();

// Birthday reminder check interval (runs every hour)
let birthdayCheckInterval = null;

module.exports = {
    name: 'birthday',
    description: 'Birthday reminder system',
    aliases: ['bday', 'bd'],
    category: 'Utility',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
            return showBirthdayHelp(message);
        }
        
        switch (subCommand) {
            case 'set':
                await setBirthday(message, args.slice(1), client, db);
                break;
            case 'remove':
                await removeBirthday(message, client, db);
                break;
            case 'list':
                await listBirthdays(message, client, db);
                break;
            case 'upcoming':
                await upcomingBirthdays(message, client, db);
                break;
            case 'setchannel':
                await setBirthdayChannel(message, args.slice(1), client, db);
                break;
            case 'check':
                await checkBirthday(message, args.slice(1), client, db);
                break;
            default:
                showBirthdayHelp(message);
        }
    },
    
    // Initialize birthday checker
    initBirthdayChecker(client, db) {
        if (birthdayCheckInterval) {
            clearInterval(birthdayCheckInterval);
        }
        
        // Check birthdays every hour
        birthdayCheckInterval = setInterval(async () => {
            await checkAndAnnounceBirthdays(client, db);
        }, 60 * 60 * 1000); // 1 hour
        
        // Also check on startup
        setTimeout(() => checkAndAnnounceBirthdays(client, db), 5000);
        
        console.log('Birthday checker initialized!');
    }
};

async function setBirthday(message, args, client, db) {
    // Format: MM/DD or MM-DD or MM DD
    const dateInput = args.join(' ').replace(/[\/\-]/g, ' ').trim();
    const parts = dateInput.split(' ');
    
    if (parts.length !== 2) {
        return message.reply('❌ Invalid date format!\n\n**Usage:** `^birthday set <MM/DD>`\n**Example:** `^birthday set 03/15` or `^birthday set 3 15`');
    }
    
    const month = parseInt(parts[0]);
    const day = parseInt(parts[1]);
    
    // Validate month and day
    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
        return message.reply('❌ Invalid date! Month must be 1-12 and day must be 1-31.');
    }
    
    // Check if day is valid for the month
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month - 1]) {
        return message.reply(`❌ Invalid day for month ${month}! Maximum is ${daysInMonth[month - 1]} days.`);
    }
    
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Create birthday key
    const birthdayKey = `${guildId}-${userId}`;
    
    // Store birthday
    const birthdayData = {
        userId,
        guildId,
        month,
        day,
        year: null, // Optional year
        lastAnnounced: null
    };
    
    birthdays.set(birthdayKey, birthdayData);
    
    // Save to database
    try {
        await db.setUserBirthday(userId, guildId, month, day);
    } catch (error) {
        console.error('Error saving birthday:', error);
    }
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎂 Birthday Set!')
        .setDescription(`Your birthday has been saved!`)
        .addFields(
            { name: '📅 Date', value: `${monthNames[month - 1]} ${day}`, inline: true },
            { name: '🎉 Next Birthday', value: getNextBirthdayText(month, day), inline: true },
            { name: '🔔 Reminder', value: 'You\'ll get a special birthday message!', inline: false }
        )
        .setFooter({ text: 'Have a great birthday when it comes! | Suggested By davidbarnett0587' });
    
    await message.reply({ embeds: [embed] });
}

async function removeBirthday(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const birthdayKey = `${guildId}-${userId}`;
    
    if (!birthdays.has(birthdayKey)) {
        return message.reply('❌ You don\'t have a birthday set! Use `^birthday set <MM/DD>` to set one.');
    }
    
    birthdays.delete(birthdayKey);
    
    // Remove from database
    try {
        await db.removeUserBirthday(userId, guildId);
    } catch (error) {
        console.error('Error removing birthday:', error);
    }
    
    await message.reply('✅ Your birthday has been removed from the system.');
}

async function listBirthdays(message, client, db) {
    const guildId = message.guild.id;
    
    // Get all birthdays for this guild
    const guildBirthdays = Array.from(birthdays.values())
        .filter(b => b.guildId === guildId)
        .sort((a, b) => {
            if (a.month !== b.month) return a.month - b.month;
            return a.day - b.day;
        });
    
    if (guildBirthdays.length === 0) {
        return message.reply('❌ No birthdays set in this server yet! Use `^birthday set <MM/DD>` to add yours.');
    }
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎂 Server Birthdays')
        .setDescription(`Total birthdays: ${guildBirthdays.length}`)
        .setFooter({ text: 'Use ^birthday set to add yours!' });
    
    // Group by month
    const byMonth = {};
    guildBirthdays.forEach(b => {
        if (!byMonth[b.month]) byMonth[b.month] = [];
        byMonth[b.month].push(b);
    });
    
    for (const [month, bdayList] of Object.entries(byMonth)) {
        let monthText = '';
        for (const bday of bdayList) {
            monthText += `${monthNames[month - 1]} ${bday.day} - <@${bday.userId}>\n`;
        }
        
        embed.addFields({ 
            name: `${monthNames[month - 1]}`, 
            value: monthText.slice(0, 1024), 
            inline: true 
        });
    }
    
    await message.reply({ embeds: [embed] });
}

async function upcomingBirthdays(message, client, db) {
    const guildId = message.guild.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    // Get all birthdays for this guild
    const guildBirthdays = Array.from(birthdays.values())
        .filter(b => b.guildId === guildId);
    
    if (guildBirthdays.length === 0) {
        return message.reply('❌ No birthdays set in this server yet!');
    }
    
    // Find upcoming birthdays (next 30 days)
    const upcoming = [];
    
    for (const bday of guildBirthdays) {
        const daysUntil = getDaysUntilBirthday(currentMonth, currentDay, bday.month, bday.day);
        if (daysUntil <= 30) {
            upcoming.push({ ...bday, daysUntil });
        }
    }
    
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    
    if (upcoming.length === 0) {
        return message.reply('📅 No birthdays in the next 30 days!');
    }
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎂 Upcoming Birthdays')
        .setDescription('Birthdays in the next 30 days')
        .setFooter({ text: 'Don\'t forget to wish them a happy birthday!' });
    
    let upcomingText = '';
    upcoming.slice(0, 15).forEach(bday => {
        const dateStr = `${monthNames[bday.month - 1]} ${bday.day}`;
        const daysText = bday.daysUntil === 0 ? '**🎉 TODAY!**' : 
                        bday.daysUntil === 1 ? '**Tomorrow**' : 
                        `in ${bday.daysUntil} days`;
        upcomingText += `${dateStr} - <@${bday.userId}> (${daysText})\n`;
    });
    
    embed.addFields({ name: '📅 Coming Soon', value: upcomingText, inline: false });
    
    await message.reply({ embeds: [embed] });
}

async function setBirthdayChannel(message, args, client, db) {
    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('❌ You need **Manage Server** permission to set the birthday channel!');
    }
    
    const channel = message.mentions.channels.first() || message.channel;
    const guildId = message.guild.id;
    
    birthdayChannels.set(guildId, channel.id);
    
    // Save to database
    try {
        await db.setGuildConfig(guildId, 'birthday_channel', channel.id);
    } catch (error) {
        console.error('Error saving birthday channel:', error);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎂 Birthday Channel Set!')
        .setDescription(`Birthday announcements will be sent to ${channel}`)
        .addFields(
            { name: '🎉 Announcements', value: 'Members will get a special birthday message at midnight!', inline: false },
            { name: '📝 Set Birthday', value: 'Members can use `^birthday set <MM/DD>` to add their birthday', inline: false }
        )
        .setFooter({ text: `Set by ${message.author.username}` });
    
    await message.reply({ embeds: [embed] });
}

async function checkBirthday(message, args, client, db) {
    const targetUser = message.mentions.users.first() || message.author;
    const userId = targetUser.id;
    const guildId = message.guild.id;
    const birthdayKey = `${guildId}-${userId}`;
    
    const birthday = birthdays.get(birthdayKey);
    
    if (!birthday) {
        return message.reply(`❌ ${targetUser.id === message.author.id ? 'You don\'t' : `${targetUser.username} doesn't`} have a birthday set!`);
    }
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const daysUntil = getDaysUntilBirthday(currentMonth, currentDay, birthday.month, birthday.day);
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle(`🎂 ${targetUser.username}'s Birthday`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: '📅 Date', value: `${monthNames[birthday.month - 1]} ${birthday.day}`, inline: true },
            { name: '⏰ Days Until', value: daysUntil === 0 ? '🎉 **TODAY!**' : `${daysUntil} days`, inline: true },
            { name: '🎈 Next Birthday', value: getNextBirthdayText(birthday.month, birthday.day), inline: false }
        );
    
    await message.reply({ embeds: [embed] });
}

async function checkAndAnnounceBirthdays(client, db) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const today = `${currentMonth}-${currentDay}`;
    
    console.log(`[Birthday Checker] Checking birthdays for ${today}...`);
    
    // Check each birthday
    for (const [key, birthday] of birthdays) {
        const birthdayDate = `${birthday.month}-${birthday.day}`;
        
        // Check if it's their birthday today
        if (birthdayDate === today) {
            // Check if we already announced today
            const lastAnnouncedDate = birthday.lastAnnounced ? new Date(birthday.lastAnnounced) : null;
            if (lastAnnouncedDate && 
                lastAnnouncedDate.getMonth() + 1 === currentMonth && 
                lastAnnouncedDate.getDate() === currentDay) {
                continue; // Already announced today
            }
            
            // Get birthday channel
            let channelId = birthdayChannels.get(birthday.guildId);
            
            if (!channelId) {
                try {
                    const config = await db.getGuildConfig(birthday.guildId, 'birthday_channel');
                    if (config) {
                        channelId = config;
                        birthdayChannels.set(birthday.guildId, channelId);
                    }
                } catch (error) {
                    console.error('Error loading birthday channel:', error);
                }
            }
            
            if (!channelId) continue;
            
            // Send birthday announcement
            try {
                const channel = await client.channels.fetch(channelId);
                const user = await client.users.fetch(birthday.userId);
                
                const embed = new EmbedBuilder()
                    .setColor('#ff69b4')
                    .setTitle('🎉 Happy Birthday! 🎉')
                    .setDescription(`Everyone wish <@${birthday.userId}> a very happy birthday! 🎂🎈`)
                    .setThumbnail(user.displayAvatarURL({ size: 256 }))
                    .setImage('https://media.giphy.com/media/g5R9dok94mrIvplmZd/giphy.gif')
                    .addFields(
                        { name: '🎂 Birthday Person', value: `<@${birthday.userId}>`, inline: true },
                        { name: '🎈 Special Day', value: `${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`, inline: true }
                    )
                    .setFooter({ text: 'Have an amazing day! | Suggested By davidbarnett0587' })
                    .setTimestamp();
                
                await channel.send({ content: `🎉 @everyone 🎉`, embeds: [embed] });
                
                // Update last announced
                birthday.lastAnnounced = Date.now();
                birthdays.set(key, birthday);
                
                console.log(`[Birthday] Announced birthday for user ${birthday.userId} in guild ${birthday.guildId}`);
            } catch (error) {
                console.error('Error announcing birthday:', error);
            }
        }
    }
}

function getDaysUntilBirthday(currentMonth, currentDay, birthdayMonth, birthdayDay) {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    let nextBirthday = new Date(currentYear, birthdayMonth - 1, birthdayDay);
    
    // If birthday already passed this year, set to next year
    const today = new Date(currentYear, currentMonth - 1, currentDay);
    if (nextBirthday < today) {
        nextBirthday = new Date(currentYear + 1, birthdayMonth - 1, birthdayDay);
    }
    
    const diffTime = nextBirthday - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

function getNextBirthdayText(month, day) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    const daysUntil = getDaysUntilBirthday(currentMonth, currentDay, month, day);
    
    if (daysUntil === 0) return '🎉 Today!';
    if (daysUntil === 1) return 'Tomorrow!';
    if (daysUntil <= 7) return `This week (${daysUntil} days)`;
    if (daysUntil <= 30) return `This month (${daysUntil} days)`;
    return `In ${daysUntil} days`;
}

function showBirthdayHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎂 Birthday System Help')
        .setDescription('Never forget a birthday again!')
        .addFields(
            { name: '📝 Set Your Birthday', value: '`^birthday set <MM/DD>`\n\nExample: `^birthday set 03/15` or `^birthday set 3 15`', inline: false },
            { name: '🗑️ Remove Birthday', value: '`^birthday remove`\n\nRemove your birthday from the system', inline: false },
            { name: '📋 List All Birthdays', value: '`^birthday list`\n\nView all birthdays in the server', inline: false },
            { name: '📅 Upcoming Birthdays', value: '`^birthday upcoming`\n\nSee birthdays in the next 30 days', inline: false },
            { name: '🔍 Check Birthday', value: '`^birthday check [@user]`\n\nCheck your or someone else\'s birthday', inline: false },
            { name: '⚙️ Set Channel (Admin)', value: '`^birthday setchannel [#channel]`\n\nSet the channel for birthday announcements\n**Requires:** Manage Server permission', inline: false },
            { name: '🎉 Features', value: '• Automatic birthday announcements at midnight\n• Birthday reminders\n• Special birthday messages\n• Track all server birthdays', inline: false }
        )
        .setFooter({ text: 'Celebrate with your community!' });
    
    message.reply({ embeds: [embed] });
}
