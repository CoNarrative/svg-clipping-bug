// Copyright (c) 2012 CoNarrative - http://www.conarrative.com/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)
// GluJS version 1.1.0

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu
 * Core library class for GluJS
 * @singleton
 */
if (window.glu != null) {
    window.existingGlu = glu;
}

glu = {
    /*
     * * @cfg {Function} handler
     */
    testMode:false,
    mtypeRegistry:{},
    bindingDirectiveRegistry:{},
    /**
     * Creates a view model and the associated view
     * @param {Object} view model config
     * @return {Object} the created view
     */
    createViewmodelAndView:function (config, asWindow, viewMode) {
        var vm;
        if (config._private && config._private.isInstantiated) {
            vm = config;
        } else {
            vm = glu.model(config);
        }
        var viewName = viewMode? vm.viewmodelName+'_'+viewMode : vm.viewmodelName;
        var viewSpec = this.getViewSpec(vm, null, viewName);
        if (glu.isString(viewSpec)) throw viewSpec;
        if (vm._private && !vm._private.isInitialized) {
            vm.init();
        }

        var view = glu.viewFromSpec(vm, viewSpec);
        return view;
    },

    splitNs:function (vmName) {
        var parts = vmName.split('.');
        return {
            className:parts[parts.length - 1],
            namespace:parts.slice(0, parts.length - 1).join('.')
        };
    },

    /*
     * Fetches a fully configured view from a name specification readied for binding and view creation
     * Returns an error string if could not process it.
     */
    getViewSpec:function (vm, ns, viewmodelName, configOverlay, defaults) {
        ns = ns || vm.ns;
        viewmodelName = viewmodelName || vm.viewmodelName;
        configOverlay = configOverlay || {};
        var viewName = viewmodelName;
        glu.log.debug('Creating view ' + ns + '.' + viewName);
        var nsSubObj = glu.namespace(ns + '.' + glu.conventions.viewNs);
        var viewSpec = nsSubObj[viewName];
        if (!viewSpec || glu.isFunction(viewSpec)) { //functions are now automatically treated as factories instead of constructors...
            var factory = viewSpec || nsSubObj[viewName + 'Factory'];
            if (factory === undefined) {
                return 'unable to find view config spec for ' + viewName;
            }
            configOverlay.vm = vm;
            viewSpec = factory(configOverlay);
            delete configOverlay.vm;
        } else {
            //TODO: Switch to making a prototype versus mixing properties in as
            //that level of dynamism has not proven to be necessary
            viewSpec = glu.deepApply({}, viewSpec);
        }
        if (viewSpec.parentLayout) {
            var layoutName = viewSpec.parentLayout;
            var layoutFactory = nsSubObj[layoutName + 'Factory']; //has to be a factory
            if (layoutFactory === undefined) return "Could not find parent layout " + layoutName;
            viewSpec.vm = vm;
            viewSpec = layoutFactory(viewSpec);
            delete viewSpec.vm;
            if (viewSpec === undefined) return "Expected layout factory " + layoutName + " to return a view specification";
        }
        if (configOverlay) {
            glu.apply(viewSpec, configOverlay);
        }
        if (defaults) {
            glu.applyIf(viewSpec, defaults);
        }
        return viewSpec;
    },

    /*
     * Initializes a view off of a view model.
     * @param {glu.ViewModel} viewmodel
     * @return {glu.view} The created view
     */
    view:function (vm, ns, className, configOverlay, defaults, parent) {
        var viewSpec = this.getViewSpec(vm, ns, className, configOverlay, defaults, parent);
        if (glu.isString(viewSpec)) throw viewSpec;
        var view = glu.viewFromSpec(vm, viewSpec, parent);
        return view;
    },

    /**
     * A factory function for creating a view once the view config has already been supplied.
     * @private
     * @param {Object} vm The view model bound to this view
     * @param {Object} viewSpec The configuration for the view
     * @return {Object}
     */
    viewFromSpec:function (vm, viewSpecBase, parent) {
        var viewSpec = viewSpecBase;
        //WARNING: Does not make copy, assume viewspec is writable (should have already been cloned if from template)
        //glu.deepApply(viewSpec, viewSpecBase); //always pass in a copy...
        var view = glu.provider.view(vm, viewSpec, parent);
        view._bindings = view._bindings || [];
        view._bindings.viewmodel = vm;
        return view;
    },

    /**
     * Locate a glu provider component.
     * @param {String} id The id of the component to locate
     * @return {Object}
     */
    getCmp:function (id) {
        return glu.provider.getCmp(id);
    },
    S4:function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    },
    /**
     * Generate a guid.
     * @param {String} prefix An optional prefix to start the guid with.
     * @return {String}
     */
    guid:function (prefix) {
        return ((prefix ? prefix : 'a') + this.S4() + this.S4() + this.S4() + this.S4() + this.S4() + this.S4() + this.S4() + this.S4());
    },
    /**
     * Returns true if the passed value is a JavaScript array, otherwise false.
     * @param {Mixed} value The value to test
     * @return {Boolean}
     */
    isArray:function (value) {
        return Object.prototype.toString.apply(value) === '[object Array]';
    },
    /**
     * Returns true if the passed value is a JavaScript Object, otherwise false.
     * @param {Mixed} value The value to test
     * @return {Boolean}
     */
    isObject:function (target) {
        //return typeof(target)=='object';
        return !!target && Object.prototype.toString.call(target) === '[object Object]';
    },
    /**
     * Returns true if the passed object is a JavaScript date object, otherwise false.
     * @param {Object} object The object to test
     * @return {Boolean}
     */
    isDate:function (value) {
        return Object.prototype.toString.apply(value) === '[object Date]';
    },
    /**
     * Returns true if the passed value is a JavaScript Function, otherwise false.
     * @param {Mixed} value The value to test
     * @return {Boolean}
     */
    isFunction:function (target) {
        return typeof(target) == 'function';
    },
    /**
     * Returns true if the passed value is a string.
     * @param {Mixed} value The value to test
     * @return {Boolean}
     */
    isString:function (target) {
        return typeof(target) == 'string';
    },

    isNumber:function (target) {
        return typeof(target) == 'number';
    },

    /**
     * Returns true if this is an actual instantiated view model
     */
    isInstantiated:function(target){
        return target._private;
    },

    namespaces:{},
    /**
     * Creates namespace to be used for scoping variables and classes so that they are not global.
     * Specifying the last node of a namespace implicitly creates all other nodes. Usage:
     * <pre><code>
     Ext.namespace('company.app1')
     company.app1.Widget = function() { ... }
     </code></pre>
     * @param {String} namespace
     * @return {Object} The namespace object.
     */
    namespace:function (str) {
        //if (this.namespaces[str]) return this.namespaces[str];

        var tokens = str.split('\.');
        var root = window;
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            var existingChild = root[token];
            if (existingChild === undefined) {
                existingChild = {};
                root[token] = existingChild;
            }
            root = existingChild;
        }
        this.namespaces[str] = root;
        return root;
    },

    /**
     *  Walks a long object path (foo.bar.prop) without using eval to find the value at the end.
     *  Unlike namespace will not create the path if it does not exist
     *  @return {Object} the path, or null if it doesn't exist
     */
    walk:function (str, root) {
        if (str==null) return null;
        var tokens = str.split('\.');
        root = root || window;
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            var existingChild = root[token];
            if (existingChild === undefined) {
                return null;
            }
            root = existingChild;
        }
        return root;
    },

    /**
     * Copies all the properties of config to obj.
     * @param {Object} target The receiver of the properties
     * @param {Object} src The source of the properties
     * @param {Object} defaults A different object that will also be applied for default values
     * @return {Object} returns target
     */
    apply:function (obj, config, defaults) {
        return glu.provider.apply(obj, config, defaults);
    },

    /**
     * Copies all the properties of config to obj, skipping if the property already exists on the target.
     * @param {Object} target The receiver of the properties
     * @param {Object} src The source of the properties
     * @param {Object} defaults A different object that will also be applied for default values
     * @return {Object} returns target
     */
    applyIf:function (obj, config, defaults) {
        return Ext.applyIf(obj, config, defaults);
    },

    /**
     * Deep clones an object property by property from a source to a target
     * @param target
     * @param src
     * @param noOverwrite
     * @return {Object} the target
     */
    deepApply:function (target, config, noOverwrite) {
        for (var propName in config) {
            var propValue = config[propName];
            if (glu.isObject(propValue) &&
                propName !== "parentVM" && //parent view model
                propName !== 'rootVM' && //root view model
                propName !== 'parentList' && //parent list
                propName !== 'meta' && //don't remember
                propName !== 'ownerCt' &&
                !glu.isInstantiated(propValue) //make sure this isn't a glu object
                )
            {
//                if (propValue.constructor!==Object.prototype.constructor) {
//                    debugger;
//                    throw 'Please only use raw objects to configure a view or view model, not other glu objects';
//                }
                target[propName] = target[propName] || {};
                glu.deepApply(target[propName], propValue, noOverwrite);
                continue;
            }
            if (noOverwrite && target.hasOwnProperty(propName)) continue;
            if (glu.isArray(propValue)) {
                var newArray = [];
                for (var i = 0; i < propValue.length; i++) {
                    var item = propValue[i];
                    if (glu.isObject(item)) {
                        var newtarget = {};
                        glu.deepApply(newtarget, item, noOverwrite);
                        newArray.push(newtarget);
                    } else {
                        newArray.push(item);
                    }
                }
                target[propName] = newArray;
                continue;
            }
            //primitive or function
            target[propName] = propValue;
        }
        return target;
    },

    /**
     * Deep clones an object property by property from a source to a target, skipping if the target property exists
     * @param target
     * @param src
     * @param noOverwrite
     * @return {Object} the target
     */
    deepApplyIf:function (obj, config) {
        return glu.deepApply(obj, config, true)
    },
    /*
     * Mixins or Traits are object snippets with properties and behavior that are added into an object
     * Unlike extjs plugins, they are parameterless and have a correctly scoped 'this' on initialization
     * In other words, they really are "mixed in" to the javascript object
     * This eliminates much of the syntactic cruft of trying to make javascript 'object-oriented'
     * While still giving the same basic feel
     * Mixins are the preferred way to go when you can do it as it makes things very simple...
     */
    traitReg:{},

    regTrait:function (name, trait) {
        this.traitReg[name] = trait;
    },

    mixin:function () {
        var target = arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            this.mixinSingleTrait(target, arguments[i]);
        }
    },

    mixinSingleTrait:function (target, traitName) {
        glu.log.info('asked to mixin trait ' + traitName);
        if (!glu.isString(traitName)) {
            throw new Error("You must pass in the short string name of the trait, not the trait itself");
        }
        if (target.traits === undefined) {
            target.traits = {};
        }
        if (target.traits[traitName] != null) {
            return;
        }

        var trait = new this.traitReg[traitName];
        if (trait === undefined) {
            throw new Error("no such trait '" + traitName + "' exists");
        }

        if (trait.requiresTrait != null) {
            glu.log.info('processing ' + trait.requiresTrait.length + ' requirements');
            for (var i = 0; i < trait.requiresTrait.length; i++) {
                var traitRef = trait.requiresTrait[i];
                this.mixin(target, traitRef);
            }
        }
        //apply everything...


        var stripped = glu.apply({}, trait); //clone
        var initTrait = stripped.initTrait; //some traits have an initializer
        delete stripped.initTrait; //don't mixin the init funciton!
        delete stripped.requiresTrait;
        this.apply(target, trait);
        glu.log.info(initTrait);
        if (initTrait != null) {
            initTrait.call(target);
        }
        target.traits[trait] = true;
    },
    mreg:function (mtype, constructor) {
        this.mtypeRegistry[mtype] = constructor;
    },

    localizer:function (config) { //logic is not exposed for now
        var nsGlobal = glu.namespace(config.ns + '.' + glu.conventions.localeNs);
        if (nsGlobal === undefined) throw new Error('Could not find locale for namespace ' + config.ns);
        var viewSpecific = config.viewmodel ? (nsGlobal[config.viewmodel.viewmodelName] || nsGlobal[config.viewmodel.recType] || {}) : {};
        var key = config.key;
        var value = viewSpecific[key] ||
            nsGlobal[key] ||
            glu.conventions.asLocaleKey(key);
        if (value.indexOf('{') > -1) {
            value = glu.string(value).format(config.params, config.viewmodel);
        }
        return value;
    },

    /**
     * Localizes based on either simple key lookup or with an array of parameters
     * @param config
     *  @param ns
     *  @param viewmodel
     *  @param params
     * @return {*}
     */
    localize:function (key, cfg) {
        if (glu.isObject(key)) {
            cfg = key;
        } else {
            cfg.key = key;
        }
        if( cfg.key.indexOf(glu.conventions.localizeStart) == 0 && glu.symbol(cfg.key).endsWith(glu.conventions.localizeEnd) ){
            cfg.key = cfg.key.substring(glu.conventions.localizeStart.length, cfg.key.length - glu.conventions.localizeEnd.length);
        }
        cfg.ns = cfg.ns || cfg.viewmodel.ns;
        cfg.params = cfg.params || {};
        return this.localizer(cfg);
    },

    /**
     * Sets the default localizer
     * @param fn The localize function (see localize for its signature)
     */
    setLocalizer:function (fn) {
        this.localizer = fn;
    },
    confirm:function (title, message, fn, scope) {
        return glu.provider.confirm(title, message, fn, scope);
    },
    message:function (title, message, fn, scope) {
        return glu.provider.message(title, message, fn, scope);
    },
    prompt:function (title, message, fn, scope) {
        return glu.provider.prompt(title, message, fn, scope);
    },

    /**
     * Registers a GluJS view adapter
     * @param name {String} the name of the adapter (the xtype if a component adapter)
     * @param adatper {Object} the adapter definition
     */
    regAdapter:function (name, adapter) {
        return glu.provider.regAdapter(name, adapter);
    },
    regBindingDirective:function (name, bindingDirective) {
        this.bindingDirectiveRegistry[name] = bindingDirective;
    },

    /*
     *         @{foo} //bind to foo if available, throw exception if cannot find
     *         @?{foo} //bind to foo if available, ignore if not
     *         @{!foo} //bind to inverse of foo if a boolean
     *        I am @{foo}; hear me roar //make a string substitution
     *         @>{foo} //oneway binding from model to view, do not track view back to model
     *         @1{foo} //bind one-time but do not track changes to foo
     */
    parseBindingSyntax:function (bindingString) {
        if (!glu.isString(bindingString)) {
            return null; //not a binding
        }
        if ((bindingString.indexOf(glu.conventions.startDelimiter) == -1 && bindingString.indexOf(glu.conventions.localizeStart) == -1)) {
            return null; //not using bind syntax and not using localization
        }
        if ((bindingString.indexOf(glu.conventions.endDelimiter) == -1 && bindingString.indexOf(glu.conventions.localizeEnd) == -1)) {
            return {
                valid:false,
                bindExpression:bindingString,
                reason:'Syntax Error: Missing closing delimiter'
            };
        }
        var results = null;

        if (bindingString.indexOf(glu.conventions.localizeStart) == 0) {
            return {
                valid:true,
                bindExpression:bindingString,
                localizationKey:bindingString.substring(glu.conventions.localizeStart.length, bindingString.length - glu.conventions.localizeEnd.length)
            };
        }

        var boundObjectRegx = new RegExp(glu.conventions.bindingSymbol + "(.*?)\\" + glu.conventions.startDelimiter);
        var boundObjectResults = bindingString.match(boundObjectRegx);
        if (glu.isArray(boundObjectResults) && boundObjectResults.length > 0) {
            var directive = boundObjectResults[boundObjectResults.length - 1];
            if (!directive) {
                directive = 'tocontrol';
            }
            for (var k in this.bindingDirectiveRegistry) {
                var symbols = this.bindingDirectiveRegistry[k].symbols;
                for (var i = 0; i < symbols.length; i++) {
                    if (symbols[i] == directive) {

                        results = glu.apply({valid:true}, this.bindingDirectiveRegistry[k]);

                        var directiveRegx = new RegExp("\\" + glu.conventions.startDelimiter + "(.*?)\\" + glu.conventions.endDelimiter);
                        var directiveResults = bindingString.match(directiveRegx);
                        if (glu.isArray(directiveResults) && directiveResults.length > 0) {
                            results.bindExpression = directiveResults[directiveResults.length - 1];
                        }
                        results.isFormula = false;
                        var startDelimiterLocation = bindingString.indexOf(glu.conventions.bindingSymbol);
                        var endDelimiterLocation = bindingString.indexOf(glu.conventions.endDelimiter);
                        if (startDelimiterLocation > 0 || endDelimiterLocation < bindingString.length - glu.conventions.endDelimiter.length) {
                            //it's a 'inline string.format'
                            //ONLY SUPPORT A SINGLE PROPERTY for now...
                            results.isFormula = true;
                            results.prefix = bindingString.substring(0, startDelimiterLocation);
                            results.suffix = bindingString.substring(endDelimiterLocation + 1);
                        }
//                        console.log(glu.provider.json.stringify(results));
                        return results;
                    }
                }
            }

        }
        return results;
    },
    openWindow:function (config, viewModel) {
        return glu.provider.openWindow(config, viewModel);
    },
    /**
     * Creates a glu ViewPort
     */
    viewport : function(config){
        return glu.provider.viewport(config);
    },
    panel:function () {
        return glu.provider.panel.apply(glu.provider, arguments);
    },
    equivalent:function (oldVal, newVal) {
        if ((oldVal == null && newVal != null) || (oldVal != null && newVal == null)) return false
        if (glu.isArray(newVal)){
            //array equivalency is if all the members are equivalent...
            if (oldVal==newVal){
                return true;
            }
            if (oldVal.length!=newVal.length) return false;
            for (var i=0;i<oldVal.length;i++){
                if (oldVal[i]!=newVal[i]) return false;
            }
            return true;
        }
        if (glu.isObject(newVal)) {
            if (newVal == oldVal) {//by reference
                return true;
            }
            //do comparison?
//            try {
//                return JSON.stringify(oldVal) == JSON.stringify(newVal);
//            } catch (excp) {
//                return false; //if cannot stringify, then does not count...
//            }
        }
        return oldVal === newVal;
    },
    setTestMode:function () {
        this.testMode = true;
    },

    validations:{
        notEmpty:function (prop) {
            return function () {
                var val = this.get(prop);
                if (val == null || val == '') {
                    return 'This field is required.';
                }
                return true;
            }
        }
    },

    widget:function (config) {
        return glu.provider.widget(config);
    },

    _splitReference:function (fqname) {
        var splitAt = fqname.lastIndexOf('\.');
        if (splitAt === -1) {
            throw new Error("Reference '" + fqname + "' requires a namespace");
        }
        return {
            ns:fqname.substring(0, splitAt),
            name:fqname.substring(splitAt + 1)
        };
    },
    def:function (fqname, config, location) {
        var capture = this._splitReference(fqname, config, location);
        var nsObj = glu.ns(capture.ns + '.' + location);
        nsObj[capture.name] = config;
    },

    /**
     * Defines a view model (see Glu.ViewModel)
     *
     * @param {String} fqname The name of the view model
     * @param {Object} config The view model configuration
     *
     */
    defModel:function (fqname, config) {
        this.def(fqname, config, glu.conventions.viewmodelNs);
    },

    /**
     * Defines a view according to the provider (e.g. ExtJS) using the provider's declarative JSON syntax
     * @param {String} fqname The name of the view
     * @param {String} viewmode (optional) Indicates the mode of this view
     * @param {String} config The declarative configuration of the view
     */
    defView:function (fqname, viewmode, config) {
        if (glu.isString(viewmode)){
            fqname = fqname + '_' + viewmode;
        } else {
            config = viewmode;
        }
        this.def(fqname, config, glu.conventions.viewNs);
    },

    extend:function (baseConstructor, classDef) {
        var constructor = classDef.constructor === Object ? function () {
            baseConstructor.apply(this, arguments);
        } : classDef.constructor;
        //dummy function to serve as temporary constructor so that we don't invoke actual base constructor until parent constructor chooses
        var tempBaseConstructor = function () {
        };
        tempBaseConstructor.prototype = baseConstructor.prototype;
        constructor.prototype = new tempBaseConstructor();
        //for chaining within the child constructor function
        constructor.superclass = baseConstructor.prototype;
        constructor.prototype.constructor = constructor;
        delete classDef.constructor;
        glu.apply(constructor.prototype, classDef);
        return constructor;
    },

    define:function (name, classDef) {
        var baseCls = glu.walk(classDef.extend) || function(){};
        var cls = glu.extend (baseCls, classDef);
        var ref = glu._splitReference(name);
        glu.ns(ref.ns)[ref.name] = cls;
        return cls;
    },

    /**
     * Informs glu that the UI is about to be changed. Used for accumulating UI changes (like
     * suspending layouts in ExtJS until the thread is done)
     */
    updatingUI : function(){
        glu.provider.updatingUI();
    },

    getDataTypeOf:function (value) {
        if (glu.isString(value)) {
            type = 'string';
        }
        else if (glu.isNumber(value)) {
            type = 'int';
        }
        else if (Ext.isBoolean(value)) {
            type = 'boolean';
        }
        else if (glu.isObject(value)) {
            type = 'object';
        }
        else if (Ext.isDate(value)) {
            type = 'date';
        }
        return type;
    },

    plugin : function(name) {
        this.plugins.push(name);
    },

    plugins:[]
};


if (window.existingGlu) {
    glu.provider = existingGlu.provider;
    glu.apply(glu,existingGlu);
    delete window.existingGlu;
}

glu.ns = glu.namespace; //alias

//register the "empty" panel that can be configured at run time.
if (Ext.getProvider().provider != 'touch') {
    glu.panel('glupanel', {});
}




/*
 * Copyright (C) 2012 by CoNarrative
 */

if (window.glu === undefined) {
    glu = {}
}
glu.conventions = {
    localizeStart:'~~',
    localizeEnd:'~~',
    localeNs:'locale',
    bindingSymbol:'@',
    /* DOCS DISABLED FOR NOW
     * <p>The start delimiter to identify view model replacement variables in a view spec.</p>
     * <p>The default value is<div class="mdetail-params">@{</div>
     *  @type String
     */
    startDelimiter:'{',
    /* DOCS DISABLED FOR NOW
     * <p>The end delimiter to identify view model replacement variables in a view spec.</p>
     * <p>The default value is<div class="mdetail-params">}</div>
     *  @type String
     */
    endDelimiter:'}',
    autoUp:'..',
    not:'!',
    windowPath:'/',
    parentProperty:'parentVM',

    specSuffix:'',
    viewmodelNs:'viewmodels',
    viewNs:'views',
    lookupNs:'lookups',

    bindProp:function (propname) {
        return this.expression(propname);
    },

    asLocaleKey : function(propName) {
        return this.localizeStart + propName + this.localizeEnd;
    },

    expression:function (propname, options) {
        if (!options) {
            return this.bindingSymbol + this.startDelimiter + propname + this.endDelimiter;
        }
        var str = this.bindingSymbol;
        if (options.optional) {
            str = str + '?';
        }
        if (options.onetime) {
            str = str + '1';
        }
        str = str + this.startDelimiter;
        if (options.not) {
            str = str + this.not;
        }
        if (options.root) {
            str = str + this.windowPath;
        }
        if (options.up) {
            str = str + this.autoUp
        }
        return str + propname + this.endDelimiter;
    },

    build:function () {
        var expr = glu.conventions.bindingSymbol;
        return {
            start:function () {
                expr += glu.conventions.startDelimiter;
                return this;
            },
            root:function () {
                expr += glu.conventions.windowPath;
                return this;
            },
            allUp:function () {
                expr += glu.conventions.autoUp;
                return this;
            },
            up:function () {
                expr += glu.conventions.parentProperty;
                return this;
            },
            prop:function (prop) {
                expr += '.' + prop;
                return this;
            },
            lookupNs:function () {
                expr += '.' + glu.conventions.lookupNs;
                return this;
            },
            literal:function (lit) {
                expr += lit;
                return this;
            },
            dot:function () {
                expr += '.';
                return this;
            },
            end:function () {
                return expr + glu.conventions.endDelimiter;
            }
        }
    }

};

// register bindingConventions
glu.regBindingDirective('onetime', {
    symbols:['onetime', '1'],
    onetime:true,
    oneway:true,
    toModel:false,
    toControl:true
});

glu.regBindingDirective('twoway', {
    symbols:['twoway', '<>'],
    onetime:false,
    oneway:false,
    toModel:true,
    toControl:true
});

glu.regBindingDirective('tocontrol', {
    symbols:['tocontrol', '>'],
    onetime:false,
    oneway:true,
    toModel:false,
    toControl:true
});

glu.regBindingDirective('optional', {
    symbols:['optional', '?'],
    optional:true,
    toModel:true,
    toControl:true
});



/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.Viewmodel
 * The view model is the "common sense" representation of application state and behavior. A 'root' view model represents
 * the application as a whole (or the module if you are a sub-app within a 'portal'), while other view models represent
 * various screens (tabs, etc.) or areas of a screen.
 * ##Defining and creating a view model
 *
 * A view model can be defined and instantiated on the fly from within a view model :
 *      var model = this.model ({
 *          status: 'OK'
 *      });
 *      //or for a dialog
 *      this.open ({
 *          status: 'OK'
 *      });
 * or it can be defined first (with namespace) and then referenced later through the 'mtype' property (as long
 * as you are in the same namespace):
 *      glu.defModel('example.main', {
 *          status : 'OK'
 *      });
 *      var vm = this.model ({
 *          mtype : 'main'
 *      });
 *
 * A view model can also be defined 'inline' within a containing view model using an 'mtype' property of 'viewmodel'
 *      glu.defModel('example.main', {
 *          detail : {
 *              mtype : 'viewmodel',
 *              myProp : 'A'
 *          }
 *      });
 *
 * or simply by reference
 *      glu.defModel('example.subscreen', {
 *          myProp : 'A'
 *      });
 *      glu.defModel('example.main', {
 *          detail : {
 *              mtype : 'subscreen'
 *          }
 *      });
 *
 * Referenced view models are fully parameterizable, so you can initialize any of the values with overrides:
 *      glu.defModel('example.main', {
 *          status : 'OK'
 *      });
 *      //...later...
 *      var vm = this.model({
 *          mtype : 'main',
 *          status : 'BAD'
 *      );
 *
 * A 'root' view model can be instantiated by one of several entry points, but most typically by setting it as the 'app':
 *      glu.app('example.main');
 * or
 *      glu.app({
 *          mtype :'example.main',
 *          //optional parameters...
 *      });
 * or it can be included as a subpanel of an already existing application panel:
 *      //...
 *      items : [{
 *          xtype: 'glupanel',
 *          viewmodelConfig : {
 *              mtype : 'main',
 *              //optional parameters...
 *          }
 *      }],
 *      //...
 * or (usually just for testing) you can start one with a fully qualified namespace
 *      var vm = glu.model('example.main');
 *
 * ## View model parts
 * The view model is composed of several distinct parts that represent your application state and behavior:
 *
 * *    Properties: Hold states that various parts of the screen can be in. Usually correspond to things that the user can set
 *      (like the contents of a text field, or the currently active tab, or which rows of a grid are selected).
 * *    Formulas: Calculated properties that respond to changes in properties or other formulas. By their nature, they are
 *      read-only so they typically represent the app 'responding' to user interaction. Glu will analyze the formula and keep it
 *      updated when input properties change.
 * *    Submodels: Contains various subscreens and lists of subscreens (glu is for full applications so view models are always
 *      in a hierarchy with a single root). There is also a special 'parentVM' property to find any view model's container.
 * *    Commands: Actions that the user can take that aren't represented by simple properties. For instance, a save button or
 *      hitting the 'close window' indicator.
 * *    Reactors: Rules that are triggered on property / formula changes so you don't have to put all of your side-effects
 *      into the property setter. For instance, refreshing the grid when any of several filters change. A formula is really a
 *      special type of reactor where the action is setting a single property; if it's more complicated, use a reactor.
 *
 *
 * ## Example
 *      glu.model({
 *          //PROPERTIES
 *          classroomName : 'Science',
 *          status : 'OK',
 *
 *          //FORMULAS
 *          classroomNameIsValid : function() { return this.classroomName !== '';}
 *          statusIsEnabled : function(){ return this.classroomNameIsValid;}
 *
 *          //SUBMODELS
 *          students : {
 *              mtype : 'list'
 *              items : [{
 *                  mtype : 'student',
 *                  firstName : 'Mike'
 *              }]
 *          }
 *
 *          //COMMANDS
 *          clear : function() {
 *              this.set('firstName','');
 *              this.set('status','OK');
 *          }
 *
 *          //REACTORS
 *          when_status_is_not_ok_then_fetch_problem_detail : {
 *              on : ['statusChanged'],
 *              action : function() {
 *                  if (this.status!=='OK'){
 *                      //fetch problem detail
 *                  }
 *              }
 *          }
 *      });
 *
 * ## Properties
 * Properties are declared simply by adding a property to the config object. The initial value will be whatever is provided.
 *      foo : 'we are foo'
 * Properties are accessed through the 'get' and 'set' methods. You can also read properties by simply reading the backing property directly:
 *      this.foo
 * As long as the property is bound or a reactive formulas, the value will always be current with UI state so a getter
 * is not strictly necessary. It is a matter of preference whether you access the property directly or call
 *      get ('foo')
 * to keep the get behavior encapsulated within the viewmodel.
 * To change get/set behavior (not usually recommended), you can manually add get/set overrides by using the convention:
 *      getFoo : function(){ return...}
 *      setFoo : function(value) {
 *         this.setRaw('foo',value);
 *      }
 * Calls to get() and set() will honor these overrides.
 *
 * In the future, we may provide either automatic getter/setters [getFoo() / setFoo('value')] and/or
 * Knockout-style getters/setters [foo()/foo('value')] if there is demand (we have experimented with both but always fallen back
 * to our old ways)
 *
 * ## Formulas
 * Formulas are read-only properties that respond to changes in other properties. To declare a formula, put a '$' at
 * the end of the name (this won't become part of its name but is just a flag) and then supply a function that returns
 * a value:
 *      saveIsEnabled$: function(){return this.isValid && this.isDirty;}
 * GluJS will scan the function and find property change events to listen for and so will automatically keep up to date with a minimum
 * of recalculation. In the example above,
 * if (and only if) the 'isValid' or 'isDirty' properties change, it will update the value of 'saveIsEnabled'.
 * Formulas can also be chained: in the example above both 'isValid' and 'isDirty' are actually other formulas!
 *
 * #### IsValid
 * There is one bit of magic-by-convention with formulas. If you name a formula such that it ends with 'IsValid', it will automatically
 * contribute to a global 'isValid' property on the view model. When all such formulas return true, then the global 'isValid' will
 * also be true.
 *
 * ## Submodels
 *
 * GluJS is a framework for quickly developing real applications with complex navigation and screens. Very often you'll want to split your
 * view models in parts. The initial example above has a list of 'student' view models. This list could correspond on the screen to
 * a set of items in a mobile list or a set of tabs. This is just one of the built-in UI composition patterns within gluJS.
 * Submodels are indicated by using the 'mtype' property within a nested object.
 *
 * ## Commands
 *
 * Whenever the user needs to take an action that isn't necessarily as simple as updating a property - especially when it involves
 * an Ajax call - then that is a command.
 * Typical commands are 'save', 'refresh', etc. They are declared simply by providing a function:
 *      save : function(){
 *          //...
 *      }
 * Very often, behavior that could be a command can really be expressed as properties. For instance, the
 * 'collapse' button on a panel could be a 'collapse' command. But it also could be more simply
 * modeled by a property:
 *      detailIsExpanded : true
 * Now you can get both collapse and expand in a single property and a single binding - and you have some state you can use
 * for other behavior (like in a formula).
 * Whenever possible, see if what you're trying to do can be reduced to a property and go with that.
 *
 * ## Reactors
 *
 * The reactor pattern is simply a shortcut to managing "event observers". It's a powerful way to reduce code clutter and break
 * out different UI behavior as "rules". For instance, if you want to refresh the grid whenever any one of five different properties
 * change, you could call 'refreshgrid' in each of those property setters. Or, you could simply state the following:
 *      When_a_grid_related_property_changes_Then_refresh_grid : {
 *          on : ['propertyAChanged','propertyBChanged','propertyCChanged','propertyDChanged','propertyEChanged'],
 *          action : function(){
 *              this.refreshStudents();
 *          }
 *      }
 * Later when you realize that you'd like to load only on an explicit refresh or just need to temporarily suppress the behavior for
 * debugging, you can just comment it out and "switch off" the behavior in one place.
 * While this is an entirely optional pattern, it is a natural and powerful fit for building reactive UIs.
 *
 * ## Convenience methods
 *
 * There are a number of convenience methods that are commonly used within a view model. Use them
 * instead of the matching ones on the 'glu' object because they
 * *    pass in the local namespace
 * *    set the scope of any callback to the viewmodel (so 'this' always refers to the view model)
 * *    automatically create parent/child associations where appropriate
 * *    are automatically mocked as needed by the simulation/testing framework just on that view model without breaking core 'glu' for other view models.
 *
 * The methods are as follows:
 *
 * *   localize
 * *   confirm
 * *   message
 * *   open
 * *   ajax
 * *   model
 */
glu.Viewmodel = glu.extend(Object, {

    constructor:function (config) {
        glu.log.debug('BEGIN viewmodel construction');
        glu.Viewmodel.superclass.constructor.call(this);
        this._setRawMessage = glu.symbol('{vmName}.{name}: {oldValue} --> {newValue}');
        glu.deepApply(this, config);
        this._private = this._private || {};
        this._private.setters = {};
        this._private.meta = {};
        //TO DO - separate between formulas and reactors proper...
        this._private.reactors = [];
        this._private.data = this._private.data || {};
        new glu.GraphObservable({vm:this});
        this._private.viewmodelName = config.viewmodelName;
        this._private.children = [];
        this._private.isInitialized=false;

        //A view model either always has a parent or is the root. It has a parent even if "disconnected".
        //so need a different way to register disconnection than being null
        this.rootVM = this.parentVM ? this.parentVM.rootVM : this;

        delete config.viewmodelName;

        //configure lazy initialization so children are not initialized until parent is complete
        this.init = function () {
            if (this._private && this._private.isInitialized) {
                glu.log.warn('attempted to initialize an already initialized view model. Init() is a lifecycle function so please put any code you need to call multiple times elsewhere.');
                return;
            }
            this._private.isInitialized=true;
            if (config.init) {
                config.init.apply(this,arguments);
            }
            this.initChildren();
            if (config.initComplete) {
                config.initComplete.apply(this,arguments);
            }
        };
        this.activate = config.activate || function () {
        };
        this.deactivate = config.deactivate || function () {
        };
        this.close = config.close || this.doClose;

        //run a custom onCreate if it exists
        if (config.onCreate) {
            config.onCreate.call(this);
        }
        //build sub models, generate setters/getters and wire event listeners
        this._walkConfig();

        //set all reactors...
        this.firingInitialReactors = true;
        for (var i = 0; i < this._private.reactors.length; i++) {
            var reactor = this._private.reactors[i];
            if (reactor.init) reactor.init();
        }
        delete this.firingInitialReactors;
        this._private.isInstantiated = true;
        if (glu.testMode) {
            this.message = jasmine.createSpy('message');
            this.confirm = jasmine.createSpy('confirm');
            this.prompt = jasmine.createSpy('prompt');
            var me = this;
            this.confirm.respond = function(btn,txt){me._fakeRespond('confirm',btn,txt);};
            this.message.respond = function(btn,txt){me._fakeRespond('message',btn,txt);};
            this.prompt.respond = function(btn,txt){me._fakeRespond('prompt',btn,txt);};
        }
        glu.log.debug('END viewmodel construction');
    },

    _fakeRespond:function(action, btn, txt) {
        //TODO: Respond to confirmations in order in case they have stacked.
        var next = this[action].mostRecentCall;
        if (next === undefined || next.args === undefined || next.args.length === 0) {
            throw action +  "was never called"
        }
        var fn=Ext.isString(next.args[0])?next.args[2]:next.args[0].fn;
        fn.call(this,btn,txt);
    },

    /**
     * Performs the underlying close operation on this view model. Of course this only makes sense where the viewmodel
     * corresponds to either a floating dialog, a screen on a mobile stack, or an item in a container (tabpanel, card, etc.)
     */
    doClose:function () {
        if (this.parentList) {
            this.parentList.remove(this);
        }
        this.fireEvent('closed', this);
    },

    /**
     * Returns the value of a property.
     * @param propName
     * @return {*}
     */
    get:function (propName) { //TODO: Use base model implementaiton
        return this.getRaw(propName);
    },

    /**
     * Sets the value of a property. If there is a custom setter defined, it will use that instead.
     * @param propName
     * @param value
     */
    set:function (propName, value) {
        var setter = this._private.setters[propName];
        if (setter === undefined) {
            throw new Error('Cannot set: This view model has no property named ' + propName);
            // this.makePropertyAccessors(propName);
            // customSetter = this[customSetterName];
        }
        setter.call(this, value);
    },

    toString:function(){
        //default to some common identifiers
        var label = this.name || this.id || '?';
        return '[' + this.viewmodelName + ' ' + label + ']'
    },
    /**
     * Sets the raw value of a property and bypasses any custom setter. This is usually used within
     * the custom setter itself to set the underlying property after any preprocessing.
     * @param propName
     * @param value
     */
    setRaw:function (propName, value, asSideEffect) {
        var subModel = glu.isObject(value) && value._ob; //the value is an observable view model
        if (this[propName] && this[propName]._ob) {
            this._ob.detach(propName);
        }
        var oldValue = this.get(propName);
        if (glu.equivalent(oldValue, value)) {
            return; //do nothing if it's the same thing.
        }
        if (!this.firingInitialReactors) glu.log.info(this._setRawMessage.format({vmName:this.toString(),name:propName,newValue:value,oldValue:oldValue}));
        this._private.data[propName] = value;
        if (!glu.isFunction(this[propName])) { //if not in "knockout" mode
            this[propName] = value;
        }
        this.fireEvent(propName + 'Changed', value, oldValue, {
            modelPropName:propName
        });
        this.fireEvent('propertychanged',propName,value,oldValue);
        if (this[propName] && this[propName]._ob) {
            this._ob.attach(propName);
        }
        if (asSideEffect != true) {
            //changed only fires once for a whole reactor chain...
            this.fireEvent('changed', propName, value, oldValue);
        }
    },
    getRaw:function (propName) {
        if (this._private.data.hasOwnProperty(propName)) {
            return this._private.data[propName];
        }
        return this[propName];
    },

    getPropertyInfo :function(propName){
        var value = this.get(propName);
        var type = glu.getDataTypeOf(value);
        return {
            name : propName,
            type : type
        }
    },

    /**
     * Adds a listener for a view model event with a default scope of the view model itself
     * The formula and reactor patterns (see above) means there is little reason to use this directly within a viewmodel.
     * @param eventName
     * @param handler
     * @param scope
     */
    on:function (eventName, handler, scope) {
        scope = scope || this;
        this._ob.on(eventName, handler, scope);
    },

    /**
     * Fires off an event to any observers.
     * There is usually little reason to call this directly, unless you are doing a broadcast pattern to children
     * in which some of them may opt in and others don't. In other cases (and within the viewmodel), it is usually
     * better just to invoke methods directly for clarity.
     */
    fireEvent:function () {
        glu.log.debug('Viewmodel "' + this.referenceName + '" is firing event "' + arguments[0] + '""');
        this._ob.fireEvent.apply(this._ob, arguments);
    },

    _walkConfig:function () {
        var propNames = [];
        for (var propName in this) {
            propNames.push(propName);
        }
        for (var i = 0; i < propNames.length; i++) {
            var propName = propNames[i];
            if (this.hasOwnProperty(propName)) {
                this._processConfigProperty(propName);
            }
        }
    },

    _processConfigProperty:function (propName, propValue) {
        //ignore reserved words...
        if (propName === '_private' || propName === 'requiresTrait' || propName === 'set' ||
            propName === 'get' || propName === 'referenceName' || propName === 'viewmodelName' ||
            propName === 'ns' || propName === 'mtype' || propName === 'parentList' ||
            propName === 'rootVM' || propName === glu.conventions.parentProperty ) {
            return;
        }
        propValue = propValue || this[propName];

        if (glu.isFunction(propValue) && propName.substring(0, 2) == 'on' && propName.substring(2, 3).toUpperCase() == propName.substring(2, 3)) {
            //switch to being a rule
            var action = propValue;
            propValue = {
                on:propName.substring(2),
                action:action
            };
        }
        if (glu.isFunction(propValue) && propName.match(/\$$/)) {
            //switch to being a formula
            propName = propName.substring(0,propName.length - 1);
            propValue = {
                on : '$',
                formula:propValue
            };
        }

        if (glu.isFunction(propValue)) {
            //a regular action - no need for further processing.
            return;
        }

        if (glu.isObject(propValue) && glu.Reactor.is(propValue)) {
            //REACTOR!
            if (propValue.formula && propName.match(/IsValid$/)) {
                //We automatically make a global 'isValid' if you introduce anything ending in IsValid
                this._processValidator(propName, propValue);
            }
            if (propValue.formula) {
                glu.log.debug("Building formula " + propName);
            } else {
                glu.log.debug("Building reaction " + propName);
            }
            this._private.reactors.push(glu.Reactor.build(propName, propValue, this));
        }

        if (glu.isObject(propValue) && propValue.hasOwnProperty('mtype')) {
            //SUBMODEL!
            propValue.referenceName = propName;
            this._private.children.push(propName);
            var model = glu.isInstantiated(propValue)? propValue: this.model(propValue);
            propValue = model;
            this[propName] = model;
            //attach (so that it doesn't matter what order the graph was built up in...
            this._ob.attach(propName,model,"parentVM");
            this.makePropertyAccessors(propName,propValue,true);
            return;
        }

        //a regular property with either a value or an non-model sub-object
        glu.log.debug('Adding setter/getter for "' + propName + '"');

        this.makePropertyAccessors(propName, propValue);
    },

    _processValidator:function (propName, propValue) {
        var formula = propValue.formula;
        var me = this;
        function updateGlobalValidity (newVal) {
            var valid = newVal;
            var actual = valid;
            if (glu.isString(valid)) { //strings mark it as invalid
                valid = false;
            }
            var oldValid = me._private.validMap.hasOwnProperty(propName) ? me._private.validMap[propName] : true;
            if (oldValid && !valid) {
                me._private.invalidCount++;
            }
            if (!oldValid && valid) {
                me._private.invalidCount--;
            }
            me._private.validMap[propName] = valid;
            me.setRaw('isValid', me._private.invalidCount == 0);
            return actual;
        };
        this.on (propName+'Changed',function(newVal){
            updateGlobalValidity(newVal);
        },this);
        this._private.hasValidators = true;
        this._private.validMap = this._private.validMap || {};
        this._private.invalidCount = 0;
        this.isValid = true;
        this.makePropertyAccessors('isValid', true);
    },

    makePropertyAccessors:function (propName, initialValue, isChildModel) {
        this._private.data[propName] = initialValue;
        var me = this;
        var setter = this['set' + glu.string(propName).toPascalCase()] ||
            function (value) {
                me.setRaw(propName, value, isChildModel);
            };
        this._private.setters[propName] = setter;
        this._private.meta[propName] = {
            setter : setter,
            isChildModel: isChildModel
        };
        if (false) //TODO: Test for knockout mode
        {
            /*
             * create a special function that calls the setter if a value is
             * passed in, but otherwise returns the getter
             * knockout-style has the advantage of some better "intellisense"
             * but has the disadvantage of making the bind syntax different than
             * javascript access.
             * Example:
             *     Bind:    '@{detail.ssn}'
             *  Concise: this.detail.ssn
             *  KO:         this.detail().ssn()
             *  Safe:    this.detail.get('ssn')
             */

            this[propName] = function () {
                if (arguments.length === 0) {
                    return this.get(propName);
                }
                setter(arguments[0]);
            }
        } else {
            this[propName] = initialValue;
        }
    },

    registerControlBinding:function (modelPropName, control) {
        if (!glu.testMode) {
            return;
        }
        this._private.controlBindings = this._private.controlBindings || {};
        if (!this._private.controlBindings[modelPropName]) {
            this._private.controlBindings[modelPropName] = [];
        }
        this._private.controlBindings[modelPropName].push(control);
    },

    //convenience methods for use by the view models themselves
    /**
     * Creates a new child model for this view model. The child model will not affect any screen behavior until
     * it is added to a list that is bound to a view that displays child components. For instance, to add a new student
     * tab you could do the following:
     *      addStudentScreen : function(id) {
     *          var student = this.model ({mtype:'student', id:di});
     *          student.init(); //load the backing data
     *          this.studentScreens.add(student);
     *      }
     * @param config
     * @return {*}
     */
    model:function (mtype, config) {
        //clean up arguments...
        if (glu.isObject(mtype)) {
            config = mtype;
            mtype = null;
        }
        if (config==null){
            config = {};
        }
        config.mtype=config.mtype || mtype || 'viewmodel';

        config.ns = this.ns;
        config.parentVM = this;
        config.rootVM = this.rootVM;
        var vm = glu.model(config);
        //if this model is itself already initialized and the new model is initializable, init it
        //otherwise, it will be handled through initChildren...
        if (this._private.isInitialized && vm._private && vm.init && !vm._private.isInitialized) {
            vm.init();
        }
        return vm;
    },

    /**
     * Localizes based on the provided lookup key.
     * The view model will be passed in and the default localizer will look for the key in a matching locale namespace
     * first and then go to the root. So for a viewmodel called 'student' and a key called 'grade', both of these would work:
     *      example.locale = {
     *          grade : 'Student Grade'
     *      };
     *      example.locale = {
     *          student : {
     *              grade : 'Student Grade'
     *          }
     *      };
     * Localization keys can also include substitution parameters. If a parameter set is not included in the call, it will be
     * provided off of the view model. So if there was a 'firstName' on the view model, this shortcut would work:
     *      example.locale = {
     *          grade : 'Student Grade for {firstName} {lastName}'
     *      }
     * The default localizer can be overridden with a call to glu.setLocalizer if the localization pattern is already
     * set in stone on an existing project.
     * @param key
     * The look up key
     * @param params
     * The values to be used when substituting within the locale string
     * @return {*}
     */
    localize:function (key, params) {
        return glu.localize({viewmodel:this, key:key, params:params});
    },

    /**
     * Shortcut for a confirmation dialog with a callback.
     * The scope of the callback will be the view model.
     * In test mode will be replaced with a jasmine spy with an additional function called respond
     * so that you can simulate a response. Simply return the name of the button that you want to be simulated:
     *      vm.confirm.respond('ok')
     * @param title
     * @param message
     * @param fn
     * @param scope
     * @return {*}
     */
    confirm:function (title, message, fn, scope) {
        if (glu.isObject(title)) {
            title.scope = title.scope || this;
        }
        scope = scope || this;
        return glu.confirm(title, message, fn, scope);
    },

    /**
     * Shortcut for a quick message dialog.
     * In test mode will be replaced with a jasmine spy.
     * @param title
     * @param message
     * @param fn
     * @param scope
     * @return {*}
     */
    message:function (title, message, fn, scope) {
        if (glu.isObject(title)) {
            title.scope = title.scope || this;
        }
        scope = scope || this;
        return glu.message(title, message, fn, scope);
    },

    /**
     * Shortcut for a quick prompt dialog.
     * In test mode will be replaced with a jasmine spy.
     * @param title
     * @param message
     * @param fn
     * @param scope
     * @return {*}
     */
    prompt:function (title, message, fn, scope) {
        if (glu.isObject(title)) {
            title.scope = title.scope || this;
        }
        scope = scope || this;
        return glu.prompt(title, message, fn, scope);
    },

    /**
     * Opens a view model as a popup (usually modal) dialog or pushes a screen on to a mobile navigation stack.
     * @param config
     * A normal config block that you would pass into glu.model, only in this case it also displays the view model in a window.
     * In test mode it instantiates the new view model but does not instantiate the view.
     * @return {*}
     */
    open:function (childVM, viewMode) {
        if (!glu.isInstantiated(childVM)){
            childVM.ns = childVM.ns || this.ns;
            childVM.parentVM = childVM.parentVM || this;
            childVM = this.model(childVM);
        }
        if (!glu.testMode) {
            glu.openWindow(childVM, viewMode);
        }
        return childVM;
    },

    /**
     * Makes a normal Ajax call through the underlying ajax provider. The scope is automatically set to the view model.
     * @param config
     */
    ajax:function (config) {
        glu.apply(config, {scope:this});
        Ext.Ajax.request(config);
    },

    initChildren : function(){
        for (var i =0;i<this._private.children.length;i++){
            var child = this[this._private.children[i]];
            if(!glu.isFunction(child.init))continue;
            if (!child._private.isInitialized) {
                child.init();
            }
        }
    },

    commitBulkUpdate : function(){
        this.fireEvent('bulkupdatecommitted',this);
    },

    unParent: function(){
        this._ob.detach('parentVM');
        delete this.parentVM;
    },

    /**
     * Starts listening on any listeners established by '.on', formulas, or reactors
     * that reference other view models (e.g. parentVM or rootVM, etc.)
     * Necessary to make the view model "come alive" again if it has been previously detached
     */
    attach:function(){
        this._ob.attachAll();
    },
    /*
     * Removes itself from anything it is listening on
     * Needed to clean up a view model that is listening to other models using '.on', formulas, or reactors
     * that reference other view models (e.g. parentVM or rootVM, etc.)
     */
    detach:function(){
        this._ob.detachAll();
    }

});
glu.mreg('viewmodel', glu.Viewmodel);

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.List
 * An observable list of values or objects as a much lighter alternative to a store
 * The objects / values are not processed in any way (i.e. are not converted into Records or Models)
 * Notifications are raised when the list itself is manipulated.
 *
 */
glu.List = glu.extend(Object, {
    constructor:function (config) {
        config = config || {};
        this.autoParent = false;
        this.autoDetach = false;
        glu.deepApply(this, config);
        this.length = 0;
        this._private = this._private || {};
        this._private.objs = [];
        new glu.GraphObservable({vm:this});
        config.items = config.items || config.data || [];
        for (var i = 0; i < config.items.length; i++) {
            var item = config.items[i];
            this.add(item, true);
        }
        delete this.items;
    },
    /**
     * Adds an item to the list
     * @param obj
     * @param silent
     */
    add:function (obj, silent, isTransfer) {
        this.insert(this.length,obj, isTransfer);
    },
    /**
     * Inserts an item at an ordinal position
     * @param index
     * @param obj
     */
    insert:function (index, obj, isTransfer) {
        if (this.autoParent && obj.parentVM && obj.parentVM!==this.parentVM) {
            throw new Error("View model already has a parent and needs to be removed from there first");
        }
        if (glu.isObject(obj) && obj.mtype ) {
            if (obj._private===undefined) {
                obj.ns = obj.ns || this.ns;
                if (this.autoParent) {
                    obj.parentVM = this.parentVM;
                    obj.parentList = this;
                }
                obj = glu.model(obj);
            }
            if (this.autoParent) {
                obj.parentList = this;
                obj._ob.attach('parentVM');
            }
            obj._ob.attachAll(); //adding to a list always reattaches an otherwise detached object
        }
        this._private.objs.splice(index, 0, obj);
        this.length++;
        this.fireEvent('lengthchanged',this.length,this.length-1);
        this.fireEvent('added', obj, index, isTransfer);
    },
    /**
     * Removes an item by reference
     * @param Obj
     * @return {*}
     */
    remove:function (Obj, isTransfer) {
        return this.removeAt(this.indexOf(Obj), isTransfer);
    },
    /**
     * Removes an item by ordinal position
     * @param index
     * @return {*}
     */
    removeAt:function (index, isTransfer) {
        var obj = this.getAt(index);
        if (obj==null) return; //nothing to do
        this._private.objs.splice(index, 1);
        this.length--;
        if (obj._ob) {
            //remove from observation graph...since it can only go child-> parent don't worry about other direction
            if (this.autoParent) {
                obj._ob.detach('parentVM');
                obj._ob.detach('rootVM');
            }
            if (this.autoDetach) {
                obj._ob.detachAll()
            }
        }
        this.fireEvent('removed', obj, index, isTransfer);
        if (index < this.activeIndex) {
            this.setActiveIndex(this.getActiveIndex() - 1);
        }
        this.fireEvent('lengthchanged',this.length,this.length+1);
        return obj;
    },
    /**
     * Removes all items
     */
    removeAll:function () {
        this.fireEvent('removedall', this);
        while (this.length > 0) {
            this.removeAt(0);
        }
    },

    /**
     * Transfers an item from another list to this one.
     * This establishes a "contract" by which we know the item never really disappears. The binder can use this
     * to re-use view components where appropriate.
     *
     * @param obj
     * @return {Number}
     */
    transferFrom:function(otherList, item, newIndex){
        if (newIndex==null) newIndex = this.length;
        otherList.remove(item, true);
        this.insert(newIndex, item, true);
        this.fireEvent('transferred', otherList, item, newIndex );
    },

    /**
     * Returns the ordinal index of an item
     * @param obj
     * @return {Number}
     */
    indexOf:function (obj) {
        if (this._private.objs.indexOf) return this._private.objs.indexOf(obj); //native indexOf
        for (var i = 0; i < this._private.objs.length; i++) {
            if (obj === this._private.objs[i]) {
                return i;
            }
        }
        return -1;
    },

    /**
     * Whether or not the supplied item is in the container
     * @param Obj
     * @return {Boolean}
     */
    contains:function (Obj) {
        return this.indexOf(Obj) > -1;
    },
    /**
     * Fetches the item at a given ordinal position
     * @param index
     * @return {*}
     */
    getAt:function (index) {
        return this._private.objs[index];
    },
    /**
     * The total number of items in the container
     * @property {Number}
     */
    length : 0,
    /**
     * An alias for length()
     * @return {Number}
     */
    getCount:function () {
        return this._private.objs.length;
    },
    /**
     * Iterates through each item in the list and applies the function
     * @param operation
     * @param scope
     */
    foreach:function (operation, scope) {
        for (var i = 0; i < this.length; i++) {
            var item = this.getAt(i);
            var myScope = scope || item;
            operation.call(myScope, item, i);
        }
    },

    /**
     * Returns a single item using a custom finder
     * @param fn
     * @param scope
     * @return {*}
     */
    find:function (fn, scope) {
        for (var i = 0; i < this.length; i++) {
            var item = this.getAt(i);
            var myScope = scope || item;
            if (fn.call(myScope, item)) {
                return item;
            }
        }
    },

    on:function (eventName, handler, scope) {
        scope = scope || this;
        this._ob.on(eventName, handler, scope);
    },

    toArray:function(){
        return this._private.objs.slice();
    },
    fireEvent:function () {
        glu.log.debug('List "' + this.referenceName + '" is firing event "' + arguments[0] + '""');
        this._ob.fireEvent.apply(this._ob, arguments);
    }
});

glu.mreg('list', glu.List);

glu.mreg('keytracking',{
    initMixin:function(){
        this.keyMap ={};
        this.idProperty = this.idProperty || 'id';
        //add initial keys since this is after constructor...
        for (var i=0;i<this._private.objs.length;i++){
            this.addKey(this._private.objs[i]);
        }
        this.on('added',this.addKey)
        this.on('removed',this.removeKey)
    },
    addKey:function(item, idx){
        var key=item[this.idProperty];
        if (this.keyMap[key]) throw new Error('Duplicate key "' + key +'" not allowed in a key-tracked list');
        if (key===undefined) return;
        this.keyMap[key] = item;
    },
    removeKey:function(item){
        var key=item[this.idProperty];
        if (key===undefined) return;
        delete this.keyMap[key];
    },
    containsKey:function(key){
        return this.keyMap[key]!==undefined;
    },
    getById:function(key){
        return this.keyMap[key];
    },
    getAtKey:function(key){
        return this.keyMap[key];
    },
    indexOfKey:function(key){
        return this.indexOf(this.getAtKey(key));
    },
    removeAtKey:function(key){
        var item = this.keyMap[key];
        if (item==null) return;
        this.remove(item);
    }
})

glu.List.prototype.forEach = glu.List.prototype.foreach;
glu.List.prototype.where = function(filter) {
    var f = [];
    for (var i = 0; i < this.length; i++) {
        var item = this.getAt(i);
        if (filter.call(this.parentVM, item)) f.push(item);
    }
    return f;
}

glu.List.prototype.count = function(filter) {
    return this.where(filter).length;
}

glu.List.prototype.any = function(filter) {
    return this.where(filter).length > 0;
}

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.ViewmodelActivator
 * @extends glu.List
 * A dynamic activation list of sub-viewmodels that can be flipped through (to power a tab, card, wizard, selected item, etc.)
 *
 * Same as the List, but you specify a 'focusProperty' that will hold one of the items in the list (accessible as well through getActiveItem())
 *
 * It will make sure that any item specified in the focus property is a member of the list (throwing an error if it doesn't, though null is allowed).
 *
 * It will also manage changing the focus item automatically to the next one should the focus item be deleted (or setting to null if all items are removed).
 *
 * It will call enter() and exit()  (if defined) on the focus view model whenever that property is updated
 */
glu.ViewmodelActivator = glu.extend(glu.List, {
    /**
     * @cfg {String} focusProperty A property on the containing view model that will hold the currently "activated" or focused item.
     */

    constructor:function (config) {
        glu.ViewmodelActivator.superclass.constructor.call(this, config);
        this.activeIndex = this.activeIndex || 0;
        this.activeItem = this.getActiveItem();
        this.focusProperty = config.focusProperty || glu.symbol(config.referenceName).until('List') + 'WithFocus';
        this.focusPropertyType = config.focusPropertyType || 'viewmodel';
        var me = this;
        this.parentVM.on(this.focusProperty + 'Changed', function (value) {
            if (glu.isNumber(value)) {
                me.setActiveIndex(value);
            } else {
                me.setActiveItem(value);
            }
        });
    },

    init:function () {
        this.foreach(function (submodel) {
            submodel.init();
        }, this)
    },

    getActiveItem:function () {
        return this.getAt(this.getActiveIndex());
    },

    removeAt:function (toRemove) {
        if (toRemove === this.activeIndex) {
            if (toRemove === this.length - 1) { //it's the last one
                this.setActiveIndex(toRemove - 1);
            }
        }
        var obj = glu.ViewmodelActivator.superclass.removeAt.call(this, toRemove);
        if (toRemove === this.activeIndex) {
            this.setActiveIndex(this.getActiveIndex());
        }
        if (this.getActiveItem() == null) {
            //do nothing for now...
        }
        return obj;
    },

    getActiveIndex:function () {
        return this.activeIndex;
    },

    setActiveIndex:function (idx) {
        if (this.activeItem && this.activeItem.exit) {
            this.activeItem.exit();
        }

        this.activeIndex = idx;
        this.activeItem = this.getActiveItem();

        //push into focus property
        this.parentVM.set(this.focusProperty, this.focusPropertyType === 'viewmodel' ? this.activeItem : this.activeIndex);

        if (this.activeItem == null) {
            //TODO: Figure out what it means to set item to null when binding
            return;
        }
        if (this.activeItem.enter) {
            this.activeItem.enter();
        }
    },

    setActiveItem:function (item) {
        var idx = this.indexOf(item);
        if (idx == -1 && item != null)
            throw ("You are attempting to pass in a view model that is not contained by the activator.");
        this.setActiveIndex(idx);
    }
});
glu.mreg('viewmodelactivator', glu.ViewmodelActivator);
glu.mreg('activatorlist', glu.ViewmodelActivator);

/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.DataModel = glu.extend(glu.Viewmodel, {
    constructor : function(config) {
        glu.log.debug('BEGIN datamodel construction');
        this._private = this._private || {};
        config.recType = config.recType || config.model || config.modelType;
        if (config.recType) {
            this._private.model = glu.walk(config.ns + '.models.' + config.recType);
        } else {
            if (glu.isArray(config.fields)) {
                for (var i = 0, len = config.fields.length; i < len; i++) {
                    if (glu.isString(config.fields[i])) {
                        config.fields[i] = {
                            name : config.fields[i],
                            type : 'string'
                        };
                        //TODO: Infer datatype here
                    }
                }
            }
            this._private.model = {
                fields : config.fields
            };
        }
        this._private.recType = config.recType;
        delete config.recType;
        this._private.url = config.url || '/' + config.recType + '/read';
        this._private.saveurl = config.saveUrl || '/' + config.recType + '/save';
        this._private.dirtyCount = 0;
        delete config.url;
        delete config.saveurl;

        if (glu.isFunction(config.params)) {
            this._private.paramGenerator = config.params;
            delete config.params;
        }

        //load in initial values into record
        if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
            //TODO: Make sure we only create the models once ... fix the "rectype" system so that
            //it more closely mimics Ext 4.0 models
            var modelId = Ext.id();
            Ext.define(modelId, {
                extend : 'Ext.data.Model',
                fields : this._private.model.fields
            });
            this.reader = new Ext.data.reader.Json({
                model : modelId
            });
        } else {
            this.reader = new Ext.data.JsonReader({}, this._private.model.fields);
        }
        //TODO: clean this up by calling loadData instead
        //workaround for new Ext 4.1 behavior...
        var idProp = 'id';
        if (config[idProp] === undefined) {
            config[idProp] = '';
        }
        var initialRecord = this.reader.readRecords([
        config
        ]).records[0];
        this._private.record = initialRecord;
        glu.apply(this, initialRecord.data);
        this._private.data = this._private.data || {};
        glu.apply(this._private.data, initialRecord.data);
        //create isDirty formulas

        this._private.record.fields.each(function(rec) {
            var name = rec.name + 'IsDirty';
            config[name] = {
                on : [rec.name + 'Changed'],
                formula : function() {
                    return this.isModified(rec.name);
                }
            }
        }, this);

        config.isDirty = false;
        //call Viewmodel constructor
        glu.DataModel.superclass.constructor.apply(this, arguments);
        glu.log.debug('END datamodel construction');
    },

    setRaw : function(fieldName, value, suppressDirtyEvent) {
        var rec = this._private.record;
        //check if part of fields and if so, set it in the record too...
        if (rec.fields.containsKey(fieldName)) {
            var wasDirty = this.isModified(fieldName);
            rec.set(fieldName, value);
            if (rec.modified && value == rec.modified[fieldName]) {
                //remove dirty indicator
                delete rec.modified[fieldName];
            }
            var isDirtyNow = this.isModified(fieldName);
            if (!wasDirty && isDirtyNow)
                this._private.dirtyCount++;
            if (wasDirty && !isDirtyNow)
                this._private.dirtyCount--;

        }
        glu.DataModel.superclass.setRaw.apply(this, arguments);
        if (rec.fields.containsKey(fieldName)) {
            this.set('isDirty', this._private.dirtyCount > 0);
        }
    },

    isModified : function(propName) {
        var rec = this._private.record;
        return rec.hasOwnProperty('modified') && rec.modified.hasOwnProperty(propName);
    },

    asObject : function() {
        return glu.apply({}, this._private.record.data);
    },

    load : function(id) {
        var url = this.url;
        if (this.appendId) {
            url = url + (glu.string(url).endsWith('/') ? '' : '/') + id;
        }
        if (this.paramGenerator) {
            var config = {
                params : {}
            };
            config.params = glu.apply(config.params, this._serialize(Ext.createDelegate(this._private.paramGenerator, this)()));
        }
        var jsonData = {
            id : id
        };
        if (config.params) {
            jsonData.params = config.params;
        }
        Ext.Ajax.request({
            url : url,
            method : 'POST',
            jsonData : jsonData,
            scope : this,
            success : function(response, opts) {
                var responseObj = Ext.decode(response.responseText);
                if (responseObj.success) {
                    var data = responseObj[this.root];
                    this.loadData(data);
                } else {
                    Ext.Msg.alert('Status', responseObj.message);
                }
            }
            // failure: function(response, opts) {
            // var responseText = (response.responseText ? response.responseText : 'Unable to contact the server.  Please try again later.');
            // Ext.Msg.alert('Status', 'Unable to contact the server.  Please try again later.');
            // }
        });
    },
    save : function() {
        var url = this.saveurl;
        if (this.appendId) {
            url = url + (glu.string(url).endsWith('/') ? '' : '/') + id;
        }
        if (this._private.paramGenerator) {
            var config = {
                params : {}
            };
            config.params = glu.apply(config.params, this._serialize(Ext.createDelegate(this._private.paramGenerator, this)()));
        }
        var jsonData = {
            model : this._private.model.name,
            data : this.getChanges(),
            id : this.getId()
        };
        if (config.params) {
            jsonData.params = config.params;
        }
        Ext.Ajax.request({
            url : url,
            method : 'POST',
            jsonData : jsonData,
            scope : this,
            success : function(response, opts) {
                var responseObj = Ext.decode(response.responseText);
                if (responseObj.success) {
                    var data = responseObj[this.root];
                    // if we got data back, then replace the existing record with this newly established record.
                    if (data) {
                        this._private.record = new this._private.record(data, data[this._private.model.idProperty]);
                        this.loadData(data);
                    } else {
                        this._private.record.commit(true);
                    }
                } else {
                    Ext.Msg.alert('Status', responseObj.message);
                }
            },
            failure : function(response, opts) {
                //                var responseText = (response.responseText ? response.responseText : 'Unable to contact the server.  Please try again later.');
                Ext.Msg.alert('Status', 'Unable to contact the server.  Please try again later.');
            }
        });
    },

    getFieldModel : function() {
        return this._private.model;
    },

    _serialize : function(data) {
        if (data) {
            for (var k in data) {
                if (glu.isArray(data[k])) {
                    data[k] = glu.json.stringify(data[k]);
                }
            }
        }
        return data;
    },
    loadData : function(rawData) {
        //workaround for new Ext 4.1 behavior...
        var idProp = 'id';
        if (rawData[idProp] === undefined) {
            rawData[idProp] = '';
        }
        var data = this.reader.readRecords([
        rawData
        ]).records[0].data;
        for (var k in data) {
            this.setRaw(k, data[k]);
        }
        this.commit();
    },
    getId : function() {
        return this._private.record.get(this._private.model.idProperty);
    },
    getFieldConfig : function(fieldName) {
        // TODO: convert model fields to objects instead of arrays, globally
        for (var i = 0; i < this._private.model.fields.length; i++) {
            if (this._private.model.fields[i].name == fieldName) {
                return this._private.model.fields[i]
            }
        }
        return null;
    },

    commit : function() {
        this._private.record.commit(true);
        for (var i = 0; i < this._private.model.fields.length; i++) {
            var field = this._private.model.fields[i].name || this._private.model.fields[i];
            this.set(field + 'IsDirty', false);
        }
        this._private.dirtyCount = 0;
        this.set('isDirty', false);
    },

    getOriginalValue : function(fieldName) {
        if (this.isModified(fieldName)) {
            return this._private.record.modified[fieldName];
        } else {
            return this.get(fieldName);
        }
    },
    getChanges : function() {
        return this._private.record.getChanges();
    },
    revert : function() {
        this._private.record.reject(true);
        this.loadData(this._private.record.data);
        this.commit();
    }
});

glu.mreg('datamodel', glu.DataModel);

/*
* Copyright (c) 2012 CoNarrative
*/

/* DOCS DISABLED FOR NOW
 * @class glu.GraphObservable
 * An observer pattern that supports the notion of object graph connectivity, so that when items are
 * swapped into the graph they automatically detach/attach in the appropriate chains
 * @type {*}
 */
glu.GraphObservable = Ext.extend(Ext.emptyFn, {
    constructor:function (config) {
        glu.apply(this, config);
        this.node = this.node || this.vm || this;
        this.node._ob = this;
        glu.apply(this, {

            edges:{

            },
            events:{ //events found

            }

        })
    },

    on:function (path, fn, scope) {
        var tokens = path.split('.');
        scope = scope || this.node;
        this.propagateRequest({
            id:Ext.id(),
            remainder:tokens,
            origin:{
                fn:fn,
                scope:scope
            }
        });
    },

    fireEvent:function () {
        var name = arguments[0].toLowerCase();
        var evt = this.events[name];
        if (!evt) return;
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        var cullList = [];
        for (var key in evt.listeners) {
            var listener = evt.listeners[key];
            var isView = listener.origin.fn.toString().indexOf('$')>-1;
            window.firings++;
            //console.log(name, 'NOTIFYING:', isView ? '$' : listener.origin.fn.toString().split('\n').slice(0,2).join('\n'));
            var myVeto = listener.origin.fn.apply(listener.origin.scope, args);
            if (myVeto === true) {
                return false;
            }
            if (myVeto === 'discard') {
                cullList.push(key);
            }
        }
        //cull dead observers...
        for (var key in cullList) {
            delete evt.listeners[key];
        }
        return true;
    },

    /**
     * Process an observation request from 'outside'. The request is the original of the 'donors'
     * Assumes object already exists
     * @param request
     * @private
     */
    propagateRequest:function (request) {
        if (request.remainder.length == 1) {
            //Found the terminus - the eventer
            var evtName = request.remainder[0].toLowerCase();
            this.events[evtName] = this.events[evtName] || {listenersCount:0, listeners:{}};
            var evt = this.events[evtName];
            if (!evt.listeners[request.id]) {
                evt.listeners[request.id] = {
                    id:request.id,
                    origin:request.origin
                };
                evt.listenersCount++;
            }
            return;
        }
        //otherwise, add as something to seek
        var myRequest = {
            id:request.id,
            remainder:request.remainder.slice(1),
            origin:request.origin
        };
        var nextEdge = request.remainder[0];
        this.edges[nextEdge] = this.edges[nextEdge] || {};
        this.edges[nextEdge][myRequest.id] = myRequest;
        var edgeVM = this.node[nextEdge];
        if (edgeVM && edgeVM._ob) {
            edgeVM._ob.propagateRequest(myRequest);
        } else {
            //TODO: If edge is array, stop there and change to just watch it instead...
//            if (edgeVM && edgeVM._ob === undefined && edgeVM.mtype) {
//                debugger;
//            }
        }
    },

    propagateRemoval:function (request) {
        if (request.remainder.length == 1) {
            //Found the terminus - the eventer -- now remove
            var evtName = request.remainder[0].toLowerCase();
            var evt = this.events[evtName];
            if (!evt || !evt.listeners[request.id]) {
                return;
            }
            delete evt.listeners[request.id];
            evt.listenersCount--;
            return;
        }
        //otherwise, add as something to seek
        var myRequest = {
            id:request.id,
            remainder:request.remainder.slice(1)
        };
        var nextEdge = request.remainder[0];
        var edge = this.edges[nextEdge];
        if (!edge) {
            return;
        }
        delete edge[myRequest.id];
        var edgeVM = this.node[nextEdge];
        if (edgeVM && edgeVM._ob) {
            edgeVM._ob.propagateRemoval(myRequest);
        }
    },
    /**
     * Walks through (already associated) graph node and propagates blocked edges
     * @param forwardRef
     * @param other
     * @param backRef
     * @private
     */
    attach:function (forwardRefName, other, backRefName) {
        other = other || this.node[forwardRefName];
        this.node[forwardRefName] = other;
        this.attachOneWay(forwardRefName);
        if (backRefName) {
            other[backRefName] = this.node;
            var other = this.node[forwardRefName];
            if (!other._ob) return;
            other._ob.attachOneWay(backRefName);
        }
    },

    attachAll:function(){
        for (var key in this.edges){
            this.attach(key);
        }
    },

    detach:function (forwardRefName, backRefName) {
        var other = this.node[forwardRefName];
        this.detachOneWay(forwardRefName);
        if (backRefName) {
            other[backRefName] = null;
            if (!other._ob) return;
            other._ob.detachOneWay(backRefName);
        }
    },

    detachAll:function(){
        for (var key in this.edges){
            this.detach(key);
        }
    },

    attachOneWay:function (refName) {
        var edges = this.edges [refName];
        if (edges) {
            var other = this.node[refName];
            if (!other || !other._ob) return;
            for (var requestId in edges) {
                var request = edges[requestId];
                other._ob.propagateRequest(request);
            }
        }
    },

    detachOneWay:function (refName) {
        var edges = this.edges [refName];
        if (edges) {
            var other = this.node[refName];
            if (!other || !other._ob) return;
            for (var requestId in edges) {
                var request = edges[requestId];
                other._ob.propagateRemoval(request);
            }
        }
    }

});
/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.log = function () {
    glu.logLevel = glu.logLevel || 'info';
    if (Ext.isIE) {
        glu.logLevel = 'off';
    }
    var levels = {
        off:0,
        error:10,
        warn:20,
        info:30,
        debug:40
    };
    var empty = function () {
    };
    var level = levels[glu.logLevel] || 0;
    return {
        /**
         * Logs an info message
         * @param {String} str The log message
         */
        info:level >= 30 ? function (str) {
            console.log('INFO:  ' + str);
        } : empty,
        warn:level >= 20 ? function (str) {
            console.log('WARN:  ' + str);
        } : empty,
        error:level >= 10 ? function (str) {
            console.log('ERROR:  ' + str);
        } : empty,
        debug:level >= 40 ? function (str) {
            console.log('DEBUG:  ' + str);
        } : empty,
        indents:0,
        indent:'',
        indentMore:function () {
            this.indents++;
            this.indent = (new Array(this.indents)).join('   ');
        },
        indentLess:function () {
            this.indents--;
            if (this.indents < 0) this.indents = 0;
            this.indent = (new Array(this.indents)).join('   ');
        }
    }
}();





/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.Model = glu.extend(Object, {
    constructor:function (config) {
        glu.Model.superclass.constructor.call(this);
        glu.apply(this, config);
        this._private = this._private || {};
        this._private.data = {};

    },
    get:function (propName) {
        return this[propName];
        //return this._private.data[propName];
    },
    set:function (propName, value) {
        this.setRaw(propName, value);
    },
    setRaw:function (propName, value) {
        var oldValue = this.get(propName);
        if (oldValue === value) {
            return; //do nothing if it's the same thing.
        }
        this._private.data[propName] = value;
        this[propName] = value; //set locally for now too...
        this.fireEvent(propName + 'Changed', value, oldValue, {
            modelPropName:propName
        });
        this.fireEvent('changed', value, oldValue, {
            modelPropName:propName
        });

    }
});

glu.mreg('model', glu.Model);

/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.model = function (mtype, config) {
    //clean up arguments...
    if (glu.isObject(mtype)) {
        config = mtype;
        mtype = null;
    }
    if (config==null){
        config = {};
    }
    config.mtype=config.mtype || mtype || 'viewmodel';

    if (config.mtype && config.mtype.indexOf('.')>-1){
        var split = glu._splitReference(config.mtype);
        config.ns = split.ns;
        config.mtype = split.name;
    }

    function upcastIfNeeded (cfg){
        if (cfg.mtype==='viewmodel' &&  (cfg.fields || cfg.recType || cfg.modelType || cfg.model)) {
            return 'datamodel';
        }
        return cfg.mtype;
    }


    config.mtype = config.mtype || 'viewmodel';
    config.mtype = upcastIfNeeded(config);
    var mtype = config.mtype;
    var ns = config.ns;
    var viewModelRegistry = ns ? glu.walk(ns + '.' + glu.conventions.viewmodelNs) : {};
    if (glu.mtypeRegistry.hasOwnProperty(mtype)) {
        //not a view model
        var mixins = config.mixins || [], applyMixins=[], i=0;
        for (; i < mixins.length; i++) {
            var mixinConfig = mixins[i], mixinName;
            if( glu.isObject(mixinConfig) )
                mixinName = mixinConfig.type;
            else
                mixinName = mixinConfig;
            var mixin = viewModelRegistry[mixinName] || glu.mtypeRegistry[mixinName];
            if (mixin === undefined) {
                var factory = viewModelRegistry[mixinName + 'Factory'];
                if (factory === undefined)     throw ('Unable to find mixin: ' + mixinName );
                mixin = factory(config);
            }
            if( glu.isObject(mixinConfig) )
                glu.apply(mixin, mixinConfig);
            glu.deepApply(config, mixin, true);
            applyMixins.push(mixin);
            if( glu.mtypeRegistry[mixinName] )
                delete config.mixins;
        }
        var temp = new glu.mtypeRegistry[mtype](config);
        for( i=0; i < applyMixins.length; i++ ){
            if( applyMixins[i].initMixin )
                applyMixins[i].initMixin.apply(temp);
        }
        return temp;
    }
    //try seeing if it is a view model in the namespace
    glu.log.debug(mtype + ' is not a built-in type, checking for a view model under the namespace. ');
    if (!ns) {
        throw ('Unable to create model: attempting to create a specified view model without a namespace (ns).');
    }
    var className = mtype;
    var vmSpecBase = viewModelRegistry[className];
    if (vmSpecBase === undefined) {
        //check for factory
        var factory = viewModelRegistry[className + 'Factory'];
        if (factory === undefined) {
            throw ('Unable to create model: Could not find specification for view model ' + className);
        }
        vmSpecBase = factory(config);
    }
    //make a copy...
    var vmSpec = {};
    //apply mixins...
    //applyMixins(vmSpecBase);

    //apply the specification
    glu.deepApply(vmSpec, vmSpecBase);
    //apply unique configs over top...
    glu.deepApply(vmSpec, config);
    vmSpec.mtype = vmSpecBase.mtype || 'viewmodel';
    vmSpec.mtype = upcastIfNeeded(vmSpec);
    vmSpec.ns = ns;
    vmSpec.viewmodelName = className;
    vmSpec.referenceName = vmSpec.referenceName || 'root';
    return new glu.model(vmSpec);
};
/*
 * Copyright (C) 2012 by CoNarrative
 */
/*
 * @class glu.Observable
 * A very simple observer pattern implementation
 */

glu.Observable = glu.extend(Object, {
    constructor : function(){
        this._ob = this._ob || {};
        this._ob.events = {};
    },
    fireEvent:function () {
        var name = arguments[0].toLowerCase();
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        if (!this._ob.events.hasOwnProperty(name)) {
            this._ob.events[name] = {listeners:[]}
        }
        var evt = this._ob.events[name];
        var cullList = [];
        for (var i = 0; i < evt.listeners.length; i++) {
            var listener = evt.listeners[i];
            var myVeto = listener.fn.apply(listener.scope, args);
            if (myVeto === true) {
                return false;
            }
            if (myVeto ==='discard'){
                cullList.unshift(i);
            }
        }
        //cull dead observers...
        for (var i=0;i<cullList.length;i++){
            evt.listeners.splice(cullList[i],1);
        }
        return true;
    },
    on:function (name, callback, scope) {
        name = name.toLowerCase();
        if (!this._ob.events.hasOwnProperty(name)) {
            this._ob.events[name] = {listeners:[]}
        }
        var evt = this._ob.events[name];
        evt.listeners.push({fn:callback, scope:scope || glu});
    }
});

glu.observer = new glu.Observable();
glu.on = function(){
    this.observer.on.apply(this.observer,arguments);
}
glu.fireEvent = function(){
    this.observer.fireEvent.apply(this.observer,arguments);
}
glu.clearPlugins = function () {
    glu.events = {};
};


/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.Reactor = {
    is:function (obj) {
        return obj.hasOwnProperty('on') && (obj.hasOwnProperty('action') || obj.hasOwnProperty('formula'));
    },
    build:function (propName, reactor, vmOfReactor, scope) {
        scope = scope || vmOfReactor;
        var isFormula = reactor.hasOwnProperty('formula');
        var formula = reactor.formula;
        var evts = reactor.on || [];
        if (evts === '$') {
            //auto-detect through introspection
            var code = formula.toString();
            var thisMatchesRe = /this\.([\.\w]*)/g;
            var getMatchesRe = /this\.get\s*\(\s*[\'\"]([\w\.]*)/g;
            var toWatch = {};
            var matches;
            function find(regex) {
                while (matches = regex.exec(code)) {
                    var prop = matches[1];
                    if (prop === 'get' || prop === 'localize') continue;
                    var tokens = prop.split('\.');
                    var lastProp='';
                    for (var i =0 ;i<tokens.length; i++){
                        toWatch[lastProp + tokens[i] + 'Changed'] = true;
                        lastProp = lastProp + tokens[i] + '.';
                    }
                }
            }
            find (thisMatchesRe);
            find (getMatchesRe);

            evts = [];
            reactor.on = evts;
            for (var evt in toWatch) {
                evts.push(evt);
            }
        }
        if (glu.isString(evts)) {
            evts = [evts];
        }
        if (isFormula) {
            //establish setter
            if (vmOfReactor.makePropertyAccessors){
                vmOfReactor.makePropertyAccessors(propName);
            }
            reactor.init = function () {
                vmOfReactor.setRaw(propName, formula.apply(scope), true); //set silently
            }
        }
        var action = isFormula ?
            function () {
                // calculate formula
                var value = formula.apply(scope);
                // TODO: Normalize 'reactor' on an array of things -> action across everything
                vmOfReactor.setRaw(propName, value, true);
            }
            : reactor.action;


        for (var i = 0; i < evts.length; i++) {
            var eventName = evts[i];
            var fullEventName = eventName;
            if (vmOfReactor.on) {
                vmOfReactor.on(fullEventName, action, vmOfReactor);
            }
        }
        return reactor;
    }
};
/*
 * Copyright (C) 2012 by CoNarrative
 */
/* DOCS DISABLED FOR NOW
 * @class glu.RowViewmodel
 * An extremely lightweight version of a view model that just has formulas (for now).
 * Very useful to get reactive behavior in grids where items can automatically update without a grid refresh
 * or based on other columns locally changing.
 * Available (at the moment) only for Ext 4.x +
 */
if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
    Ext.define('glu.rowViewmodel', {
        extend:'Ext.data.Model',

        initFormulas : function(){
            for (var formulaName in this.formulas) {
                var fn = this.formulas[formulaName];
                glu.Reactor.build(formulaName, {on:'$', formula:fn}, this, this.data);
            }
            for (var formulaName in this.formulas) {
                var fn = this.formulas[formulaName];
                this.data[formulaName] = fn.apply(this.data);
            }
        },

        //LIVE CHANGE STEP 3a: Keeps getting called until formulas done processing
        //TODO: True dependency graph...
        setRaw:function (formulaName, value) {
            //if the formula has changed within this cycle or since last update, put on the update list
            if ((this.formulasToUpdate[formulaName] && this.formulasToUpdate[formulaName] != value) ||
                this.get(formulaName) != value) {
                this.formulasToUpdate[formulaName] = value;
                this.fireEvent(formulaName + 'Changed', value, this.formulasToUpdate[formulaName] || this.get(formulaName));
            }
        },

         //LIVE CHANGE STEP 4a: add the accumulated formula changes to the property
        afterEdit:function (modifiedFieldNames) {
            if (this.settingFormulas) {
                //do nothing when accumulating formula changes NOTE: Not used at the moment
                return;
            }
            var name = modifiedFieldNames[0];
            this.formulasToUpdate = {};
            this.fireEvent(name + 'Changed', this.data[name]);
            //formulas have finished accumulating

            for (var fName in this.formulasToUpdate) {
                this.data[fName] = this.formulasToUpdate[fName];
                modifiedFieldNames.push(this.formulasToUpdate[fName]);
            }
            this.settingFormulas = false;
            this.callParent(modifiedFieldNames);
        }

    });


    glu.defRowModel = function (name, config) {
        if (config.formulas) {
            for (var formulaName in config.formulas) {
                config.fields.push({
                    name:formulaName
                });
            }
        }
        config.extend = 'glu.rowViewmodel'
        Ext.define(name, config);
    };

    Ext.define('glu.Reader', {
        extend:'Ext.data.reader.Json',
        alias:'reader.glujson',
        extractData:function () {
            var records = this.callParent(arguments);
            if (this.model.prototype.formulas) {
                for (var i = 0; i < records.length; i++) {
                    var rec = records[i];
                    rec.initFormulas();
                }
            }
            return records;
        }
    });

}


/*
 * Copyright (C) 2012 by CoNarrative
 */
if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
    Ext.define('glu.Store', {
        extend : 'Ext.data.Store',
        constructor : function(config) {
            var modelDefName = config.model;
            if (config.model && config.model.indexOf('\.') == -1) {
                config.model = config.ns + '.models.extjs.' + config.model;
            }
            var found = glu.walk(config.model);
            if (!found) {
                if (Ext.getProvider().provider == 'touch') {
                    Ext.define(config.model, {
                        extend : 'Ext.data.Model',
                        config : {
                            fields : glu.walk(config.ns + '.models.' + modelDefName).fields
                        }
                    });
                } else {
                    Ext.define(config.model, {
                        extend : 'Ext.data.Model',
                        fields : glu.walk(config.ns + '.models.' + modelDefName).fields
                    });
                }
            }

            this.callParent([config]);
        }
    });
} else {
    glu.Store = glu.extend(Ext.data.JsonStore, {
        remoteSort : true,
        _lastSortField : null,
        _lastSortOrder : 'ASC',
        constructor : function(config) {
            Ext.applyIf(config, {
                totalProperty : 'totalCount',
                root : 'result'
            });
            if (config.hasOwnProperty('recType')) {
                var model = glu.walk(config.ns + '.models.' + config.recType);
                config.fields = model.fields;
                config.idProperty = config.idProperty || model.idProperty;
            }
            if (Ext.isFunction(config.params)) {
                this.paramGenerator = config.params;
                delete config.params;
            }
            config.proxy = config.proxy || new Ext.data.HttpProxy({
                method : 'POST',
                prettyUrls : false,
                url : config.url
            });
            config.proxy.url = config.proxy.url || config.url;
            delete config.url;
            this.deferredLoader = new Ext.util.DelayedTask();
            if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
                config.reader = {
                    type : 'json',
                    root : config.root,
                    totalProperty : config.totalProperty
                }
            }
            glu.Store.superclass.constructor.call(this, config);
        },
        loadActual : function(loadConfig) {
            if (this.paramGenerator) {
                loadConfig = {
                    params : {}
                };
                loadConfig.params = Ext.apply(loadConfig.params, this._serialize(Ext.createDelegate(this.paramGenerator, this.parentVM)()));
            }
            glu.Store.superclass.load.call(this, loadConfig);
        },
        load : function(loadConfig) {
            if (glu.testMode === true) {
                this.loadActual(loadConfig);
                return;
            }
            this.deferredLoader.delay(10, this.loadActual, this, [loadConfig]);
            //shouldn't be trigger loads as fast as they can come...
            return true;
            //always happy to oblige...
        },
        loadData : function(config, append) {
            if ((Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') && !Ext.isArray(config)) {
                glu.Store.superclass.loadData.call(this, config[this.root], append);
                this.totalCount = config[this.totalProperty];
            } else {
                glu.Store.superclass.loadData.call(this, config, append);
            }
        },
        _serialize : function(data) {
            if (data) {
                for (var k in data) {
                    if (glu.isArray(data[k])) {
                        data[k] = glu.json.stringify(data[k]);
                    }
                }
            }
            return data;
        }
    });
}
glu.mreg('store', Ext.data.Store);
glu.mreg('glustore', glu.Store);
glu.mreg('arraystore', Ext.data.ArrayStore);
glu.mreg('jsonstore', Ext.data.JsonStore);
glu.mreg('treestore', Ext.data.TreeStore);

glu.mreg('listtreestoreadapter', {
    initMixin : function() {
        var attachTo = this.attachTo;
        if (this.parentVM[attachTo]) {
            this.on('update', function(store, record, operation, modifiedFieldNames, eOpts) {
                var index = Ext.Array.indexOf(store.getRootNode().childNodes,record), viewmodel = this[attachTo].getAt(index), i = 0, len = modifiedFieldNames.length;
                for (; i < len; i++) {
                    if (viewmodel[modifiedFieldNames[i]] !== undefined)
                        viewmodel.set(modifiedFieldNames[i], record.get(modifiedFieldNames[i]));
                }
            }, this.parentVM);

            if (this.parentVM[attachTo].on) {
                this.parentVM[attachTo].on('added', function(obj, index) {
                    this.getRootNode().insertChild(index, obj);
                }, this);
                this.parentVM[attachTo].on('removed', function(obj, index) {
                    this.getRootNode().removeChild(this.getRootNode().getChildAt(index));
                }, this);
                this.parentVM[attachTo].on('edited', function(obj, index) {
                    this.getRootNode().getChildAt(index).set(obj.asObject());
                }, this);
                //Child node listners
                this.parentVM[attachTo].on('appendchild', function(obj, parentIndex) {
                    var node = this.getRootNode().getChildAt(parentIndex);
                    node.appendChild(obj);
                    if (!node.isExpanded())
                        node.expand();
                }, this);
                this.parentVM[attachTo].on('insertchild', function(obj, parentIndex, childIndex) {
                    var node = this.getRootNode().getChildAt(parentIndex);
                    node.insertChild(childIndex, obj);
                    if (!node.isExpanded())
                        node.expand();
                }, this);
                this.parentVM[attachTo].on('removechild', function(parentIndex, child) {
                    this.getRootNode().getChildAt(parentIndex).removeChild(child);
                }, this);
                this.parentVM[attachTo].on('editedchild', function(parentIndex, child, newChild) {
                    this.getRootNode().getChildAt(parentIndex).replaceChild(newChild, child);
                }, this);
            }
        }
    }
});

glu.mreg('liststoreadapter', {
    initMixin : function() {
        var attachTo = this.attachTo;
        if (this.parentVM[attachTo]) {
            this.on('update', function(store, record, operation, modifiedFieldNames, eOpts) {
                var index = store.indexOf(record), viewmodel = this[attachTo].getAt(index), i = 0, len = modifiedFieldNames.length;
                for (; i < len; i++) {
                    if (viewmodel[modifiedFieldNames[i]] !== undefined)
                        viewmodel.set(modifiedFieldNames[i], record.get(modifiedFieldNames[i]));
                }
            }, this.parentVM);

            if (this.parentVM[attachTo].on) {
                this.parentVM[attachTo].on('added', function(obj, index) {
                    this.insert(index, obj);
                }, this);
                this.parentVM[attachTo].on('edited', function(obj, index) {
                    var editObj = {};
                    for (var i = 0; i < this.model.getFields().length; i++) {
                        var fieldName = this.model.getFields()[i].name;
                        editObj[fieldName] = obj[fieldName];
                    }
                    this.getAt(index).set(editObj);
                }, this);
                this.parentVM[attachTo].on('removed', function(obj, index) {
                    this.removeAt(index);
                }, this);
            }
        }
    }
});

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.Symbol
 * Provides utilities for manipulating symbols to help with naming conventions
 *
 */

glu = window.glu || {};
glu.Symbol = function (str) {
    this.str = str;
}
glu.symbol = function (str) {
    return new glu.Symbol(str);
}
glu.string = glu.symbol;

glu.apply(glu.Symbol.prototype, {
    /**
     * Determins if a string ends with the provided suffix
     * @param {String} suffix The suffix to check with
     * @return {Boolean}
     */
    endsWith:function (suffix) {
        if (!this.str) {
            return this.str;
        }
        return this.str.indexOf(suffix, this.str.length - suffix.length) !== -1;
    },

    /**
     * Converts a string to camel case
     * @return {String}
     */
    toCamelCase:function () {
        if (!this.str) {
            return this.str;
        }
        return this.str.substring(0, 1).toLowerCase() + this.str.substring(1);
    },

    /**
     * Converts a string to pascal case
     * @return {String}
     */
    toPascalCase:function () {
        if (!this.str) {
            return this.str;
        }
        return this.str.substring(0, 1).toUpperCase() + this.str.substring(1);
    },
    /*
     * return the symbol up until it hits some flag word
     */
    until:function (remove) {
        var target = glu.symbol(remove).toPascalCase();
        var trimAt = this.str.indexOf(target);
        return trimAt == -1 ? this.str : this.str.substring(0, trimAt);
    },
    /**
     * returns symbols split on case
     */
    split:function () {
        var name = this.str.replace(/([A-Z])/g, function (g) {
            return '@' + g
        });
        return name.split('@');
    },
    /**
     * Injects a space before upper case letters excluding the first letter in the string.
     * @return {String}
     */
    asTitle:function () {
        var name = this.str.replace(/([A-Z])/g, function (g) {
            return ' ' + g.toUpperCase();
        });
        if (name.indexOf(' ') == 0) {
            name = name.substring(1);
        }
        return glu.string(name).toPascalCase();
    },

    flattenArgs: function(argsArray){
        var temp = [],i,j,subArgs;

        for( i=0; i < argsArray.length; i++ ){
            if( Object.prototype.toString.call(argsArray[i]) == '[object Array]' ){
                subArgs = this.flattenArgs(argsArray[i]);
                for(j=0; j< subArgs.length; j++ ){
                    temp.push(subArgs[j]);
                }
            }
            else{
                temp.push(argsArray[i]);
            }
        }

        return temp;
    },

    /**
     * Accepts either a set of arguments that represent values to substitute ordinally
     * or one or more config objects in which to search by name key
     * @param cfg
     * @return {*}
     */
    format:function (cfg) {
        var args = arguments;
        args = this.flattenArgs(args);
        if (!glu.isObject(cfg)) {
            return this.str.replace(/{(\d+)}/g, function (token, idx) {
                var key = Number(token.substring(1, token.length - 1));
                if (args[key] === undefined) {
                    throw new Error("Positional parameter " + token + " is out of range for this string substitution.");
                }
                return args[idx];
            });
        }
        //otherwise name based substitutions...
        return this.str.replace(/{([\.\w]*?)}/g, function (token) {
            var key = token.substring(1, token.length - 1);
            var value = undefined;
            for (var i = 0; i < args.length; i++) {
                value = glu.walk(key, args[i]);
                if (value != null) {
                    break;
                }
            }
            if (value === undefined) {
                throw new Error("Need to supply value for named parameter " + key + " for this string substitution.");
            }
            return value;
        });

    }
});


