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
    $scope.currentStop = "";
    $scope.dbPromise = "";
    $scope.loadFromFile = 0;

    $scope.changeStop = function(stop_id){
        $scope.currentStop = stop_id;
        $scope.schedule = [];
        $scope.liveDepartures = [];
        $scope.loadStop();
        $scope.loadSchedule();
    }

    $scope.loadStop = function(){
      var url = $scope.baseURL.replace('apiMethod','GetDeparturesByStop');
      url += '&stop_id=' + $scope.currentStop;

      $http.get(url).success(function(data){
        $scope.liveDepartures = data.departures;
      });
    };

    $scope.loadSchedule = function(){
      var url = $scope.baseURL.replace('apiMethod','GetStopTimesByStop');
      url += '&stop_id=' + $scope.currentStop;

      $scope.dbPromise.then(function(db){
        var tx = db.transaction('schedules', 'readwrite');
        var scheduleStore = tx.objectStore('schedules');
        var scheduleIndex = scheduleStore.index('stop_id');

        return scheduleIndex.getAll($scope.currentStop);
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
            stop_id : $scope.currentStop,
            stop_times : data.stop_times
          });
        });
      },function(err){

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
      });
    };

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

    $scope.init = function(){
      $scope.startServiceWorker();
      $scope.dbPromise = $scope.openDB();
      $scope.getRoutesFromDB().then(function(routes){
        if(routes.length == 0){
          $scope.loadFiles().then(function(){
            return $scope.getRoutesFromDB();
          }).then(function(){
            return $scope.getStopsFromDB();
          });
        } else {
            return $scope.getStopsFromDB();
        }
      }).then(function(){
        $scope.changeStop("PLAZA:1");
        $scope.loadSchedule();
        //$interval($scope.loadStop,60000);
      });
      //
      /*
      $scope.openDB().then(function(){
        if($scope.loadFromFile == 1){
          $scope.loadFiles()
        } else {
          return;
        }

      }).then(function(){
        //return $scope.getRoutesFromDB();
      });
      */
      /*
      $scope.openDB().then(function(dbPromise){
        $scope.dbPromise = dbPromise;
        console.log(dbPromise);
        if($scope.loadFromFile == 1){
          return $scope.loadFiles();
        } else {
          return;
        }
      }).then(function(){
        return $scope.getRoutesFromDB();
      });
      */
      /*
      console.log('im checking now');
      console.log($scope.loadFromFile);
      if($scope.loadFromFile == 1){
        $scope.loadFiles();
      }
      */
      /*
      $scope.dbPromise.then(function(){
        $scope.getRoutesFromDB().then(function(){
          $scope.getStopsFromDB().then(function(){
            $scope.changeStop("PLAZA:1");
            $scope.loadSchedule();
            $interval($scope.loadStop,60000);
          });
        });
      });
      */
    };

    $scope.init();

  });
