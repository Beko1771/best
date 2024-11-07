require('dotenv').config(); // Load environment variables from .env
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pipeline } = require('stream');
const fetch = require('node-fetch');  // Import fetch

// Initialize the bot using the token from environment variable
const bot = new Telegraf('7854726117:AAHyAOKhQjXpAHZLR8SDEi3FqIGvInkYbz8');

// On start message
const onStartMsg = "Salom! Men sizga qo'shiq topib berishim mumkin. Qo'shiq nomini yozing...";

// Handle the /start command
bot.start((ctx) => {
    return ctx.reply(onStartMsg, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Boshqa qo\'shiqni qidirish', callback_data: 'search_again' }]
            ]
        }
    });
});

// Function to download a file (song preview)
const downloadFile = async (url, filePath) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
    const streamPipeline = promisify(pipeline);
    await streamPipeline(response.body, fs.createWriteStream(filePath));
};

// Inline button handler (for search again or reset)
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData === 'search_again') {
        await ctx.reply("Qo'shiq nomini kiriting:");
    }
    await ctx.answerCbQuery(); // Acknowledge the callback
});

// Handle text messages from users
bot.on('text', async (ctx) => {
    const term = ctx.message.text.trim();

    // Shazam API endpoint to search for songs
    let endpoint = "https://www.shazam.com/services/amapi/v1/catalog/UZ/search?";
    endpoint = `${endpoint}term=${encodeURIComponent(term)}&limit=5&types=songs,artists`;  // Get top 5 results

    try {
        const response = await fetch(endpoint);
        const data = await response.json();

        if (data.results && data.results.songs && data.results.songs.data.length > 0) {
            // List the first 3 songs
            const songs = data.results.songs.data.slice(0, 3);
            let message = "Mana, topilgan qo'shiqlar:\n\n";

            for (const song of songs) {
                const songName = song.attributes.name;
                const artistName = song.attributes.artistName;
                const previewUrl = song.attributes.previews[0].url;

                // Prepare file name and path for download
                const fileName = `${artistName} - ${songName}.mp3`;
                const filePath = path.join(__dirname, fileName);

                // Download the song preview and send it
                await downloadFile(previewUrl, filePath);
                message += `${artistName} - ${songName}\n`;

                // Send audio
                await ctx.replyWithAudio({ source: filePath });

                // Clean up the file after sending
                fs.unlinkSync(filePath);
            }

            // Ask user if they want to search again
            await ctx.reply(message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Boshqa qo\'shiqni qidirish', callback_data: 'search_again' }]
                    ]
                }
            });
        } else {
            await ctx.reply("Afsuski, siz kiritgan qo'shiq topilmadi. Iltimos, boshqa nom kiriting.");
        }
    } catch (error) {
        console.error('Xatolik yuz berdi:', error);
        await ctx.reply('Maʼlumot olishda xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
    }
});

// Launch the bot
bot.launch();

