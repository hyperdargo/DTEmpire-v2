// commands/ai/imagegen.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('../../utils/apiClient');

module.exports = {
    name: 'imagegen',
    description: 'Generate images using Flux AI',
    aliases: ['imggen', 'generateimage', 'aiimage', 'flux'],
    category: 'AI',
    
    async execute(message, args, client) {
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🖼️ Flux AI Image Generation')
                .setDescription('Generate high-quality images using Flux AI model.')
                .addFields(
                    { name: '📝 Usage', value: '`^imagegen <prompt>` - Generate image with Flux', inline: false },
                    { name: '🎨 Available Model', value: '• **Flux** - High-quality image generation model', inline: false },
                    { name: '💡 Examples', value: '`^imagegen a beautiful sunset over mountains`\n`^imagegen cyberpunk city at night`\n`^imagegen fantasy landscape with dragons`', inline: false },
                    { name: '⚠️ Note', value: 'Flux is the only available model. Previous model (seedream) has been removed.', inline: false }
                )
                .setFooter({ text: 'Powered by Pollinations API | DTEmpire v2.6.9' });
            
            return message.reply({ embeds: [embed] });
        }
        
        // Always use flux model
        const model = 'flux';
        const prompt = args.join(' ');
        
        if (!prompt) {
            return message.reply('❌ Please provide a prompt!\nExample: `^imagegen a red apple on a table`');
        }
        
        if (prompt.length > 500) {
            return message.reply('❌ Prompt is too long! Maximum 500 characters.');
        }
        
        await generateAndSendImage(message, model, prompt);
    }
};

async function generateAndSendImage(message, model, prompt) {
    const generatingMessage = await message.reply(`🔄 Generating image with Flux AI... This may take 15-30 seconds.`);
    
    try {
        console.log(`Generating image with Flux, prompt: ${prompt}`);
        
        // Generate image using your API client
        const imageData = await apiClient.generateImage(prompt, model);
        
        console.log(`API Response received:`, {
            bufferLength: imageData.buffer?.length || 0,
            contentType: imageData.contentType,
            model: model
        });
        
        // Check if the response is actually an image
        if (!imageData.buffer || imageData.buffer.length < 100) {
            throw new Error('API returned empty or invalid image data');
        }
        
        // Check if it's JSON (text) instead of image
        const textData = imageData.buffer.toString('utf8', 0, 100);
        if (textData.trim().startsWith('{') || textData.includes('"url"') || textData.includes('"error"')) {
            console.log('Response appears to be JSON:', textData);
            
            try {
                const jsonData = JSON.parse(imageData.buffer.toString());
                if (jsonData.url) {
                    // Create embed with URL instead
                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🖼️ Flux AI Generated Image')
                        .setDescription(`**Prompt:** ${prompt}`)
                        .addFields(
                            { name: '🧠 Model', value: 'Flux', inline: true },
                            { name: '👤 Requested by', value: message.author.username, inline: true },
                            { name: '⚡ Status', value: 'Generated', inline: true }
                        )
                        .setImage(jsonData.url) // Use the URL directly
                        .setFooter({ text: 'Powered by Flux AI | DTEmpire v2.6.9' })
                        .setTimestamp();
                    
                    await generatingMessage.edit({
                        content: null,
                        embeds: [embed]
                    });
                    return;
                } else if (jsonData.error) {
                    throw new Error(jsonData.error);
                }
            } catch (jsonError) {
                console.log('Failed to parse as JSON:', jsonError);
            }
        }
        
        // If we have image buffer data, try to send it as an attachment
        if (imageData.buffer && imageData.buffer.length > 100) {
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🖼️ Flux AI Generated Image')
                .setDescription(`**Prompt:** ${prompt}`)
                .addFields(
                    { name: '🧠 Model', value: 'Flux', inline: true },
                    { name: '👤 Requested by', value: message.author.username, inline: true },
                    { name: '⚡ Status', value: 'Generated', inline: true }
                )
                .setFooter({ text: 'Powered by Flux AI | DTEmpire v2.6.9' })
                .setTimestamp();
            
            // Try to send as file attachment
            try {
                await generatingMessage.edit({
                    content: null,
                    embeds: [embed],
                    files: [{
                        attachment: imageData.buffer,
                        name: `flux-generated-${Date.now()}.png`
                    }]
                });
                return;
            } catch (fileError) {
                console.log('Failed to send as file:', fileError);
                throw new Error('Failed to process image file');
            }
        }
        
        throw new Error('No valid image data received from API');
        
    } catch (error) {
        console.error('Flux Image Generation Error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Flux Image Generation Failed')
            .setDescription('Failed to generate image. Please try again.')
            .addFields(
                { name: 'Error', value: error.message.substring(0, 200), inline: false },
                { name: '💡 Tips', value: '• Try a simpler prompt\n• Check if the API is working\n• Use different keywords\n• Flux is the only available model (seedream removed)', inline: false }
            )
            .setFooter({ text: 'API Status: Check /api/status | Flux Only' });
        
        await generatingMessage.edit({
            content: null,
            embeds: [errorEmbed],
            components: []
        });
    }
}