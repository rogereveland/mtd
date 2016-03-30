'use strict';

/**
 * @ngdoc overview
 * @name mtdApp
 * @description
 * # mtdApp
 *
 * Main module of the application.
 */


angular
  .module('mtdApp', [
    'ngAnimate',
    'ngAria',
    'ngCookies',
    'ngMessages',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl',
        controllerAs: 'main'
      })
      .when('/about', {
        templateUrl: 'views/about.html',
        controller: 'AboutCtrl',
        controllerAs: 'about'
      })
      .otherwise({
        redirectTo: '/'
      });
  })
  .filter('mtdTime', function(){
    return function(input) {
        var timeSuffix = 'PM';
        if(input.substring(0,1) === '0' || input.substring(0,2) === '11'){
          timeSuffix = 'AM';
        }
        var theTime = input.substring(0,5) + ' ' + timeSuffix;
        if(theTime.substring(0,1) === '0'){
          theTime = theTime.replace('0','');
        }
        if(Number(theTime.substring(0,2)) >= 13){
          var x = theTime.substring(0,2);
          var y = Number(x) - 12;
          theTime = theTime.replace(x,y);
        }
        return theTime;
    };
  })
  .filter('routeTime', function(){
    return function(input) {
      var d = new Date(input);
      console.log(d);
      var hours = d.getHours();
      var minutes = d.getMinutes();
      var suffix = 'AM'
      if(hours>12){
        hours = Number(hours) - 12;
        suffix = 'PM'
      }
      if(hours < 10){
        hours = "0" + hours;
      }
      if(minutes < 10){
        minutes = "0" + minutes;
      }
      var returnTime = hours + ":" + minutes + " " + suffix;
      return returnTime;
    };
  })
  ;
