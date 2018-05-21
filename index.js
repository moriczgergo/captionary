require('dotenv').config();

var kttn = require('kttnkndy')('bot', {
    showInitializedMessage: false,
    timestampedLog: false
});

const GoogleImages = require('google-images');
var Discord = require('discord.js'); // Discord bot module
var gameController = require('./lib/gamecontroller');

var client = new Discord.Client(); // Initialize Discord.js client
var discwork = require('discwork')(client); // Command framework
var cse = new GoogleImages(process.env.CAPTIONARY_CSE, process.env.CAPTIONARY_CSE_KEY);

var funFacts = [];

const botUserID = "447797133261668373";

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
    process.on('SIGINT', () => {
        client.destroy();
    });
});

discwork.add([/^capt!onary$/i, /^capt!$/i], function(message) { // Help message
    message.author.send({
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
            footer: {
                text: "\uD83D\uDCA1 Fun fact: " + funFact()
            }
        }
    }).then(function() { // success
        if (message.channel.type != "dm") message.react("\ud83d\ude4c"); // React with :raised_hands:
    }).catch(function(err) { // error
        message.react("\u274C"); // React with :x:
        kttn.error(JSON.stringify(err));
    });
});

discwork.add([/^capt!onary guide$/, /^capt!guide$/], function(message) {
    message.author.send({
        embed: {
            title: "Guide",
            description: "Captionary is a Discord game about getting the funniest image and caption combinations.\nPlayers: 4-8\n",
            fields: [
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
            footer: {
                text: "\uD83D\uDCA1 Fun fact: " + funFact()
            }
        }
    })
});

discwork.add([/^capt!onary invite$/, /^capt!invite$/], function(message) { // Invite link
    message.author.send("Hey! Thanks for considering adding Captionary to your server. You can do so here: https://captionary.skiilaa.me/add\n\n\uD83D\uDCA1 Fun fact: " + funFact()).then(function() {
        if (message.channel.type != "dm") {
            message.react("\ud83d\ude4c");
        }
    }).catch(function(err) {
        message.react("\u274C")
        kttn.error(JSON.stringify(err));
    });
});

discwork.add([/^capt!onary join$/, /^capt!join$/], function(message) {
    gameController.joinGame(message);
});

discwork.add([/^capt!onary start$/, /^capt!start$/], function(message) {
    gameController.startGame(message);
});

discwork.add([/./], function(message, matches) {
    if (message.channel.type == "dm" && message.author.id != botUserID) {
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
        gameController.input(message);
    }
});

discwork.done();

client.login(process.env.CAPTIONARY_TOKEN);
