var
  argv            = require('yargs')                                // "yargs" is a command line argument module
                    .demand('connection')                           // 'connection' is the path to the node_redis style connection object
                    .argv,
  express         = require('express'),                             // HTTP server for node
  redis           = require('redis'),                               // node_redis to manage the redis connection
  WebSocketServer = require('ws').Server,                           // Web socket server module
  EventEmitter    = require('events').EventEmitter,                 // Node.js Event emitter module
  connectionJson  = require(argv.connection),                       // Load the connection object from a file

  wss             = new WebSocketServer({ port: 8858 }),            // create a web socket server on port 8858
  localEvents     = new EventEmitter(),                             // create a new event emitter instance

  app             = express(),                                      // init express
  patterns        = {                                               // store our patterns in a object as to not repeat myself
    load            : 'load:*',
    response        : 'response:*',
    tweet           : 'tweet:*'
  },
  subClient       = redis.createClient(connectionJson);             // Create the client with the options from the JSON file. It's a standard node_redis connection object

subClient.on('pmessage',function(pattern, channel, message) {       // Pattern subscribe callback functions have three arguments
  localEvents.emit(pattern,channel,message);                        // turn it around and emit an event (that will be responsed inside the stateful web socket connection)
});
subClient.psubscribe(patterns.load);                                // Subscribe to CPU loads
subClient.psubscribe(patterns.response);                            // Subscribe to processing responses 
subClient.psubscribe(patterns.tweet);                               // Subscribe to incoming tweets

wss.on('connection', function(ws) {                                 // When a new web socket server connection occurs
  var
    handler = function(channel,message) {                           // we handle all Redis events the same way - but note that these are emitted events not specificly redis pub/sub
      ws.send(JSON.stringify({                                      // send out a JSON object
        channel   : channel,                                        // with the channel
        message   : message                                         // and message
      }), function(err) {                                           // handle the errors
        if (err) { console.log('error',err); }
      });
    };

  localEvents.on(patterns.load, handler);                           // Subscribe to the load emitted events
  localEvents.on(patterns.response, handler);                       // Subscribe to the response events
  localEvents.on(patterns.tweet, handler);                          // Subscribe to the incoming tweet events

  ws.on('close', function() {                                       // when the web socket event is closed - this prevents trying to write to a closed web socket
    localEvents.removeListener(patterns.load, handler);             // Stop listening for load events
    localEvents.removeListener(patterns.response, handler);         // Stop listening for response events
    localEvents.removeListener(patterns.tweet, handler);            // Stop listening for tweet events
  });
});

app         
  .use(express.static('static'))                                    // Serve all files in the ./static directory
  .listen(8859, function () {                                       // Start the web server (for HTTP connections)
    console.log('started');                                         // Log that we're good-to-go
  });