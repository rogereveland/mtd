/* jshint unused: false */
//jscs: disable requireCamelCaseOrUpperCaseIdentifiers
/* globals idb, jQuery */
'use strict';

/**
 * @ngdoc function
 * @name mtdApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the mtdApp
 */
angular.module('mtdApp')
  .controller('MainCtrl', function ($scope, $http) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];

    $scope.routes = [];
    $scope.stops = [];
    $scope.liveDepartures = [];
    $scope.schedule = [];
    $scope.searchText = "Transit Plaza";
    $scope.apiKey = "352b4714e2ef4f7ba0f8b5f9f6267745";
    $scope.baseURL = 'https://developer.cumtd.com/api/v2.2/json/apiMethod?key='+$scope.apiKey;
    $scope.currentStop = "PLAZA:1";
    $scope.loadStop = function(stop_id){
      $scope.currentStop = stop_id;
      var url = $scope.baseURL.replace('apiMethod','GetDeparturesByStop');
      url += '&stop_id=' + stop_id;
      $http.get(url).success(function(data){
        $scope.liveDepartures = data.departures;
      });

      url = url.replace('GetDeparturesByStop','GetStopTimesByStop');
        
      $http.get(url).then(function(data){
        $scope.schedule = data.stop_times;
      },function(data){
        console.log('Couldnt load');
      });

    };

    $scope.getRouteName = function(routeID, direction){
      for(var i=0; i<$scope.routes.length; i++){
        var route = $scope.routes[i];
        if(route.route_id === routeID){
          var routeName = route.route_short_name + ' ' + direction + ' ' + route.route_long_name;
          return routeName;
        }
      }
    };

    $scope.startServiceWorker = function(){
      if (!navigator.serviceWorker) {
        return;
      }
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        console.log(reg);
      });
    };

    $scope.startDB = function(){
      //Setup the database
      var dbPromise = idb.open('mtd-db', 3, function(upgradeDb) {
      switch(upgradeDb.oldVersion) {
          case 0:
            var routeStore = upgradeDb.createObjectStore('routes', { keyPath: 'route_id' });
            routeStore.createIndex('route_id','route_id');
            routeStore.createIndex('route_short_name','routeNumber');
          case 1:
            var routeStore = upgradeDb.transaction.objectStore('routes');
            routeStore.createIndex('routeNumber','route_short_name');
            routeStore.deleteIndex('route_short_name');
          case 2:
            var stopStore = upgradeDb.createObjectStore('stops',{keyPath : 'stop_id'});
            stopStore.createIndex('stopName','stop_name');
        }
      });

      //Load the route information into the db
      dbPromise.then(function(db){
        jQuery.get('/google_transit/routes.txt', function(data) {
          var lines = data.split('\n');
          for(var i=1;i<lines.length;i++){
            var line = lines[i].split(',');
            var tx = db.transaction('routes','readwrite');
            var routeStore = tx.objectStore('routes');
            if(line[0] !== ''){
              routeStore.put({
                route_id : line[0],
                agency_id : line[1],
                route_short_name : parseFloat(line[2]),
                route_long_name : line[3],
                route_desc : line[4],
                route_type : line[5],
                route_url : line[6],
                route_color : line[7],
                route_text_color : line[8]
              });
            }
          }
        });
      });

      //Put the stops into the database.
      dbPromise.then(function(db){
        jQuery.get('/google_transit/stops.txt', function(data) {
          var lines = data.split('\n');
          for(var i=1;i<lines.length;i++){
            var line = lines[i].split(',');
            var tx = db.transaction('stops','readwrite');
            var stopStore = tx.objectStore('stops');
            if(line[0] !== ''){
              stopStore.put({
                stop_id : line[0],
                stop_code : line[1],
                stop_desc : line[2],
                stop_lat : line[3],
                stop_lon : line[4]
              });
            }
          }
        });
      })

      //get the stops from the database
      dbPromise.then(function(db) {
        var tx = db.transaction('stops');
        var stopStore = tx.objectStore('stops');

        return stopStore.getAll();
      }).then(function(stops) {
        //After the stops are loaded, make them accessible from the search
        $scope.$apply(function(){
            $scope.stops = stops;
        });
      });

      //get the routes from the database
      dbPromise.then(function(db) {
        var tx = db.transaction('routes');
        var routeStore = tx.objectStore('routes');
        var routeNumberIndex = routeStore.index('routeNumber');
        return routeNumberIndex.getAll();
      }).then(function(routes) {
        //Put them into an array for easier grabbing.
        $scope.$apply(function(){
            $scope.routes = routes;
        });
      });
    };

    $scope.init = function(){
      $scope.startDB();
      $scope.startServiceWorker();
      $scope.loadStop($scope.currentStop);
    };

    $scope.init();

  });
