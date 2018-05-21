var NodeCache = require('node-cache');
var EventEmitter = require('events').EventEmitter;
var nanoid = require('nanoid');
var deasync = require('deasync');

class QueueEmitter extends EventEmitter {}

const gameCache = new NodeCache();

var queue = [];
var callCount = 0;
var queueLoading = false;
var queueEmitter = new QueueEmitter();

function listGameIDs() {
    return new Promise(function(resolve, reject) {
        gameCache.keys(function(err, keys) {
            if (err) reject(err);
            else resolve(keys);
        });
    });
}

function listGames() {
    return new Promise(function(resolve, reject) {
        queue.push(function() {
            return new Promise(function(qResolve, qReject) {
                listGameIDs().then(function(result) {
                    console.log(result);
                    var games = [];
                    var error = false;
                    result.some(function(id, index) {
                        var result = false;
                        var x = false;
                        _getGame(id).then(function(game) {
                            games.push(game);
                            if (games.length == result.length) {
                                result = true;
                            }
                            x = true;
                        }).catch(function(err) {
                            reject(err);
                            error = true;
                            x = true;
                        });
                        deasync.loopWhile(() => !x);
                        return result || error;
                    });
                    if (!error) resolve(games);
                    qResolve();
                }).catch(function(err) {
                    reject(err);
                    qResolve();
                });
            });
        });
        queueEmitter.emit("add");
    });
}

function createGame() {
    return new Promise(function(resolve, reject) {
        queue.push(function() {
            return new Promise(function(qResolve, qReject) {
                var id = nanoid();
                gameCache.set(id, {
                    id,
                    players: [],
                    full: 8,
                    teams: {
                        imager: [],
                        captioner: []
                    },
                    turn: 0,
                    turnState: []
                }, function(err, success) {
                    if (err || !success) {
                        reject(err);
                        qResolve();
                    } else {
                        resolve(id);
                        qResolve();
                    }
                });
            });
        });
        queueEmitter.emit("add");
    });
}

function deleteGame(id) {
    return new Promise(function(resolve, reject) {
        queue.push(function() {
            return new Promise(function(qResolve, qReject) {
                gameCache.del(id, function(err) {
                    if (err) {
                        reject(err);
                        qResolve();
                    } else {
                        resolve();
                        qResolve();
                    }
                });
            });
        });
        queueEmitter.emit("add");
    });
}

function updateGame(id, changeAction) {
    return new Promise(function(resolve, reject) {
        queue.push(function() {
            return new Promise(function(qResolve, qReject) {
                gameCache.get(id, function(err, value) {
                    if (err) {
                        reject(err);
                        qResolve();
                    }
                    var newObj = changeAction(value);
                    gameCache.set(id, newObj, function(err, success) {
                        if (err || !success) {
                            reject(err);
                            qResolve();
                        } else {
                            resolve();
                            qResolve();
                        }
                    });
                });
            });
        });
        queueEmitter.emit("add");
    });
}

function _getGame(id) { // non-queued getGame
    return new Promise(function(resolve, reject) {
        gameCache.get(id, function(err, value) {
            if (err) {
                reject(err);
            } else {
                resolve(value);
            }
        });
    });
}

function getGame(id) {
    return new Promise(function(resolve, reject) {
        queue.push(function() {
            return new Promise(function(qResolve, qReject) {
                gameCache.get(id, function(err, value) {
                    if (err) {
                        reject(err);
                        qResolve();
                    } else {
                        resolve(value);
                        qResolve();
                    }
                });
            });
        });
        queueEmitter.emit("add");
    });
}

function nextInQueue() {
    if (queue.length > 0) {
        queueLoading = true;
        callCount++;
        console.log(`cacheQueue: New element in queue. Calling... (#${callCount})`);
        var x = false;
        queue.shift()().then(function() {
            console.log("cacheQueue: Response!");
            x = true;
        }).catch(function(err) {
            console.log(err);
            console.error("cacheQueue: Error!");
            x = true;
        })
        deasync.loopWhile(function() { return !x;})
        if (queue.length != 0) setImmediate(nextInQueue);
        else queueLoading = false;
    }
}

module.exports = {
    listGames,
    createGame,
    deleteGame,
    updateGame,
    getGame
};

queueEmitter.on("add", function() {
    if (!queueLoading) {
        nextInQueue();
    }
})