// Copyright (c) 2012 CoNarrative - http://www.conarrative.com/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)
// GluJS version 1.1.0

/*
 * Copyright (C) 2012 by CoNarrative
 */
Ext.ns('glu.test.ajax');
glu.test.ajax.originalProvider = (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') ? Ext.Ajax.request : Ext.lib.Ajax.request;

/**
 * @class glu.test
 * @singleton
 * Provides simulation facilities for specification-based testing
 */

/**
 * @param config  The backend configuration in the form:
 *   @param defaultRoot The root url to capture (that is, the root url of your JSON REST services). Often it is something like '/json'. Defaults to '/'
 *   @param fallbackToAjax When true, if an AJAX call is made to a route that is not captured by this back-end, go ahead and let it be handled normally by the AJAX library. When false, throw an exception.
 *   @param autoRespond Automatically fake the response (for "live simulation" mode with an actual user)
 *   @param routes The routes for capture
 * @return {Object}
 *
 * The route format is in the form
 *     'routename' : {
 *        url : 'foo/bar/:id',
 *        handle : function(req) { return {echoId: req.params.id};}
 *     }
 *
 * Example:
 *      backend = glu.test.createBackend({
 *          defaultRoot: '/json/',
 *          fallbackToAjax: auto,
 *          autoRespond: auto,
 *          routes: {
 *              'removeAssets': {
 *                  url: 'assets/action/remove',
 *                  handle: function(req) {
 *                      return assets.remove(req.params.ids);
 *                  }
 *              },
 *              'requestVerification': {
 *                  url: 'assets/action/requestVerification',
 *                  handle: function(req) {
 *                      return assets.update(req.params.ids, {status: 'verifying' });
 *                  }
 *              },
 *              'assetSave': {
 *                  url: 'assets/:id/action/save',
 *                  handle: function(req) {
 *                      return assets.replace(req.params.id, req.jsonData);
 *                  }
 *              },
 *              'assets': {
 *                  url: 'assets',
 *                  handle: function(req) {
 *                      return assets.list(req.params);
 *                  }
 *              },
 *              'asset': {
 *                  url: 'assets/:id',
 *                  handle: function(req) {
 *                      return assets.get(req.params.id);
 *                  }
 *              }
 *          }
 *      });
 *
 */
glu.test.createBackend = function (config) {
    /**
     * @class glu.test.Backend
     * A backend object for use with specification-style testing
     */
    var me = {
        fallbackToAjax:config.fallbackToAjax || false,
        defaultRoot:config.defaultRoot || '/',
        requests:[],
        routes:{},

        /**
         Start intercepting AJAX calls using this backend
         */
        capture:function () {
            if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
                Ext.Ajax.request = this.ext4Request;
            } else {
                Ext.lib.Ajax.request = this.ext3LibRequest;
            }
        },
        captureUrl:function (url) {
            if (url.substring(0, 1) != '/') {
                url = me.defaultRoot + url;
            }
            var qsIndex = url.indexOf('?');
            if (qsIndex > -1) {
                //TODO: Process query string!!!
                var queryString = url.substring(url);
                url = url.substring(0, qsIndex);
            }
            return {
                url:url
            };
        },
        ext4Request:function (options) {
            var q = me.captureUrl(options.url);
            var url = q.url;
            var route = me.matchRoute(url);
            if (route === undefined) {
                if (me.fallbackToAjax) {
                    //perform actual Ajax
                    glu.test.ajax.originalProvider.call(this, options);
                    return;
                } else {
                    throw new Error('There is no matching back-end route for ' + url);
                }
            }
            var scope = options.scope || window;
            var requestOptions = this.setOptions(options, scope);
            if (this.fireEvent('beforerequest', this, options) !== false) {
                var xhr = {
                    headers:{},
                    setRequestHeader:function (key, header) {
                        this.headers[key] = header;
                    }
                };
                var headers = this.setupHeaders(xhr, options, requestOptions.data, requestOptions.params);
                var jsonParams = Ext.isString(options.params) ? Ext.decode(options.params) : options.params;
                var request = {
                    serviceName:route.name,
                    headers:headers,
                    params:Ext.applyIf(route.params, jsonParams),
                    cb:{
                        scope:scope,
                        success:options.success || Ext.emptyFn,
                        failure:options.failure || Ext.emptyFn,
                        callback:options.callback || Ext.emptyFn
                    },
                    url:options.url,
                    o:options
                };
                if (options.method != 'GET') {
                    request.jsonData = jsonParams;
                }
                route.requests.push(request);
                me.requests.push(request);
                if (config.autoRespond) {
                    setTimeout(function () {
                        me.respond(request)
                    }, 5); //respond back in 5 ms
                }
            } else {
                Ext.callback(options.callback, options.scope, [options, undefined, undefined]);
                return null;
            }
        },

        matchRoute:function (path) {
            for (var name in this.routes) {
                var route = this.routes[name];
                var captures;
                if (captures = route.regex.exec(path)) {
                    var keys = route.keys;
                    route.params = {};
                    // params from capture groups
                    for (var i = 1; i < captures.length; i++) {
                        var key = keys[i - 1];
                        var val = Ext.isString(captures[i]) ? decodeURIComponent(captures[i]) : captures[i];
                        if (key) {
                            route.params[key.name] = val;
                        }
                    }
                    return route;
                }
            }
        },

        ext3LibRequest:function (verb, actualUrl, cb, p, o) {
            var q = me.captureUrl(o.url);
            var url = q.url;
            var route = me.matchRoute(url);
            if (route === undefined) {
                if (me.fallbackToAjax) {
                    //perform actual Ajax
                    glu.test.ajax.originalProvider.call(this, verb, actualUrl, cb, p, o);
                    return;
                } else {
                    throw new Error('There is no matching back-end route for ' + url);
                }
            }
            var jsonParams = Ext.isString(o.params) ? Ext.decode(o.params) : o.params;
            var request = {
                serviceName:route.name,
                params:Ext.applyIf(route.params, jsonParams),
                cb:cb,
                url:o.url,
                o:o
            };
            route.requests.push(request);
            me.requests.push(request);
            if (config.autoRespond) {
                setTimeout(function () {
                    me.respond(request)
                }, 5); //respond back in 5 ms
            }
        },
        /**
         * Register a new route
         * @param config The route configuration in the form
         *      @param {String} name The name of the route
         *      @param {String} url The url of the route
         *      @param {Function} handle The handler for the route
         */
        register:function (config) {
            if (config.url.substring(0, 1) != '/') {
                config.url = this.defaultRoot + config.url;
            }
            var route = this.createRoute(config.verb || config.method, config.url, config.handle);
            route.name = config.name;
            route.handle = config.handle;
            this.routes[route.name] = route;
        },

        /**
         * Respond to a given request (will remove the request from the route's queue)
         * @param request The request to fulfill
         * @param [ajaxResponse] The response if overriding the default response
         */
        respond:function (request, ajaxResponse) {
            //pull off the two queues
            var sRequests = this.routes[request.serviceName].requests;
            for (var i = 0; i < sRequests.length; i++) {
                var toCheck = sRequests[i];
                if (request == toCheck) {
                    sRequests.splice(i, 1);
                    break;
                }
            }
            for (var i = 0; i < this.requests.length; i++) {
                var toCheck = this.requests[i];
                if (request == toCheck) {
                    this.requests.splice(i, 1);
                    break;
                }
            }
            var route = this.routes[request.serviceName];
            ajaxResponse = ajaxResponse || route.handle(request);
            if (!ajaxResponse.responseText && !ajaxResponse.responseObj) {
                ajaxResponse = {responseObj:ajaxResponse};
            }
            ajaxResponse.headers = ajaxResponse.headers || {};
            var keys = [];
            for (var key in ajaxResponse.headers) {
                keys.push(key);
            }
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                ajaxResponse.headers[key.toLowerCase()] = ajaxResponse.headers[key];
            }
            var responseText = ajaxResponse.responseText || Ext.encode(ajaxResponse.responseObj);
            var response = {
                //requestId : request.id,
                tId:request.o.tId,
                // Normalize the status and statusText when IE returns 1223, see the above link.
                status:200 || ajaxResponse.status,
                statusText:'OK' || ajaxResponse.statusText,
                getResponseHeader:function (header) {
                    return ajaxResponse.headers[header.toLowerCase()];
                },
                getAllResponseHeaders:function () {
                    return ajaxResponse.headers;
                },
                responseText:responseText,
                argument:request.cb.argument
            };
            //callback
            var success = (response.status >= 200 && response.status < 300) || response.status == 304;
            if (success) {
                request.cb.success.call(request.cb.scope, response);
            } else {
                request.cb.failure.call(request.cb.scope, response);
            }
            if (request.cb.callback) {
                request.cb.callback.call(request.cb.scope, request.o, success, response);
            }
        },
        /**
         * Respond to the first item in the routes queue
         * @param routeName The name of the route
         * @param [ajaxResponse] The response object if overriding the default response
         */
        respondTo:function (serviceName, ajaxResponse) {
            var route = this.routes[serviceName];
            if (!route) {
                throw new Error("Unable to find a simulated route with the name '" + serviceName + "'");
            }
            if (route.requests.length == 0) {
                throw new Error("Route '" + serviceName + "' does not have any pending requests to which we can respond.");
            }
            this.respond(route.requests[0], ajaxResponse)
        },
        respondNext:function (ajaxResponse) {
            this.respond(this.requests[this.requests.length - 1], ajaxResponse);
        },
        /**
         * Returns the responses in the request queue for that route
         * @param routeName The name of the route
         * @return {Object} the request object
         */
        getRequestsFor:function (serviceName) {
            return this.routes[serviceName].requests
        },
        createRoute:function (method, path, options) {
            options = options || {};
            var keys = [];
            return {
                path:path,
                method:method,
                regex:this.regexifyRoute(path, keys),
                keys:keys,
                requests:[]
            };
        },
        regexifyRoute:function (path, keys, caseSensitive) {
            path = path.replace(/\//g, '\/');
            path = path.replace(/:\w+/g,
                    function (keyBlock) {
                        keys.push({
                            name:keyBlock.substring(1)
                        });
                        return '([^/]+.?)';
                    });
            return new RegExp('^' + path + '/?$', caseSensitive ? '' : 'i' );
        }

    };
    if (config.routes) {
        if (glu.isObject(config.routes)) {
            var routes = [];
            for (var key in config.routes) {
                var route = config.routes[key];
                route.name = key;
                routes.push(route);
            }
            config.routes = routes;
        }
        for (var i = 0; i < config.routes.length; i++) {
            var routeSpec = config.routes[i];
            me.register(routeSpec);
        }
    }
    return me;
};

/*
 *  Copyright (C) 2012 by CoNarrative
 */
/**
 *
 * @class glu.test
 *
 */
/**
 * Creates a table given a fields definition and an array of initial data
 * @param fields
 * @param data
 * @return {glu.test.MemoryTable}
 */
glu.test.createTable = function (fields, data) {
    if (fields.fields) {
        fields = fields.fields;
    }
    if (glu.isNumber(data) || data === undefined) {
        data = glu.test.createFakeData(fields, data || 50);
    }
    var keyIndex = {};
    for (var i = 0 ;i<data.length;i++){
        var row = data[i];
        keyIndex[row.id] = row;
    }
/**
 * @class glu.test.MemoryTable
 * An in-memory table for use with glu.test.ajax
 */
    var me = {
    /**
     * Gets a stored object by id
     * @param {String} id
     * @return {Object}
     */
    get:function (id) {
            return keyIndex[id];
        },
    /**
     * Iterates over items in the table
     * @param {String} id
     * @param {Function} op
     */
        each : function(id, op) {
            var ids = Ext.isArray(id) ? id : [id];
            for (var i =0;i<ids.length;i++){
                var thisId = ids[i];
                op(thisId);
            }
        },
    /**
     * Updates one or more rows, replacing *only* the provided fields
     * @param {String/Array} ids An id or array of ids
     * @param {Object} newData The field values to be overwritten
     * @return {Object}
     */
        update : function (ids, newData) {
            me.each (ids, function(id){
                glu.apply(keyIndex[id], newData);
            });
            return {};
        },
    /**
     * Creates a new row
     * @param {Object} newData The new row
     */
        create : function (newData) {
            var id = newData.id;
            if (id === undefined) throw new Error("An id property is required");
            if (keyIndex[id]) throw new Error("Duplicate key of " + id);
            data.push(newData);
            keyIndex[id] = newData;
        },
    /**
     * Replaces an existing row in its entirey. Unlike update, all fields will be overwritten
     * @param {String/Array} ids An id or array of ids
     * @param {Object} newData The new row
     * @return {Object}
     */
        replace : function (ids, newData){
            me.each (ids, function(id){
                keyIndex[id] = newData;
                newData.id = id;
                for (var i=0; i<data.length; i++){
                    if (data[i].id==id) {
                        data[i]=newData;
                        break;
                    }
                }
            });
            return {};
        },
    /**
     * Removes one or more rows
     * @param ids The ids of the rows to remove
     * @return {Object}
     */
        remove : function (ids) {
            me.each (ids, function(id){
                for (var i=0; i<data.length; i++){
                    if (data[i].id==id) {
                        data.splice(i,1);
                        break;
                    }
                }
                delete keyIndex[id];
            });
            return {};
        },
    /**
     * Return a list of rows as an array
     * @param query The query expressed as an object with a number of named parameters
     * @param filterFn An optional filter function
     * @return {Object}
     *
     * The query named parameters are:
     *
     *   - `start` The index at which to start
     *   - `limit` Number of rows to return
     *   - `sorters` An array of sorters on which to sort
     *   - `filters` An array of filters
     */
        list:function (query, filterFn) {
            query = query || {};

            data = glu.deepApply(data);

            var params = query.params || query;
            params.start = query.start || 0;
            //will fake like a remote database
            var config = {
                reader:new Ext.data.JsonReader({
                    fields:fields
                }),
                data:data
            };
            if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
                var cfg = config;
                //inline a model as needed
                if (cfg.fields || (cfg.reader && cfg.reader.fields)) {
                    //just build a dynamic model...
                    //TODO: Make a 'fields' cache that can create models dynamically based on a set of fields
                    //so at least they are cached
                    var name = 'glu.test.models' + Ext.id().replace('-', '_');
                    Ext.define(name, {
                        extend:'Ext.data.Model',
                        fields:cfg.fields || cfg.reader.fields
                    });
                    cfg.model = name;
                }
            }

            if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
                if (params.sorters) {
                    config.sorters = params.sorters
                }
                if (params.sort) {
                    config.sorters = Ext.decode(params.sort);
                }
            }
            else{
                if (params.sort) {
                    config.sortInfo = {
                        field:params.sort,
                        direction:params.dir
                    }
                }
            }
            var memStore = new Ext.data.Store(config);
            // [{"comparator":"RE","value":"aa"}]
            var filters = params.filters || [];

            if (params.filterText) {
                filters.push({
                    field:'firstName',
                    value:params.filterText
                });
            }

            function checkFilter(record, fieldFilter) {
                //starts with...
                var testVal = record.get(fieldFilter.field);
                var value = fieldFilter.value;
                if (Ext.isString(testVal)) {
                    return testVal.indexOf(value) == 0;
                }
                return false;
            }

            function filterBy(record) {
                for (var i = 0; i < filters.length; i++) {
                    var include = checkFilter(record, filters[i]);
                    if (!include) {
                        return false;
                    }
                }
                return true;
            }

            if(filterFn){
                memStore.filterBy(filterFn)
            }
            else if (filters.length > 0) {
                memStore.filterBy(filterBy);
            }


            var records = memStore.getRange();
            var pagedRecords = [];

            //do paging...
            var operation = params;
            var remaining = records.length - operation.start;
            operation.limit = Ext.isDefined(operation.limit) ? operation.limit : remaining;
            var take = operation.limit < remaining ? operation.limit : remaining;
            for (var i = operation.start; i < operation.start + take; i++) {
                pagedRecords.push(records[i].data);
            }

            //return as a paged result
            return {
                total:records.length,
                rows:pagedRecords
            };
        }
    };
    return me;
};

glu.test.types = {
    'string':function (field) {
        //remember to include code/lookup data (only good if using foreign 'lookup' keys on data :-) )
        var name = field.name.toLowerCase();
        var value = '';
        if (name.indexOf('firstname') > -1) {
            value = glu.fake.contact.firstName();
            return value;
        }
        if (name.indexOf('lastname') > -1) {
            value = glu.fake.contact.lastName();
            return value;
        }
        if (name.indexOf('name') > -1) {
            value = glu.fake.contact.name();
            return value;
        }
        if (name.indexOf('fax') > -1 || name.indexOf('phone') > -1 || name.indexOf('mobile') > -1) {
            value = glu.fake.contact.phoneNumber();
            return value;
        }
        if (name.indexOf('dob') > -1 || name.indexOf('date') > -1) {
            value = glu.fake.date({min:"1/1/1960", max:"1/1/1972", separator:"/"});
            return value;
        }
        if (name == 'state') {
            return glu.fake.contact.state;
        }
        if (name.indexOf('postal') == 0 || name.indexOf('zip') == 0) {
            return glu.fake.contact.zip(5);
        }
        if (name.indexOf('memo') > -1 || name.indexOf('description') > -1) {
            return glu.fake.words(8, 12);
        }
        return glu.fake.title(4, 5);
    },
    'int':function (field) {
        if(field.max){
            return Math.floor(Math.random()*field.max);
        }
        return glu.fake.bigNumber(4);
    },
    'boolean':function (field) {
        return glu.fake.bool();
    },
    'date':function (field) {
        return glu.fake.date({min:"1/1/1960", max:"1/1/1972", delimiter:"/"});
    },
    'float':function (field) {
        if(field.max){
            return Math.floor(Math.random()*field.max);
        }
        return glu.fake.bigNumber(7);
    }
};
glu.test.types.number = glu.test.types['float'];
glu.test.types.integer = glu.test.types['int'];
glu.test.types.bool = glu.test.types['boolean'];

glu.test.createFakeData = function (fields, number) {
    var data = [];
    var id = 0;

    for (var i = 0; i < number; i++) {
        var row = {};
        data.push(row);
        for (var f = 0; f < fields.length; f++) {
            var field = fields[f];
            var name = field.name;
            var type = field.type;
            if (field.name == 'id') {
                id = id + 1;
                row[name] = id;
                continue;
            }
            if (field.oneOf){
                if(glu.isNumber(field.oneOf)){
                    row[name] = Math.floor(Math.random()*field.oneOf);
                }
                else{
                    // an array is given
                    row[name] = glu.fake.oneOf(field.oneOf);
                }
                continue;
            }
            row[name] = glu.test.types[type](field, row);
        }
    }

    return data;
};

/*
 * Copyright (C) 2012 by CoNarrative
 */
/*
 * Spec language on top of Jasmine
 */
Given = function (text, fn) {
    describe('Given ' + text, fn)
};
When = function (text, fn) {
    describe('When ' + text, fn)
};
Meaning = function (fn) {
    beforeEach(fn)
};
Shouldve = function (text, fn) {
    it('Should have ' + text, fn)
};
Should = function (text, fn) {
    it('Should ' + text, fn)
};
ShouldHave = Shouldve;
/*
 * Copyright (C) 2012 by CoNarrative
 */
(function () {
    var boyFirstNames = "Michael,Christopher,Jason,David,James,Matthew,Joshua,John,Robert,Joseph,Daniel,Brian,Justin,William,Ryan,Eric,Nicholas,Jeremy,Andrew,Timothy,Jonathan,Adam,Kevin,Anthony,Thomas,Richard,Jeffrey,Steven,Charles,Brandon,Mark,Benjamin,Scott,Aaron,Paul,Nathan,Travis,Patrick,Chad,Stephen,Kenneth,Gregory".split(",");
    var girlFirstNames = "Jennifer,Amanda,Jessica,Melissa,Sarah,Heather,Nicole,Amy,Elizabeth,Michelle,Kimberly,Angela,Stephanie,Tiffany,Christina,Lisa,Rebecca,Crystal,Kelly,Erin,Laura,Amber,Rachel,Jamie,April,Mary,Sara,Andrea,Shannon,Megan,Emily,Julie,Danielle,Erica,Katherine,Maria,Kristin,Lauren,Kristen,Ashely,Christine,Brandy".split(",");
    var lastNames = "Smith,Johnson,Williams,Jones,Brown,Davis,Miller,Wilson,Moore,Taylor,Anderson,Thomas,Jackson,White,Harris,Martin,Thompson,Garcia,Martinez,Robinson,Clark,Rodriguez,Lewis,Lee,Walker,Hall,Allen,Young,Hernandez,King,Wright,Lopez,Hill,Scott,Green,Adams,Baker,Gonzalez,Nelson,Carter,Mitchell".split(",");
    var codeNames = "venus,apollo,mercury,jupiter,homer,bart"
    var loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum";
    var words = loremIpsum.split(" ");

    glu.fake = {
        /* DOCS DISABLED FOR NOW
         * Random number between 0 and n-1
         * @param n
         * @return {Number}
         */
        rand:function (n) {
            return Math.floor(n * Math.random());
        },
        /* DOCS DISABLED FOR NOW
         * Random number in range
         * If provided a singe argument, returns random number between 1 and n
         * @param min
         * @param max
         * @return {Number}
         */
        range:function (min, max) {
            if (max==null) {
                max = min;
                min = 1;
            }
            return min + this.rand(max-min + 1);
        },
        oneOf:function (set) {
            if (arguments.length>1){
                //arguments form the set
                set = [].slice.call(arguments);
            }
            set = glu.isString(set)?set.split(","):set;
            return set[this.rand(set.length)];
        },
        bigNumber:function (length) {
            var out = "";
            for (var i = 0; i < length; i++) {
                out += this.rand(10);
            }
            return out;
        },
        date:function (options) {
            options = options || {};
            var min = new Date(options.min);
            var max = new Date(options.max);
            var d = new Date(this.range(min.getTime(), max.getTime()));
            return d;
        },
        bool:function () {
            return this.rand(2) < 1;
        },
        name:function () {
            return oneOf(codeNames);
        },
        words:function (min, max) {
            return words.slice(0, this.range(min,max)).join(' ');
        },
        title:function (min, max) {
            return this.words(1,4);
        },
        contact : {
            name : function(sex){
                sex = sex == null ? glu.fake.oneOf('M','F') : sex.toUpperCase();
                return glu.fake.oneOf(sex=='M' ? boyFirstNames : girlFirstNames) + " " + glu.fake.oneOf(lastNames);
            },
            firstName:function (sex) {
                sex = sex == null ? glu.fake.oneOf('M','F') : sex.toUpperCase();
                return glu.fake.oneOf(sex=='M' ? boyFirstNames : girlFirstNames);
            },
            lastName:function () {
                return glu.fake.oneOf(lastNames);
            },
            phoneNumber : function(){
                return glu.fake.bigNumber(3) + " " + glu.fake.bigNumber(3) + "-" + glu.fake.bigNumber(4);
            },
            state : function(){
                return glu.fake.oneOf("TX,TN,AL,AK,MI,OH,CA");
            },
            zip : function(){
                return glu.fake.bigNumber(5);
            }
        }

    };

})();
