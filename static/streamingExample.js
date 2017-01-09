function streamingExampleCtrl($scope,dataStream) {                  // Controller for our page
  $scope.tweetsIn = dataStream.tweetsIn;                            // Add the `tweetsIn` to `$scope` (tweet:*)
  $scope.tweetsOut = dataStream.tweetsOut;                          // Add the `tweetsOut` to `$scope` (response:*)
  $scope.series = dataStream.lines;                                 // Add `lines` to `$scope.series`

  $scope.labels = ['9','8','7','6','5','4','3','2','1','0'];        // Create the time legend
  $scope.data = dataStream.values;                                  // Add `values` to `$scope.data`
  $scope.options = {                                                // Configuration for chart.js/angular-chart
    animation : {
      duration  : 0
    },
    elements  : {
      line      : { tension : 0.2 },
      point     : { radius : 0 }
    },
    scales  : {
      yAxes     : [ { ticks : { min : 0, max : 50} } ]
    },
    legend  : { display : true }
  };
}

angular.module('streamingExample', [                                // Create the main angular module
    'angular-websocket',                                            // Use websockets
    'chart.js'                                                      // And Chart.js / Angular-charts
  ])
  .factory('dataStream', function($websocket) {                     // Setup the websocket
      var 
        dataStream = $websocket('ws://localhost:8858'),             // Right now it's localhost, but you can do this over a distant connection
        keys  = [],                                                 // `keys` represents servers
        values = [],                                                // `values` are the load figures
        tweetsIn = [],                                              // from 'tweet:*'
        tweetsOut = [];                                             // from 'response:*'

      dataStream.onMessage(function(message) {                      // This is called everytime a new web socket message is received
        var
          anUpdate = JSON.parse(message.data),                      // It's text, so convert it to JSON
          updateChannelIndex;                                       // This will hold the index of the array that makes up the load graph
        
        if (anUpdate.channel.match(/^load\:/gi)) {                  // Match any channel that starts with 'load:'
          updateChannelIndex = keys.indexOf(anUpdate.channel);      // Find the index
          if (updateChannelIndex === -1) {                          // If it's not found
            updateChannelIndex = (keys.push(anUpdate.channel)-1);   // The new index will be the last
            values.push([]);                                        // push in a new array so we can subsequently push into it
          }

          values[updateChannelIndex].push(Number(anUpdate.message));// push into the array at the index from above. It will be a numerical value
          if (values[updateChannelIndex].length > 10) {             // If the array in question is longer than 10
            values[updateChannelIndex].shift();                     // Then remove the oldest value
          }
        } else if (anUpdate.channel.match(/^tweet\:/gi)) {          // Match any channel that starts with 'tweet:'
          tweetsIn.push(anUpdate);                                  // Add the new one
          if (tweetsIn.length > 5) {                                // If the array of incoming tweets is longer than 5
            tweetsIn.shift();                                       // Then remove the oldest value
          }
        } else if (anUpdate.channel.match(/^response\:/gi)) {       // Match any channel that starts with 'response:'
          tweetsOut.push(anUpdate);                                 // Add the new one
          if (tweetsOut.length > 5) {                               // If the array of responses tweets is longer than 5
            tweetsOut.shift();                                      // Then remove the oldest value
          }
        } 
      });

      return {                                                      // Everything goes to a nice neat object
        lines     : keys,
        values    : values,
        tweetsIn  : tweetsIn,
        tweetsOut : tweetsOut
      };                                                            // Angular will take care of constantly updating this object in the controller
    })
  .controller('streamingExampleCtrl',streamingExampleCtrl);