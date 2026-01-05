const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'removerole',
    description: 'Remove one or multiple roles from users',
    aliases: ['takerole', 'roleremove'],
    category: 'Moderation',
    
    async execute(message, args, client, db) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ You need **Manage Roles** permission to use this command!');
        }

        // Check bot permissions
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ I need **Manage Roles** permission to remove roles!');
        }

        const mentionedRoles = message.mentions.roles;
        const mentionedUsers = message.mentions.users;

        if (mentionedRoles.size === 0) {
            return message.reply('❌ Usage: `^removerole @role(s) @user(s)`\n\n**Examples:**\n• `^removerole @Member @User`\n• `^removerole @Role1 @Role2 @User`\n• `^removerole @Role @User1 @User2`');
        }

        if (mentionedUsers.size === 0) {
            return message.reply('❌ Please mention at least one user to remove roles from!');
        }

        const roles = Array.from(mentionedRoles.values());
        const users = Array.from(mentionedUsers.values());

        // Check if bot can manage these roles
        const botHighestRole = message.guild.members.me.roles.highest;
        const unmanageableRoles = roles.filter(role => role.position >= botHighestRole.position);

        if (unmanageableRoles.length > 0) {
            return message.reply(`❌ I cannot manage these roles as they are higher than or equal to my highest role:\n${unmanageableRoles.map(r => r.toString()).join(', ')}`);
        }

        // Process role removals
        const results = {
            success: [],
            doesntHave: [],
            failed: []
        };

        for (const user of users) {
            try {
                const member = await message.guild.members.fetch(user.id);
                
                for (const role of roles) {
                    try {
                        if (!member.roles.cache.has(role.id)) {
                            results.doesntHave.push(`${user.username} doesn't have ${role.name}`);
                        } else {
                            await member.roles.remove(role);
                            results.success.push(`✅ Removed ${role.name} from ${user.username}`);
                        }
                    } catch (roleError) {
                        results.failed.push(`❌ Failed to remove ${role.name} from ${user.username}`);
                        console.error('Role remove error:', roleError);
                    }
                }
            } catch (memberError) {
                results.failed.push(`❌ Could not fetch member: ${user.username}`);
                console.error('Member fetch error:', memberError);
            }
        }

        // Create response embed
        const embed = new EmbedBuilder()
            .setColor(results.failed.length === 0 ? '#00ff00' : '#ff9900')
            .setTitle('👥 Role Removal Results')
            .setTimestamp()
            .setFooter({ text: `Requested by ${message.author.username}` });

        if (results.success.length > 0) {
            embed.addFields({ 
                name: '✅ Successfully Removed', 
                value: results.success.join('\n').slice(0, 1024), 
                inline: false 
            });
        }

        if (results.doesntHave.length > 0) {
            embed.addFields({ 
                name: 'ℹ️ Doesn\'t Have Role', 
                value: results.doesntHave.join('\n').slice(0, 1024), 
                inline: false 
            });
        }

        if (results.failed.length > 0) {
            embed.addFields({ 
                name: '❌ Failed', 
                value: results.failed.join('\n').slice(0, 1024), 
                inline: false 
            });
        }

        embed.setDescription(`**Summary:**\n✅ Success: ${results.success.length}\nℹ️ Doesn't Have: ${results.doesntHave.length}\n❌ Failed: ${results.failed.length}`);

        await message.reply({ embeds: [embed] });
    }
};
