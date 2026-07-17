const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'shuffle',
    description: 'Shuffle the current queue',
    aliases: ['mix', 'random'],
    category: 'music',
    async execute(message, args, client) {
        try {
            if (!client.playerManager || !client.playerManager.riffy) {
                return message.reply('❌ Music system not available.');
            }
            const player = client.playerManager.riffy.players.get(message.guild.id);
            if (!player) return message.reply('❌ No active player in this guild.');
            if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel) {
                return message.reply('❌ You must be in the same voice channel.');
            }
            if (player.queue.length < 2) return message.reply('❌ Need at least 2 tracks to shuffle.');
            player.queue.shuffle();
            const embed = new EmbedBuilder().setColor('#0061ff').setTitle('🔀 Queue Shuffled').setTimestamp();
            return message.channel.send({ embeds: [embed] });
        } catch (e) {
            console.error('Shuffle command error:', e);
            return message.reply('❌ Failed to shuffle the queue.');
        }
    }
};
