﻿(function (root) {

    var packageName = 'Terratype';

    if (!root.terratype) {
        root.terratype = {
            loading: false,
            providers: {}
        };
    }

    angular.module('umbraco').directive('terratypeJson', function () {
        return {
            restrict: 'A', // only activate on element attribute
            require: 'ngModel', // get a hold of NgModelController
            link: function (scope, element, attrs, ngModelCtrl) {

                var lastValid;

                // push() if faster than unshift(), and avail. in IE8 and earlier (unshift isn't)
                ngModelCtrl.$parsers.push(fromUser);
                ngModelCtrl.$formatters.push(toUser);

                // clear any invalid changes on blur
                element.bind('blur', function () {
                    element.val(toUser(scope.$eval(attrs.ngModel)));
                });

                // $watch(attrs.ngModel) wouldn't work if this directive created a new scope;
                // see http://stackoverflow.com/questions/14693052/watch-ngmodel-from-inside-directive-using-isolate-scope how to do it then
                scope.$watch(attrs.ngModel, function (newValue, oldValue) {
                    lastValid = lastValid || newValue;

                    if (newValue != oldValue) {
                        ngModelCtrl.$setViewValue(toUser(newValue));

                        // TODO avoid this causing the focus of the input to be lost
                        ngModelCtrl.$render();
                    }
                }, true); // MUST use objectEquality (true) here, for some reason

                function fromUser(text) {
                    // Beware: trim() is not available in old browsers
                    if (!text || text.trim() === '') {
                        return {};
                    } else {
                        try {
                            lastValid = angular.fromJson(text);
                            ngModelCtrl.$setValidity('invalidJson', true);
                        } catch (e) {
                            ngModelCtrl.$setValidity('invalidJson', false);
                        }
                        return lastValid;
                    }
                }

                function toUser(object) {
                    // better than JSON.stringify(), because it formats + filters $$hashKey etc.
                    return angular.toJson(object, true);
                }
            }
        };
    });


    //  Display language values that contain {{}} variables.
    angular.module("umbraco.directives").directive('terratypeTranslate', ['$compile', 'localizationService', function ($compile, localizationService) {
        return function (scope, element, attr) {
            attr.$observe('terratypeTranslate', function (key) {
                localizationService.localize(key).then(function (value) {
                    var c = $compile('<span>' + value + '</span>')(scope);
                    element.append(c);
                });
            })
        }
    }]);

    angular.module('umbraco').controller('terratype', ['$scope', '$timeout', '$http', '$injector', 'localizationService', function ($scope, $timeout, $http, $injector, localizationService) {
        $scope.config = null;
        $scope.store = null;
        $scope.vm = function () {
            return $scope.terratype;
        };

        $scope.terratype = {
            urlProvider: function (id, file, cache) {
                var r = Umbraco.Sys.ServerVariables.umbracoSettings.appPluginsPath + '/' + id + '/' + file;
                if (cache == true) {
                    r += '?cache=1.0.5';
                }
                return r;
            },
            images: {
                loading: Umbraco.Sys.ServerVariables.umbracoSettings.umbracoPath + '/assets/img/loader.gif',
                failed: Umbraco.Sys.ServerVariables.umbracoSettings.umbracoPath + '/images/false.png',
                success: Umbraco.Sys.ServerVariables.umbracoSettings.umbracoPath + '/images/true.png',
            },
            loading: true,
            configgering: false,
            controller: function (a) {
                return Umbraco.Sys.ServerVariables.umbracoSettings.umbracoPath + '/backoffice/' + packageName + '/ajax/' + a;
            },
            poll: 250,
            identifier: $scope.$id + (new Date().getTime()),
            error: null,
            isPreview: false,
            position: [],
            providers: [],
            provider: {
                id: null,
                referenceUrl: null,
                name: null
            },
            label: {},
            labels: [],
            mapId: function (array, id) {
                for (var i = 0; i != array.length; i++) {
                    if (array[i].id == id) {
                        return i;
                    }
                }
                return -1;
            },
            translate: function (m) {
                localizationService.localize(m.name).then(function (value) {
                    m.name = value;
                });
                localizationService.localize(m.description).then(function (value) {
                    m.description = value;
                });
                if (m.referenceUrl) {
                    localizationService.localize(m.referenceUrl).then(function (value) {
                        m.referenceUrl = value;
                    });
                }
            },
            initLabels: function (done) {
                $http.get($scope.vm().controller('labels')).then(function success(response) {
                    angular.forEach(response.data, function (m) {
                        $scope.vm().translate(m);
                        $scope.vm().setLabelView(m);
                    });
                    $timeout(function () {
                        $scope.vm().labels = response.data;
                        done();
                    });
                });
            },
            setLabelView: function (m) {
                if (!m.view) {
                    m.view = $scope.vm().urlProvider(packageName, 'views/label.' + m.id + '.html', true);
                }
                if (!m.controller) {
                    m.controller = 'terratype.label.' + m.id;
                }
            },
            initConfig: function () {
                $scope.vm().configgering = true;
                $scope.vm().initLabels(function () {
                    if (typeof ($scope.model.value) === 'string') {
                        $scope.model.value = ($scope.model.value != '') ? JSON.parse($scope.model.value) : {};
                    }
                    $scope.config = function () {
                        return $scope.model.value.config;
                    }
                    $scope.store = function () {
                        return $scope.model.value;
                    }

                    $scope.vm().setIcon();
                    $http.get($scope.vm().controller('providers')).then(function success(response) {
                        angular.forEach(response.data, function (p) {
                            $scope.vm().translate(p);
                            angular.forEach(p.coordinateSystems, function (c) {
                                $scope.vm().translate(c);
                            });
                        });
                        $timeout(function () {
                            $scope.vm().providers = response.data;

                            if ($scope.config && $scope.config().provider && $scope.config().provider.id != null) {
                                $scope.vm().setProvider($scope.config().provider.id);
                            }
                            $timeout(function () {
                                $scope.vm().loading = false;
                            });
                        })
                    }, function error(response) {
                        $scope.vm().loading = false;
                    });
                });
            },
            loadProvider: function (id, done) {
                var wait = setInterval(function () {
                    if (!root.terratype.loading) {
                        clearInterval(wait);

                        if (!angular.isUndefined(root.terratype.providers[id])) {
                            done();
                        } else {
                            root.terratype.loading = true;
                            var script = $scope.vm().urlProvider(id, 'scripts/' + id + '.js', true);
                            LazyLoad.js(script, function () {
                                $timeout(function () {
                                    if (angular.isUndefined(root.terratype.providers[id])) {
                                        throw script + ' does not define global variable root.terratype.providers[\'' + id + '\']';
                                    }
                                    root.terratype.providers[id].script = script;
                                    done(id);
                                    root.terratype.loading = false;
                                });
                            });
                        }
                    }
                }, $scope.vm().poll);
            },
            setIcon: function () {
                if ($scope.config().icon && $scope.config().icon.id) {
                    $scope.vm().iconPredefineChangeInternal($scope.config().icon.id);
                }
                $scope.vm().iconAnchor();
                if ($scope.config().icon && !$scope.config().icon.id) {
                    $scope.vm().iconCustom();
                }
            },
            setProvider: function (id) {
                var index = $scope.vm().mapId($scope.vm().providers, id);
                if (index == -1) {
                    //  Asked for a provider we don't have
                    return;
                }
                $scope.vm().loadProvider(id, function () {
                    $scope.vm().providers[index] = angular.extend($scope.vm().providers[index], root.terratype.providers[id]);
                    $scope.vm().providers[index].events = $scope.vm().providers[index].init($scope.vm().identifier, $scope.vm().urlProvider,
                        $scope.store, $scope.config, $scope.vm, function () {
                            $scope.$apply();
                        });
                    $scope.vm().provider = $scope.vm().providers[index];
                    $scope.vm().provider.events.setProvider();
                    if ($scope.store().position && $scope.store().position.id != null) {
                        $scope.vm().setCoordinateSystem($scope.store().position.id);
                    }
                });
            },
            setCoordinateSystem: function (id) {
                var index = $scope.vm().mapId($scope.vm().provider.coordinateSystems, id);
                $scope.vm().position = (index != -1) ? angular.copy($scope.vm().provider.coordinateSystems[index]) : { id: null, referenceUrl: null, name: null, datum: null, precision: 6 };
                if ($scope.vm().configgering) {
                    $scope.store().position.precision = $scope.vm().position.precision;
                }
                $scope.vm().provider.events.setCoordinateSystem();
            },
            setLabel: function (id) {
                if (id) {
                    var index = $scope.vm().mapId($scope.vm().labels, id);
                    if (index == -1) {
                        index = 0;
                    }
                    $scope.vm().label = $scope.vm().labels[index];
                }
                angular.extend($scope.vm().label, $scope.store().label);
                $scope.vm().provider.events.labelChange($scope.vm().label);
            },
            iconAnchor: function () {
                if (isNaN($scope.config().icon.anchor.horizontal)) {
                    $scope.vm().icon.anchor.horizontal.isManual = false;
                    $scope.vm().icon.anchor.horizontal.automatic = $scope.config().icon.anchor.horizontal;
                } else {
                    $scope.vm().icon.anchor.horizontal.isManual = true;
                    $scope.vm().icon.anchor.horizontal.manual = $scope.config().icon.anchor.horizontal;
                }
                if (isNaN($scope.config().icon.anchor.vertical)) {
                    $scope.vm().icon.anchor.vertical.isManual = false;
                    $scope.vm().icon.anchor.vertical.automatic = $scope.config().icon.anchor.vertical;
                } else {
                    $scope.vm().icon.anchor.vertical.isManual = true;
                    $scope.vm().icon.anchor.vertical.manual = $scope.config().icon.anchor.vertical;
                }
            },
            iconPredefineChangeInternal: function (id) {
                var index = 0;
                if (id) {
                    var index = $scope.vm().mapId($scope.vm().icon.predefine, id);
                    if (id == -1) {
                        index = 0;
                    }
                }
                $scope.config().icon.id = id;
                $scope.config().icon.url = $scope.vm().icon.predefine[index].url;
                $scope.config().icon.size = $scope.vm().icon.predefine[index].size;
                $scope.config().icon.anchor = $scope.vm().icon.predefine[index].anchor;
                $scope.vm().iconAnchor();
            },
            iconPredefineChange: function (id) {
                $scope.vm().iconPredefineChangeInternal(id);
                $scope.vm().provider.events.setIcon();
            },
            absoluteUrl: function (url) {
                if (!url) {
                    return '';
                }
                if (url.indexOf('//') != -1) {
                    //  Is an absolute address
                    return url;
                }
                //  Must be a relative address
                if (url.substring(0, 1) != '/') {
                    url = '/' + url;
                }

                return root.location.protocol + '//' + root.location.hostname + (root.location.port ? ':' + root.location.port : '') + url;
            },
            iconCustom: function () {
                $scope.config().icon.id = $scope.vm().icon.predefine[0].id;
                if (!$scope.vm().icon.anchor.horizontal.isManual) {
                    switch ($scope.vm().icon.anchor.horizontal.automatic) {
                        case 'left':
                            $scope.vm().icon.anchor.horizontal.manual = 0;
                            break;
                        case 'center':
                            $scope.vm().icon.anchor.horizontal.manual = (($scope.config().icon.size.width - 1) / 2) | 0;
                            break;
                        case 'right':
                            $scope.vm().icon.anchor.horizontal.manual = $scope.config().icon.size.width - 1;
                            break;
                    }
                }
                if (!$scope.vm().icon.anchor.vertical.isManual) {
                    switch ($scope.vm().icon.anchor.vertical.automatic) {
                        case 'top':
                            $scope.vm().icon.anchor.vertical.manual = 0;
                            break;
                        case 'center':
                            $scope.vm().icon.anchor.vertical.manual = (($scope.config().icon.size.height - 1) / 2) | 0;
                            break;
                        case 'bottom':
                            $scope.vm().icon.anchor.vertical.manual = $scope.config().icon.size.height - 1;
                            break;
                    }
                }
            },
            iconImageChange: function () {
                $scope.vm().icon.urlFailed = '';
                $http({
                    url: $scope.vm().controller('image'),
                    method: 'GET',
                    params: {
                        url: $scope.config().icon.url
                    }
                }).then(function success(response) {
                    if (response.data.status == 200) {
                        $scope.config().icon.size = {
                            width: response.data.width,
                            height: response.data.height
                        };
                        $scope.config().icon.format = response.data.format;
                    } else {
                        $scope.vm().icon.urlFailed = response.data.error;
                    }
                }, function fail(response) {
                    $scope.vm().icon.urlFailed = response.data;
                });
                $scope.vm().iconCustom();
            },
            icon: {
                anchor: {
                    horizontal: {},
                    vertical: {}
                },
                predefine: [
                {
                    id: '',
                    name: '[Custom]',
                    url: '',
                    shadowUrl: '',
                    size: {
                        width: 32,
                        height: 32
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'bottom'
                    }
                },
                {
                    id: 'redmarker',
                    name: 'Red Marker',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/spotlight-poi.png',
                    shadowUrl: '',
                    size: {
                        width: 22,
                        height: 40
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'bottom'
                    }
                },
                {
                    id: 'greenmarker',
                    name: 'Green Marker',
                    url: 'https://mt.google.com/vt/icon?psize=30&font=fonts/arialuni_t.ttf&color=ff304C13&name=icons/spotlight/spotlight-waypoint-a.png&ax=43&ay=48&text=%E2%80%A2',
                    shadowUrl: '',
                    size: {
                        width: 22,
                        height: 43
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'bottom'
                    }
                },
                {
                    id: 'bluemarker',
                    name: 'Blue Marker',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/spotlight-waypoint-blue.png',
                    shadowUrl: '',
                    size: {
                        width: 22,
                        height: 40
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'bottom'
                    }
                },
                {
                    id: 'purplemarker',
                    name: 'Purple Marker',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/spotlight-ad.png',
                    shadowUrl: '',
                    size: {
                        width: 22,
                        height: 40
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'bottom'
                    }
                },
                {
                    id: 'goldstar',
                    name: 'Gold Star',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/star_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 42,
                        height: 42
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'greyhome',
                    name: 'Grey Home',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/home_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'redshoppingcart',
                    name: 'Red Shopping Cart',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/supermarket_search_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'blueshoppingcart',
                    name: 'Blue Shopping Cart',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/supermarket_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'redhotspring',
                    name: 'Red Hot Spring',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/jp/hot_spring_search_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'reddharma',
                    name: 'Red Dharma',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/worship_dharma_search_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'browndharma',
                    name: 'Brown Dharma',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/worship_dharma_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'redjain',
                    name: 'Red Jain',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/worship_jain_search_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'brownjain',
                    name: 'Brown Jain',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/worship_jain_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'redshopping',
                    name: 'Red Shopping',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/shopping_search_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'blueshopping',
                    name: 'Blue Shopping',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/shopping_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'redharbour',
                    name: 'Red Harbour',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/harbour_search_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'blueharbour',
                    name: 'Blue Harbour',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/harbour_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'orangeumbraco',
                    name: 'Orange Umbraco',
                    url: Umbraco.Sys.ServerVariables.umbracoSettings.umbracoPath + '/assets/img/application/logo.png',
                    shadowUrl: '',
                    size: {
                        width: 32,
                        height: 32
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'blackumbraco',
                    name: 'Black Umbraco',
                    url: Umbraco.Sys.ServerVariables.umbracoSettings.umbracoPath + '/assets/img/application/logo_black.png',
                    shadowUrl: '',
                    size: {
                        width: 32,
                        height: 32
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'whiteumbraco',
                    name: 'White Umbraco',
                    url: Umbraco.Sys.ServerVariables.umbracoSettings.umbracoPath + '/assets/img/application/logo_white.png',
                    shadowUrl: '',
                    size: {
                        width: 32,
                        height: 32
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'redcircle',
                    name: 'Red Circle',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/generic_search_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'orangecircle',
                    name: 'Orange Circle',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/ad_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'browncircle',
                    name: 'Brown Circle',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/generic_establishment_v_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'greencircle',
                    name: 'Green Circle',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/generic_recreation_v_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                {
                    id: 'bluecircle',
                    name: 'Blue Circle',
                    url: 'https://mt.google.com/vt/icon/name=icons/spotlight/generic_retail_v_L_8x.png&scale=2',
                    shadowUrl: '',
                    size: {
                        width: 48,
                        height: 48
                    },
                    anchor: {
                        horizontal: 'center',
                        vertical: 'center'
                    }
                },
                ]
            },
            loadEditor: function (c, completed) {
                $scope.vm().labelOverlay.view = $scope.vm().urlProvider(packageName, 'views/label.' + $scope.config().label.id + '.html', true);
                localizationService.localize($scope.vm().labelOverlay.title).then(function (value) {
                    $scope.vm().labelOverlay.title = value;
                });
                localizationService.localize($scope.vm().labelOverlay.subtitle).then(function (value) {
                    $scope.vm().labelOverlay.subtitle = value;
                });
                if (!$scope.store().zoom) {
                    $scope.store().zoom = c.zoom;
                }
                if (!$scope.store().label) {
                    $scope.store().label = {
                        content: '',
                        id: 'standard'
                    }
                }
                if (!$scope.store().position || !$scope.store().position.id || !$scope.store().position.datum) {
                    $scope.store().position = {
                        id: c.position.id,
                        datum: c.position.datum
                    }
                    done();
                } else if ($scope.store().position.id != c.position.id) {
                    //  Convert coords from old system to new
                    $http({
                        url: $scope.vm().controller('convertcoordinatesystem'),
                        method: 'GET',
                        params: {
                            sourceId: $scope.store().position.id,
                            sourceDatum: $scope.store().position.datum,
                            destinationId: c.position.id
                        }
                    }).then(function success(response) {
                        $scope.store().position.datum = response.data;
                        $scope.store().position.id = c.position.id;
                        done();
                    });
                } else {
                    done();
                }
                function done() {
                    $scope.vm().loadProvider($scope.config().provider.id, function () {
                        $scope.vm().isPreview = !angular.isUndefined($scope.model.sortOrder);
                        $scope.vm().provider = angular.copy(root.terratype.providers[$scope.config().provider.id]);
                        var position = angular.copy($scope.store().position);
                        position.precision = c.position.precision;
                        $scope.vm().provider.coordinateSystems = [];
                        $scope.vm().provider.coordinateSystems.push(position);
                        $scope.vm().position = angular.copy(position);
                        $scope.vm().label = $scope.config().label;
                        $scope.vm().setLabelView($scope.vm().label);
                        $scope.vm().loading = false;
                        setTimeout(function () {
                            //  Simple way to wait for any destroy to have finished
                            $scope.vm().provider.events = $scope.vm().provider.init($scope.vm().identifier, $scope.vm().urlProvider,
                                $scope.store, $scope.config, $scope.vm, function () {
                                    $scope.$apply();
                                });
                            if ($scope.config().label.enable == true && $scope.config().label.editPosition == 0) {
                                $scope.vm().provider.events.addEvent('icon-click', $scope.vm().labelOverlay.display, this);
                            }
                            if (completed) {
                                completed();
                            }
                        }, 150);
                    });
                }
            },
            initEditor: function (completed) {
                $scope.vm().error = false;
                try {
                    if (typeof ($scope.model.value) === 'string') {
                        $scope.model.value = ($scope.model.value != '') ? JSON.parse($scope.model.value) : null;
                    }
                    if (!$scope.model.value) {
                        $scope.model.value = {};
                    }
                }
                catch (oh) {
                    //  Can't even read our own values
                    $scope.vm().error = true;
                    $scope.model.value = {};
                }
                try {
                    $scope.config = function () {
                        return $scope.model.config.definition.config;
                    }
                    $scope.store = function () {
                        return $scope.model.value;
                    }
                    $scope.vm().loadEditor($scope.model.config.definition, completed);
                }
                catch (oh) {
                    //  Error so might as well show debug
                    $scope.vm().loading = false;
                    $scope.vm().error = true;
                    $scope.config().debug = 1;
                }
            },
            gridOverlay: {
                title: 'terratypeGridOverlay_title',
                subtitle: 'terratypeGridOverlay_subtitle',
                show: false,
                display: function () {
                    if ($scope.vm().gridOverlay.show == true) {
                        return;
                    }
                    $scope.config = function () {
                        return $scope.vm().gridOverlay.config;
                    }
                    if ($scope.control.value) {
                        $scope.vm().gridOverlay.store = $scope.control.value;
                    }
                    $scope.store = function () {
                        return $scope.vm().gridOverlay.store;
                    }
                    $scope.vm().setLabelView($scope.config().label);
                    if ($scope.vm().gridOverlay.dataTypes.length == 0) {
                        $http.get($scope.vm().controller('datatypes')).then(function success(response) {
                            $scope.vm().gridOverlay.dataTypes = response.data;
                            loaded();
                        });
                    } else {
                        loaded();
                    }
                    loaded = function () {
                        $scope.vm().gridOverlay.show = true;
                        if ($scope.store().datatypeId) {
                            $scope.vm().gridOverlay.setDatatype($scope.store().datatypeId);
                        }
                    }
                },
                submit: function (model) {          //  model = $scope.vm().gridOverlay
                    model.show = false;
                    $scope.control.value = $scope.vm().gridOverlay.store;
                    $timeout(function () {
                        $scope.vm().loadGrid();
                    });
                },
                view: 'uninitalized',
                dataTypes: [],
                vm: $scope.vm,
                config: {
                    label: {
                        enablew: false,
                        editPosition: 0
                    }
                },
                store: {},
                rte: {},
                setDatatype: function (id) {
                    $scope.vm().showMap = false;
                    $timeout(function () {
                        var d = $scope.vm().gridOverlay.dataTypes;
                        for (var i = 0; i != d.length; i++) {
                            if (d[i].id == id) {
                                $scope.vm().identifier = $scope.$id + id + (new Date().getTime());
                                var c = angular.copy(d[i].config);
                                $scope.store().datatypeId = id;
                                $scope.vm().gridOverlay.config = c.config;
                                $scope.vm().loadEditor(c);
                                break;
                            }
                        }
                    });
                }
            },
            labelOverlay: {
                title: 'terratypeLabelOverlay_title',
                subtitle: 'terratypeLabelOverlay_subtitle',
                show: false,
                display: function () {
                    if ($scope.vm().labelOverlay.show == true) {
                        return false;
                    }
                    $scope.vm().labelOverlay.show = true;
                    return false;
                },
                submit: function (model) {          //  model = $scope.vm().labelOverlay
                    $scope.vm().setLabel();
                    model.show = false;
                },
                view: 'uninitalized',
                vm: $scope.vm,
                config: function () {
                    return $scope.config().label;
                },
                store: function () {
                    return $scope.store().label;
                }
            },
            loadGrid: function () {
                try {
                    $http.get($scope.vm().controller('datatypes?id=' + $scope.control.value.datatypeId)).then(function success(response) {
                        if (response.data.length == 1) {
                            $scope.config = function () {
                                return $scope.vm().gridOverlay.config;
                            }
                            $scope.store = function () {
                                return $scope.control.value;
                            }
                            var c = angular.copy(response.data[0].config);
                            $scope.vm().gridOverlay.config = c.config;
                            $scope.vm().loadEditor(c, function () {
                                $scope.vm().provider.events.addEvent('map-click', $scope.vm().gridOverlay.display, this);
                            });
                        }
                    });
                }
                catch (oh) {
                    //  Error so might as well show debug
                    $scope.vm().loading = false;
                    $scope.vm().error = true;
                    $scope.config().debug = 1;
                }
            },
            initGrid: function () {
                $scope.vm().gridOverlay.view = $scope.vm().urlProvider(packageName, 'views/grid.overlay.html', true);
                localizationService.localize($scope.vm().gridOverlay.title).then(function (value) {
                    $scope.vm().gridOverlay.title = value;
                });
                localizationService.localize($scope.vm().gridOverlay.subtitle).then(function (value) {
                    $scope.vm().gridOverlay.subtitle = value;
                });
                $timeout(function () {
                    $scope.vm().loading = false;
                    if ($scope.control.$initializing) {
                        //  No map has been selected yet
                    } else if ($scope.control.value) {
                        //  Map has been previous set
                        try {
                            if (typeof ($scope.control.value) === 'string') {
                                $scope.control.value = ($scope.control.value != '') ? JSON.parse($scope.control.value) : null;
                            }
                        }
                        catch (oh) {
                            //  Can't even read our own values
                            $scope.vm().error = true;
                            $scope.control.value = {};
                        }
                    }
                }, 200);
            }
        }
    }]);

    angular.module('umbraco').controller('terratype.label.standard', ['$scope', '$timeout', 'localizationService', '$controller', 'tinyMceService', 'macroService',
    function ($scope, $timeout, localizationService, $controller, tinyMceService, macroService) {

        $scope.identifier = $scope.$id + (new Date().getTime());
        $scope.colors = [
            { id: '#ffffff' },      // White
            { id: '#faebd7' },      // Antique White
            { id: '#f5f5dc' },      // Beige
            { id: '#ffe4c4' },      // Bisque
            { id: '#c0c0c0' },      // Silver
            { id: '#808080' },      // Grey
            { id: '#000000' },      // Black
            { id: '#ff0000' },      // Red
            { id: '#800000' },      // Maroon
            { id: '#ffff00' },      // Yellow
            { id: '#808000' },      // Olive
            { id: '#00ff00' },      // Lime
            { id: '#008000' },      // Green
            { id: '#00ffff' },      // Aqua
            { id: '#008080' },      // Teal
            { id: '#0000ff' },      // Blue
            { id: '#000080' },      // Navy
            { id: '#ff00ff' },      // Fuchsia
            { id: '#800080' }       // Purple
        ]
        $scope.init = function () {
            var parent = $scope.$parent;
            while (parent) {
                if (parent.terratype) {
                    break;
                }
                parent = parent.$parent;
            };

            $scope.vm = parent.vm;
            $scope.config = parent.config;
            $scope.store = parent.store;

            var timer = setInterval(function () {
                if (!root.tinymce) {
                    return;
                }
                var editor = $scope.rte.getEditor();
                if (editor == null) {
                    return;
                }
                clearInterval(timer);
                $scope.rte.label = new $scope.rte.createLabel(editor);
                $scope.rte.blur();
            }, 100);
        }
        $scope.setForeground= function (id) {
            $scope.store().label.foreground = id;
        }

        $scope.setBackground = function (id) {
            $scope.store().label.background = id;
        }
        
        $scope.rte = {
            id: $scope.identifier + 'rte',
            getEditor: function () {
                for (var i = 0; i != tinymce.editors.length; i++) {
                    if (tinymce.editors[i].id == $scope.rte.id) {
                        return tinymce.editors[i]; 
                    }
                }
                return null;
            },
            createLabel: function (editor) {
                var text = editor.getElement().getAttribute("placeholder") || editor.settings.placeholder;
                var attrs = editor.settings.placeholder_attrs || { style: { 'position': 'absolute', 'width': '100%', 'overflow': 'hidden' } };
                var el = root.tinymce.DOM.create('div', attrs);
                var inner = root.tinymce.DOM.add(el, 'span', { style: { 'padding': '10px', 'color': '#aaaaaa', 'font-size': '17px !important;', 'white-space': 'pre-wrap', 'display':'inline-block' } }, text)
                var parent = editor.getContentAreaContainer();
                parent.insertBefore(el, parent.firstChild);
                return el;
            },
            label: null,
            focus: function () {
                var editor = $scope.rte.getEditor();
                if (!editor.settings.readonly === true) {
                    $scope.rte.label.style.display = 'none'
                }
            },
            blur: function () {
                var editor = $scope.rte.getEditor();
                if (editor.getContent() == '') {
                    $scope.rte.label.style.display = '';
                } else {
                    $scope.rte.label.style.display = 'none'
                }
                $scope.vm().setLabel();
            },
            config: {
                selector: "textarea",
                toolbar: ['code', 'styleselect', 'bold', 'italic', 'forecolor', 'backcolor','alignleft', 'aligncenter', 'alignright', 'bullist', 'numlist', 'link', 'umbmediapicker', 'umbembeddialog'],
            },
            linkPickerOverlay: {},
            openLinkPicker: function (editor, currentTarget, anchorElement) {
                $scope.rte.linkPickerOverlay = {
                    view: "linkpicker",
                    currentTarget: currentTarget,
                    show: true,
                    submit: function (model) {
                        tinyMceService.insertLinkInEditor(editor, model.target, anchorElement);
                        $scope.rte.linkPickerOverlay.show = false;
                        $scope.rte.linkPickerOverlay = null;
                    }
                };
            },
            mediaPickerOverlay: {},
            openMediaPicker: function (editor, currentTarget, userData) {
                $scope.rte.mediaPickerOverlay = {
                    currentTarget: currentTarget,
                    onlyImages: true,
                    showDetails: true,
                    startNodeId: userData.startMediaId,
                    view: "mediapicker",
                    show: true,
                    submit: function (model) {
                        tinyMceService.insertMediaInEditor(editor, model.selectedImages[0]);
                        $scope.rte.mediaPickerOverlay.show = false;
                        $scope.rte.mediaPickerOverlay = null;
                    }
                };
            },
            embedOverlay: {},
            openEmbed: function (editor) {
                $scope.rte.embedOverlay = {
                    view: "embed",
                    show: true,
                    submit: function (model) {
                        tinyMceService.insertEmbeddedMediaInEditor(editor, model.embed.preview);
                        $scope.rte.embedOverlay.show = false;
                        $scope.rte.embedOverlay = null;
                    }
                };
            },
            macroPickerOverlay: {},
            openMacroPicker: function (editor, dialogData) {
                $scope.rte.macroPickerOverlay = {
                    view: "macropicker",
                    dialogData: dialogData,
                    show: true,
                    submit: function (model) {
                        var macroObject = macroService.collectValueData(model.selectedMacro, model.macroParams, dialogData.renderingEngine);
                        tinyMceService.insertMacroInEditor(editor, macroObject, $scope);
                        $scope.rte.macroPickerOverlay.show = false;
                        $scope.rte.macroPickerOverlay = null;
                    }
                };
            }
        }
    }]);

    angular.module('umbraco').controller('terratype.grid.overlay', ['$scope', '$timeout', 'localizationService', '$controller', 'tinyMceService', 'macroService',
        function ($scope, $timeout, localizationService, $controller, tinyMceService, macroService) {
        $scope.identifier = $scope.$id + (new Date().getTime());
        $scope.init = function () {
            var gridOverlay = $scope.$parent.model;
            $scope.vm = gridOverlay.vm;
            $scope.config = gridOverlay.config;
            $scope.store = gridOverlay.store;
        }

    }]);

}(window));
