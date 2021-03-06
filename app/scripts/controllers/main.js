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
  .controller('MainCtrl', function ($scope, $http, $interval, $q) {

    //Setup our initial variables. Using a few variables as "flags" to control what gets displayed.
    $scope.routes = [];
    $scope.stops = [];
    $scope.liveDepartures = [];
    $scope.schedule = [];
    $scope.tripInfo = [];
    $scope.searchTextDepart = "Transit Plaza";
    $scope.searchTextArrive = "Church & Elm (SE Corner)";
    $scope.apiKey = "352b4714e2ef4f7ba0f8b5f9f6267745";
    $scope.baseURL = 'https://developer.cumtd.com/api/v2.2/json/apiMethod?key='+$scope.apiKey;
    $scope.currentDepartStop = "";
    $scope.currentArriveStop = "CHCHELM:2";
    $scope.dbPromise = "";
    $scope.loadFromFile = 0;
    $scope.updateAlert = false;
    $scope.worker = "";

    //This will send a message to our service worker, letting it know the user wants to update
    $scope.postMessage = function(){
      $scope.worker.postMessage({action: 'skipWaiting'});
      $scope.updateAlert = false;
    };

    /*
      This gets called when a new version of the service worker is found, it shows an alert to the user
      informing them that theres a new version. Have to wrap the updateAlert in $scope.$apply to get the
      view to properly update
    */
    $scope.updateReady = function(worker){
      $scope.$apply(function(){
          $scope.updateAlert = true;
      });
      $scope.worker = worker;
    };

    /*
      This gets called during the initialization of the service worker, it tracks any incoming updates
      to the service worker
    */
    $scope.trackInstalling = function(worker){
      worker.addEventListener('statechange', function() {
        if (worker.state === 'installed') {
          $scope.updateReady(worker);
        }
      });
    };


    /*
      This function gets called once at startup and then when a user clicks on a stop.
      It will update which stop is the current one and then load the functions to get schedules
    */
    $scope.changeStop = function(stop_id){
        $scope.currentDepartStop = stop_id;
        $scope.schedule = [];
        $scope.liveDepartures = [];
        $scope.loadStop();
        $scope.loadSchedule();
    };

    // This function gets the live data for the stop from the online API
    $scope.loadStop = function(){
      var url = $scope.baseURL.replace('apiMethod','GetDeparturesByStop');
      url += '&stop_id=' + $scope.currentDepartStop;

      $http.get(url).success(function(data){
        $scope.liveDepartures = data.departures;
      });
    };

    /*
      This function gets the static schedule of departure times from the database.
      It then updates the database with the updated schedule for this stop.
    */
    $scope.loadSchedule = function(){
      var url = $scope.baseURL.replace('apiMethod','GetStopTimesByStop');
      url += '&stop_id=' + $scope.currentDepartStop;

      $scope.dbPromise.then(function(db){
        var tx = db.transaction('schedules', 'readwrite');
        var scheduleStore = tx.objectStore('schedules');
        var scheduleIndex = scheduleStore.index('stop_id');

        return scheduleIndex.getAll($scope.currentDepartStop);
      }).then(function(schedules){
        if(schedules.length > 0){
          $scope.$apply(function(){
              $scope.schedule = schedules[0].stop_times;
          });
        }
      });


      $http.get(url).then(function(res){
        var data = res.data;
        $scope.schedule = data.stop_times;
        $scope.dbPromise.then(function(db){
          var tx = db.transaction('schedules', 'readwrite');
          var scheduleStore = tx.objectStore('schedules');
          scheduleStore.put({
            stop_id : $scope.currentDepartStop,
            stop_times : data.stop_times
          });
        });
      },function(err){

      });


    };

    //Since the route name isn't kept with the stops and departures, we have to get it from our db of route names
    $scope.getRouteName = function(routeID, direction){
      for(var i=0; i<$scope.routes.length; i++){
        var route = $scope.routes[i];
        if(route.route_id === routeID){
          var routeName = route.route_short_name + ' ' + direction + ' ' + route.route_long_name;
          return routeName;
        }
      }
    };

    /*
      This function starts up the service worker and it's helper functions. This code was developed
      in the Offline First course and reused here.
    */

    $scope.startServiceWorker = function(){
      if (!navigator.serviceWorker) {
        return;
      }
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        if (reg.waiting) {
          $scope.updateReady(reg.waiting);
          return;
        }

        if (reg.installing) {
          $scope.trackInstalling(reg.installing);
          return;
        }

        reg.addEventListener('updatefound', function() {
          $scope.trackInstalling(reg.installing);
        });

        //Code taken from the Offline First course
        var refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', function() {
          if (refreshing) {return;}
          window.location.reload();
          refreshing = true;
        });

      });
    };

    /*
      This function sets up the Database and returns a handle we can use in other functions
      to access the database.
    */

    $scope.openDB = function(){
      //Setup the database
      var deferred = $q.defer();
      var dbPromise = idb.open('mtd-db', 6, function(upgradeDb) {
      var importData = 0;
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
          case 3:
            var scheduleStore = upgradeDb.createObjectStore('schedules', {keyPath : 'stop_id'});
          case 4:
            var scheduleStore = upgradeDb.transaction.objectStore('schedules');
            scheduleStore.createIndex('stop_id','stop_id');
          case 5:
            $scope.loadFromFile = 1;
        }
        deferred.resolve();
      });

      return dbPromise;

    };
    /*
      If the database is empty, or in the future we need to update it with content
      this function will read the GTFS files and put them into the datbase.
    */
    $scope.loadFiles = function(){
      var deferred = $q.defer();
      $http.get('/google_transit/routes.txt').then(function(res) {
        var lines = res.data.split('\n');
        $scope.dbPromise.then(function(db){
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
      }).then(function(){
        $http.get('/google_transit/stops.txt').then(function(res){
          var lines = res.data.split('\n');
          $scope.dbPromise.then(function(db){
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
            deferred.resolve();
          });
        });
      });
      return deferred.promise;
    };

    //This function gets the routes from the database.
    $scope.getRoutesFromDB = function(){
      var deferred = $q.defer();
      $scope.dbPromise.then(function(db) {
        var tx = db.transaction('routes');
        var routeStore = tx.objectStore('routes');
        var routeNumberIndex = routeStore.index('routeNumber');
        return routeNumberIndex.getAll();
      }).then(function(routes) {
        //Put them into an array for easier grabbing.
        $scope.$apply(function(){
            $scope.routes = routes;
            deferred.resolve(routes);
        });
      });
      return deferred.promise;
    };

    //This function gets the stops from the database so we can use them in our stops search
    $scope.getStopsFromDB = function(){
      var deferred = $q.defer();
      $scope.dbPromise.then(function(db) {
        var tx = db.transaction('stops');
        var stopStore = tx.objectStore('stops');
        return stopStore.getAll();
      }).then(function(stops) {
        //After the stops are loaded, make them accessible from the search
        $scope.$apply(function(){
            $scope.stops = stops;
            deferred.resolve(stops);
        });
      });
      return deferred.promise;
    };
    //This is kind of a silly function, but if we don't use a function to set the stop, the view doesn't update properly.
    $scope.setArrival = function(stop){
      $scope.currentArriveStop = stop.stop_id;
      $scope.searchTextArrive = stop.stop_desc;
    };


    //This function will fetch the trip information from the server and display it in the box.
    $scope.calculateRoute = function(){
      $scope.tripInfo = [];
      var url = $scope.baseURL.replace('apiMethod','GetPlannedTripsByStops');
      url += '&origin_stop_id=' + $scope.currentDepartStop;
      url += '&destination_stop_id=' + $scope.currentArriveStop;
      url += '&time=09:00';
      $http.get(url).then(function(res){
        $scope.tripInfo = res.data.itineraries;
        console.log($scope.tripInfo)
      });
    };

    //The initialization function that sets up our app.
    $scope.init = function(){
      //Start the service worker...
      $scope.startServiceWorker();
      //Setup the database...
      $scope.dbPromise = $scope.openDB();
      //Get the data into a usable state by first checking if we have routes in the DB...
      $scope.getRoutesFromDB().then(function(routes){
        if(routes.length === 0){
          //if the db is empty we need to read the files and then load our variables.
          $scope.loadFiles().then(function(){
            return $scope.getRoutesFromDB();
          }).then(function(){
            return $scope.getStopsFromDB();
          });
        } else {
            //if the db has data, load it!
            return $scope.getStopsFromDB();
        }
      }).then(function(){
        //Then load up our initial bus stop and schedule and set it to check for departures every minute
        $scope.changeStop("PLAZA:1");
        $scope.loadSchedule();
        $scope.calculateRoute();

        //$interval($scope.loadStop,60000);
      });
    };

    $scope.init();

  });
