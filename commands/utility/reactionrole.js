const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Store reaction roles (in production, use database)
const reactionRoles = new Map();

module.exports = {
    name: 'reactionrole',
    description: 'Create and manage reaction roles',
    aliases: ['rr', 'reactrole'],
    category: 'Utility',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
            return showReactionRoleHelp(message);
        }
        
        switch (subCommand) {
            case 'create':
                await createReactionRole(message, args.slice(1), client, db);
                break;
            case 'add':
                await addReactionRole(message, args.slice(1), client, db);
                break;
            case 'remove':
                await removeReactionRole(message, args.slice(1), client, db);
                break;
            case 'list':
                await listReactionRoles(message, client, db);
                break;
            case 'delete':
                await deleteReactionRole(message, args.slice(1), client, db);
                break;
            default:
                showReactionRoleHelp(message);
        }
    }
};

async function createReactionRole(message, args, client, db) {
    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You need **Manage Roles** permission to create reaction roles!');
    }

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ I need **Manage Roles** permission to assign roles!');
    }

    // Parse: ^reactionrole create "Title" "Description" @role1:emoji1 @role2:emoji2
    const titleMatch = args.join(' ').match(/"([^"]+)"/);
    
    if (!titleMatch) {
        return message.reply('❌ Usage: `^reactionrole create "Title" "Description" @role1:emoji1 @role2:emoji2`\n\n**Example:**\n`^reactionrole create "Choose Your Roles" "Click buttons to get roles" @Member:✅ @VIP:⭐ @Gamer:🎮`');
    }

    const title = titleMatch[1];
    const restText = args.join(' ').replace(titleMatch[0], '').trim();
    
    const descMatch = restText.match(/"([^"]+)"/);
    if (!descMatch) {
        return message.reply('❌ Please provide a description in quotes!');
    }

    const description = descMatch[1];
    const rolesInputText = restText.replace(descMatch[0], '').trim();

    // Parse role-emoji pairs
    const roleMentions = message.mentions.roles;
    if (roleMentions.size === 0) {
        return message.reply('❌ Please mention at least one role!');
    }

    // Extract emoji for each role
    const roleEmojiPairs = [];
    const roleParts = rolesInputText.split(/(?=<@&)/); // Split before each role mention

    for (const part of roleParts) {
        if (!part.trim()) continue;

        const roleMatch = part.match(/<@&(\d+)>/);
        if (!roleMatch) continue;

        const roleId = roleMatch[1];
        const role = roleMentions.get(roleId);
        if (!role) continue;

        // Find emoji after role mention
        const emojiMatch = part.match(/:\s*(.+?)(?:\s|$)/);
        let emoji = '✅'; // Default emoji

        if (emojiMatch) {
            emoji = emojiMatch[1].trim();
        }

        roleEmojiPairs.push({ role, emoji });
    }

    if (roleEmojiPairs.length === 0) {
        return message.reply('❌ No valid role-emoji pairs found!');
    }

    if (roleEmojiPairs.length > 25) {
        return message.reply('❌ Maximum 25 roles allowed per reaction role message!');
    }

    // Create embed
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: 'Click the buttons below to get roles!' })
        .setTimestamp();

    // Add role list to embed
    let rolesText = '';
    roleEmojiPairs.forEach(({ role, emoji }) => {
        rolesText += `${emoji} - ${role}\n`;
    });
    embed.addFields({ name: 'Available Roles', value: rolesText, inline: false });

    // Create buttons (max 5 per row, max 5 rows = 25 buttons)
    const rows = [];
    
    for (let i = 0; i < roleEmojiPairs.length; i += 5) {
        const row = new ActionRowBuilder();
        const endIndex = Math.min(i + 5, roleEmojiPairs.length);
        
        for (let j = i; j < endIndex; j++) {
            const { role, emoji } = roleEmojiPairs[j];
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rr_${role.id}`)
                    .setLabel(role.name)
                    .setEmoji(emoji)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        rows.push(row);
    }

    // Send reaction role message
    const rrMessage = await message.channel.send({ embeds: [embed], components: rows });

    // Store reaction role data
    const rrId = rrMessage.id;
    const rrData = {
        id: rrId,
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: rrMessage.id,
        title,
        description,
        roles: roleEmojiPairs.map(({ role, emoji }) => ({ roleId: role.id, emoji })),
        createdBy: message.author.id,
        createdAt: Date.now()
    };

    reactionRoles.set(rrId, rrData);

    // Save to database
    try {
        await db.saveReactionRole(rrData);
    } catch (error) {
        console.error('Error saving reaction role:', error);
    }

    // Set up button collector
    const filter = i => i.customId.startsWith('rr_');
    const collector = rrMessage.createMessageComponentCollector({ filter });

    collector.on('collect', async i => {
        const roleId = i.customId.replace('rr_', '');
        const role = message.guild.roles.cache.get(roleId);

        if (!role) {
            return i.reply({ content: '❌ Role not found!', ephemeral: true });
        }

        try {
            const member = await message.guild.members.fetch(i.user.id);

            if (member.roles.cache.has(roleId)) {
                // Remove role
                await member.roles.remove(role);
                await i.reply({ content: `✅ Removed role: ${role.name}`, ephemeral: true });
            } else {
                // Add role
                await member.roles.add(role);
                await i.reply({ content: `✅ Added role: ${role.name}`, ephemeral: true });
            }
        } catch (error) {
            console.error('Error managing role:', error);
            await i.reply({ content: '❌ Failed to manage role!', ephemeral: true });
        }
    });

    await message.reply(`✅ Reaction role created! ID: \`${rrId}\``);
}

async function addReactionRole(message, args, client, db) {
    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You need **Manage Roles** permission to manage reaction roles!');
    }

    const messageId = args[0];
    if (!messageId) {
        return message.reply('❌ Usage: `^reactionrole add <message_id> @role emoji`\n\nExample: `^reactionrole add 123456789 @Role ⭐`');
    }

    const rrData = reactionRoles.get(messageId);
    if (!rrData) {
        return message.reply('❌ Reaction role message not found!');
    }

    const role = message.mentions.roles.first();
    if (!role) {
        return message.reply('❌ Please mention a role to add!');
    }

    const emoji = args[args.length - 1] || '✅';

    // Check if role already exists
    if (rrData.roles.some(r => r.roleId === role.id)) {
        return message.reply('❌ This role is already in the reaction role message!');
    }

    if (rrData.roles.length >= 25) {
        return message.reply('❌ Maximum 25 roles allowed per reaction role message!');
    }

    // Add role to data
    rrData.roles.push({ roleId: role.id, emoji });
    reactionRoles.set(messageId, rrData);

    // Update database
    try {
        await db.saveReactionRole(rrData);
    } catch (error) {
        console.error('Error updating reaction role:', error);
    }

    // Update message
    try {
        const channel = await client.channels.fetch(rrData.channelId);
        const rrMessage = await channel.messages.fetch(rrData.messageId);
        
        // Recreate embed and buttons
        await updateReactionRoleMessage(rrMessage, rrData, message.guild);
        
        await message.reply(`✅ Added ${role} to reaction roles!`);
    } catch (error) {
        console.error('Error updating message:', error);
        await message.reply('❌ Failed to update reaction role message!');
    }
}

async function removeReactionRole(message, args, client, db) {
    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You need **Manage Roles** permission to manage reaction roles!');
    }

    const messageId = args[0];
    if (!messageId) {
        return message.reply('❌ Usage: `^reactionrole remove <message_id> @role`');
    }

    const rrData = reactionRoles.get(messageId);
    if (!rrData) {
        return message.reply('❌ Reaction role message not found!');
    }

    const role = message.mentions.roles.first();
    if (!role) {
        return message.reply('❌ Please mention a role to remove!');
    }

    // Remove role from data
    const initialLength = rrData.roles.length;
    rrData.roles = rrData.roles.filter(r => r.roleId !== role.id);

    if (rrData.roles.length === initialLength) {
        return message.reply('❌ This role is not in the reaction role message!');
    }

    reactionRoles.set(messageId, rrData);

    // Update database
    try {
        await db.saveReactionRole(rrData);
    } catch (error) {
        console.error('Error updating reaction role:', error);
    }

    // Update message
    try {
        const channel = await client.channels.fetch(rrData.channelId);
        const rrMessage = await channel.messages.fetch(rrData.messageId);
        
        await updateReactionRoleMessage(rrMessage, rrData, message.guild);
        
        await message.reply(`✅ Removed ${role} from reaction roles!`);
    } catch (error) {
        console.error('Error updating message:', error);
        await message.reply('❌ Failed to update reaction role message!');
    }
}

async function updateReactionRoleMessage(rrMessage, rrData, guild) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(rrData.title)
        .setDescription(rrData.description)
        .setFooter({ text: 'Click the buttons below to get roles!' })
        .setTimestamp(rrData.createdAt);

    // Add role list
    let rolesText = '';
    for (const { roleId, emoji } of rrData.roles) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
            rolesText += `${emoji} - ${role}\n`;
        }
    }
    embed.addFields({ name: 'Available Roles', value: rolesText || 'No roles', inline: false });

    // Recreate buttons
    const rows = [];
    
    for (let i = 0; i < rrData.roles.length; i += 5) {
        const row = new ActionRowBuilder();
        const endIndex = Math.min(i + 5, rrData.roles.length);
        
        for (let j = i; j < endIndex; j++) {
            const { roleId, emoji } = rrData.roles[j];
            const role = guild.roles.cache.get(roleId);
            
            if (role) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rr_${roleId}`)
                        .setLabel(role.name)
                        .setEmoji(emoji)
                        .setStyle(ButtonStyle.Primary)
                );
            }
        }
        
        rows.push(row);
    }

    await rrMessage.edit({ embeds: [embed], components: rows });
}

async function listReactionRoles(message, client, db) {
    const guildRRs = Array.from(reactionRoles.values()).filter(rr => rr.guildId === message.guild.id);

    if (guildRRs.length === 0) {
        return message.reply('❌ No reaction roles found in this server!');
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Reaction Roles')
        .setDescription(`Total: ${guildRRs.length}`)
        .setFooter({ text: 'Use ^reactionrole delete <id> to remove' });

    let listText = '';
    guildRRs.forEach(rr => {
        listText += `**ID:** \`${rr.id}\`\n**Title:** ${rr.title}\n**Roles:** ${rr.roles.length}\n**Channel:** <#${rr.channelId}>\n\n`;
    });

    embed.addFields({ name: 'Server Reaction Roles', value: listText.slice(0, 4000), inline: false });

    await message.reply({ embeds: [embed] });
}

async function deleteReactionRole(message, args, client, db) {
    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You need **Manage Roles** permission to delete reaction roles!');
    }

    const messageId = args[0];
    if (!messageId) {
        return message.reply('❌ Usage: `^reactionrole delete <message_id>`');
    }

    const rrData = reactionRoles.get(messageId);
    if (!rrData) {
        return message.reply('❌ Reaction role message not found!');
    }

    // Delete from memory
    reactionRoles.delete(messageId);

    // Delete from database
    try {
        await db.deleteReactionRole(messageId);
    } catch (error) {
        console.error('Error deleting reaction role:', error);
    }

    // Try to delete the message
    try {
        const channel = await client.channels.fetch(rrData.channelId);
        const rrMessage = await channel.messages.fetch(rrData.messageId);
        await rrMessage.delete();
    } catch (error) {
        console.log('Could not delete reaction role message:', error.message);
    }

    await message.reply('✅ Reaction role deleted successfully!');
}

function showReactionRoleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎭 Reaction Roles Help')
        .setDescription('Create self-assignable roles with buttons!')
        .addFields(
            { 
                name: '📝 Create Reaction Role', 
                value: '`^reactionrole create "Title" "Description" @role1:emoji1 @role2:emoji2`\n\n**Example:**\n`^reactionrole create "Choose Roles" "Click to get roles" @Member:✅ @VIP:⭐ @Gamer:🎮`', 
                inline: false 
            },
            { 
                name: '➕ Add Role', 
                value: '`^reactionrole add <message_id> @role emoji`\n\nAdd a new role to existing reaction role message', 
                inline: false 
            },
            { 
                name: '➖ Remove Role', 
                value: '`^reactionrole remove <message_id> @role`\n\nRemove a role from reaction role message', 
                inline: false 
            },
            { 
                name: '📋 List', 
                value: '`^reactionrole list`\n\nView all reaction roles in this server', 
                inline: false 
            },
            { 
                name: '🗑️ Delete', 
                value: '`^reactionrole delete <message_id>`\n\nDelete a reaction role message', 
                inline: false 
            },
            { 
                name: '📌 Features', 
                value: '• Users can click buttons to toggle roles\n• Up to 25 roles per message\n• Custom emojis for each role\n• Automatic role management', 
                inline: false 
            }
        )
        .setFooter({ text: 'Requires: Manage Roles permission' });

    message.reply({ embeds: [embed] });
}
