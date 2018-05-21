require('dotenv').config();

var Discord = require('discord.js'); // Discord bot module

var client = new Discord.Client(); // Initialize Discord.js client
var discwork = require('discwork')(client); // Command framework

client.on('ready', function() {
    client.user.setPresence({ // Set our "Playing" text
        game: {
            name: "UNDER MAINTENANCE"
        }
    });
});

discwork.add(/^capt!/, function(message) { // Invite link
    message.reply("Sorry, but Captionary is under maintenance. Read more at https://captionary.skiilaa.me");
});

discwork.done();

client.login(process.env.CAPTIONARY_TOKEN);