(function () {
    "use strict";
    var trackie_module = angular.module("trackie", ["ngRoute", "ngResource", "ngCookies", "restangular"])
        .constant("CONFIG", {
            "DEBUG": false
        })
        .constant("VARS", {
            "FORBIDDEN_URL": "/forbidden"
        })
        .config(["$interpolateProvider", function ($interpolateProvider) {
            $interpolateProvider.startSymbol("{$");
            $interpolateProvider.endSymbol("$}");
        }])
        .config(["$resourceProvider", function($resourceProvider) {
            $resourceProvider.defaults.stripTrailingSlashes = false;
        }])
        .config(["$httpProvider", function ($httpProvider) {
            $httpProvider.defaults.xsrfCookieName = "csrftoken";
            $httpProvider.defaults.xsrfHeaderName = "X-CSRFToken";
        }])
        .config(["RestangularProvider", function (RestangularProvider) {
            RestangularProvider.setBaseUrl("/api/v1");
            //RestangularProvider.setRequestSuffix("/");
        }])
        .config(["$routeProvider", "$locationProvider", "VARS", function ($routeProvider, $locationProvider, VARS) {
            $routeProvider.when("/", {
                templateUrl: "main.html",
                controller: "MainController",
                reloadAfterAuthChange: true
            }).when("/404", {
                templateUrl: "partials/status/404.html"
            }).when(VARS.FORBIDDEN_URL, {
                templateUrl: "partials/status/403.html"
            }).otherwise({
                redirectTo: "/404"
            });

            $locationProvider.html5Mode(true);
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

    trackie_module.service("djangoAuth", ["$q", "$http", "$cookies", "$rootScope", "$templateCache", "$route", "$location", "VARS", function ($q, $http, $cookies, $rootScope, $templateCache, $route, $location, VARS) {
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
                            $templateCache.removeAll();
                        }
                        self.authenticated = true;
                        self.user = data;
                        defer.resolve();
                    }, function () {
                        if (self.authenticated) {
                            $templateCache.removeAll();
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
                $templateCache.removeAll();
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
                    var redirectTo  = $route.current.params.from || "/";
                    var route = $route.routes[redirectTo] || {};
                    if (route.throwAuthError){
                        if (this.authenticated) {
                            $location.url(redirectTo);
                        }
                    } else {
                        $location.url(redirectTo);
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
                }, function () {
                    $window.alert("Nedá sa odhlásiť. Skúste to neskôr.")
                });
            }
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
                    var isValid = elem.val() === secondField.val();
                    ctrl.$setValidity("sameValue", isValid);
                });
            });

            secondField.on("keyup", function () {
                scope.$apply(function () {
                    var isValid = elem.val() === secondField.val();
                    ctrl.$setValidity("sameValue", isValid);
                });
            });
        }

        return {
            require: "ngModel",
            link: link
        }
    }]);

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
}());
