require('dotenv').config();

var Raven = require('raven');
var kttn = require('kttnkndy')('bot', {
    showInitializedMessage: false,
    timestampedLog: false
});

const GoogleImages = require('google-images');
var Discord = require('discord.js'); // Discord bot module
var gameController = require('./lib/gamecontroller');

var client = new Discord.Client(); // Initialize Discord.js client
var discwork = require('discwork')(client); // Command framework
var cse = new GoogleImages(process.env.CAPTIONARY_CSE, process.env.CAPTIONARY_CSE_KEY); // Google image search
Raven.config(process.env.CAPTIONARY_DSN).install(); // Error reporting

var funFacts = []; // Will be filled up later by client.on('ready')

function funFact() {
    return funFacts[Math.floor(Math.random() * funFacts.length)];
}

client.on('ready', function() {
    funFacts = [ // Set up funFacts array
        "Ugandan Knuckles is a dead meme.",
        `Captionary is added to ${client.guilds.array().length} server${client.guilds.array().length > 1 ? "s" : ""}.`
    ];
    client.user.setPresence({ // Set our "Playing" text
        game: {
            name: "capt!onary"
        }
    });
    process.on('SIGINT', () => { // Somewhat-graceful exit.
        client.destroy();
    });
    kttn.log(`Bot up and running! ${client.user.tag}`);
});

discwork.add([/^capt!onary$/i, /^capt!$/i], function(message) { // Help command
    message.author.send({ // Sending special embed message
        embed: {
            title: "Commands",
            description: "If you're looking for a Captionary game guide, check out `capt!onary guide`.",
            fields: [
                {
                    name: "capt!onary",
                    value: "Lists commands.\nAlias: `capt!`",
                    inline: true
                },
                {
                    name: "capt!onary guide",
                    value: "Shows game guide.\nAlias: `capt!guide`",
                    inline: true
                },
                {
                    name: "capt!onary invite",
                    value: "Shows invite link of bot.\nAlias: `capt!invite`",
                    inline: true
                }
            ],
            footer: { // Fun fact
                text: "\uD83D\uDCA1 Fun fact: " + funFact()
            }
        }
    }).then(function() { // success
        if (message.channel.type != "dm") message.react("\ud83d\ude4c"); // React with :raised_hands:
    }).catch(function(err) { // error
        message.react("\u274C"); // React with :x:
        console.log(err);
        Raven.captureException(err, { extra: { message } }); // Report error
    });
});

discwork.add([/^capt!onary guide$/i, /^capt!guide$/i], function(message) { // Guide command
    message.author.send({ // Send special embed message
        embed: {
            title: "Guide",
            description: "Captionary is a Discord game about getting the funniest image and caption combinations.\nPlayers: 4-8\n",
            fields: [ // Each field is like a heading in a document.
                {
                    name: "Teams",
                    value: "Captionary has two teams:\n * the Imagers\n * the Captioners\n\n"
                },
                {
                    name: "Turns",
                    value: "The game has four turns:\n * Image\n * Caption\n * Assign\n * Vote\n\n"
                },
                {
                    name: "Turns: Image",
                    value: "Participating team: Imagers\n\nEnter a search term for an image.\nThe machine will pick a random image from the results, without showing you.\n\n"                },
                {
                    name: "Turns: Caption",
                    value: "Participating team: Captioners\n\nEnter four captions.\nYou can't see the images that were picked.\n\n"
                },
                {
                    name: "Turns: Assign",
                    value: "Participating team: Imagers\n\nAssign one caption out of four to an image.\n\nNotes:\n * The imager will not get their own image.\n * The imager will not see the caption's picker.\n * The captions are selected from different people each.\n\n"
                },
                {
                    name: "Turns: Vote",
                    value: "Participating team: Captioners\n\nVote for the best image and caption pair.\n\nNotes:\n * The pictures' makers' names are not shown while voting.\n\n"
                },
                {
                    name: "Winning",
                    value: "The winners are the people who:\n * Picked the image that won.\n * Picked the caption that won.\n * Assigned the image and caption that won.\n\n"
                },
                {
                    name: "Points",
                    value: "The image and caption picker each get 25 points, multiplied by their level.\nThe assigner gets 50 points, multiplied by their level.\n\n"
                },
                {
                    name: "Levels",
                    value: "TBD"
                }
            ],
            footer: { // Fun fact footer
                text: "\uD83D\uDCA1 Fun fact: " + funFact()
            }
        }
    }).catch(function(err) {
        message.react("\u274C") // Rect with :x:
        console.log(err);
        Raven.captureException(err, { extra: { message } }); // Report error
    });
});

discwork.add([/^capt!onary invite$/i, /^capt!invite$/i], function(message) { // Invite command
    message.author.send("Hey! Thanks for considering adding Captionary to your server. You can do so here: https://captionary.skiilaa.me/add\n\n\uD83D\uDCA1 Fun fact: " + funFact()).then(function() { // Send invite link & fun fact in the DMs
        if (message.channel.type != "dm") { // If we aren't in the DMs
            message.react("\ud83d\ude4c"); // Send :raised_hands: as a signal that the message has been sent.
        }
    }).catch(function(err) {
        message.react("\u274C") // React with :x:
        console.log(err);
        Raven.captureException(err, { extra: { message } }); // Report error
    });
});

discwork.add([/^capt!onary join$/i, /^capt!join$/i], function(message) { // Join command
    gameController.joinGame(message); // Call the gamecontroller
});

discwork.add([/^capt!onary start$/i, /^capt!start$/i], function(message) { // Start command
    gameController.startGame(message); // Call the gamecontroller
});

discwork.add([/^capt!onary leave$/i, /^capt!leave$/i], function(message) { // Leave command
    gameController.leaveGame(message); // Call the gamecontroller
});

discwork.add([/./], function(message, matches) { // Any input
    if (message.channel.type == "dm" && message.author.id != client.user.id) { // If it's in the DMs and it is not send by the bot
        // ANSWER PROCESSING

        kttn.log("Got message, sending it over to the game controller...");
        /*cse.search(message.content, {page: 1, safe: "high"}).then(function(results) {
            if (results.length == 0) {
                    message.reply("No results. Did you search for something dirty?");
                    return;
            }
            var pick = Math.floor(Math.random() * results.length);
            message.reply(`Here's the ${pick+1}${pick+1 == 1 ? "st" : pick+1 == 2 ? "nd" : pick+1 == 3 ? "rd" : "th"} image from the results:\n${results[pick].url}`);
        }).catch(function(err) {
            message.react("\u274C")
            console.error(err);
        });*/
        gameController.input(message); // Call the gamecontroller
    }
});

discwork.done(); // Finalize our command list

client.login(process.env.CAPTIONARY_TOKEN);