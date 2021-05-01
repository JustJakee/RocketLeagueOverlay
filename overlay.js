const WsSubscribers = {
    __subscribers: {},
    websocket: undefined,
    webSocketConnected: false,
    registerQueue: [],
    init: function (port, debug, debugFilters) {
        port = port || 49322;
        debug = debug || false;
        if (debug) {
            if (debugFilters !== undefined) {
                console.warn(
                    "WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped"
                );
            } else {
                console.warn(
                    "WebSocket Debug Mode enabled without filters applied. All events will be dumped to console"
                );
                console.warn(
                    "To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function"
                );
            }
        }
        WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
        WsSubscribers.webSocket.onmessage = function (event) {
            let jEvent = JSON.parse(event.data);
            if (!jEvent.hasOwnProperty('event')) {
                return;
            }
            let eventSplit = jEvent.event.split(':');
            let channel = eventSplit[0];
            let event_event = eventSplit[1];
            if (debug) {
                if (!debugFilters) {
                    console.log(channel, event_event, jEvent);
                } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                    console.log(channel, event_event, jEvent);
                }
            }
            WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
        };
        WsSubscribers.webSocket.onopen = function () {
            WsSubscribers.triggerSubscribers("ws", "open");
            WsSubscribers.webSocketConnected = true;
            WsSubscribers.registerQueue.forEach((r) => {
                WsSubscribers.send("wsRelay", "register", r);
            });
            WsSubscribers.registerQueue = [];
        };
        WsSubscribers.webSocket.onerror = function () {
            WsSubscribers.triggerSubscribers("ws", "error");
            WsSubscribers.webSocketConnected = false;
        };
        WsSubscribers.webSocket.onclose = function () {
            WsSubscribers.triggerSubscribers("ws", "close");
            WsSubscribers.webSocketConnected = false;
        };
    },
    /**
     * Add callbacks for when certain events are thrown
     * Execution is guaranteed to be in First In First Out order
     * @param channels
     * @param events
     * @param callback
     */
    subscribe: function (channels, events, callback) {
        if (typeof channels === "string") {
            let channel = channels;
            channels = [];
            channels.push(channel);
        }
        if (typeof events === "string") {
            let event = events;
            events = [];
            events.push(event);
        }
        channels.forEach(function (c) {
            events.forEach(function (e) {
                if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                    WsSubscribers.__subscribers[c] = {};
                }
                if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                    WsSubscribers.__subscribers[c][e] = [];
                    if (WsSubscribers.webSocketConnected) {
                        WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                    } else {
                        WsSubscribers.registerQueue.push(`${c}:${e}`);
                    }
                }
                WsSubscribers.__subscribers[c][e].push(callback);
            });
        })
    },
    clearEventCallbacks: function (channel, event) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel]
            .hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel] = {};
        }
    },
    triggerSubscribers: function (channel, event, data) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel]
            .hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel][event].forEach(function (callback) {
                if (callback instanceof Function) {
                    callback(data);
                }
            });
        }
    },
    send: function (channel, event, data) {
        if (typeof channel !== 'string') {
            console.error("Channel must be a string");
            return;
        }
        if (typeof event !== 'string') {
            console.error("Event must be a string");
            return;
        }
        if (channel === 'local') {
            this.triggerSubscribers(channel, event, data);
        } else {
            let cEvent = channel + ":" + event;
            WsSubscribers.webSocket.send(JSON.stringify({
                'event': cEvent,
                'data': data
            }));
        }
    }
};


$(() => {
    WsSubscribers.init(49322, true);
    WsSubscribers.subscribe('game', 'update_state', (x) => {
        //$('.scorebug .team-left .score').text(x['game']['teams'][0]['score']);
        //$('.scorebug .team-right .score').text(x['game']['teams'][1]['score']);
        updatePlayerCard(x);
        updateScore(x);
        updateTime(x);
    });
    WsSubscribers.subscribe('game', 'goal_scored', (x) => {
        runGoalAnimation();
    });

});

function updatePlayerCard(data) {
    var playerName = data['game']['target'];

    if (playerName === '') {
        document.getElementById('blue-card').style.display = "none";
        document.getElementById('orange-card').style.display = "none";
    } else {
        if (data['players'][playerName]['team'] == '0') {
            document.getElementById('blue-card').style.display = "block";
            document.getElementById('orange-card').style.display = "none";
            $('#blue-card-name').text(data['players'][playerName]['name']);
            $('#blue-card-score').text(data['players'][playerName]['score']);
            $('#blue-card-goals').text(data['players'][playerName]['goals']);
            $('#blue-card-assists').text(data['players'][playerName]['assists']);
            $('#blue-card-saves').text(data['players'][playerName]['saves']);
            document.getElementById('blue-card-boost-vis').style.width = parseInt(data['players'][playerName][
                'boost'
            ]) + '%';
        } else {
            document.getElementById('orange-card').style.display = "block";
            document.getElementById('blue-card').style.display = "none";
            $('#orange-card-name').text(data['players'][playerName]['name']);
            $('#orange-card-score').text(data['players'][playerName]['score']);
            $('#orange-card-goals').text(data['players'][playerName]['goals']);
            $('#orange-card-assists').text(data['players'][playerName]['assists']);
            $('#orange-card-saves').text(data['players'][playerName]['saves']);
            document.getElementById('orange-card-boost-vis').style.width = parseInt(data['players'][playerName][
                'boost'
            ]) + '%';
        }
    }
}

function updateTime(data) {
    var timeInSecs = parseFloat(data['game']['time']);
    var minutesRemaining = timeInSecs / 60;
    var secondsRemaining = Math.ceil(timeInSecs % 60);
    

    if (secondsRemaining < 10) {
        $('#game-time').text(Math.floor(minutesRemaining) + ':0' + secondsRemaining);
    } else {
        $('#game-time').text(Math.floor(minutesRemaining) + ':' + secondsRemaining);
    }

}

function updateScore(data) {
    var blueScore = data['game']['teams']['0']['score'];
    var redScore = data['game']['teams']['1']['score'];

    // set score
    $('#blue-score').text(blueScore);
    $('#orange-score').text(redScore);
}

function runGoalAnimation() {
    document.getElementById('slidetest').style.width = "538px";
    setTimeout(() => {
        document.getElementById('slidetest').style.width = "0px";
    }, 2500);
}