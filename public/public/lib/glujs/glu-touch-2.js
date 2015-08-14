// Copyright (c) 2012 CoNarrative - http://www.conarrative.com/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)
// GluJS version 1.1.0

/*
 * Copyright (c) 2012 CoNarrative
 */
if (!Ext.getProvider) {
    Ext.getProvider = function () {
        return {provider:'touch', version:'2.0.1'}
    }
};

/*Add to Ext 3.x*/
if (!Ext.getVersion) {
    Ext.getVersion = function () {
        return Ext.version;
    }
};
if (!Ext.reg) {
    Ext.reg = function (name, ctor) {
        Ext.ClassManager.setAlias('widgets.' + name, ctor);
    };

};


/*
 * Copyright (C) 2012 by CoNarrative
 */

Ext.namespace('glu.provider');
Ext.apply(glu.provider, {
    getCmp:function (id) {
        return Ext.getCmp(id);
    },
    widget:(Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') ? function (config) {
        return config.xtype.indexOf('svg-')==0?Ext.createByAlias('svgwidgets.' + config.xtype, config): Ext.widget(config.xtype, config);
    } : function (config) {
        return Ext.create(config)
    },

    view:function (vm, viewSpec, parent) {
        if (viewSpec._asWindow && viewSpec.xtype!='menu') {
            if (viewSpec.asWindow) {
                viewSpec = glu.deepApply({
                    xtype:'window',
                    layout:'fit',
                    items:[viewSpec]
                }, viewSpec.asWindow);
            } else {
                viewSpec.xtype = 'window';
            }
        }
        viewSpec.xtype = viewSpec.xtype || 'panel';
        if (parent && parent.svgParentId) viewSpec.svgParentId = parent.svgParentId; //for svg controls pass down root element
        var bindings = glu.provider.binder.collectBindings(viewSpec, vm, parent).bindings;
        var view = this.widget(viewSpec);
        glu.provider.binder.applyBindingsList(bindings);
        return view;
    },
    namespace:function (str) {
        return Ext.namespace(str);
    },
    apply:function (obj, config, defaults) {
        return Ext.apply(obj, config, defaults);
    },
    viewport:function (config) {
        var view = glu.createViewmodelAndView(config);
        if (Ext.getProvider().provider == 'touch') {
            var viewport = Ext.Viewport.add(view);
        }
        else {
            return new Ext.Viewport({
                layout:'fit',
                items:[view]
            });
        }
    },
    confirm:function (title, message, fn, scope) {
        if (Ext.isObject(title)) {
            return Ext.Msg.show(title);
        }
        else {
            return Ext.Msg.confirm(title, message, fn, scope);
        }
    },
    message:function (title, message, fn, scope) {
        return Ext.Msg.alert(title, message, fn, scope);
    },
    prompt:function (title, message, fn, scope){
        return Ext.Msg.prompt(title,message,fn,scope);
    },

    /* returns a viewmodel entry point as a constructor
     * and registers it with ExtJS
     * The entry point is the actual view created as a panel
     * and is entirely overrideable at "put in container" time
     */

    panel:function (xtypeName, vmConfig) {
        if (glu.isObject(xtypeName)) {
            vmConfig = xtypeName;
            xtypeName = vmConfig.xtype;
        }
        var ctor = function (extjsConfig) {
            //1: Initialize the viewmodel
            if (extjsConfig.viewmodelConfig) {
                glu.deepApply(vmConfig, extjsConfig.viewmodelConfig);
            }
            var vm = glu.model(vmConfig);
            vm.init();
            //2: Get the bound config specification for the matching view...
            delete extjsConfig.xtype;
            var viewSpec = glu.getViewSpec(vm, vm.ns, vm.viewmodel, extjsConfig, {
                xtype:'panel'
            });
            //3: Perform the bindings...
            var bindings = glu.provider.binder.collectBindings(viewSpec, vm).bindings;

            if (Ext.isString(viewSpec))
                throw viewSpec;
            //4: Finish creating the control through calling the constructor on the transformed viewSpec
            type.superclass.constructor.call(this, viewSpec);
            //4A: Add rootVM reference
            this.vm = vm;
            //5: Add activate binding (in case it is a tab. This would be handled by a higher level view model if this wasn't the root')...
            this.on('activate', vm.activate, vm);
            //6: Apply bindings list to the created control
            glu.provider.binder.applyBindingsList(bindings);
        };
        if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
            var cfg = {
                extend:'Ext.panel.Panel',
                constructor:ctor
            };
            if (xtypeName != null) {
                cfg.alias = 'widget.' + xtypeName;
            }
            var type = Ext.define('glu.panels.' + Ext.id().replace('-', '_'), cfg);
            return type;
        } else {
            var type = Ext.extend(Ext.Panel, {
                constructor:ctor
            });
            if (xtypeName != null) {
                Ext.reg(xtypeName, type);
            }
            return type;
        }

    },


    /*
     * 'windowizes' a panel and pops it up
     */
    openWindow:function (viewmodel, viewMode) {
        var viewmodelName = viewMode ? viewmodel.viewmodelName + '_'+viewMode : viewmodel.viewmodelName;
        var view = glu.view(viewmodel, viewmodel.ns, viewmodelName, {_asWindow:true});
        if (view.showAt && view.usePositionAt){
            var pos = glu.walk(view.usePositionAt);
            view.showAt(pos.x, pos.y);
        } else
        {
            view.show();
        }
        return view;
    },

    /**
     * Registers an adapter. Inheritance via the extend property is wired up lazily so that ordering
     * is irrelevant
     */
    regAdapter:function (name, adapterDef) {
        var ns = Ext.ns('glu.provider.adapters');
        adapter = adapterDef;
        ns[name] = adapter;
        adapter.name = name;
        return adapter;
    },

    deferredLayoutTask: new Ext.util.DelayedTask(function(){
        glu._suspendingLayout = false;
        Ext.resumeLayouts(true);
    }),


    updatingUI : function(){
        if (!glu.asyncLayouts || !Ext.suspendLayouts) return;
        if (!glu._suspendingLayout) {
            Ext.suspendLayouts();
            glu._suspendingLayout = true;
        }
        this.deferredLayoutTask.delay(1); //go as soon as the thread is done
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
Ext.ns('glu.provider.binder');

/**
 * @class glu.provider.Binder
 * Takes care of binding views to view models. This is a gluJS internal and you should never have to use this class directly.
 * ###Binding syntax
 *
 * * `!` Inverts a boolean value. Example: `collapsed:' {@!expanded}'`
 * * `.` Allows you to naturally traverse into child objects. Example: `text:'{@activeItem.displayText}'`
 *
 * * `..`: Find the property at this level or any level above. Example: `save:'{@..save}'` will bind to the save command/function at this view model level and if it cannot find it, walk up the `parentVM` chain until it does find it.
 * Now for the binding directives (these all come immediately after the `@` sign and before the `{` to indicate that they are about *how* and not *what* to bind.
 * * `1` One-time binding - do not listen or update. Example: `value:'@1{displayText}'` will provide an initial value to the control but the control will never affect `displayText` and changes to `displayText` will never affect the `value`.
 * * `>` One-way binding - update the view when the control changes, but not vice versa, making the control binding "read-only". Example: `value:'@>{displayText}'` will initially set the value to `displayText` and will track changes to that in the view model, but will never itself update the view model.
 * * `?` Optional binding - do not raise an error if the matching view model property is not found. This is usally only used when working with view adapters (extending GluJS) as ordinarily you want to know when you have a "bad binding'. Example: `value:'@?{displayText}'` will let the application continue smoothely even if there is no `displayText` on the view model.
 *
 *
 */
Ext.apply(glu.provider.binder, {

    /**
     * Walks an ExtJS control configuration (before it has been passed into an ExtJS control constructor/Ext.create/Ext.widget)
     * collects all the bindings it finds all of the way down while validating the bindings against the supplied view model
     * and writes initial values to the config object so that the ExtJS control can be created with appropriate values.
     * Also adds any "automatic plugins" supplied by the various adapters that will "clean up" Ext JS control behavior
     * to be more suitable for use within a MVVM framework.
     * @param {Object} config The configuration for the control
     * @param {Object} viewmodel The view model
     * @return {Array} The bindings array
     */
    collectBindings:function (config, viewmodel, parentConfig, parentPropName, parentAdapter, bindingsList, indents) {
        //STEP 1: apply parentage and things that only make sense when it is a child item
        if (parentConfig) {
            //preprocess
            if (glu.isString(config)) {
                if (config == '->' || config == '-' || config == '|') {
                    //skip - it's some other sort of shortcut string like for a menu item or button padding that can't be bound...
                    return {
                        config:config,
                        bindings:bindingsList
                    }
                }
                //otherwise, assume it's a name-bound field with the default type
                config = {
                    name:config
                };
            }
            //use cached adatper if available...
            var parentAdapter = parentAdapter || this.getAdapter(parentConfig);
            //default type is only if the collection is the items collection
            var defaultTypeForItems = parentPropName == 'items' ? parentConfig.defaultType : null;
            var adapterSpecificDefaultXtype = parentAdapter['defaultTypes'] ? parentAdapter.defaultTypes[parentPropName] : null;
            config.xtype = config.xtype || defaultTypeForItems || adapterSpecificDefaultXtype || 'panel';
            if (parentPropName == 'items' || parentPropName === undefined) { //apply parent defaults if in items container or unknown
                if (parentConfig.defaults) {
                    Ext.applyIf(config, parentConfig.defaults);
                }
                //apply default transforms from the parent
                if (parentConfig.defaultTransforms) {
                    config.transforms = config.transforms || parentConfig.defaultTransforms;
                }
            }
            //process inlining of other views (triggered by xtypes that don't appear to be registered with ExtJs)
            //by nature, this can only happen when parent information is available
            var isRegistered = this.isRegistered(config.xtype);
            if (config.xtype && !isRegistered) {
                var origXtype = config.xtype;
                delete config.xtype;
                //see if it starts with bind syntax, meaning it's a placeholder for a bound sub-model
                if (origXtype && origXtype.substring(0, 2) == '@{') {
                    var expr = origXtype.substring(2, origXtype.length - 1);
                    var split = this.traverseExpression(viewmodel, expr);
                    var target = split.model[split.prop];
                    var viewname = target.viewmodelName + (config.viewMode?'_'+config.viewMode:'');
                    var spec = glu.getViewSpec(target, viewmodel.ns, viewname, config);
                    if (Ext.isString(spec))
                        throw spec;
                    //just inline the view and prepare for binding...
                    config = spec;
                    //must add actual xtype
                    config.xtype = config.xtype || defaultTypeForItems || adapterSpecificDefaultXtype || 'panel';
                    config.bindContext = expr;

                } else {
                    //see if it is a 'local type' and if so inline it
                    var spec = glu.getViewSpec(viewmodel, viewmodel.ns, origXtype, config);
                    if (!Ext.isString(spec)) {//getViewSpec returns error strings when it can't process the request. I wrote it but do not necessarily approve.
                        config = spec;
                        config.xtype = config.xtype || defaultTypeForItems || adapterSpecificDefaultXtype || 'panel';
                    } else {
                        //put it back - it will throw an exception later
                        config.xtype = origXtype;
                    }
                }
            }

        }

        //STEP 2 : Initialize the actual binding by fetching the adapter, bindContext, and transforms
        glu.log.indentMore();
        config._bindingMap = config._bindingMap || {};
        config.xtype = config.xtype || 'panel'; //default to panel if nothing else found
        glu.log.debug(glu.log.indent + 'COLLECTING bindings for {xtype: ' + config.xtype + '}');
        bindingsList = bindingsList || [];
        //first, look for conventional name binding.
        var xtypeAdapter = this.getAdapter(config);
        var transformAdapters = [];
        if (config.transforms != null) {
            //transform additional adapters...
            for (var i = 0; i < config.transforms.length; i++) {
                transformAdapters.push(this.getAdapter({
                    xtype:config.transforms[i]
                }));
            }
        }
        //global adapters...
        for (var i = 0; i < glu.plugins.length; i++) {
            transformAdapters.push(this.getAdapter({
                xtype:glu.plugins[i]
            }));
        }

        //if bindContext is specified, then offset the viewmodel to that sub model.
        if (config.hasOwnProperty('bindContext')) {
            var traversalExpression = this.traverseExpression(viewmodel, config.bindContext);
            if (traversalExpression.model[traversalExpression.prop]) {
                viewmodel = traversalExpression.model[traversalExpression.prop];
            }
        }

        //STEP 3: Invoke any 'beforeCollect' adapters or plugins, and get a new adapter if it changed the xtype
        //repeat until xtype stops changing!
        var origXtype = null;
        while (origXtype != config.xtype) {
            var origXtype = config.xtype;
            if (glu.isFunction(xtypeAdapter.beforeCollect)) {
                xtypeAdapter.beforeCollect(config, viewmodel);
            }
            for (var i = 0; i < transformAdapters.length; i++) {
                var origXtype = config.xtype;
                if (glu.isFunction(transformAdapters[i].beforeCollect)) {
                    transformAdapters[i].beforeCollect(config, viewmodel);
                }
            }
            if (origXtype !== config.xtype) {
                //the before collect routines may have changed the xtype
                xtypeAdapter = this.getAdapter(config);
            }
        }
        glu.fireEvent('beforecollect', config, viewmodel, parentPropName);


        //STEP 4: Apply any automatic conventions (supplied by adapter) based on the config.name property
        if (config.name != null && !xtypeAdapter.suppressNameBindings) {
            //automatically find the best default property to bind to when binding by name
            if (glu.isFunction(xtypeAdapter.applyConventions)) {
                //perform automatic template-based name bindings
                xtypeAdapter.applyConventions(config, viewmodel);
            }
        }

        //STEP 5: Walk all of properties of the adapter
        var childContainerPropNames = [];

        for (var propName in config) {

            if (propName === 'xtype' || propName === 'ptype' || propName === '_defaultVm'
                || propName === 'id' || propName === '_bindings' || propName === '_bindingMap'
                || (propName ==='name' && !xtypeAdapter.suppressNameBindings) || propName === 'rootVM') {
                //skip unbindable properties
                continue;
            }

            var value = config[propName];

            if (propName == 'listeners') {
                //manage listeners block which is special:
                config._bindingMap = config._bindingMap || {};
                config._bindingMap.listeners = config._bindingMap.listeners || {};
                var listeners = value;
                for (var propName in listeners) {
                    config._bindingMap.listeners[propName] = config.listeners[propName];
                    this.collectPropertyBinding(propName, config.listeners, viewmodel, true);
                }
                continue;
            }

            if (xtypeAdapter.isChildObject && xtypeAdapter.isChildObject(propName, value)) {
                //process a special single child object like a menu or toolbar
                //we check for string because it may be a binding that will get pushed down a level
                if (glu.isString(value) || glu.isArray(value)) {
                    //appears to be an array shortcut for an actual single special item like a menu or toolbar...
                    var shortcutConverter = xtypeAdapter[propName + 'Shortcut'];
                    if (shortcutConverter) {
                        value = shortcutConverter(value, config);
                        config[propName] = value;
                    }
                    if (glu.isString(value) || glu.isArray(value)) {
                        throw "Failed to convert " + propName + " into a child object";
                    }
                }

                childContainerPropNames.push(propName);
                continue;
            }
            var isChildArray = xtypeAdapter.isChildArray && xtypeAdapter.isChildArray(propName);
            if ((isChildArray && glu.isArray(value))) {
                //process a child array (like items or dockedItems), only if actually an array.
                //if a binding to a list, then simply collect the binding
                childContainerPropNames.push(propName);
                continue;
            }

            //By convention established by ExtJS, anything that ends with a "handler"
            //is a special shortcut event listener
            var isEventListener = propName == 'handler' || glu.symbol(propName).endsWith('Handler');

            //Finally, process this individual property binding
            this.collectPropertyBinding(propName, config, viewmodel, isEventListener, isChildArray, xtypeAdapter);
        }

        if (glu.isFunction(xtypeAdapter.beforeCollectChildren)) {
            xtypeAdapter.beforeCollectChildren(config, viewmodel);
        }

        //STEP 6: Walk child objects
        function bindChildren() {
            for (var idx = 0; idx < childContainerPropNames.length; idx++) {
                var childContainerPropName = childContainerPropNames[idx];
                var childContainer = config[childContainerPropName];
                if (Ext.isArray(childContainer)) {
                    var newItems = [];
                    for (var i = 0; i < childContainer.length; i++) {
                        var childItem = childContainer[i];
                        var result = this.collectBindings(childItem, viewmodel, config, childContainerPropName, xtypeAdapter, bindingsList, indents + 1);
                        newItems.push(result.config);
                    }
                    config[childContainerPropName] = newItems;
                } else {
                    //otherwise do a simple recursion
                    config[childContainerPropName] = this.collectBindings(childContainer, viewmodel, config, childContainerPropName, xtypeAdapter, bindingsList, indents + 1).config;
                }
            }
        }

        //do the actual child walk
        bindChildren.apply(this);

        //STEP 7: Call any beforeCreate on the adapter (now that the config is all prepared)
        if (glu.isFunction(xtypeAdapter.beforeCreate)) {
            xtypeAdapter.beforeCreate(config, viewmodel);
        }

        for (var i = 0; i < transformAdapters.length; i++) {
            if (glu.isFunction(transformAdapters[i].beforeCreate)) {
                var upshot = transformAdapters[i].beforeCreate(config, viewmodel) || {};
                //sometimes in rare case a transformer will need to rebind the children after a radical change
                if (upshot.rebindChildren) {
                    bindChildren.apply(this);
                }
            }
        }

        //STEP 8: add the 'afterCreate' plugin from the adapter to the ExtJS control to
        //"normalize" the control on creation. DOES NOT APPLY BINDING, just "converts" ExtJS control
        //to glu control as needed without affecting ExtJS prototypes or creating new widgets
        if (!(config.plugins && config.plugins.addedBinderPlugin)) {
            if (Ext.getProvider().provider == 'touch') {
                config.plugins = config.plugins || [];
                config.plugins.addedBinderPlugin = true;
                Ext.define('Ext.plugin.' + xtypeAdapter.name + 'Plugin', {
                    isBinderPlugin:true,
                    alias:'plugin.' + xtypeAdapter.name + 'Plugin',
                    //xtype:'Ext.plugin.adapterPlugin',
                    init:function (control) {
                        if (glu.isFunction(xtypeAdapter.afterCreate)) {
                            xtypeAdapter.afterCreate(control, viewmodel);
                        }
                        for (var i = 0; i < transformAdapters.length; i++) {
                            var tAdapter = transformAdapters[i];
                            if (glu.isFunction(tAdapter.afterCreate)) {
                                tAdapter.afterCreate(control, viewmodel);
                            }
                        }
                    }
                });
                config.plugins.push(xtypeAdapter.name + 'Plugin');

            }
            else {
                config.plugins = config.plugins || [];
                config.plugins.addedBinderPlugin = true;
                config.plugins.push({
                    isBinderPlugin:true,
                    init:function (control) {
                        if (glu.isFunction(xtypeAdapter.afterCreate)) {
                            xtypeAdapter.afterCreate(control, viewmodel);
                        }
                        for (var i = 0; i < transformAdapters.length; i++) {
                            var tAdapter = transformAdapters[i];
                            if (glu.isFunction(tAdapter.afterCreate)) {
                                tAdapter.afterCreate(control, viewmodel);
                            }
                        }
                    }
                });
            }
        }

        //STEP 9: Store the binding in the list and return
        if (config._bindings != null && config._bindings.length > 0) {
            config.id = config.id || Ext.id(null,'glu-' + config.xtype + '-');
            config._bindings.defaultModel = viewmodel;
            config._bindings.adapter = xtypeAdapter;
            bindingsList.push(config);
        }
        glu.log.indentLess();
        return {
            config:config,
            bindings:bindingsList
        }
    },

    /*
     * Collect and activate property binding on the config
     */
    collectPropertyBinding:function (propName, config, viewmodel, isEventListener, isChildArray, xtypeAdapter) {
        var propValue = config[propName];
        var binding = this.readPropertyBinding(propValue, viewmodel, isEventListener);
        if (binding == null) {
            return; //nothing to do
        }
        if (binding.localizationKey) {
            //just a localization, no need to store
            config[propName] = binding.initialValue;
            return;
        }
        binding.controlPropName = propName;
        if (!binding.valid) {
            if (binding.reason.indexOf('Syntax ') > -1) {
                throw 'Binding Exception - ' + binding.reason;
            }
            if (binding.optional) {
                delete config[propName];
                return;
            }
            if (binding.reason == 'Missing bind target') {
                throw 'Binding Exception - The control config property "' + propName +
                    '" is non-optionally bound to view model property "' +
                    propValue + '" but that target does not exist.';
            }
            if (binding.reason == 'Illegal function binding') {
                throw "Binding Exception: " + 'Attempted to bind config property "' + propName + '" to a function when "'
                    + propName + '" is not a handler or listener.';
            }
            throw 'Binding Exception: ' + binding.reason
        }
        if (isEventListener) {
            //simply provides the signature of the event minus
            //the first argument (which is always the control itself)
            binding.initialValue = function () {
                var args = Array.prototype.slice.call(arguments);
                args.shift();
                //remove the first element
                if (config.value) {
                    //if there is a value, put that first in the list
                    args.unshift(config.value);
                }
                glu.log.info(glu.symbol('USER triggered {0}.{1}').format(binding.model.toString(), binding.modelPropName));
                binding.model[binding.modelPropName].apply(binding.model, args);
            };
            config[binding.controlPropName] = binding.initialValue;
            return;
        }

        if (binding.initialValue && isChildArray) {
            //don't actually want it being initialized with a bunch of view/data/whatever models!
            //These will be added later by the item binder
            binding.initialValue = [];
        }

        //transform initial value if requested by adapter
        if (xtypeAdapter) {
            var propBindings = xtypeAdapter[binding.controlPropName + 'Bindings'];
            if (propBindings && propBindings.transformInitialValue) {
                binding.initialValue = propBindings.transformInitialValue(binding.initialValue, config, binding.model);
            }
        }

        //set initial value
        config[binding.controlPropName] = binding.initialValue;

        //track that the binding occurred (for a sanity check, not otherwise used)
        config._bindings = config._bindings || [];
        if (config._bindingMap) {
            config._bindingMap[propName] = propValue;
        }

        //If this is more than a one-time binding on initialization, store it for later
        if (!binding.onetime) {
            config._bindings.push(binding);
        }
    },

    /* DOCS DISABLED FOR NOW
     * Simply collect a binding without actually activating it on the configuration
     */
    readPropertyBinding:function (propValue, viewmodel, isEventListener) {
        var binding = glu.parseBindingSyntax(propValue);
        if (binding == null || !binding.valid) {
            return binding;
        }
        binding = Ext.apply(binding, {
            model:viewmodel,
            invertValue:false,
            initialValue:null
        });
        //DETECT IF the whole expression is a locale key. Assume it begins and ends with those delimiters.
        if (binding.localizationKey) {
            binding.initialValue = glu.localize({
                viewmodel:binding.model,
                ns:viewmodel.ns,
                key:binding.localizationKey
            });
            return binding;
        }

        var bindExpression = binding.bindExpression;

        //VERY SIMPLE EXPRESSION PROCESSING
        //Starts with not "!" ?
        if (bindExpression.indexOf('!') == 0) {
            binding.invertValue = true;
            bindExpression = bindExpression.substring(1);
        }
        if (bindExpression.substring(0, glu.conventions.windowPath.length) == glu.conventions.windowPath) {
            bindExpression = bindExpression.substring(glu.conventions.windowPath.length);
            var traversed = this.traverseExpression(window, bindExpression);
            binding.model = traversed.model;
            bindExpression = traversed.prop;
        } else if (bindExpression.indexOf(glu.conventions.autoUp) > -1) {
            bindExpression = bindExpression.substring(glu.conventions.autoUp.length);
            binding.model = this.traverseUpExpression(binding.model, bindExpression);
        } else
        //is there a traversal
        if (bindExpression.indexOf('\.') > -1) {
            var traversed = this.traverseExpression(binding.model, bindExpression);
            binding.model = traversed.model;
            bindExpression = traversed.prop;
        }
        binding.modelPropName = bindExpression;
        binding.initialValue = binding.model.get ? binding.model.get(bindExpression) : binding.model[bindExpression];

        if (binding.initialValue === undefined && !binding.model.hasOwnProperty(bindExpression)) {
            binding.valid = false;
            binding.reason = 'Missing bind target';
            return binding;
        }
        if (isEventListener) {
            return binding; //nothing more to do at this point...
        }

        if (Ext.isFunction(binding.initialValue)) {
            binding.valid = false;
            binding.reason = "Illegal function binding";
        }

        //make substitution:
        if (binding.invertValue) {
            binding.initialValue = !binding.initialValue;
        }
        if (binding.isFormula) {
            binding.initialValue = binding.prefix + binding.initialValue + binding.suffix;
        }
        return binding;
    },

    traverseExpression:function (model, expression) {
        var tokens = expression.split('\.');
        var actualModel = model;
        for (var i = 0; i < tokens.length - 1; i++) {
            var token = tokens[i];
            var child = actualModel.get ? actualModel.get(token) : actualModel[token];
            if (child === undefined) {
                throw "Unable to find child '" + token + "' within expression '" + expression + "'";
            }
            actualModel = child;
        }
        return {
            model:actualModel,
            prop:tokens[tokens.length - 1]
        }
    },

    traverseUpExpression:function (model, expression) {
        var foundModel = model;
        do {
            var hasProp = foundModel.hasOwnProperty(expression);
            if (hasProp)
                break;
            foundModel = foundModel.parentVM;
        } while (foundModel != null);

        return foundModel || model;
    }
});

/*
 * Copyright (C) 2012 by CoNarrative
 */
Ext.ns('glu.provider.binder');
Ext.apply(glu.provider.binder, {
    /*
     * Receives an array of bindings and attaches them appropriately
     */
    applyBindingsList:function (configList) {
        for (var i = 0; i < configList.length; i++) {
            var config = configList[i];
            this.applyAllBindingsToAControl(config);
        }
    },

    applyAllBindingsToAControl:function (config) {
        if (!config.hasOwnProperty('_bindings')) {
            return; //has no bindings
        }
        var control = Ext.getCmp(config.id);
        var bindingAdapter = config._bindings.adapter;
        if (control === undefined) {
            if (bindingAdapter.findControl) {
                control = bindingAdapter.findControl(config);
            }
            if (control === undefined) {
                glu.log.warn('unable to find and apply bindings to control ' + config.id);
                return;
            }
        }
        if (control._private != null && control._private.isBound == true) {
            return; //already bound
        }
        glu.log.indentMore();
        glu.log.debug(glu.log.indent + 'APPLYING bindings for {xtype: ' + control.xtype + '}');

        control._private = control._private || {};
        control._private.isBound = true;

        new glu.GraphObservable({node:control});
        control._vm = config._bindings.defaultModel; //the defaultModel is the directly bound model
        control.on('destroy', function(cntrl){
            cntrl._ob.detach('_vm'); //informs the view model list to stop sending me events
        });
        var bindings = config._bindings;
        for (var i = 0; i < bindings.length; i++) {
            var binding = bindings[i];
            this.applyOneBindingToControl(bindingAdapter, config, control, binding);
        }
        if (control.fireEvent) {
            control.fireEvent('glubind', control);
        }
        glu.log.indentLess();
    },

    applyOneBindingToControl:function (bindingAdapter, config, control, binding) {
        var propBindings = bindingAdapter[binding.controlPropName + 'Bindings'] || {};

        if (propBindings && glu.isFunction(propBindings.custom)) {
            var handledCustom = propBindings.custom({
                binding:binding,
                config:config,
                viewmodel:binding.model,
                control:control
            });
            if (!(handledCustom === false)) {
                return;
            }
        }
        //MODEL -> CONTROL
        if (binding.model.on != null) {//only listen to model when model is observable
            this.applyPropBindingToControl(bindingAdapter, config, binding.model, control, binding, propBindings);
        }

        // MODEL -> CONTROL IS FINISHED.
        if (propBindings && propBindings.onInit) {
            propBindings.onInit.call(binding.model, binding, control);
        }

        // CONTROL -> MODEL
        if (propBindings === undefined || propBindings.suppressViewmodelUpdate || propBindings.eventName === undefined) {
            //can't bind from control -> model because control property doesn't surface any behavior to user
            return;
        }

        glu.log.debug('LISTENING on control property ' + propBindings.eventName);

        control.on(propBindings.eventName, function () {
            var adaptedValue = propBindings.eventConverter.apply(bindingAdapter, arguments);
            if (binding.invertValue) {
                adaptedValue = !adaptedValue;
            }
            glu.log.info(glu.symbol('USER changed {0}.{1}').format(binding.model.toString(), binding.modelPropName));
            binding.model.set.call(this, binding.modelPropName, adaptedValue);
        }, binding.model);

    },

    /**
     * Adds a listener to a particular view model property that will push into a control
     * The reference to the control is entirely weak and by control ID, so that nowhere do we hold on
     * to a reference to an ExtJS component (to minimize inadvertent memory leaks)
     * @private
     * @param bindingAdapter
     * @param config
     * @param viewmodel
     * @param theControl
     * @param binding
     * @param propBindings
     */
    applyPropBindingToControl:function (bindingAdapter, config, viewmodel, theControl, binding, propBindings) {
        // if glu.testMode then store a reference to the control within the view model
        //TODO: Make sure registerCOntrolBinding just hands in Id
        if (glu.testMode) {
            viewmodel.registerControlBinding(binding.modelPropName, theControl);
        }

        var modelEventName = binding.modelPropName + 'Changed';
        glu.log.debug('binding model event name of ' + modelEventName);

        var controlId = theControl.id;
        var valueSetter = propBindings.setComponentProperty;
        if (valueSetter === undefined) {//default to the form 'control.setFoo(value)', where foo is the name
            var setterName = 'set' + glu.string(binding.controlPropName).toPascalCase();
            var testSetter = theControl[setterName];
            if (testSetter === undefined) {
                glu.log.debug('Attempted to bind non-existent value setter "' + setterName + '" on xtype: ' + theControl.xtype);
                return;
            }
            valueSetter = function (value, oldValue, options, control) {
                control[setterName].call(control, value);
            };
        }

        var storeInControlAs = propBindings.storeValueInComponentAs || binding.controlPropName;
        var wrapper = function (value, oldValue, options) {
            var control = Ext.getCmp(controlId);
            if (control===undefined) {
                if (bindingAdapter.findControl) {
                    control = bindingAdapter.findControl(config);
                }
                if (control === undefined) {
                    return 'discard';
                }
            }
            if (glu.isArray(value)){
                //make a copy--arrays are handled by equivalence not reference
                value = value.slice();
            }
            if (binding.invertValue) {
                value = !value;
            }
            if (binding.isFormula) {
                value = binding.prefix + value + binding.suffix;
            }
            if (glu.equivalent(control[storeInControlAs], value)) {
                glu.log.debug('suppressing set of property ' + binding.controlPropName + ' on control as it already has value->' + value);
                return; //suppress - already set to that value. This control could have been the originator of the model change in fact.
            }
            //TODO - Simply save oldvalue instead of recalculating...
            if (binding.invertValue) {
                oldValue = !oldValue;
            }
            if (binding.isFormula) {
                oldValue = binding.prefix + oldValue + binding.suffix;
            }
            glu.log.debug('setting control property "' + binding.controlPropName + '" to "' + value + '"');
            glu.updatingUI();
            valueSetter(value, oldValue, options, control);
            //set the underlying field as a tracker
            control[storeInControlAs] = value;
        };

        glu.log.debug('LISTENING on viewmodel property ' + modelEventName);

        viewmodel.on(modelEventName, wrapper, viewmodel);

        //TODO: Switch to this format ASAP so we can start properly detaching views from their view models for when view models switch contexts
//        theControl._ob.on('_vm.' + modelEventName, wrapper, viewmodel);
    }
});

/*
 * Copyright (c) 2012 CoNarrative
 */
Ext.ns('glu.provider.binder');
Ext.apply(glu.provider.binder, {
    getAdapter:function (config) {
        // if its a plugin, return a dummy adapter that does nothing
        if (config.ptype) {
            return glu.provider.adapters.ptype;
        }
        var xtype = config.xtype;
        var adapter = null;
        do {
            adapter = glu.provider.adapters[xtype];
            if (!adapter) {
                if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
                    var currentType = Ext.ClassManager.getByAlias('widget.' + xtype);
                    if (!currentType) {
                        throw (xtype + ' is not a valid xtype');
                    }
                    xtype = currentType.superclass.xtype;
                } else {
                    var currentType = Ext.ComponentMgr.types[xtype];
                    if (!currentType) {
                        throw (xtype + ' is not a valid xtype');
                    }
                    xtype = currentType.superclass.constructor.xtype;
                }

            }
        } while (!adapter);
        //use the xtype chain

        if (xtype != config.xtype) {
            glu.log.debug('No exact binding adaptor for ' + config.xtype + '; using adapter for ' + xtype + ' instead.');
        }

        //initialize the adapter if it hasn't been. We can do this simply because these are singletons
        return this.initAdapter(adapter);
    },

    /**
     * Lazy chains adapter to make debugging simpler and avoid file ordering issues
     */
    initAdapter : function (adapterDef){
        if (adapterDef.initialized) {
            return adapterDef;
        }
        var ns = glu.provider.adapters;
        var name = adapterDef.name;
        if (adapterDef.extend) {
            var child = ns[adapterDef.extend];
            this.initAdapter(child);
        }
        if (adapterDef.extend && adapterDef.extend.indexOf('.')==-1){
            adapterDef.extend = 'glu.provider.adapters.' + glu.symbol(adapterDef.extend).toPascalCase();
        }
        var className = 'glu.provider.adapters.' + glu.symbol(name).toPascalCase();
//        if (Ext.getVersion().major>3 || Ext.getProvider().provider == 'touch') {
//            //adapterDef.singleton = true;   //NOT doing a singleton, but making a separate class name so that it matches Ext 3 pattern
//            var adapterClass = Ext.define (className, adapterDef);
//        } else {
//            var base = (adapterDef.extend ? glu.walk(adapterDef.extend) : null) || Object;
//            var adapterClass = Ext.extend(base,adapterDef);
//            ns[glu.symbol(name).toPascalCase()] = adapterClass;
//        }
        var adapterClass =glu.define(className, adapterDef);
        var adapter = new adapterClass();
        ns[name] = adapter;
        adapter.name = name;
        if (adapter.initAdapter) {
            adapter.initAdapter();
        }
        adapter.initialized = true;
        return adapter;
    },

    isRegistered:function (xtype) {
        return Ext.ComponentMgr.isRegistered(xtype) || ((Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') && Ext.ClassManager.getNameByAlias('widget.' + xtype) !== '');
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.provider.itemsHelper = {
	insertItem:function(context, idx, viewItem){
        var container = context.control;
        var collectionName = context.binding.controlPropName;
        if (collectionName!='items'){
            container[collectionName].insert(idx,viewItem);
        } else {
            //normal items
            if (container.insert) {
                container.insert(idx, viewItem);
            } else {
                container.items.insert(idx, viewItem);
            }
        }
    },
    removeItemAt:function(context, idx){
        var container = context.control;
        var collectionName = context.binding.controlPropName;
        if (collectionName!='items'){
            container[collectionName].removeAt(idx);
        } else {
            //normal items
            if (idx>container.items.length - 1) return;
            if (container.remove || container.removeAt) {
                if (container.removeAt) {
                    container.removeAt(idx);
                } else {    
                    container.remove(idx);
                }
            } else {
                container.items.removeAt(idx);
            }
        }
    },
    removeAllItems:function(context){
        var container = context.control;
        var collectionName = context.binding.controlPropName;
        if (collectionName!='items'){
            container[collectionName].removeAll();
        } else {
            if (container.removeAll){
                container.removeAll();
            } else {
                container.items.removeAll();
            }
        }
    },
    /*
     * Handles additions to the observable list
     */
    respondToAdd:function (item, idx, context, needsDoLayout) {
        glu.log.indentMore();
        glu.updatingUI();
        glu.log.debug(glu.log.indent + 'Processing a view item added to collection at index ' + idx);
        var list = context.viewmodel.get(context.binding.modelPropName);
        var container = context.control;
        if (!container.itemTemplate && !(item.mtype == 'viewmodel' || item.mtype == 'datamodel')) {
            throw "Cannot render an item within a bound items list because there is neither an itemTemplate defined nor is the item a viewmodel";
        }
        var viewItem = null;

        if (container.itemTemplate) {//use item template if it exists
            var viewItemSpec = glu.isFunction(container.itemTemplate) ? container.itemTemplate(item, idx) : glu.deepApply({}, container.itemTemplate);
            if (viewItemSpec === undefined)
                return;
            //do nothing if template is null...
            item.parentVM = list.parentVM;
            item.rootVM = list.rootVM;
            item.ns = list.ns;
            item.recType = list.recType;
            var result = glu.provider.binder.collectBindings(viewItemSpec, item, container.initialConfig);
            var boundConfigs = result.bindings;
            //Make a record observable as needed...
            if (item.phantom != null && boundConfigs.length > 0) {
                //TODO: Make sure that it isn't one way bindings...'
                this.makeRecordObservable(item);
            }
            viewItem = glu.widget(viewItemSpec);
            glu.provider.binder.applyBindingsList(boundConfigs);

        } else {//view model
            var viewModelName = item.viewmodelName;
            if( container.initialConfig.defaults && container.initialConfig.defaults.viewMode ){
                viewModelName += '_'+container.initialConfig.defaults.viewMode;
            }
            viewItem = glu.view(item, item.ns, viewModelName, {}, {}, container.initialConfig);
        }
 
        viewItem._vm = item; //add view model directly to view 

        this.insertItem(context,idx,viewItem);

        //apply as needed...
        if (needsDoLayout) {
            container.doLayout();
        }
        //No more doLayout in Touch
        if(Ext.getProvider().provider=='touch')
        {
            container.setActiveItem(0);
        }
        //make sure the view item has a reference back to the model in case it needs it...
        viewItem.model = item;
        glu.log.indentLess();
    },

    /* DOCS DISABLED FOR NOW
     * Initializes a bound item list
     * Does not deal with "activation"
     */
    bindItems:function (context, needsDoLayout) {
        glu.log.indentMore();
        glu.log.debug(glu.log.indent + 'processing bound items list');
        context.needsDoLayout = needsDoLayout;
        var list = context.viewmodel.get(context.binding.modelPropName);
        var container = context.control;
        context.valueSetTask = new Ext.util.DelayedTask(function () {
        });
        //MODEL -> CONTAINER
        //step through current items and create matching views
        var me = this;
        //support for enumerations across integer value
        //TODO: should use yield for newer javascripts...
        if (glu.isNumber(list)) {
            var count = list;
            list = [];
            for (var i = 0; i < count + 1; i++) {
                list.push(i);
            }
        }
        list.each = list.each || list.foreach ||
            function (process) {
                for (var i = 0; i < list.length; i++) {
                    process.call(me, list[i], i);
                }
            };


        list.each(function (item, idx) {
            this.respondToAdd(item, idx, context, false, true)
        }, this);
        if (needsDoLayout) {//just one time for all of those initial adds
            container.doLayout();
        }
        //if not observable, then a static list and stop listening...
        if (list.on === undefined)
            return;

        if (list._ob) {
            //its a glu list using the graph observable concept. This will clean up references on remove
            //listen to changed event on add/remove
            glu.temp = glu.temp || {};
            glu.temp.transfers = glu.temp.transfer || {};
            var attachPath = '_vm.' + context.binding.modelPropName +  '.';
            var transferKey = context.viewmodel.viewmodelName + '-' +context.binding.modelPropName;
            container._ob.on(attachPath + 'removedall', function(){
                //do a batch remove if possible. Later individual remove events will be ignored by the container
                this.removeAllItems(context);
            }, this);
            container._ob.on(attachPath + 'added', function (item, idx, isTransfer) {
                glu.updatingUI();
                if (isTransfer) {
                    //re-use the transferred component
                    var transferral = glu.temp.transfers[transferKey];
                    var component = transferral.shift();
                    if (transferral.length==0) delete glu.temp.transfers[transferKey];
                    delete component._isTransferring;
                    container.autoDestroy = container._autoDestroy;
                    delete container._autoDestroy;
                    if (component.destroyed) {
                        //cannot reuse after all
                        this.respondToAdd(item, idx, context, needsDoLayout);
                        return;
                    }
                    this.insertItem(context,idx,component);
                    return;
                };
                this.respondToAdd(item, idx, context, needsDoLayout);
            }, this);
            container._ob.on(attachPath + 'removed', function (item, idx, isTransfer) {
                glu.updatingUI();
                if (isTransfer) {
                    var component = container.items.getAt(idx);
                    component._isTransferring = true;
                    container._autoDestroy = container.autoDestroy;
                    container.autoDestroy = false;
                    //the key makes sure that we only re-use when moving between identical lists
                    glu.temp.transfers[transferKey] = glu.temp.transfers[transferKey] || [];
                    glu.temp.transfers[transferKey].push(component);
                }
                //suppress tab selection change events
                container._changeOriginatedFromModel=true;
                this.removeItemAt(context,idx);
                delete container._changeOriginatedFromModel;
            }, this);

        } else
        //if store, listen that way...
        if (list.data && list.data.on) {
            if (Ext.getVersion().major > 3 || Ext.getProvider().provider == 'touch') {
                //strange that 'add' does not work properly on store in Ext 4∆
                list.data.on('add', function (idx, item) {
                    glu.updatingUI();
                    this.respondToAdd(item, idx, context, needsDoLayout)
                }, this);
                list.data.on('remove', function (idx, item) {
                    //container._changeOriginatedFromModel=true;
                    glu.updatingUI();
                    this.removeItemAt(context,idx);
                }, this);
            } else {
                list.on('add', function (store, items, idx) {
                    for (var it = 0; it < items.length; it++) {
                        glu.updatingUI();
                        this.respondToAdd(items[it], idx + it, context, needsDoLayout)
                    }
                }, this);
                list.on('remove', function (store, item, idx) {
                    glu.updatingUI();
                    //suppress tab selection change events
                    container._changeOriginatedFromModel=true;
                    this.removeItemAt(context,idx);
                    delete container._changeOriginatedFromModel;
                }, this);
            }
        }
        glu.log.indentLess();

    },

    makeRecordObservable:function (item) {
        //TODO: Clean up and unify observable pattern as a mixin!!!!
        item.events = {};
        item.innerSet = item.set;
        item.registerControlBinding = function () {
        };
        //for testing
        item.on = function (name, callback, scope) {
            name = name.toLowerCase();
            if (!this.events.hasOwnProperty(name)) {
                this.events[name] = {
                    listeners:[]
                }
            }
            var evt = this.events[name];
            evt.listeners.push({
                fn:callback,
                scope:scope || glu
            });
        };
        item.fireEvent = function () {
            var name = arguments[0].toLowerCase();
            var args = Array.prototype.slice.call(arguments);
            args.shift();
            if (!this.events.hasOwnProperty(name)) {
                this.events[name] = {
                    listeners:[]
                }
            }
            var evt = this.events[name];
            for (var i = 0; i < evt.listeners.length; i++) {
                var listener = evt.listeners[i];
                var myVeto = listener.fn.apply(listener.scope, args);
                if (myVeto === true) {
                    return false;
                }
            }
            return true;
        };
        item.set = function (propName, value) {
            var oldValue = this.get(propName);
            if (oldValue === value) {
                return;
                //do nothing if it's the same thing.
            }
            this.innerSet(propName, value);
            this.fireEvent(propName + 'Changed', value, oldValue, {
                modelPropName:propName
            });
            this.fireEvent('changed', value, oldValue, {
                modelPropName:propName
            });

        }
    }
};

/*
 * Copyright (c) 2012 CoNarrative
 */
Ext.ns('glu.provider.adapters');
glu.regAdapter = glu.provider.regAdapter;

glu.regAdapter('component', {
    applyConventions:function (config, viewmodel) {
    },
    isChildArray:function (propName, value) {
        propName === 'items';
    },
    isChildObject:function () {
        return false;
    },
    processChildPropertyShortcut:function (propName, config) {
        return config;
    },
    afterCreate:function (control, viewmodel) {

    },
    checkForEditors:function (config, propConfigs) {
        for (var name in propConfigs) {
            var editor = config[name];
            if (!Ext.isObject(editor)) continue;
            //it's an editor
            config[name] = editor.value; //move the fixed value or binding into the property
            config.editors = config.editors || [];
            config.propName = name;
            editor.xtype = 'editor';
            editor.target = propConfigs[name];
            editor.trigger = editor.trigger || 'dblclick';
            editor.field.value = editor.field.value || editor.value;
            delete editor.value;
            config.editors.push(editor);
        }
    }
});



glu.regAdapter('checkboxfield', {
    extend:'field',
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            checked:glu.conventions.expression(config.name),
            label:glu.conventions.asLocaleKey(config.name)
        });
    },
    beforeCreate:function (config, viewmodel) {
    },
    afterCreate:function (control, viewmodel) {
        control.addListener('check', function (control) {
            control.fireEvent('checkedChanged', control, control.getChecked());
        }, control);

        control.addListener('uncheck', function (control) {
            control.fireEvent('checkedChanged', control, control.getChecked());
        }, control);
    },
    checkedBindings:{
        setComponentProperty:function (value, oldValue, options, control) {
            control.setChecked(value)
        },
        eventName:'checkedChanged',
        eventConverter:function (control, newValue) {
            return control.getChecked();
        }
    }
});

/*
 * Copyright (c) 2012 CoNarrative
 */
glu.regAdapter('container', {
    extend:'component',
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            items:glu.conventions.expression(config.name)
        });
        glu.provider.adapters.Component.prototype.applyConventions.apply(this, arguments);
    },
    isChildArray:function (propName, value) {
        return propName === 'items' || propName === 'dockedItems';
    },
    beforeCollect:function (config) {

    },
    beforeCreate:function (config) {

    },
    afterCreate:function (control, viewmodel) {
        glu.provider.adapters.Component.prototype.afterCreate.apply(this, arguments);
    },
    activeItemBindings:{
        setComponentProperty:function (value, oldValue, options, control) {
            //TODO: added this check due to headless access.  if fails because layout is not rendered
            if (!control.getLayout() || !control.getLayout().setActiveItem) {
                return;
            }
            control.getLayout().setActiveItem(value);
        }
    },
    itemsBindings:{
        custom:function (context) {
            if (context.control._layout != 'card') {
                //do regular bindings
                glu.provider.itemsHelper.bindItems(context, false);
                return;
            }

            var activator = context.viewmodel.get(context.binding.modelPropName);
            var cardPanel = context.control;

            glu.provider.itemsHelper.bindItems(context);
        }
    }
});
glu.regAdapter('field', {
    extend:'component',
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            value:glu.conventions.expression(config.name),
          //  valid:glu.conventions.expression(config.name + 'IsValid', {optional:true}),
            label:glu.conventions.asLocaleKey(config.name)
        });
        glu.provider.adapters.Component.prototype.applyConventions.apply(this, arguments);
    },
    valueBindings:{
        eventName:'change',
        eventConverter:function (field, newVal) {
            return field.getValue()
        },
        setComponentProperty:function(value,oldvalue,options,control){
            control.suspendCheckChange++;
            control.setValue(value);
            control.lastValue = value;
            control.suspendCheckChange--;
        }
    }
});
/*
 * Copyright (c) 2012 CoNarrative
 */
glu.regAdapter('label', {
    extend:'component',
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            html:glu.conventions.expression(config.name),
            //  valid:glu.conventions.expression(config.name + 'IsValid', {optional:true}),
            //label:glu.conventions.asLocaleKey(config.name)
        });
    },
    beforeCollect:function (config, viewmodel) {
        this.checkForEditors(config, {fieldLabel:'labelEl', value:'inputEl', boxLabel:'boxLabelEl'});
        //prevent change checking - may be 4.0 only;
    },
    htmlBindings:{
        setComponentProperty:function (value, oldValue, options, control) {
            control.setHtml(value);
        }
    }
});
/*
 * Copyright (C) 2013 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.segmentedbutton
 * @author Travis Barajas
 * @extends glu.extjs.adapters.container
 * The segmentedbutton adapter adds support for an activeButton binding.
 *
*
 */
glu.regAdapter('segmentedbutton', {
    extend:'container',
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            text : glu.conventions.asLocaleKey(config.name),
            activeButton: glu.conventions.expression(config.name)
        });
        glu.provider.adapters.Container.prototype.applyConventions.apply(this, arguments);
    },
    beforeCreate:function (config, viewmodel) {
        glu.provider.adapters.Container.prototype.beforeCreate.apply(this, arguments);
        config.listeners = {
            toggle: function (segButton, button, isPressed, eOpts) {
                if(!isPressed) return //Don't care about the active button being depressed.
                segButton.fireEvent('activeitemchanged', segButton, button, isPressed);
            }
        }
    },
    activeButtonBindings:{
        setComponentProperty:function (value, oldValue, options, control) {
            //TODO:  Code a better way to ignore the UI event
            if(control.getPressedButtons()[0].config.value === value) return;

            console.log('about to set value '+value)
            var button = control._items.findBy(function (item) {
                if(item.config.value == value) return true;
            });

            control.setPressedButtons(button);
        },
        eventName:'activeitemchanged',
        eventConverter:function (control, button, isPressed) {
            return button.config.value
        }
    },
    afterCreate: function (control, viewmodel) {
        glu.provider.adapters.Container.prototype.afterCreate.apply(this, arguments);
        if (control.config.activeButton != null) {
            var button = control._items.findBy(function (item) {
                if(item.config.value == control.config.activeButton) return true;
            })
            control.setPressedButtons(button);
        }
    }
});
glu.regAdapter('textfield', {
    extend:'field',
    beforeCollect:function (config) {
        config.enableKeyEvents = true;
    },
    /**
     * @cfg {Function} enterKeyHandler
     * A special GluJS convenience shortcut that handles the pressing of the "Enter" key when in the field
     */
    afterCreate:function (control, viewmodel) {
        //glu.provider.adapters.Field.prototype.afterCreate.apply(this, arguments);
        if (glu.testMode) {
            control.addListener('keyup', function () {
                control.fireEvent('textchanged', control);
            }, control);
            return;
        }
        //adds a buffer to all key events
        if (!control.delayedEvent) {
            control.delayedEvent = new Ext.util.DelayedTask(function () {
                control.fireEvent('textchanged', control);
            });
        }
        control.addListener('keyup', function (t, e, o) {
            control.delayedEvent.delay(control.keyDelay || 100); //give some time for multiple keypresses...
        }, control);

        if (control.getInitialConfig().enterKeyHandler) {
            //special gluJS helper handler
            control.on('action', function (f, e) {
                if (e.event.keyIdentifier == 'Enter') {
                    control.fireEvent('textchanged', control); //force most recent
                    control.initialConfig.enterKeyHandler();
                }
            }, null, {delay:110});
        }
    },
    initAdapter:function () {
        this.valueBindings = glu.deepApplyIf({eventName:'textchanged'}, this.valueBindings);
    }
});

