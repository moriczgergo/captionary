//#region Imports
var Raven = require('raven');
var kttn = require('kttnkndy')("logic", {
    showInitializedMessage: false,
    timestampedLog: false
});

var Message = require('discord.js').Message;
var EventEmitter = require('events').EventEmitter;

var gameCache = require('./gamecache.js'); // Game cache controller.

Raven.config(process.env.CAPTIONARY_DSN, {
    autoBreadcrumbs: true
}).install();
//#endregion

//#region Emitters
class GameEmitter extends EventEmitter {} // Custom class for our game-event emitter

var emitters = {}; // Game emitters stored via game ID
//#endregion

//#region General Helper Functions
function isInGame(userID) { // Checks if provided player is in-game or not.
    kttn.log(`isInGame called for ${userID}.`);

    return new Promise(function(resolve, reject) { // Create new promise to return
        kttn.log(`isInGame: Listing games...`);

        gameCache.listGames().then(function(games) { // Get all games
            kttn.log(`isInGame: Got them!`);

            resolve(games.some(function(game) { // Test all for player
                kttn.log(`isInGame: Testing for includedness...`);
                return game.players.find(x => x.id == userID); // checks if player.id is supplied userID
            }));

        }).catch(function(err) {
            reject(err);
        });
    });
}

function getGameIDFromPlayer(userID) { // Get the game the player is participating in
    return new Promise(function(resolve, reject) {
        gameCache.listGames().then(function(games) { // List all games
            var gameID = false;

            games.some(function(game) { // Select a game
                if (game.players.find(x => x.id == userID)) { // if player.id is the supplied userid
                    gameID = game.id; // select game
                    return true; // End loop
                } else {
                    return false;
                }
            });

            resolve(gameID); // Return selected game (or false)
        }).catch(function(err) {
            reject(err);
        });
    });
}
//#endregion

//#region Match Manager Functions
/**
 * Creats a game.
 */
function _createGame() { // Creates a game
    return new Promise(function(resolve, reject) {
        gameCache.createGame().then(function(gameID) {
            emitters[gameID] = new GameEmitter(); // Initialize event emitter for game
            
            resolve(gameID); // Return game id
        }).catch(function(err) {
            reject(err);
        });
    });
}

/**
 * Joins a game.
 * @param {String} gameID The game ID.
 * @param {Message} message The message asking to join.
 * @param {Boolean} creator Whether the player added is the creator of this game or not.
 */
function _joinGame(gameID, message, creator) {
    return new Promise(function(resolve, reject) {
        gameCache.updateGame(gameID, function(game) { // Update the game
            var ourGame = game;
            ourGame.players.push({ // Add player in the game
                username: message.author.username,
                id: message.author.id,
                owner: creator
            });
            return ourGame;
        }).then(function() {
            emitters[gameID].emit("change"); // Emit change event
            resolve(); // Return
        }).catch(function(err) {
            reject(err);
        });
    });
}

/**
 * Starts a game.
 * @param {String} gameID The game ID.
 */
function _startGame(gameID) {
    return new Promise(function(resolve, reject) {
        gameCache.updateGame(gameID, function(game) { // Update the game
            var ourGame = game;
            ourGame.turn = 1;
            ourGame.turnState = [];

            // Team builder
            for (var i = 0; i < ourGame.players.length; i++) {
                if (ourGame.teams.imager.length == Math.ceil(ourGame.players.length / 2)) {
                    ourGame.teams.captioner.push(i);
                } else if (ourGame.teams.captioner.length == Math.floor(ourGame.players.length / 2)) {
                    ourGame.teams.imager.push(i);
                } else {
                    if (Math.random() > 0.5) {
                        ourGame.teams.captioner.push(i);
                    } else {
                        ourGame.teams.imager.push(i);
                    }
                }
            }
            return ourGame;
        }).then(function() {
            emitters[gameID].emit("change"); // Emit change event
            resolve(); // Return
        }).catch(function(err) {
            reject(err);
        });
    });
}

/**
 * Leaves a game.
 * @param {String} gameID The game ID.
 * @param {Message} message The message asking to join.
 */
function _leaveGame(gameID, message) {
    return new Promise(function(resolve, reject) {
        gameCache.updateGame(gameID, function(game) { // Update the game
            var ourGame = game;
            var playerIndex = ourGame.players.indexOf(game.players.find(x => x.id == message.author.id));
            if (ourGame.players[playerIndex].owner) { // Generate a new owner, if needed
                ourGame.players[Math.floor(Math.random() * ourGame.players.length)].owner = true;
            }
            ourGame.players.slice(playerIndex, 1); // Remove
            return ourGame;
        }).then(function() {
            emitters[gameID].emit("left", message.author.id); // Emit change event
            resolve(); // Return
        }).catch(function(err) {
            reject(err);
        });
    });
}
//#endregion

//#region Input Processing
/**
 * Processes user input.
 * @param {Message} message
 */
function input(message) { // Processes an incoming message
    kttn.log("Got the message! Calling isInGame.");
    isInGame(message.author.id).then(function(result) { // Check if the author is in-game or not
        kttn.log("Back from isInGame!");

        if (result) { // If the author is in-game
            kttn.log("Searching for the Game ID based on the player...");
            getGameIDFromPlayer(message.author.id).then(function(gameID) { // Get game the player is participating in
                if (gameID) { // If game was found
                    kttn.log("Found the game! Getting it's info...");
                    gameCache.getGame(gameID).then(function(game) { // Get game from game ID
                        kttn.log("Game data:");
                        console.log(game); // Log the game
                    }).catch(function(err) {
                        kttn.error("Failed to get game.");
                        console.log(err);
                        Raven.captureException(err, { extra: { message, gameID } });
                        message.react("\u274C"); // React with :x:
                    });
                } else { // If game wasn't found
                    kttn.error("Failed to get Game ID.");
                    Raven.captureException(new Error("Failed to get Game ID."), { extra: { message, gameID } });
                    message.react("\u274C"); // React with :x:
                }
            }).catch(function(err) {
                kttn.error("Failed to get Game ID.");
                console.log(err);
                Raven.captureException(err, { extra: { message } });
                message.react("\u274C"); // React with :x:
            });
        } else { // If they aren't in game
            kttn.log("Not in game")
        }
    }).catch(function(err) {
        kttn.error("Failed to check if the user is in-game.");
        console.log(err);
        Raven.captureException(err, { extra: { message } });
        message.react("\u274C"); // React with :x:
    });
}

//#region Commands
/**
 * Attempts to join a user to a game.
 * @param {Message} message
 */
function joinGame(message) {
    kttn.log("Got joinGame message. Checking if user is in-game already...");
    isInGame(message.author.id).then(function(result) { // Check if player is in-game
        kttn.log(`isInGame done: ${result}`);
        if (result) { // If the player is in-game
            message.reply("You're already in-game!");
        } else { // If the player isn't in-game
            kttn.log("Searching for a non-full game.");
            gameCache.listGames().then(function(games) { // List all games
                var gameID = false;
                games.some(function(game) { // Loop through all games
                    if (game.turn == 0 && game.players.length < game.full) { // If the game is still waiting for players, and the game isn't full
                        gameID = game.id; // save Game ID
                        return true;
                    }
                    return false;
                });
                if (gameID != false) { // If we found a game
                    kttn.log("Found a game! Joining...");
                    _joinGame(gameID, message, false).then(function() { // Join the game
                        kttn.log("Game joined! Displaying info to player.");
                        displayGameInfo(gameID, message); // Display lobby info for game
                    }).catch(function(err) {
                        kttn.error("Failed to update game.");
                        console.log(err);
                        Raven.captureException(err, { extra: { message, gameID } });
                        message.react("\u274C"); // React with :x:
                    });
                } else { // If we haven't found a game
                    kttn.log("No free game. Creating game...");
                    _createGame().then(function(gameID) { // Create a game
                        kttn.log("Game created! Joining it...");
                        _joinGame(gameID, message, true).then(function() { // Join the created game
                            kttn.log("Game joined! Displaying info go player.");
                            displayGameInfo(gameID, message); // Display lobby info for game
                        }).catch(function(err) {
                            kttn.error("Failed to join game.");
                            console.log(err);
                            Raven.captureException(err, { extra: { message, gameID } });
                            message.react("\u274C"); // React with :x:
                        });
                    }).catch(function(err) {
                        kttn.error("Failed to create game.");
                        console.log(err);
                        Raven.captureException(err, { extra: { message } });
                        message.react("\u274C"); // React with :x:
                    });
                }
            });
        }
    }).catch(function(err) {
        kttn.error("Failed to check if the user is in-game.");
        console.log(err);
        Raven.captureException(err, { extra: { message, gameID } });
        message.react("\u274C"); // React with :x:
    });
}

/**
 * Attempts to force-start a game.
 * @param {Message} message
 */
function startGame(message) {
    // TO-DO: Player Count Check
    kttn.log("Got startGame message. Checking if user is in-game...");
    isInGame(message.author.id).then(function(result) { // Check if player is in-game
        kttn.log(`isInGame done: ${result}`);
        if (result) { // If the player is in-game
            kttn.log("Getting game data of the player's game...");
            getGameIDFromPlayer(message.author.id).then(function(gameID) { // Get game the player is participating in
                if (gameID) { // If game was found
                    kttn.log("Game found! Getting more info...");
                    gameCache.getGame(gameID).then(function(game) { // Get game from game ID
                        kttn.log("Info acquired. Checking if the game is still waiting for players...");
                        if (game.turn == 0) {
                            kttn.log("The game is waiting for players to join. Looking for in-game data of the player.");
                            var playerInGame = game.players.find(x => x.id == message.author.id);
                            if (playerInGame) {
                                kttn.log("Data found. Permission check...");
                                if (playerInGame.owner) {
                                    kttn.log("Player has sufficent permissions. Force-starting the game...");
                                    _startGame(gameID).then(function() {
                                        kttn.log("Start successful!");
                                        message.reply("Game started!");
                                    }).catch(function(err) {
                                        kttn.error("Failed to start game.");
                                        console.log(err);
                                        Raven.captureException(err, { extra: { message, gameID } });
                                        message.react("\u274C"); // React with :x:
                                    });
                                } else {
                                    kttn.log("Permission denied.");
                                    message.reply("You don't have permission to force-start this game.");
                                }
                            } else {
                                kttn.error("Failed to find the user in-game.");
                                console.log(err);
                                Raven.captureException(err, { extra: { message, gameID } });
                                message.react("\u274C"); // React with :x:
                            }
                        } else {
                            kttn.log("The game has already started.");
                            message.reply("Can't start a game that has already been started.");
                        }
                    }).catch(function(err) {
                        kttn.error("Failed to get game.");
                        console.log(err);
                        Raven.captureException(err, { extra: { message, gameID } });
                        message.react("\u274C"); // React with :x:
                    });
                } else { // If game wasn't found
                    kttn.error("Failed to get Game ID.");
                    Raven.captureException(new Error("Failed to get Game ID"), { extra: { message } });
                    message.react("\u274C"); // React with :x:
                }
            }).catch(function(err) {
                kttn.error("Failed to get Game ID.");
                console.log(err);
                Raven.captureException(err, { extra: { message  } });
                message.react("\u274C"); // React with :x:
            });
        } else { // If the player isn't in-game
            kttn.log("The player is not in-game.");
            message.reply("You're not in-game!");
        }
    }).catch(function(err) {
        kttn.error("Failed to check if the user is in-game.");
        console.log(err);
        Raven.captureException(err, { extra: { message } });
        message.react("\u274C"); // React with :x:
    });
}

/**
 * Attempts to leave a game.
 * @param {Message} message
 */
function leaveGame(message) {
    // TO-DO: Player Count Check
    kttn.log("Got startGame message. Checking if user is in-game...");
    isInGame(message.author.id).then(function(result) { // Check if player is in-game
        kttn.log(`isInGame done: ${result}`);
        if (result) { // If the player is in-game
            kttn.log("Getting game data of the player's game...");
            getGameIDFromPlayer(message.author.id).then(function(gameID) { // Get game the player is participating in
                if (gameID) { // If game was found
                    kttn.log("Game found! Getting more info...");
                    gameCache.getGame(gameID).then(function(game) { // Get game from game ID
                        kttn.log("Info acquired. Checking if the game is still waiting for players...");
                        if (game.turn == 0) {
                            kttn.log("The game is waiting for players to join. Leaving game.");
                            _leaveGame(gameID, message).then(function() {
                                kttn.log("Leave successful!");
                                message.reply("Game left.");
                            }).catch(function(err) {
                                kttn.error("Failed to start game.");
                                console.log(err);
                                Raven.captureException(err, { extra: { message, gameID } });
                                message.react("\u274C"); // React with :x:
                            });
                        } else {
                            kttn.log("The game has already started.");
                            message.reply("You can't leave! The game has already started.");
                        }
                    }).catch(function(err) {
                        kttn.error("Failed to get game.");
                        console.log(err);
                        Raven.captureException(err, { extra: { message, gameID } });
                        message.react("\u274C"); // React with :x:
                    });
                } else { // If game wasn't found
                    kttn.error("Failed to get Game ID.");
                    Raven.captureException(new Error("Failed to get Game ID"), { extra: { message } });
                    message.react("\u274C"); // React with :x:
                }
            }).catch(function(err) {
                kttn.error("Failed to get Game ID.");
                console.log(err);
                Raven.captureException(err, { extra: { message  } });
                message.react("\u274C"); // React with :x:
            });
        } else { // If the player isn't in-game
            kttn.log("The player is not in-game.");
            message.reply("You're not in-game!");
        }
    }).catch(function(err) {
        kttn.error("Failed to check if the user is in-game.");
        console.log(err);
        Raven.captureException(err, { extra: { message } });
        message.react("\u274C"); // React with :x:
    });
}

//#endregion
//#endregion

//#region Match Display Functions

/**
 * Displays lobby info of game.
 * @param {String} gameID The game's ID.
 * @param {Message} message The original message asking for the data.
 * @param {Boolean} edit If the data should be updated, or should be created.
 * @param {[Message]} og The original display message. Only needed if edit is true.
 */
function _displayLobbyInfo(gameID, message, edit, og) {
    // Select method to call (send/edit)
    var call = message.author.send.bind(message.author);
    if (edit) call = og.edit.bind(og);

    return new Promise(function(resolve, reject) {
        gameCache.getGame(gameID).then(function(game) { // Get supplied game
            call({
                embed: {
                    title: `Game (${gameID})`,
                    description: "Waiting for players...",
                    fields: [
                        {
                            name: "Players",
                            value: `${game.players.map(x => x.username).join("\n")}`
                        }
                    ]
                }
            }).then(function(newMsg) {
                resolve(newMsg);
            }).catch(function(err) {
                reject(err, false);
            });
        }).catch(function(err) {
            kttn.error("Failed to get game.");
            console.log(err);
            reject(err, true);
        });
    });
}

/**
 * Displays current game info.
 * @param {String} gameID The game's ID.
 * @param {Message} message Original display message (generated by _displayLobbyInfo)
 */
function _displayGameInfo(gameID, message) {
    return new Promise(function(resolve, reject) {
        gameCache.getGame(gameID).then(function(game) { // Get supplied game
            var imagerList = `${game.teams.imager.map(x => game.players[x].username).join("\n")}`;
            if (imagerList.trim().length == 0) imagerList = "(none)";
            var captionerList = `${game.teams.captioner.map(x => game.players[x].username).join("\n")}`;
            if (captionerList.trim().length == 0) captionerList = "(none)";

            message.edit({ // Edit original message
                embed: {
                    title: `Game (${gameID})`,
                    description: "The game has been started.",
                    fields: [
                        {
                            name: "Imagers",
                            value: imagerList,
                            inline: true
                        },
                        {
                            name: "Captioners",
                            value: captionerList,
                            inline: true
                        },
                    ]
                }
            }).then(function() {
                resolve();
            }).catch(function(err) {
                reject(err, false);
            });
        }).catch(function(err) {
            kttn.error("Failed to get game.");
            console.log(err);
            Raven.captureException(err, { extra: { gameID } });
            reject(err, true);
        });
    });
}

/**
 * Displays left game info.
 * @param {String} gameID The game's ID.
 * @param {Message} message Original display message (generated by _displayLobbyInfo)
 */
function _displayLeftGame(gameID, message) {
    return new Promise(function(resolve, reject) {
        message.edit({ // Edit original message
            embed: {
                title: `Game (${gameID})`,
                description: "You have left the game.",
            }
        }).then(function() {
            resolve();
        }).catch(function(err) {
            reject(err, false);
        });
    });
}

/**
 * Displays game info for a user.
 * @param {String} gameID The ID of the game to display.
 * @param {Message} message Original message asking for the data.
 */
function displayGameInfo(gameID, message) {
    kttn.log("Displaying game info for the first time...");
    _displayLobbyInfo(gameID, message, false).then(function(newMsg) { // Display lobby info for the first time.
        kttn.log("Display successful! Subscribing to the change event.");
        var eventListener = function() { // Register change event listener for game's event emitter
            kttn.log(`Change event invoked. Getting up-to-date game info... (${gameID})`);
            gameCache.getGame(gameID).then(function(game) { // Get game info
                kttn.log("Got the info. Checking what to display...");
                if (!game.players.find(x => x.id == message.author.id)) {
                    kttn.log("User isn't in-game");
                    return;
                }
                if (game.turn == 0) { // If we're still waiting for players.
                    kttn.log("Game is waiting for players. Displaying lobby info.");
                    _displayLobbyInfo(gameID, message, true, newMsg).then(function() {
                        kttn.log("Info updated.");
                    }).catch(function(err, handled) {
                        if (!handled) {
                            kttn.error("Failed to display lobby info.");
                            console.log(err);
                            Raven.captureException(err, { extra: { message, gameID, game } });
                        }
                    });
                } else if (game.turn >= 1 && game.turn <= 4) { // If we're playing
                    kttn.log("Game in progress. Showing game info.");
                    _displayGameInfo(gameID, newMsg).then(function() {
                        kttn.log("Info updated.");
                    }).catch(function(err, handled) {
                        if (!handled) {
                            kttn.error("Failed to display game info.");
                            console.log(err);
                            Raven.captureException(err, { extra: { message, gameID, game } });
                        }
                    });
                }
            }).catch(function(err) {
                kttn.error("Failed to get game.");
                console.log(err);
                Raven.captureException(err, { extra: { message, gameID } });
            });
        }
        emitters[gameID].on("change", eventListener);
        emitters[gameID].on("left", function(leaverID) {
            if (leaverID == message.author.id) {
                kttn.log(`The player (${leaverID}) has left the game. Removing event listener...`);
                emitters[gameID].removeListener("change", eventListener);
                kttn.log(`Event listener removed. Displaying left message.`);
                _displayLeftGame(gameID, newMsg).then(function() {
                    kttn.log(`Info updated.`);
                }).catch(function(err, handled) {
                    if (!handled) {
                        kttn.error("Failed to display left message.");
                        console.log(err);
                        Raven.captureException(err, { extra: { message, gameID } });
                    }
                });
            } else {
                eventListener();
            }
        });
    }).catch(function(err) {
        kttn.error("Failed to display lobby info.");
        console.log(err);
        Raven.captureException(err, { extra: { message, gameID } });
        message.react("\u274C"); // React with :x:
    });
}
//#endregion

module.exports = {
    input,
    joinGame,
    startGame,
    leaveGame
};
