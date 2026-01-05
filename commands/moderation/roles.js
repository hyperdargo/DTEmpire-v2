const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'addrole',
    description: 'Add one or multiple roles to users',
    aliases: ['giverole', 'roleadd'],
    category: 'Moderation',
    
    async execute(message, args, client, db) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ You need **Manage Roles** permission to use this command!');
        }

        // Check bot permissions
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ I need **Manage Roles** permission to add roles!');
        }

        // Usage: ^addrole @role1 @role2 @user1 @user2
        // or: ^addrole @role @user
        
        const mentionedRoles = message.mentions.roles;
        const mentionedUsers = message.mentions.users;

        if (mentionedRoles.size === 0) {
            return message.reply('❌ Usage: `^addrole @role(s) @user(s)`\n\n**Examples:**\n• `^addrole @Member @User` - Add one role to one user\n• `^addrole @Role1 @Role2 @User` - Add multiple roles to one user\n• `^addrole @Role @User1 @User2` - Add one role to multiple users\n• `^addrole @Role1 @Role2 @User1 @User2` - Add multiple roles to multiple users');
        }

        if (mentionedUsers.size === 0) {
            return message.reply('❌ Please mention at least one user to add roles to!');
        }

        const roles = Array.from(mentionedRoles.values());
        const users = Array.from(mentionedUsers.values());

        // Check if bot can manage these roles
        const botHighestRole = message.guild.members.me.roles.highest;
        const unmanageableRoles = roles.filter(role => role.position >= botHighestRole.position);

        if (unmanageableRoles.length > 0) {
            return message.reply(`❌ I cannot manage these roles as they are higher than or equal to my highest role:\n${unmanageableRoles.map(r => r.toString()).join(', ')}`);
        }

        // Check if user can manage these roles
        const userHighestRole = message.member.roles.highest;
        const unmanageableByUser = roles.filter(role => role.position >= userHighestRole.position && message.guild.ownerId !== message.author.id);

        if (unmanageableByUser.length > 0) {
            return message.reply(`❌ You cannot manage these roles as they are higher than or equal to your highest role:\n${unmanageableByUser.map(r => r.toString()).join(', ')}`);
        }

        // Process role additions
        const results = {
            success: [],
            alreadyHas: [],
            failed: []
        };

        for (const user of users) {
            try {
                const member = await message.guild.members.fetch(user.id);
                
                for (const role of roles) {
                    try {
                        if (member.roles.cache.has(role.id)) {
                            results.alreadyHas.push(`${user.username} already has ${role.name}`);
                        } else {
                            await member.roles.add(role);
                            results.success.push(`✅ Added ${role.name} to ${user.username}`);
                        }
                    } catch (roleError) {
                        results.failed.push(`❌ Failed to add ${role.name} to ${user.username}`);
                        console.error('Role add error:', roleError);
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
            .setTitle('👥 Role Addition Results')
            .setTimestamp()
            .setFooter({ text: `Requested by ${message.author.username}` });

        if (results.success.length > 0) {
            embed.addFields({ 
                name: '✅ Successfully Added', 
                value: results.success.join('\n').slice(0, 1024), 
                inline: false 
            });
        }

        if (results.alreadyHas.length > 0) {
            embed.addFields({ 
                name: 'ℹ️ Already Has Role', 
                value: results.alreadyHas.join('\n').slice(0, 1024), 
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

        // Add summary
        embed.setDescription(`**Summary:**\n✅ Success: ${results.success.length}\nℹ️ Already Has: ${results.alreadyHas.length}\n❌ Failed: ${results.failed.length}`);

        await message.reply({ embeds: [embed] });
    }
};
