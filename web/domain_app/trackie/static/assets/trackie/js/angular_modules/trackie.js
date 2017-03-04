(function () {
    "use strict";
    var trackie_module = angular.module("trackie", ["ngRoute", "ngResource", "ngCookies", "ngAnimate", "ngTouch", "restangular", "ui.grid", "ui.grid.selection", "ui.grid.saveState", "ui.grid.pagination", "naif.base64"])
        .constant("CONFIG", {
            "DEBUG": false
        })
        .constant("VARS", {
            "FORBIDDEN_URL": "/forbidden",
            "PARTIALS_REGEX": /partials\/.+/
        })
        .config(["$provide", function ($provide) {
            $provide.decorator("$templateCache", [
                "$delegate", function ($delegate) {

                    var keys = [];
                    var origPut = $delegate.put;
                    var origRemove = $delegate.remove;
                    var origRemoveAll = $delegate.removeAll;

                    $delegate.put = function (key, value) {
                        origPut(key, value);
                        keys.push(key);
                        keys = _.uniq(keys);
                    };

                    $delegate.remove = function (key) {
                        origRemove(key);
                        _.pull(keys, key);
                    };

                    $delegate.removeAll = function () {
                        origRemoveAll();
                        keys = [];
                    };

                    $delegate.getKeys = function () {
                        return keys;
                    };

                    $delegate.removeAllByKey = function (regex) {
                        var keysToDelete = _.filter($delegate.getKeys(), function(n){
                            return regex.test(n);
                        });
                        _.forEach(keysToDelete, function(key){
                            $delegate.remove(key);
                        });
                    };

                    return $delegate;
                }
            ]);
        }])
        .config(["$interpolateProvider", function ($interpolateProvider) {
            // $interpolateProvider.startSymbol("{$");
            // $interpolateProvider.endSymbol("$}");
        }])
        .config(["$resourceProvider", function($resourceProvider) {
            $resourceProvider.defaults.stripTrailingSlashes = false;
        }])
        .config(["$httpProvider", function ($httpProvider) {
            $httpProvider.defaults.xsrfCookieName = "csrftoken";
            $httpProvider.defaults.xsrfHeaderName = "X-CSRFToken";
        }])
        .config(["RestangularProvider", function (RestangularProvider) {
            RestangularProvider.setBaseUrl("/api/v1/trackie");
            RestangularProvider.setFullResponse(true);
            RestangularProvider.setRequestSuffix("/");
        }])
        .config(["$routeProvider", "$locationProvider", "VARS", function ($routeProvider, $locationProvider, VARS) {
            $routeProvider.when("/", {
                templateUrl: "partials/main.html",
                controller: "MainController",
                reloadAfterAuthChange: true
            }).when("/profile", {
                templateUrl: "partials/profile.html",
                controller: "ProfileController",
                reloadAfterAuthChange: true,
                throwAuthError: true
            }).when("/race/:id", {
                templateUrl: "partials/map.html",
                controller: "MapController"
                //reloadAfterAuthChange: true,
            }).when("/track/add", {
                templateUrl: "partials/track/create.html",
                controller: "TrackCreateController",
                reloadAfterAuthChange: true,
                throwAuthError: true
            }).when("/track/:id", {
                templateUrl: "partials/track/detail.html",
                controller: "TrackController",
                reloadAfterAuthChange: true
            }).when("/track/:id/update", {
                templateUrl: "partials/track/update.html",
                controller: "TrackUpdateController",
                reloadAfterAuthChange: true,
                throwAuthError: true
            }).when("/racer/add", {
                templateUrl: "partials/racer/create.html",
                controller: "RacerCreateController",
                reloadAfterAuthChange: true,
                throwAuthError: true
            }).when("/racer/:id", {
                templateUrl: "partials/racer/detail.html",
                controller: "RacerController"
            }).when("/racer/:id/update", {
                templateUrl: "partials/racer/update.html",
                controller: "RacerUpdateController"
            }).when("/403", {
                templateUrl: "partials/status/403.html"
            }).when("/404", {
                templateUrl: "partials/status/404.html"
            }).when(VARS.FORBIDDEN_URL, {
                templateUrl: "partials/status/403.html"
            }).otherwise({
                redirectTo: "/404"
            });

            //$locationProvider.html5Mode(true);
        }])
        .run(["$rootScope", "$location", "$route", "djangoAuth", function ($rootScope, $location, $route, djangoAuth) {
            djangoAuth.initialize();
            $rootScope.$on("$routeChangeStart", function (event, toState, toParams) {
                var state = toState.redirectTo ? $route.routes[toState.redirectTo]: toState;
                djangoAuth.authenticationStatus().then(function () {
                    djangoAuth.checkPageAuth(state.throwAuthError);
                });
            });
       }]);

    // Services

    trackie_module.service("djangoAuth", ["$q", "$http", "$cookies", "$rootScope", "$templateCache", "$location", "$routeParams", "$route", "VARS", function ($q, $http, $cookies, $rootScope, $templateCache, $location, $routeParams, $route, VARS) {
        return {
            "API_URL": "api/v1/auth",
            "use_session": true,
            "authenticated": null,
            "authPromise": null,
            "user": null,
            "request": function (args) {
                if ($cookies.token) {
                    $http.defaults.headers.common.Authorization = "Token " + $cookies.token;
                }
                args = args || {};
                var deferred = $q.defer();
                var url = this.API_URL + args.url;
                var method = args.method || "GET";
                var params = args.params || {};
                var data = args.data || {};
                $http({
                    url: url,
                    withCredentials: this.use_session,
                    method: method.toUpperCase(),
                    params: params,
                    headers: {"X-Requested-With": "XMLHttpRequest"},
                    data: data
                }).success(angular.bind(this, function (data, status) {
                    deferred.resolve(data, status);
                })).error(angular.bind(this, function (data, status, headers, config) {
                    if (data) {
                        data.status = status;
                    }
                    if (status === 0) {
                        if (data === "") {
                            data = {};
                            data.status = 0;
                            data.non_field_errors = ["Could not connect. Please try again."];
                        }
                        if (data === null) {
                            data = {};
                            data.status = 0;
                            data.non_field_errors = ["Server timed out. Please try again."];
                        }
                    }
                    deferred.reject(data, status, headers, config);
                }));
                return deferred.promise;
            },
            "register": function (username, password1, password2, email, more) {
                var data = {
                    "username": username,
                    "password1": password1,
                    "password2": password2,
                    "email": email
                };
                data = angular.extend(data, more);
                return this.request({
                    "method": "POST",
                    "url": "/registration/",
                    "data": data
                });
            },
            "login": function (username, password) {
                var djangoAuth = this;
                return this.request({
                    "method": "POST",
                    "url": "/login/",
                    "data": {
                        "username": username,
                        "password": password
                    }
                }).then(function (data) {
                    if (!djangoAuth.use_session) {
                        $http.defaults.headers.common.Authorization = "Token " + data.key;
                        $cookies.token = data.key;
                    }
                    djangoAuth.authenticated = true;
                    djangoAuth.user = data.user;
                    djangoAuth.changedAuth();
                    $rootScope.$broadcast("djangoAuth.logged_in", data);
                });
            },
            "logout": function () {
                var djangoAuth = this;
                return this.request({
                    "method": "POST",
                    "url": "/logout/"
                }).then(function () {
                    delete $http.defaults.headers.common.Authorization;
                    delete $cookies.token;
                    // delete $cookies.sessionid;
                    djangoAuth.authenticated = false;
                    djangoAuth.user = null;
                    djangoAuth.changedAuth();
                    $rootScope.$broadcast("djangoAuth.logged_out");
                });
            },
            "changePassword": function (password1, password2) {
                return this.request({
                    "method": "POST",
                    "url": "/password/change/",
                    "data": {
                        "new_password1": password1,
                        "new_password2": password2
                    }
                });
            },
            "resetPassword": function (email) {
                return this.request({
                    "method": "POST",
                    "url": "/password/reset/",
                    "data": {
                        "email": email
                    }
                });
            },
            "profile": function () {
                return this.request({
                    "method": "GET",
                    "url": "/user/"
                });
            },
            "updateProfile": function (data) {
                return this.request({
                    "method": "PATCH",
                    "url": "/user/",
                    "data": data
                });
            },
            "verify": function (key) {
                return this.request({
                    "method": "POST",
                    "url": "/registration/verify-email/",
                    "data": {"key": key}
                });
            },
            "confirmReset": function (uid, token, password1, password2) {
                return this.request({
                    "method": "POST",
                    "url": "/password/reset/confirm/",
                    "data": {
                        "uid": uid,
                        "token": token,
                        "new_password1": password1,
                        "new_password2": password2
                    }
                });
            },
            "authenticationStatus": function (restrict, force) {
                restrict = restrict || false;
                force = force || false;
                if (this.authPromise === null || force) {
                    this.authPromise = this.profile();
                }
                var self = this;
                var defer = $q.defer();
                if (this.authenticated !== null && !force) {
                    if (this.authenticated === false && restrict) {
                        defer.reject("User is not logged in.");
                    } else {
                        defer.resolve();
                    }
                } else {
                    this.authPromise.then(function (data) {
                        if (!self.authenticated) {
                            $templateCache.removeAllByKey(VARS.PARTIALS_REGEX);
                        }
                        self.authenticated = true;
                        self.user = data;
                        defer.resolve();
                    }, function () {
                        if (self.authenticated) {
                            $templateCache.removeAllByKey(VARS.PARTIALS_REGEX);
                        }
                        self.authenticated = false;
                        self.user = null;
                        if (restrict) {
                            defer.reject("User is not logged in.");
                        } else {
                            defer.resolve();
                        }
                    });
                }
                return defer.promise;
            },
            "changedAuth": function () {
                $templateCache.removeAllByKey(VARS.PARTIALS_REGEX);
                var route = $route.current.redirectTo ? $route.routes[$route.current.redirectTo] : $route.current;
                this.checkPageAuth(route.throwAuthError, route.reloadAfterAuthChange);
            },
            "checkPageAuth": function (throwAuthError, reload) {
                var currentPath = $location.path() || "/";

                if (currentPath !== VARS.FORBIDDEN_URL) {
                    if (throwAuthError && !this.authenticated) {
                        $location.path("/forbidden");
                        $location.search("from", currentPath);
                    } else if (reload) {
                        $route.reload();
                    }
                } else {
                    // TODO refactor 25.02. 2017
                    var from  = $route.current.params.from || "/";
                    // not good for dynamic routes like /tracks/:id
                    var route = $route.routes[from] || {};
                    if (route.throwAuthError){
                        if (this.authenticated) {
                            $location.url(from);
                        }
                    } else {
                        $location.url(from);
                    }
                }
            },
            "initialize": function (url, sessions) {
                this.API_URL = url || this.API_URL;
                this.use_session = sessions || this.use_session;
                return this.authenticationStatus();
            }
        };
    }]);

    // Factories

    trackie_module.factory("OLMap", [function () {
        function OLMapFactory(target) {
            this.target = target;
            this.sources = {};
            this.sidebar = null;
            this.layers = {
                "tile": new ol.layer.Tile({
                    source: new ol.source.OSM()
                })
            };
            this.style = {
                "Point": new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: null,
                        stroke: new ol.style.Stroke({
                            color: [255, 0, 0],
                            width: 1
                        })
                    })
                }),
                "Point_unselected": new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: null,
                        stroke: new ol.style.Stroke({
                            color: [255, 0, 0, 0.5],
                            width: 1
                        })
                    })
                }),
                "LineString": new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: "green",
                        width: 1
                    })
                }),
                "MultiLineString": new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: "green",
                        width: 1
                    })
                })
            };
            this.map = new ol.Map({
                target: this.target,
                layers: [
                    this.layers.tile
                ],
                view: new ol.View({
                    center: [0, 0],
                    zoom: 1
                })
            });
        }

        OLMapFactory.prototype.addVectorLayer = function (options) {
            var name = options.name;
            var source = !options["source"] ? new ol.source.Vector() : options.source;
            var style = options["style"] ? options["style"] : undefined;

            var layer = new ol.layer.Vector({
                source: source,
                style: style
            });

            this.sources[name] = source;
            this.layers[name] = layer;
            this.map.addLayer(layer);
            window.map = this.map;

            return layer;
        };

        OLMapFactory.prototype.addSidebar = function(options){
            this.sidebar = new ol.control.Sidebar(options);
            this.map.addControl(this.sidebar);
        };

        OLMapFactory.prototype.fitBySource = function (name) {
            this.map.getView().fit(this.sources[name].getExtent());
        };

        return OLMapFactory;
    }]);

    // Directives

    trackie_module.directive("loginModal", ["djangoAuth", "$window", function (djangoAuth, $window) {
        function link(scope, element) {
            scope.djangoAuth = djangoAuth;
            scope.login = function (username, password) {
                djangoAuth.login(username, password).then(function () {
                    element.find("#login-modal").removeClass("in").hide();
                    element.find("#login-modal-backdrop").fadeOut().removeClass("in");
                }, function (error) {
                    renderFormErrors(element.find("form"), error);
                });
            };
            scope.logout = function () {
                djangoAuth.logout().then(function () {
                    //TODO: todo (todoception)
                }, function () {
                    $window.alert("Nedá sa odhlásiť. Skúste to neskôr.");
                });
            };
        }

        return {
            link: link,
            restrict: "AE",
            templateUrl: "partials/login.html",
            scope: {}
        };
    }]);

    trackie_module.directive("sameValueAs", [function () {
        function link(scope, elem, attrs, ctrl) {
            var secondField = elem.parents("form").find("#" + attrs.sameValueAs);

            elem.on("keyup", function () {
                scope.$apply(function () {
                    var ngField = ctrl.$$parentForm[secondField.attr("name")];
                    var isValid = (ctrl.$pristine || ngField.$pristine) ? true : elem.val() === secondField.val();
                    ctrl.$setValidity("sameValue", isValid);
                    ngField.$setValidity("sameValue", isValid);
                });
            });

            secondField.on("keyup", function () {
                scope.$apply(function () {
                    var ngField = ctrl.$$parentForm[secondField.attr("name")];
                    var isValid = (ctrl.$pristine || ngField.$pristine) ? true : elem.val() === secondField.val()
                    ctrl.$setValidity("sameValue", isValid);
                    ngField.$setValidity("sameValue", isValid);
                });
            });
        }

        return {
            require: "ngModel",
            link: link
        };
    }]);

    trackie_module.directive("validFile", function () {
        return {
            require: "ngModel",
            link: function (scope, el, attrs, ngModel) {
                //change event is fired when file is selected
                el.bind("change", function () {
                    scope.$apply(function () {
                        ngModel.$setViewValue(el.val());
                        ngModel.$render();
                    });
                });
            }
        }
    });

    // Controllers

    trackie_module.controller("MainController", ["$scope", "djangoAuth", "Restangular", function ($scope, djangoAuth, Restangular) {
        $scope.register = function (username, pass1, pass2, email) {
            djangoAuth.register(username, pass1, pass2, email).then(function (data) {
                djangoAuth.authenticationStatus(false, true).then(function () {
                    djangoAuth.changedAuth();
                });
            }, function (error) {
                renderFormErrors($("#registration-form"), error, "id_");
            });
        }
    }]);

    trackie_module.controller("ProfileController", ["$scope", "djangoAuth", "Restangular" ,function($scope, djangoAuth, Restangular){
        Restangular.all("auth").customGET("user/").then(function(user){
            $scope.user = user;
        });
    }]);

    trackie_module.controller("MapController", ["$scope", "$location", "$routeParams", "$interval", "Restangular", "OLMap", function($scope, $location, $routeParams, $interval, Restangular, OLMap){
        function highlight_racers(scope, ol_source) {
            if (!scope.gridApi) return;
            var selected = scope.gridApi.selection.getSelectedRows();
            var selectedIds = [];
            _.forEach(selected, function (i) {
                selectedIds.push(i.id);
            });
            ol_source.forEachFeature(function (i) {
                if (selected.length == 0 || _.indexOf(selectedIds, i.getId()) == -1) {
                    i.setProperties({"$hide": false});
                } else {
                    i.setProperties({"$hide": true});
                }
            });
        }

        function get_race_data(promise, scope, ol_source, projection) {
            promise.get().then(function (race_data) {
                if (race_data.status == 204) {
                    $interval.cancel(scope.data_interval);
                    console.log("Race stream has been ended");
                    // TODO inform users about finished race
                    return;
                }
                scope.race_data = race_data.data;
                scope.gridOptions.data = race_data.data.features;
                ol_source.clear();

                var format = new ol.format.GeoJSON();
                var features = format.readFeatures(race_data.data, {featureProjection: projection});
                ol_source.addFeatures(features);

                highlight_racers(scope, ol_source);
            }, function(response) {
                console.log(response);
            });
        }

        $scope.map = new OLMap("map");
        $scope.map.addVectorLayer({name: "track"});
        $scope.map.addVectorLayer({
            name: "data",
            style: function (feature) {
                var type = feature.getGeometry().getType();
                if (feature.getProperties()["$hide"]) {
                    type += "_unselected";
                }
                return $scope.map.style[type];
            }
        });
        $scope.map.addSidebar({element: "sidebar", position: "left"});

        $scope.gridOptions = {
            primaryKey: "properties.racer.number",
            enableRowSelection: true,
            multiSelect: true,
            enableSelectAll: true,
            paginationPageSizes: false,
            paginationPageSize: 10,
            rowIdentity: function (row) {
                return row.properties.racer.number;
            },
            onRegisterApi: function(gridApi){
                $scope.gridApi = gridApi;
                $scope.gridApi.selection.on.rowSelectionChanged($scope, function(){
                    highlight_racers($scope, $scope.map.sources["data"]);
                });
                $scope.gridApi.selection.on.rowSelectionChangedBatch($scope, function(){
                    highlight_racers($scope, $scope.map.sources["data"]);
                });
            },
            columnDefs: [
                {name:"Číslo", field: "properties.racer.number"},
                {name:"Meno", field: "properties.racer.first_name"},
                {name:"Priezvisko", field: "properties.racer.last_name"},
                {name:"Čas", field: "properties.data.time"}
            ]
        };

        var race = Restangular.one("races", $routeParams.id);
        race.get().then(function(response){
            var projection = response.data.projection ? response.data.projection.code : "EPSG:3857";
            $scope.race = response.data;

            Restangular.oneUrl("tracks", $scope.race.track.file).get().then(function(json){
                var format = new ol.format.GPX();
                var features = format.readFeatures(json.data, {featureProjection: projection});
                var promise = race.one("data");

                $scope.map.sources["track"].addFeatures(features);
                $scope.map.fitBySource("track");

                get_race_data(promise, $scope, $scope.map.sources["data"], projection);
                if (!response.data.end) {
                    $scope.data_interval = $interval(function () {
                        get_race_data(promise, $scope, $scope.map.sources["data"], projection);
                    }, 5000);

                    $scope.$on("$destroy", function(){
                        $interval.cancel($scope.data_interval);
                    })
                }
            });
        }, function(error){
            if (error.status.toString()[0] == 4){ //4xx
                $location.url("/" + error.status + "?from="+$location.path());
            }
        });
    }]);

    trackie_module.controller("TrackCreateController", ["$scope", "$location", "Restangular", function($scope, $location, Restangular){
        $scope.trackForm = {};

        $scope.createTrack = function () {
            var data = angular.copy($scope.trackForm.data);
            data["file"] = data["file"] ? data["file"]["base64"] : null;
            Restangular.all("tracks").post(data).then(function(response){
                $location.path("/track/"+response.data.id);
            }, function(error){
                renderFormErrors($("#track-form"), error.data, "id_");
            });
        }
    }]);

    trackie_module.controller("TrackController", ["$scope", "$location", "$routeParams", "Restangular", "djangoAuth", "OLMap", function ($scope, $location, $routeParams, Restangular, djangoAuth, OLMap) {
        $scope.deleteTrack = function(){
            $scope.track.remove().then(function (response) {
                $location.path("/");
            }, function (error) {
                if (error.status.toString()[0] == 4){ //4xx
                    $location.url("/" + error.status + "?from="+$location.path());
                }
            })
        };

        $scope.map = new OLMap("track-map");
        $scope.map.addVectorLayer({name: "track"});

        djangoAuth.authenticationStatus().then(function(){
            $scope.user = djangoAuth.user;
        });

        $scope.track_source = Restangular.one("tracks", $routeParams.id);
        $scope.track_source.get().then(function (response) {
            $scope.track = response.data;
            Restangular.oneUrl("tracks", response.data.file).get().then(function (file) {
                var format = new ol.format.GPX();
                var features = format.readFeatures(file.data, {featureProjection: "EPSG:3857"});

                $scope.map.sources["track"].addFeatures(features);
                $scope.map.fitBySource("track");
            })
        }, function (error) {
            if (error.status.toString()[0] == 4){ //4xx
                $location.url("/" + error.status + "?from="+$location.path());
            }
        });
    }]);

    trackie_module.controller("TrackUpdateController", ["$scope", "$location", "$routeParams", "Restangular", function($scope, $location, $routeParams, Restangular){
        $scope.updateTrack = function(){
            $scope.track = angular.extend($scope.track, $scope.trackForm.data);
            $scope.track.put().then(function (response) {
                $location.path("/track/" + response.data.id);
            }, function (error) {
                if (error.status.toString()[0] == 4){ //4xx
                    $location.url("/" + error.status + "?from="+$location.path());
                }
            })
        };

        Restangular.one("tracks", $routeParams.id).get().then(function(response){
            $scope.track = response.data;
            $scope.trackForm.data = response.data.plain();
        }, function(error){
            if (error.status.toString()[0] == 4){ //4xx
                $location.url("/" + error.status + "?from="+$location.path());
            }
        });
    }]);

    trackie_module.controller("RacerCreateController", ["$scope", "$location", "Restangular", function($scope, $location, Restangular){
        $scope.racerForm = {};

        $scope.createRacer = function () {
            var data = angular.copy($scope.racerForm.data);
            data["photo"] = data["photo"] ? data["photo"]["base64"] : null;
            Restangular.all("racers").post(data).then(function(response){
                $location.path("/racer/"+response.data.id);
            }, function(error){
                renderFormErrors($("#racer-form"), error.data, "id_");
            });
        }
    }]);

    trackie_module.controller("RacerController", ["$scope", "$location", "$routeParams", "Restangular", "djangoAuth", function ($scope, $location, $routeParams, Restangular, djangoAuth) {
        djangoAuth.authenticationStatus().then(function(){
            $scope.auth = djangoAuth;
        });

        $scope.racer_source = Restangular.one("racers", $routeParams.id);
        $scope.racer_source.get().then(function (response) {
            $scope.racer = response.data;
        }, function (error) {
            if (error.status.toString()[0] == 4){ //4xx
                $location.url("/" + error.status + "?from="+$location.path());
            }
        });
    }]);

    trackie_module.controller("RacerUpdateController", ["$scope", "$location", "$routeParams", "Restangular", function($scope, $location, $routeParams, Restangular){
        $scope.updateRacer = function(){
            $scope.racer = angular.extend($scope.racer, $scope.racerForm.data);
            if (!$scope.racerForm.data["photo"]["base64"]){
                 delete $scope.racer["photo"];
                $scope.racer.patch().then(function (response) {
                    $location.path("/racer/" + response.data.id);
                }, function (error) {
                   renderFormErrors($("#racer-form"), error.data, "id_");
                });
            } else {
                $scope.racer.photo = $scope.racer.photo["base64"];
                $scope.racer.put().then(function (response) {
                    $location.path("/racer/" + response.data.id);
                }, function (error) {
                    renderFormErrors($("#racer-form"), error.data, "id_");
                });
            }
        };

        Restangular.one("racers", $routeParams.id).get().then(function(response){
            $scope.racer = response.data;
            $scope.racerForm.data = response.data.plain();
        }, function(error){
            if (error.status.toString()[0] == 4){ //4xx
                $location.url("/" + error.status + "?from="+$location.path());
            }
        });
    }]);
}());
