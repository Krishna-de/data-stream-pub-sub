var
  argv          = require('yargs')                                  // "yargs" is a command line argument module
                  .demand('connection')                             // 'connection' is the path to the node_redis style connection object
                  .demand('twittercreds')                           // Path to JSON file containing Twitter API credentials
                  .demand('terms')                                  // comma delimited keywords to track (e.g. "nodejs,angular,redis")
                  .argv,                                            // return the values in an object
  _             = require('lodash'),                                // We'll use lodash to make sorting and filtering the most idle connections easier
  redis         = require('redis'),                                 // node_redis to manage the redis connection
  rk            = require('rk'),                                    // rk to join strings together with ':' elegantly
  Twitter       = require('node-tweet-stream'),                     // Get tweets in an evented stream

  twitterCreds  = require(argv.twittercreds),                       // Load the twitter credentials from the JSON file
  connectionJson
                = require(argv.connection),                         // Load the connection object from a file

  t             = new Twitter(twitterCreds),                        // create the twitter stream instance

  subClient,                                                        // client in subscriber mode
  pubClient,                                                        // client in normal mode

  patterns      = {                                                 // store our patterns in a object as to not repeat myself
    load      : 'load:*',
    response  : 'response:*'
  },

  inactiveThreshold                                                 // number of milliseconds to determine if a crew member is gone
                = 500,                                              // you'll need to set the value of `loadfreq` on the crew member less than this
  servers       = {},                                               // we'll store the server names here
  serverLastSeen
                = {};                                               // and the last seen is keeping track of the server name by the last time the crew member reported a load

function getMostIdle() {                                            // return the crew member with the lowest CPU load
  var
    leastBusy = _(servers)                                          // `servers` looks like { server1 : 1.2, server2 : 4 }
      .toPairs()                                                    // convert it to [['server1',1.2],['server2',4]]
      .sort(function(a,b) {                                         // descending order by the load
        return a[1]-b[1];
      })
      .first();                                                     // just grab the first value - aka the lowest load
  if (leastBusy) {                                                  // it's possible that there are no servers
    return {                                                        // if not, send out the server with the least load
      server  : leastBusy[0],
      load    : leastBusy[1]
    };
  } else {
    return false;                                                   // otherwise, return false
  }
}

function cleanInactiveServers() {                                   // Remove any servers that are inactive
  _(serverLastSeen)                                                 // `serverLastSeen` looks like { server1 : 1483375830687, server2 : 1483372820653 }
    .toPairs()                                                      // convert it to [['server1', 1483375830687], ['server2',1483372820653]]
    .map(function(aPair) {
      if (aPair[1] < (Date.now() - inactiveThreshold)) {            // if the one in question is too old
        delete servers[aPair[0]];                                   // delete it from the servers object
      }
    })
    .value();                                                       // This triggers everything to execute in lodash, although we're not actually doing anything with the value 
}

subClient = redis.createClient(connectionJson);                     // Create the client with the options from the JSON file. It's a standard node_redis connection object
pubClient = subClient.duplicate();                                  // Make a duplicate because you can't do both pub and sub on the same connection

subClient.on('pmessage',function(pattern, channel, message) {       // process the load messages coming from the crew members
  var
    serverName;

  if (pattern === patterns.load) {                                  // ignore all other messages besides those that are 'load:*'
    serverName = channel.split(patterns.load.slice(0,-1))[1];       // 'load:servername' is split by 'load:' (removing the *) and getting the last bit.
    servers[serverName] = Number(message);                          // Convert the payload to a number and store it in the `servers` object
    serverLastSeen[serverName] = Date.now();                        // Update the `serversLastSeen` object with the current timestamp
  }                                                                 // You could do an `else` here to process other messages (like the responses)
});

subClient.psubscribe(patterns.load);                                // Subscribe to the load messages
//subClient.psubscribe(patterns.response);                          // You'd do this for all the other messages you wanted to handle

t.on('tweet', function (tweet) {                                    // node-tweet-stream emits a 'tweet' event when one comes in
  var
    mostIdle = getMostIdle();                                       // Find our most idle crew member

  if (mostIdle) {                                                   // If we have crew members
    pubClient.publish(rk('tweet',mostIdle.server),tweet.text);      // then we publish a message to the least busy server, with a payload as the text of the tweet
  }
});
t.on('error', function (err) {                                      // Handle errors, just in case.
  console.log('Twitter Error', err);                                // Twitter does have quite a few limits, so it's very possible to exceed them
});

argv.terms.split(',').forEach(function(aTerm) {                     // Split up the tracking argument from the command line
  console.log('tracking',aTerm);                                    // log what we're tracking
  t.track(aTerm);                                                   // Track the keyword
});

setInterval(cleanInactiveServers,inactiveThreshold);                // Check for inactive servers every 500 ms (or the value of inactiveThreshold)