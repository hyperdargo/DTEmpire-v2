const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('../../utils/apiClient');

module.exports = {
    name: 'aichat',
    description: 'Chat with AI using different models',
    aliases: ['ai', 'chat', 'ask'],
    category: 'AI',
    
    async execute(message, args, client, db) {
        // Get AI model - handle db gracefully
        let aiModel = 'Discord';
        
        if (db && typeof db.getGuildConfig === 'function') {
            try {
                const config = await db.getGuildConfig(message.guild.id);
                aiModel = config.ai_model || 'Discord';
            } catch (error) {
                console.error('Error getting AI config:', error.message);
            }
        }
        
        if (args.length === 0) {
            // Show AI help
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🤖 DTEmpire AI Chat')
                .setDescription(`**Current Model:** DTEmpire\n**Usage:** \`^ai <your message>\``)
                .addFields(
                    { name: '🎯 Available Models', value: 'DTEmpire', inline: false },
                    { name: '🖼️ Image Generation', value: 'Use `.imagegen <prompt>`', inline: false },
                    { name: '🔊 Text-to-Speech', value: 'Use `.tts <text>`', inline: false }
                )
                .setFooter({ text: 'DTEmpire API' });
            
            message.reply({ embeds: [embed] });
            return;
        }
        
        // Handle AI request
        // Force Discord model if not set
        if (!aiModel || aiModel === 'deepseek') aiModel = 'Discord';
        const prompt = args.join(' ');
        await handleAIRequest(message, aiModel, prompt);
    }
};

async function handleAIRequest(message, model, prompt) {
    try {
        // Send typing indicator
        await message.channel.sendTyping();
        
        // Show waiting message
        const waitingEmbed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🤖 AI is thinking...')
            .setDescription(`Processing your message with DTEmpire model...\n\n⏳ This may take a moment.`);
        
        const waitingMsg = await message.reply({ embeds: [waitingEmbed] });
        
        // Make API request - wait as long as needed
        let aiResponse = null;
        
        aiResponse = await apiClient.getAIResponse(prompt, model, 'quick');
        
        // If we got a response, update the message
        if (aiResponse) {
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🤖 AI Response')
                .setDescription(aiResponse.slice(0, 4000))
                .addFields(
                    { name: '🧠 Model', value: 'DTEmpire', inline: true },
                    { name: '👤 User', value: message.author.username, inline: true }
                )
                .setFooter({ text: 'DTEmpire AI System v2.8.0' });
            
            await waitingMsg.edit({ embeds: [embed] });
        } else {
            // No response
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🤖 AI Error')
                .setDescription(`**Your message:** ${prompt.substring(0, 200)}...\n\n**Error:** AI did not return a response. Try again.`)
                .setFooter({ text: 'DTEmpire AI - Error response' });
            
            message.reply({ embeds: [errorEmbed] });
        }
        
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        
        // Error response
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🤖 AI Error')
            .setDescription(`**Your message:** ${prompt.substring(0, 200)}...\n\n**Error:** ${error.message}\n\n*Try: \`^ai help\` for more options*`)
            .setFooter({ text: 'DTEmpire AI - Error response' });
        
        message.reply({ embeds: [errorEmbed] });
    }
}