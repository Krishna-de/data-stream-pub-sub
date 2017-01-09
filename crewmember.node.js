var 
  argv          = require('yargs')                                  // "yargs" is a command line argument module
                  .demand('processname')                            // a unique identifier for this crew member
                  .demand('connection')                             // 'connection' is the path to the node_redis style connection object
                  .demand('loadfreq')                               // the frequency (in milliseconds) that the crew member will report the CPU load
                  .argv,                                            // return the values in an object
  pusage        = require('pidusage'),                              // Module to get the CPU/memory of a specific PID
  redis         = require('redis'),                                 // node_redis to manage the redis connection

  connectionJson
                = require(argv.connection),                         // Load the connection object from a file

  loadSim       = 0,                                                // This is the modifier to *simulate* additional load
  loadSimInc    = 4,                                                // 4% greater each time it handles a tweet

  subClient,                                                        // client in subscriber mode
  pubClient;                                                        // client in normal mode

pubClient = redis.createClient(connectionJson);                     // Create the client with the options from the JSON file. It's a standard node_redis connection object
subClient = pubClient.duplicate();                                  // Make a duplicate because you can't do both pub and sub on the same connection

setInterval(function() {                                            // run the function every argv.loadfreq ms
  pusage.stat(process.pid, function(err, stat) {                    // `process.pid` evaluates the CPU usage of this process
    if (err) { throw err; }                                         // You may want better error handling
    pubClient.publish('load:'+argv.processname, stat.cpu+loadSim);  // publish the load (`stat.cpu`) plus the simulated load value
  });
},argv.loadfreq);

subClient.on('message',function(channel, message) {                 // When a message comes in - note how the signature of this function is just `channel`, `message` because it's for `subscribe` not `psubscribe`
  loadSim += loadSimInc;                                            // increase load on each tweet - obviously, you won't need this if you're not simulating load
  setTimeout(function() {                                           // After 2000ms, run this function
    pubClient.publish('response:'+argv.processname,message);        // Publish the response - it's just echoing the same message but you'd hopefully have something different after 2000ms of processing :)
    if (loadSim > loadSimInc) {                                     // ensure that something hasn't gone wrong and the load is above 1
      loadSim -= loadSimInc;                                        // reduce the load back to simulate the processing being complete
    }
  },2000);
});
subClient.subscribe('tweet:'+argv.processname);                     // Subscribe to a specific pattern