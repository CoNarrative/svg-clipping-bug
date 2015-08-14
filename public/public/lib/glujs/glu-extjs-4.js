// Copyright (c) 2012 CoNarrative - http://www.conarrative.com/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)
// GluJS version 1.1.0

/*
 * Copyright (C) 2012 by CoNarrative
 */
if (!Ext.reg) {
    Ext.reg = function (name, ctor) {
        Ext.ClassManager.setAlias('widgets.' + name, ctor);
    };

    Ext.grid.CheckboxSelectionModel = Ext.selection.CheckboxModel;
    Ext.grid.RowSelectionModel = Ext.selection.RowModel;
}

/*Add to Ext 3.x*/
if (!Ext.getVersion) {
    Ext.getVersion = function () {
        return Ext.version;
    }
}
if (!Ext.getProvider) {
    Ext.getProvider = function () {
        return {provider:'extjs'}
    }
};

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
                        throw new Error("Failed to convert " + propName + " into a child object");
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
                throw new Error('Binding Exception - ' + binding.reason);
            }
            if (binding.optional) {
                delete config[propName];
                return;
            }
            if (binding.reason == 'Missing bind target') {
                throw new Error('Binding Exception - The control config property "' + propName +
                    '" is non-optionally bound to view model property "' +
                    propValue + '" but that target does not exist.');
            }
            if (binding.reason == 'Illegal function binding') {
                throw new Error("Binding Exception: " + 'Attempted to bind config property "' + propName + '" to a function when "'
                    + propName + '" is not a handler or listener.');
            }
            throw new Error('Binding Exception: ' + binding.reason);
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
                throw new Error("Unable to find child '" + token + "' within expression '" + expression + "'");
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
            if (container.remove){
                container.remove(idx);
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
            throw new Error("Cannot render an item within a bound items list because there is neither an itemTemplate defined nor is the item a viewmodel");
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
/**
 * @class glu.extjs.adapters.field
 * @extends glu.extjs.adapters.component
 *
 * Fields in glu share two basic properties : a value property whose change behavior is normalized across all field types
 * (even in Ext 3.x), and a fieldLabel.
 * In form-rich applications, glu encourages you to find ways to minimize their visual setup down to simply specifying their
 * grouping and order:
 *      {
 *          xtype : 'form',
 *          defaultType : 'autofield',
 *          items : ['name','ssn', {
 *                  xtype:'fieldset',
 *                  items:['street',
 *                      {
 *                          xtype : 'fieldcontainer',
 *                          layout : 'hbox',
 *                          items : ['city','state','zip']
 *                      }
 *                  ]
 *              }]
 *       }
 *
 * That way, visual conventions can be easily managed globally without having to create additional component/widgets,
 * and with an easy way to opt-out for individual fields (just fully specify what they should look like as normal).
 *
 * See the {@link autofield} for an example of how to auto-generate xtypes/configurations for your fields.
 */
Ext.ns('glu.provider.adapters');
glu.regAdapter = glu.provider.regAdapter;

glu.regAdapter('fieldset', {
    extend : 'container',
    defaultTypes : {
        items : 'textfield'
    },
    applyConventions : function(config, viewmodel) {
        Ext.applyIf(config, {
            collapsed : glu.conventions.expression(config.name + 'IsExpanded', {
                optional : true,
                not : true
            })
        });
        glu.provider.adapters.Container.prototype.applyConventions.apply(this, arguments);
    },

    afterCreate : function(control, viewmodel) {
        glu.provider.adapters.Container.prototype.afterCreate.apply(this, arguments);
        var expandOrCollapseFactory = function(expanded) {
            return function(control) {
                if (control.supressCollapseEvents)
                    return true;
                control.fireEvent('expandorcollapserequest', control, expanded);
                return false;
            }
        };

        if (control._bindingMap.collapsed) {
            control.on('beforecollapse', expandOrCollapseFactory(false));
            control.on('beforeexpand', expandOrCollapseFactory(true));
        }

        if (control._bindingMap && control._bindingMap.activeItem !== undefined) {
            control.addActual = control.add;
            control.add = function(index, item) {
                item.on('render', function() {
                    item.getEl().on('click', function() {
                        control.fireEvent('activeitemchangerequest', control, control.items.indexOf(item));
                    });
                });
                control.addActual(index, item);
            }
        }
    },

    collapsedBindings : {
        eventName : 'expandorcollapserequest',
        eventConverter : function(control, expanded) {
            return !expanded;
        },
        storeValueInComponentAs : 'collapsedActual',
        setComponentProperty : function(value, oldValue, options, control) {
            control.supressCollapseEvents = true;
            if (value == true) {
                if (control.rendered) {
                    control.collapse();
                } else {
                    control.collapsed = true;
                }
            } else {
                if (control.rendered) {
                    //hack for ext 4...
                    control.expand();
                } else {
                    control.collapsed = false;
                }
            }
            control.supressCollapseEvents = false;
        }
    }
});

glu.regAdapter('multiselect', {
    extend : 'field'
}); 

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.autofield
 * @author Mike Gai, Nick Tackes
 *
 * ##Glu Virtual Component
 * This is not an actual component but a "virtual component". When you use the 'autofield' as an xtype, this adapter actually *transforms*
 * the existing configuration and assigns the xtype for you. It does this by looking up the given name on the data model
 * to which the control is bound to determine its type, then generating a configuration that best matches.
 *      glu.ns('sample.viewmodels').student = {
 *          fields : [{
 *              name : 'firstName'
 *          },{
 *              name : 'lastName'
 *          },{
 *              name : 'active',
 *              type : 'boolean'
 *          }]
 *      }
 *      glu.ns('sample.views').student = {
 *          xtype : 'form',
 *          defaultType : 'autofield',
 *          items : [{
 *              name : 'firstName'
 *          },{
 *              name : 'lastName'
 *          },{
 *              name : 'active'
 *          }]
 *      }
 * The 'active' field will become a yes/no radio button. The point is that you are specifying just the bare minimum to logically order
 * your fields, while letting a common bit of code make the actual rendering decision. This pattern is be useful when
 * you want to strongly enforce your field / form patterns. Since glu also automatically converts any string in an items array into named configuration object
 *      items: ['foo'] --> items: [{name: 'foo'}]
 * the recommended form for defining the view is instead:
 *       glu.ns('sample.views').student = {
 *          xtype : 'form',
 *          defaultType : 'autofield',
 *          items : ['firstName','lastName','active']
 *      }
 * Note that this straightforward transformation pattern is difficult with vanilla Ext JS as controls are statically typed
 * and plugins are not invoked until after the (static) control constructor has been invoked.
 *
 * The autofield transformer is not (yet) meant to be a general-purpose transformer, but more of an example off of which
 * you can create your own transformers for your particular project. In the future we will be investigating making this
 * more configurable so that you can use it 'out of the box'.
 */
glu.regAdapter('autofield', {
    beforeCollect:(function () {
        function getField(name) {
            return this.fieldsMap[name];
        }

        return function (config, dataModel) {
            var key = config.name;
            var field;
            if (dataModel.mtype === 'datamodel') {
                var model = dataModel.getFieldModel();
                if (model.fieldsMap === undefined) {
                    var lookup = {};
                    for (var i = 0; i < model.fields.length; i++) {
                        var field = model.fields[i];
                        lookup[field.name] = field;
                    }
                    model.fieldsMap = lookup;
                }
                ;

                model.getField = model.getField || getField;

                field = model.getField(key);
                if (!field) {
                    config.xtype = 'displayfield'
                    return;
                }
            } else {
                //TODO: Generalize property meta-information into view model, not here!!!
                field = dataModel.getPropertyInfo(key);
            }
            var xtype = 'textfield';
            if (dataModel[key+'$']){
                //formulas are always display-only
                xtype = 'displayfield';
            } else
            if (field.name == 'id') {
                //anything named id is read-only unless otherwise indicated
                xtype = 'displayfield';
            }
            else if (field.oneOf) {
                //one of several values
                xtype='combo';
                var dataType = glu.getDataTypeOf(field.oneOf[0]);
                var data = [];
                for (var i = 0; i < field.oneOf.length; i++) {
                    var fieldKey = field.oneOf[i];
                    data.push({
                        text:glu.localize(fieldKey, {viewmodel:dataModel}),
                        value:fieldKey
                    });

                }
                var backingStore = new Ext.data.Store({
                    fields:['text', {name:'value', type:dataType}],
                    data:data
                });
                glu.applyIf(config, {
                    triggerAction:'all',
                    mode:'local',
                    store:backingStore,
                    displayField:'text',
                    valueField:'value',
                    forceSelection:true
                })
            }
            else if (field.hasOwnProperty('lookup')) {
                xtype = 'combo';
                // TODO: standardization of display/value field names?  better way of accessing them?
                var displayField = 'text';
                var valueField = 'value';
                var ns = eval(dataModel.ns);
                if (ns.lookups && ns.lookups[field.lookup]) {
                    if (Ext.getVersion().major > 3 && ns.lookups[field.lookup].fields === undefined) {
                        //cache the default fields into the model constructor to make 4.0 behave like Ext 3.2
                        ns.lookups[field.lookup].fields = new ns.lookups[field.lookup].model().fields;
                    }
                    // assume the code is ordered first in the meta data
                    valueField = ns.lookups[field.lookup].fields.keys[0];
                    displayField = ns.lookups[field.lookup].fields.keys[1];
                }
                config.triggerAction = 'all';
                //                config.lazyRender = true;
                config.mode = 'local';
                config.store = glu.conventions.build().start().root().literal(dataModel.ns).lookupNs().prop(field.lookup).end();
                config.displayField = displayField;
                config.valueField = valueField;
            }
            else if (field.type == 'integer' || field.type == 'int' || field.type == 'number') {
                xtype = 'numberfield';
            }
            else if (field.type == 'boolean') {
                xtype = 'checkbox';
//                xtype = 'radiogroup';
//                config.items = [
//                    {xtype:'radio', name:field.name, boxLabel:'Yes', inputValue:'true'},
//                    {xtype:'radio', name:field.name, boxLabel:'No', inputValue:'false', checked:true }
//                ];
            }
            else if (field.type == 'date') {
                xtype = 'datefield'
            }

            config.xtype = xtype;
        }
    })()

});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.button
 * @author Mike Gai
 * @extends glu.extjs.adapters.component
 *
 * A button most commonly invokes a command within glu. For example:
 *      glu.ns('sample').main = {
 *          go : function () {
 *              //...
 *          }
 *      };
 *      glu.ns('sample').main = {
 *          tbar : [{
 *              text : 'Go',
 *              handler : '@{go}'
 *          }
 * will invoked the 'go' command.
 *
 * However, a button within a glu.extjs.ux.ButtonGroup can also set a value:
 *      glu.ns('sample').main = {
 *          mode : 'road'
 *      };
 *      glu.ns('sample').main = {
 *          tbar : {
 *              xtype : 'buttongroup',
 *              items: [{
 *                  text : 'Satellite',
 *                  value : '@{satellite}'
 *               },{
 *                  text : 'Hybrid',
 *                  value : '@{hybrid}'
 *              },{
 *                  text : 'Road',
 *                  value : '@{road}'
 *              }]
 *          }
 *      }
 *
 * The last button will start off selected, and clicking the buttons will change the value of *mode*.
 * In either case, name convention binding can be used as a shortcut:
 *      items : ['satellite','hybrid','road']
 * is equivalent to the last example (the name will be passed as a key to the configured localizer for rendering).
 *
 */
glu.regAdapter('button', {
    extend : 'component',
    defaultTypes : {
        menu : 'menu'
    },
    isChildObject : function(propName){
        return propName==='menu';
    },

    menuShortcut : function(value) {
        return {
            xtype:'menu',
            defaultType:'menuitem',
            items:value
        };
    },
    /**
     * @cfg {Function} handler
     * *one-time binding.* The (command) handler for this button.
     * Like all bound glu listeners, it passes in the default arguments of the triggering event,
     * prepended by any value you might have assigned to the control. For instance, consider the following:
     *      glu.ns('sample').main = {
     *          openScreen : function (screenTag) {
     *              //...
     *          }
     *      };
     *      glu.ns('sample').main = {
     *          tbar : [{
     *              text : 'Open Major',
     *              value : 'major',
     *              handler : '@{openScreen}'
     *          },{
     *              text : 'Open Minor',
     *              value : 'minor',
     *              handler : '@{openScreen}'
     *          }]
     *      }
     * Pressing the 'minor' button will pass the value 'minor' into the openScreen command function.
     *
     * **Convention: ** @{..*start*}
     */

    applyConventions: function(config, viewmodel) {
        Ext.applyIf (config, {
            handler : glu.conventions.expression(config.name,{up:true}),
            pressed : glu.conventions.expression(config.name + 'IsPressed', {optional:true}),
            text : glu.conventions.asLocaleKey(config.name)
        });
        glu.provider.adapters.Component.prototype.applyConventions.apply(this, arguments);
    },

    /**
     * @cfg {String} text
     * The text to display on the button.
     *
     * It is usually best to let this be handled by localization:
     *
     *      text : '~~firstName~~'
     *
     * **Convention: ** &#126;&#126;*firstName*&#126;&#126;
     */
    /**
     * @cfg {Boolean} pressed
     * *two-way binding.* The pressed state of this button if a toggle button.
     *
     * **Convention: ** @?{debugIsPressed}
     */
    pressedBindings:{
        setComponentProperty:function (newValue, oldValue, options, control) {
            control.toggle(newValue, true);
        },
        eventName:'toggle',
        eventConverter:function (control) {
            return control.pressed;
        }
    }

});
/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.regAdapter('buttongroup', {
    extend : 'container',
    defaultTypes:{
        items:'button'
    },
    beforeCollect:function(config){
        glu.provider.adapters.Container.prototype.beforeCollect.apply(this, arguments);
        //add in default item template???
        if (config.activeItem != null) {
            //convert to toggle button group
            config.defaults = config.defaults || {};
            config.defaults.enableToggle = true;
            config.defaults.toggleGroup = Ext.id();
            config.defaults.toggleHandler = function(button){
                button.ownerCt.fireEvent('activeitemchanged', button.ownerCt,button,button.ownerCt.items.indexOf(button));
            };
        }
    },
    itemsBindings:{
        custom:function (context) {
            context.control.itemTemplate = context.control.itemTemplate || function (item) {
                var key = item.itemId || item.name || item.value || item.id;
                return {
                    xtype:'button',
                    text:glu.conventions.localizeStart + key + glu.conventions.localizeEnd,
                    value:key
                }
            };
            glu.provider.itemsHelper.bindItems(context, true);
        }
    },
    activeItemBindings:{
        eventName:'activeitemchanged',
        eventConverter:function (group, button, idx) {
            //if the button has a value, then use that, otherwise return the index
            return button.value || idx;
        },
        setComponentProperty:function(value,oldvalue,options,control){
            var button = control.items.find(function(item){return value==item.value});
            button.toggle(true);
        }
    },

    afterCreate:function (control, viewmodel) {
        glu.provider.adapters.Container.prototype.afterCreate.apply(this, arguments);
        var me = this;
        if (control._bindingMap.activeItem){
            control.on('afterrender',function(){
                setTimeout(function(){
                    me.activeItemBindings.setComponentProperty(control.activeItem,null,null,control);
                },1);
            });
        }
    }

});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.checkbox
 * @author Mike Gai
 * @extends glu.extjs.adapters.field
 *
 * A binder that adapts a checkbox. Normalizes the 'checked' value so that you can bind on either 'value' or 'checked'
 */
glu.regAdapter('checkbox', {
    extend :'field',
    beforeCreate:function (config, viewmodel) {
        config.checked = config.checked || config.value;
    },
    initAdapter : function(){
        this.checkedBindings = this.valueBindings;
    },
    boxLabelBindings : {
        setComponentProperty: function(newValue,oldValue,options,control){
            if (control.rendered){
                control.boxLabelEl.update(newValue);
            }
            else{
                control.boxLabel = newValue;
            }
        }
    }
});

glu.regAdapter('checkboxfield', {
    extend: 'checkbox'
});

glu.regAdapter('radiofield', {
    extend :'checkbox',
    suppressNameBindings: true
});

glu.regAdapter('radio', {
    extend :'radiofield'
});
/*
* Copyright (C) 2012 by CoNarrative
*/
/**
 * @class glu.extjs.adapters.combo
 * @author Mike Gai
 * @extends glu.extjs.adapters.field
 *
 * The combo box is usually bound by value (by default the backing Model) and to a store.
 *
 * Note : This adapter eliminates race conditions caused by the value being set
 * before the backing store is loaded. When the store changes (a la the backing
 * data arrives), it will check to see if the value is now present and then set the combo
 * box accordingly.
 */

/*
 */
glu.regAdapter('combo', {
    extend : 'field',

    applyConventions: function(config, viewmodel) {
        Ext.applyIf (config, {
            store : glu.conventions.expression(config.name + 'Store', {optional:true})
        });
        glu.provider.adapters.Field.prototype.applyConventions.apply(this, arguments);
    },
    
    /**
     * @cfg {Ext.data.Store} store
     * The store for this grid.
     *
     * *One-time binding*
     *
     * **Convention**: @{*itemList*}
     */
    beforeCreate : function(config, viewmodel) {
        if (!config.store)
            return;
        if (config.store.gluTweaked == true)
            return;
        config.store.gluTweaked = true;
        var evtName = Ext.getVersion().major > 3 ? 'datachanged' : 'load';
        config.store.on(evtName, function() {
            var control = Ext.getCmp(config.id);
            if (!control)
                return;
            control.setValue(control.targetValue);
        });
    },
    afterCreate : function(control, viewmodel) {
        glu.provider.adapters.Field.prototype.afterCreate.apply(this, arguments);

        if (!control.delayedEvent) {
            control.delayedEvent = new Ext.util.DelayedTask(function() {
                control.fireEvent('valuechanged', control);
            });
        }

        if (control.enableKeyEvents) {
            control.addListener('keyup', function(t, e, o) {
                control.delayedEvent.delay(control.keyDelay || 100);
                //give some time for multiple keypresses...
            }, control);
        }

        if( control.multiSelect ){
            control.addListener('beforedeselect', function(t, e, o) {
                control.delayedEvent.delay(control.keyDelay || 100);
                //give some time for multiple keypresses...
            }, control);
        }


        control.addListener('change', function(t, e, o) {
            control.delayedEvent.delay(control.keyDelay || 100);
            //give some time for multiple keypresses...
        }, control);

        control.addListener('select', function(t, e, o) {
            control.delayedEvent.delay(control.keyDelay || 100);
            //give some time for multiple keypresses...
        }, control);
        

        //Solves a race condition in which the initial value is set before the backing store has been loaded
        //does not attempt to solve later race conditions with stores reloading
        if (!control.valueField)
            return;
        // var r = control.findRecord(control.valueField, control.value);
        // if(r) {
        // //reset the value one last time just in case the callback has already happened
        // control.setValue(control.value);
        // return;
        // }
        control.setValueActual = control.setValue;
        control.setValue = function(value) {
            this.targetValue = value;
            this.setValueActual(value);
        };
        control.setValue(control.value);
        //there is no record, so wait until load
        // control.store.on('load',function(){
        // control.setValue(control.value);
        // //control.store.un('load'); //stop listening for load event
        // });
    },
    beforeCollect : function(config) {
        glu.provider.adapters.Field.prototype.beforeCollect.apply(this, arguments);
        if (config.editable)
            config.enableKeyEvents = true;
    },
    initAdapter : function() {
        //this.valueBindings = glu.deepApplyIf({eventName : 'select'},this.valueBindings);
        this.valueBindings = glu.deepApplyIf({
            eventName : 'valuechanged'
        }, this.valueBindings);
    }
});

glu.regAdapter('combobox', {
    extend : 'combo'
}); 
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.component
 * @type {Object}
 * Base component adapter for all ExtJS components.
 * Please note that GluJS provides some additional behavior for the 'xtype' property (see below) as well as 'viewMode'
 * property for organizing your views.
 */
glu.regAdapter('component', {
    applyConventions:function (config, viewmodel) {
        var g = glu.conventions;
        var pattern = {
            disabled:g.expression(config.name + 'IsEnabled', {optional:true, not:true}),
            hidden:g.expression(config.name + 'IsVisible', {optional:true, not:true})
        };
        glu.deepApplyIf(config, pattern);
    },
    //is the property an array to walk?
    isChildArray:function (name) {
        return name === 'editors';
    },
    //is the property a sub-item to recurse into?
    isChildObject:function () {
        return false;
    },
    processChildPropertyShortcut:function (propName, config) {
        return config;
    },
    /**
     * @cfg {String} cls
     * *one-way binding.* Sets a convenience css class. Since the binding removes the old class before adding the new, this
     * property is suitable for a variety of dynamic class effects, made easy by using text substitutions in the binding. For example:
     *      cls : 'my-widget-status-@{status}'
     * will dynamically change the class by naming convention to match the current status.
     */
    clsBindings:{
        setComponentProperty:function (newValue, oldValue, options, control) {
            if (control.removeCls) {
                control.removeCls(oldValue);
            } else {
                control.removeClass(oldValue);
            }
            control.addClass(newValue);
        }
    },
    /**
     * @cfg {String} itemCls
     * *one-way binding.* Sets a convenience item css class. Since the binding removes the old class before adding the new, this
     * property is suitable for a variety of dynamic class effects, made easy by using text substitutions in the binding. For example:
     *      itemCls : 'my-widget-status-@{status}'
     * will dynamically change the class by naming convention to match the current status.
     */
    itemClsBindings:{
        setComponentProperty:function (newValue, oldValue, options, control) {
            if (control.el && control.el.parent) {
                var p = control.el.parent('.x-form-item');
                if (p === undefined) return;
                if (p.removeCls) {
                    p.removeCls(oldValue);
                } else {
                    p.removeClass(oldValue);
                }
            }
            control.itemCls = newValue;
        }
    },
    /**
     * @cfg {String} hidden
     * *one-way binding.* Sets the visibility of the component.
     *
     * **Convention:** @{*foo*IsHidden}
     */
    hiddenBindings:{
        setComponentProperty:function (newValue, oldValue, options, control) {
            if (control.xtype == 'radiogroup' && control.items && control.items.length > 0) {
                for (var i = 0; i < control.items.length; i++) {
                    if (Ext.isArray(control.items)) {
                        // do nothing.  this is due to the case where control is run in headless mode
//                        control.items[i].setVisible(!newValue);
                    }
                    else {
                        control.items.items[i].setVisible(!newValue);
                    }
                }
            }
            if( control.tab )control.tab.setVisible(!newValue);
            else control.setVisible(!newValue);
            if (control.ownerCt) {
                control.ownerCt.doLayout();
            }
        }
    },

    isHoveredBindings:{
        eventName : 'hoverchange',
        eventConverter:function(ctrl){
            return ctrl.isHovered;
        }
    },

    //helper function to be called within the beforecollect of child adapters that want to add editors...
    //the config argument is an object whose keys are editable component properties
    //and whose values are either the name of the element or a function to find it
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
    },
    beforeCollect:function (config) {
        //debugger;
    },
    afterCreate:function (control, viewmodel) {
        var config = control;
        if (config.editors) {
            for (var i = 0; i < config.editors.length; i++) {
                var editorCfg = config.editors[i];
                var editor = Ext.widget('editor', editorCfg);
                control.on('afterrender', function (control) {
                    setTimeout(function () {
                        var el = Ext.isString(editor.target) ? control[editor.target] : editor.target(control);
                        if( el )
                        el.on(editor.trigger, function () {
                            editor.startEdit(el, control[control.propName]);//control.getValue()
                        });
                    }, 1);
                });
            }
        }
        if (control.isHovered != null) {
            control.on('afterrender', function () {
                var el = control.el;
                control.isHovered = false;
                el.on('mouseenter', function () {
                    control.isHovered = true;
                    control.fireEvent('hoverchange', control, true);
                });
                el.on('mouseleave', function () {
                    control.isHovered = false;
                    control.fireEvent('hoverchange', control, false);
                });
            });
        }
        if (control.tpl){
            //VERY SPECIAL BINDINGS!
            var task = new Ext.util.DelayedTask(
                function(){
                    control.update(viewmodel);
                    control.fireEvent('updated',control);
                });
            control.on('render',function(){control.fireEvent('updated',control)});
            control.data = viewmodel; //use viewmodel as initialtemplate source
            //TODO: FInd all the bound guys and LISTEN ON THEM!
            viewmodel.on('bulkupdatecommitted', function(){task.delay(10);});
        }
    }

    /**
     * @cfg {String} viewMode
     * Specifies which "mode" to put the view in, assuming that mode is defined. If no viewMode is supplied (which is typical) then
     * it uses the default defined view. To supply different modes for a view, define it as follows in defView:
     *
     *     defView ('assets.asset', 'detail', { ...});
     *
     * where 'detail' is the name of the mode.
     *
     * You can then use it wherever you would insert a child view (either through items binding or as a placeholder). In the case
     * of a static child view, it looks like the following within the parent view definition:
     *
     *     items : [{
     *         xtype : '@{assetWithFocus}', //a property on the parent view model that contains a view model of type 'asset'
     *         viewMode : 'detail' //tells gluJS to use the 'detail' mode
     *     }]
     *
     * For a collection of items using items binding, use the ExtJS defaults property to assing viewMode to all of the children:
     *
     *     items : '@{assetList}', //a List of asset view models
     *     defaults : {viewMode:'detail'} //all of the child views will be put
     *
     * Currently viewMode is not bindable, but we have plans to make it bindable in a future release to make it simple to flip between
     * modes (such as read-only and edit modes, or whatever you define). For now you can achieve the same thing with a card layout that
     * contains the two views and flipping between them.
     */

    /**
     * @cfg {String} xtype
     * Specifies the xtype of the view per normal ExtJS. However, there are two extensions:
     *
     * ##Includes (xtype shortcut)
     * Sometimes a view bound to a single view model becomes big enough that you want to split it up into separate files without
     * having to make it a true nested view bound to a different view model. Since GluJS respects "local namespaces", you can simply inline the view
     * *without* having to declare an xtype alias :
     *
     *     glu.defineView('helloworld.main',{
     *        title : 'My top level view',
     *        layout:'hbox',
     *        items : [{html:'a panel declared inline'}, { xtype : 'aboutCompany'}]
     *     });
     *     glu.defineView('helloworld.aboutCompany',{
     *        title : 'Imagine a bunch of widgets about us'
     *     });
     *
     * ##Nested views
     * Since GluJS is all about UI composition of complicated UIs, there is often the need for nesting a view bound to a different view model
     * (usually a child view model) within a view bound to the parent view model. That is done as follows:
     *
     *     glu.defView ('assets.main',{
     *         layout : 'border',
     *         items : [{
     *             //GRID or "MASTER"
     *             xtype : 'grid',
     *             region : 'center',
     *         //a bunch of grid definition here...
     *         },{
     *             region : 'right',
     *             //VIEW CORRESPONDING TO DETAIL GOES HERE!
     *             xtype : '@{detail}'
     *         }]
     *     });
     *     glu.defView ('assets.asset',{
     *         xtype : 'form',
     *         items: [{
     *             fieldLabel : 'name',
     *             value : '@{name}'
     *         },{
     *             //...etc...
     *         }]
     *     });
     *
     *
     * This is a 1-time binding and *NOT LIVE* (at least not yet). We will be adding support for 'mutable views' in the future, but for
     * now you can achieve the same thing easily enough with a card layout binding.
     */
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.compositefield
 * @author Mike Gai
 * @extends glu.extjs.adapters.container
 * A basic adapter for a compositefield (see also {@link glu.extjs.adapters.fieldcontainer}).
 *
 */

glu.regAdapter('compositefield', {
    extend : 'field',
    valueBindings:{
        eventName:'change',
        eventConverter:function (control) {
            return control.getValue();
        }
    },
    afterCreate:function (control, viewmodel) {
        glu.provider.adapters.Field.prototype.afterCreate.apply(this, arguments);
        //ExtJS 3.2 Does not automatically initialize sub-items in initComponent so we do it here
        if (control.items.get === undefined) {
            for (var i = 0; i < control.items.length; i++) {
                control.items[i] = Ext.create(control.items[i]);
            }
        }
    },
    itemsBindings:{
        custom:function (context) {
            glu.provider.itemsHelper.bindItems(context, true);
        }
    },
    isChildArray : function(propName, value){
        return propName==='items';
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.container
 * @extends glu.extjs.adapters.component
 */

/**
 * @cfg {Array/glu.List/glu.ActivatorList/Ext.data.Store} items
 * *one-way binding.*
 * This indicates that the items collection under this control is entirely bound and controlled by an array, List, or
 * Store within the view model. The items can be Records, Models, or Viewmodels.
 * As items are removed or added, they will be rendered appropriately through a defined itemTemplate (for Models
 * and Viewmodels when an itemTemplate is defined)
 * or through a matching view (for Viewmodels).
 * The items will honor their parent default xtype unless overriden.
 *
 * Since there is a collapsed tool available to the panel, we will support two-way binding in the future.
 *
 * **Convention:** @{*item*List}
 */
glu.regAdapter('container',{
    extend : 'component',
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            items : glu.conventions.expression(config.name)
        });
        glu.provider.adapters.Component.prototype.applyConventions.apply(this, arguments);
    },
    beforeCollect:function(){
        glu.provider.adapters.Component.prototype.beforeCollect.apply(this, arguments);
        //do nothing
    },
    isChildArray : function(propName, value){
        return propName==='editors' || propName==='items';
    },
    itemsBindings:{
        custom:function (context) {
            glu.provider.itemsHelper.bindItems(context);
        }
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.dataview
 * @author Travis Barajas
 * @extends glu.extjs.adapters.component
 * Binds to a data view and handles selection.
 *
 *
 */
glu.regAdapter('dataview', {
    extend : 'component',
    /**
     *  @cfg {Array} selected
     *  Binds currently selected records
     *  *Two-way binding*
     */
    selectedBindings:{
        eventName:'selectionchange',
        eventConverter:function (control) {
            return control.getSelectedRecords();
        },
        setComponentProperty:function (value, oldValue, options, control) {
            //do nothing for now...
        }
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.displayfield
 * @author Mike Gai
 * @extends glu.provider.adapters.field
 */
glu.regAdapter('displayfield', {
    extend : 'field',
    valueBindings:{
        setComponentProperty:function (value, oldValue, options, control) {
            control.setValue(value);
            control.value = control.getValue();
        }
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.editor
 * @author Mike Gai
 * @extends glu.extjs.adapters.component
 *
 * A binder that adapts facilitates the inline declarative use of the ExtJS Editor. Ordinarily, you have to
 * manage the editor yourself in a handler, but that goes against the declarative GluJS grain.
 */
glu.regAdapter('editor', {
    extend :'field',

    isChildObject : function(propName) {
        return propName === 'field';
    },

    inEditModeBindings : {

    }

});


/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.field
 * @author Mike Gai
 * @extends glu.extjs.adapters.component
 * Base adapter for all of the various field types
 */
glu.regAdapter('field', {
    extend:'component',
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            value:glu.conventions.expression(config.name),
            valid:glu.conventions.expression(config.name + 'IsValid', {optional:true}),
            fieldLabel:glu.conventions.asLocaleKey(config.name)
        });
        glu.provider.adapters.Component.prototype.applyConventions.apply(this, arguments);
    },
    beforeCollect:function (config, viewmodel) {
        this.checkForEditors(config, {fieldLabel:'labelEl',value:'inputEl', boxLabel: 'boxLabelEl'});
        //prevent change checking - may be 4.0 only;
    },
    /**
     * @cfg {String/Number} value
     *
     * *Two-way binding*. The value of this field.
     *
     * **Convention: ** @{*firstName*}
     */

    /**
     * @cfg {String} fieldLabel
     *
     * The label that will be applied to this field if in the appropriate layout.
     *
     * Usually, it is best to make sure that this is a localization key and not an exact text literal
     *      fieldLabel: '~~firstName~~'
     * will look up the key 'firstName' in the localizer and replace with the appropriate text
     *
     * **Convention: ** &#126;&#126;*firstName*&#126;&#126;
     */

    /**
     * @cfg {Boolean/String} valid
     * *One-way binding*
     * Updates the validity marking of the field.
     * The view model property can be either a boolean true/false
     * or a string (empty for valid, anything else will be the error message)
     *
     * **Convention:** @{*foo*IsValid}
     */
    validBindings:{
        setComponentProperty:function (newValue, oldValue, options, control) {
            var text = control.invalidText;
            if (Ext.isString(newValue)) {
                text = newValue;
                newValue = newValue === '' ? true : false;
            }
            if (newValue == false) {
                control.valid = false;
                control.markInvalid(text);
            } else {
                control.valid = true;
                control.clearInvalid();
            }
        },
        onInit:function (binding, control) {
            //DISABLE INTERNAL VALIDATION ON THIS CONTROL!
            control.validate = Ext.emptyFn;
            //initialize with proper valid markings--must be done AFTER RENDER...
            var me = this;
            control.on('render', function () {
                //AND after it has REALLY rendered
                setTimeout(function () {
                    glu.provider.adapters.field.validBindings.setComponentProperty(control.valid, false, {}, control);
                }, 1);
            });
        }
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
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.fieldcontainer
 * @author Mike Gai
 * @extends glu.extjs.adapters.panel
 * A binder to the new, improved Ext 4.x compositefield
 */
glu.regAdapter('fieldcontainer', {
    extend : 'panel',

    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            'value' : glu.conventions.expression(config.name),
            'valid' : glu.conventions.expression(config.name + 'IsValid', {optional:true})
        });
        glu.provider.adapters.Panel.apply(this, arguments);
    },

    /**
     * @cfg {String} fieldLabel
     *
     * The label that will be applied to this field if in the appropriate layout.
     *
     * Usually, it is best to make sure that this is a localization key and not an exact text literal
     *      fieldLabel: '~~firstName~~'
     * will look up the key 'firstName' in the localizer and replace with the appropriate text
     *
     * **Convention: ** &#126;&#126;*firstName*&#126;&#126;
     */
    itemsBindings:{
        custom:function (context) {
            glu.provider.itemsHelper.bindItems(context, true);
        }
    },

    beforeCollect: function(config){
        glu.provider.adapters.Panel.prototype.beforeCollect.apply(this, arguments);
        this.checkForEditors(config, {fieldLabel:'labelEl'});
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.regAdapter('fileuploadfield', {
    extend : 'field',
    valueBindings:{
        eventName:'fileselected',
        eventConverter:function (control) {
            return control.getValue();
        }
    }
});
glu.regAdapter('htmleditor', {
    extend: 'textfield',

    /**
     * @cfg {Function} enterKeyHandler
     * A special GluJS convenience shortcut that handles the pressing of the "Enter" key when in the field
     */
    afterCreate: function(control, viewmodel) {
        glu.provider.adapters.Textfield.prototype.afterCreate.apply(this, arguments);
        control.addListener('sync', function(t, v, o) {
            if(control.lastSyncValue != v) {
                control.lastSyncValue = v;
                control.delayedEvent.delay(control.keyDelay || 100); //give some time for multiple keypresses...
            }
        }, control);
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.label
 * @author Mike Gai, Nick Tackes
 * @extends glu.extjs.adapters.component
 */
glu.regAdapter('label', {
    extend : 'component',
    /**
     * @cfg {String} text
     *
     * The text of the label.
     *
     * **Convention:** &#126;&#126;*firstName*&#126;&#126;
     */
    applyConventions:function (config, viewmodel) {
        Ext.applyIf(config, {
            'text' : '~~' + config.name + '~~'
        });
        glu.provider.adapters.Component.prototype.applyConventions.apply(this, arguments);
    }
});

/**
 * class glu.extjs.adapters.menu
 * @extends glu.extjs.adapters.panel
 */
glu.regAdapter('menu' ,{
    extend : 'panel',
    defaultTypes:{
        items:'menuitem'
    },
    itemsBindings:{
        custom:function (context) {
            glu.provider.itemsHelper.bindItems(context);
        }
    }
});

/**
 * @class glu.extjs.adapters.menuitem
 * @extends glu.extjs.adapters.component
 */
glu.regAdapter('menuitem', {
    extend : 'component',

    applyConventions: function(config, viewmodel) {
        Ext.applyIf (config, {
            handler : glu.conventions.expression(config.name,{up:true}),
            text : glu.conventions.asLocaleKey(config.name)
        });
        glu.provider.adapters.Component.prototype.applyConventions.apply(this, arguments);
    },

    /**
     * @cfg {Boolean} checked
     * *Two-way binding*. The checked state of the menu item.
     */
    checkedBindings:{
        eventName:'checkchange',
        eventConverter:function (item, checked) {
            return checked;
        },
        setComponentProperty : function(value, oldValue, options, control) {
            control.setChecked(value,true);//suppress event
        }
    },
    isChildObject : function(propName){
        return propName==='menu';
    },

    menuShortcut : function(value) {
        return {
            xtype:'menu',
            defaultType:'menuitem',
            items:value
        };
    }
});
/*
* Copyright (C) 2012 by CoNarrative
*/
/**
 * @class glu.extjs.adapters.panel
 * @author Mike Gai, Nick Tackes, Travis Barajas
 * @extends glu.extjs.adapters.container
 * A basic adapter for all things panel.
 *
 *
 */
glu.regAdapter('panel', {
    extend : 'container',
    applyConventions : function(config, viewmodel) {
        Ext.applyIf(config, {
            collapsed : glu.conventions.expression(config.name + 'IsExpanded', {
                optional : true,
                not : true
            })
        });
        glu.provider.adapters.Container.prototype.applyConventions.apply(this, arguments);
    },

    isChildArray : function(propName, value) {
        return propName=='editors' || propName === 'items' || propName === 'dockedItems';
    },

    isChildObject : function(propName) {
        return propName === 'tbar' || propName === 'bbar' || propName === 'buttons' || propName === 'fbar' || propName === 'lbar' || propName === 'rbar';
    },

    tbarShortcut : function(value) {
        return {
            xtype : 'toolbar',
            defaultType : 'button',
            items : value,
            dock : 'top'
        }
    },

    bbarShortcut : function(value) {
        return {
            xtype : 'toolbar',
            defaultType : 'button',
            items : value,
            dock : 'bottom'
        }
    },

    buttonsShortcut : function(value, config) {
        return {
            xtype : 'toolbar',
            defaultType : 'button',
            items : value,
            dock : 'bottom',
            layout : {
                // default to 'end' (right-aligned)
                pack : { left:'start', center:'center' }[config.buttonAlign] || 'end'
            }
        }
    },

    fbarShortcut : function(value, config) {
        return {
            xtype : 'toolbar',
            defaultType : 'button',
            items : value,
            dock : 'bottom',
            layout : {
                // default to 'end' (right-aligned)
                pack : { left:'start', center:'center' }[config.buttonAlign] || 'end'
            }
        }
    },

    lbarShortcut : function(value) {
        return {
            xtype : 'toolbar',
            defaultType : 'button',
            items : value,
            vertical : true,
            dock : 'left'
        }
    },

    rbarShortcut : function(value) {
        return {
            xtype : 'toolbar',
            defaultType : 'button',
            items : value,
            vertical : true,
            dock : 'right'
        }
    },
    /**
     * @cfg {Function} closeHandler
     * The handle to process a 'close me' request from either a window close button or a tab close button.
     * By default it will call the 'close' method on the view model.
     * If you override the close method, use the doClose()
     * method on the view model to actually perform the close operation. To veto a close because the screen is not
     * valid would look like this:
     *      //view model assuming using default {@close} binding
     *      close : function() {
     *          if (this.isValid) {
     *              this.doClose();
     *          }
     *      }
     * Default: '{@close}'
     */
    beforeCollect : function(config) {
        glu.provider.adapters.Container.prototype.beforeCollect.apply(this, arguments);
        this.checkForEditors(config, {title: function(control){return control.header.titleCmp.textEl;}});
        //auto-add the close listener
        config.closeHandler = config.closeHandler || '@{close}';
    },
    beforeCreate : function(config, vm) {
        config.listeners = config.listeners || {};
        //The ExtJS close cycle is too strange and must be normalized
        //Now it will simply create a close request instead of anything funny...
        config.listeners.beforeclose = config.listeners.beforeclose ||
        function(panel) {
            // config.closeTask = config.closeTask || new Ext.util.DelayedTask();
            // config.closeTask.delay(1,function(){
            // panel.fireEvent('closerequest', this);
            // });
            if (config.closeHandler) {
                config.closeHandler.apply(vm);
            }
            return false;
        };

    },
    afterCreate : function(control, viewmodel) {
        glu.provider.adapters.Container.prototype.afterCreate.apply(this, arguments);
        //make sure windows close themselves when their matching view model closes...
        if (control.isWindow && Ext.isFunction(control.close)) {
            viewmodel.on('closed', function() {
                glu.log.debug('closed matching window since viewmodel was closed');
                if (control.hidden) {
                    control.doClose();
                } else {
                    control.hide(null, control.doClose, control);
                }
            });
        }
        var expandOrCollapseFactory = function(expanded) {
            return function(control) {
                if( control.supressCollapseEvents )
                    return true;
                control.fireEvent('expandorcollapserequest', control, expanded);
                return false;
            }
        };

        if( control._bindingMap.collapsed ){
            control.on('beforecollapse', expandOrCollapseFactory(false));
            control.on('beforeexpand', expandOrCollapseFactory(true));
        }

        if (control._bindingMap && control._bindingMap.activeItem!==undefined && control.getLayout().type != 'card') {
            control.addActual = control.add;
            control.add = function(index, item) {
                item.on('render', function() {
                    item.getEl().on('click', function() {
                        control.fireEvent('activeitemchangerequest', control, control.items.indexOf(item), item);
                    });
                });
                control.addActual(index, item);
            }
        }

        if (control._activeIndex !== undefined) {
            control.on('render', function(panel){
                panel._changeOriginatedFromModel = true;
                panel.getLayout().setActiveItem(panel._activeIndex);
            });
        }
    },
    /**
     * @cfg {String} html
     * *one-way binding.* The inner html to place in the body
     */
    htmlBindings : {
        setComponentProperty : function(value, oldValue, options, control) {
            // if the value is an object
            control.update(value);
        }
    },
    dataBindings : {
        setComponentProperty : function(value, oldValue, options, control) {//TODO: should really be the html property
            // if the value is an object
            control.update(value);
        }
    },

    /**
     * @cfg {Boolean} html
     * *one-way binding.* Whether or not the panel is collapsed.
     * Since there is a collapsed tool, we will support two-way binding in the future.
     *
     * **Convention:** @{*foo*IsCollapsed}
     */
    collapsedBindings : {
        eventName : 'expandorcollapserequest',
        eventConverter : function(control, expanded) {
            return !expanded;
        },
        storeValueInComponentAs : 'collapsedActual',
        setComponentProperty : function(value, oldValue, options, control) {
            control.supressCollapseEvents = true;
            if (value == true) {
                if (control.rendered) {
                    control.collapse(control.collapseDirection, control.animCollapse);
                } else {
                    control.collapsed = true;
                }
            } else {
                if (control.rendered) {
                    //hack for ext 4...
                    control.expand(control.animCollapse);
                } else {
                    control.collapsed = false;
                }
            }
            control.supressCollapseEvents = false;
        }
    },

    /**
     * @cfg closable
     * *one-time binding ExtJS 3.x, one-way binding ExtJS 4.x*
     */
    closableBindings : {
        setComponentProperty : function(value, oldValue, options, control) {
            if (!(Ext.getVersion().major > 3)) return;
            if (control.tab) {
                //for a panel in a tab panel
                control.tab.setClosable(value);
                return;
            }
            if (control.header) {
                for (var i =0;i<control.header.items.getCount();i++){
                    var tool = control.header.items.getAt(i);
                    if (tool.type === 'close') {
                        tool.setVisible(value);
                        return;
                    }
                }
                //couldn't find it so add if true
                if (value===true) {
                    control.addClsWithUI('closable');
                    control.addTool({
                        type: 'close',
                        handler: Ext.Function.bind(control.close, control, [])
                    });
                }
            }
        }
    },

    activeItemBindings : {
        eventName:'activeitemchangerequest',
        eventConverter:function (control, idx, item) {
            return control._activeItemValueType==='viewmodel'?item._vm:idx;
        },
        storeValueInComponentAs : '_activeIndex',
        setComponentProperty:function (value, oldValue, options, control) {
            if (value===undefined || value===-1) {
                return; //nothing to do ... can't really "deselect" card/tab within ExtJS
            }
            if (value.mtype) {
                control._activeItemValueType = 'viewmodel';
                value = control.items.findIndexBy(function(card){return card._vm == value;});
                if (value==-1) throw new Error("Could not find a item in card layout bound to the view model passed to activeItem");
            }
            var oldItem = oldValue==-1?null : control.items.getAt(oldValue);
            control._changeOriginatedFromModel = true;
            if( control.getLayout().type == 'card')
                control.getLayout().setActiveItem(value);
            else
                control.fireEvent('activeitemchanged', control, control.items.getAt(value), oldItem);
        },
        transformInitialValue : function (value, config, viewmodel){
            if (value.mtype) {
                if (value.parentList === undefined) {
                    throw new Error("Attempted to set an activeTab to a view model that is not in a list.  You should always set the activeItem in the init()");
                }
                config._activeItemValueType = 'viewmodel';
                config._activeIndex = value.parentList.indexOf(value);
                //This is never going to work anyway because ExtJS doesn't care about activeTab when there are no items
                //And we haven't put the items in yet
                return -1;
            }
            return value;
        }
    },

    //TODO: Move into change tracked panel!!! BUt right now transformers don't supply bindings...
    enableTrackingBindings : {
        setComponentProperty : function(value, oldValue, options, control) {
            var idx = value ? 0 : 1;
            var active = control.items.get(idx);
            if (control.rendered) {
                control.getLayout().setActiveItem(active);
            } else {
                control.activeItem = active;
            }
        }
    },
    itemsBindings : {
        custom : function(context) {
            if (context.control.layout != 'card') {
                //do regular bindings
                glu.provider.itemsHelper.bindItems(context, true);
                return;
            }

            var activator = context.viewmodel.get(context.binding.modelPropName);
            var cardPanel = context.control;

            glu.provider.itemsHelper.bindItems(context);
        }
    }
});

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.pickerfield
 * @author Mike Gai
 * @extends glu.extjs.adapters.field
 *
 * A binder that adapts pickers (datefields, etc.) which use a select event and can be collapsed /expanded.
 */
glu.regAdapter('pickerfield', {
    extend :'field',
    /**
     * @cfg {Boolean} html
     * *one-way binding.* Whether or not the picker is collapsed. This lets you 'auto open' the picker if needed
     * We will support the other direction in the future (so this is currently broken)
     * **Convention:** @{*foo*IsCollapsed}
     */
    collapsedBindings:{
        setComponentProperty:function (value, oldValue, options, control) {
            if (value == true) {
                if (control.rendered) {
                    control.collapse();
                } else {
                    control.collapsed = true;
                }
            } else {
                if (control.rendered) {
                    control.expand();
                } else {
                    control.collapsed = false;
                }
            }
        }
    },
    initAdapter : function(){
        this.valueBindings = glu.deepApplyIf({eventName : 'select'},this.valueBindings);
    }
});


/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.regAdapter('progress', {
    extend : 'field',
    valueBindings:{
        setComponentProperty:function (value, oldValue, options, control) {
            control.updateProgress(value);
        }
    }
});

/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.regAdapter('radiogroup', {
    extend : 'field',
    valueBindings:{
        eventName:'change',
        eventConverter:function (field, newVal) {
            var selected = '';
            for( var key in newVal ){
                selected = newVal[key];
            }
            return selected;
            //return field.getValue()[field.items.getAt(0).name];
        },
        setComponentProperty:function(value,oldvalue,options,control){
            control.suspendCheckChange++;
            control.setValue(value);
            control.lastValue = value;
            control.suspendCheckChange--;
        }
    },
    itemsBindings:{
        custom:function (context) {
            glu.provider.itemsHelper.bindItems(context);
        }
    },
    isChildArray : function(propName, value){
        return propName==='editors' || propName==='items';
    }
});

glu.regAdapter('checkboxgroup', {
    extend : 'field',
    valueBindings:{
        eventName:'change',
        eventConverter:function (control, checked) {
            var checks = [];
            for( var key in checked ){
                if( checked[key] == 'on' ){
                    checks.push(key);
                }
            }
            return checks;
        },
        setComponentProperty: function(newValue, oldValue, options, control){
            var obj = {};
            for( var i = 0; i < newValue.length; i++){
                if( newValue[i] )
                    obj[newValue[i]] = true;
            }
            control.setValue(obj);
        }
    },
    itemsBindings:{
        custom:function (context) {
            glu.provider.itemsHelper.bindItems(context);
        }
    },
    isChildArray : function(propName, value){
        return propName==='editors' || propName==='items';
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.spinnerfield
 * @author Mike Gai
 * @extends glu.extjs.adapters.field
 *
 * A binder that adapts spinners (like the Number field)
 */
glu.regAdapter('spinnerfield', {
    extend :'field',
    beforeCreate:function (config) {
        config.enableKeyEvents = true;
    },
    afterCreate:function (control, viewmodel) {
        glu.provider.adapters.Field.prototype.afterCreate.apply(this, arguments);
        if (glu.testMode) {
            control.addListener('keyup', function () {
                control.fireEvent('valuechanged', control);
            }, control);
            return;
        }
        //adds a buffer to all key events
        if (!control.delayedEvent) {
            control.delayedEvent = new Ext.util.DelayedTask(function () {
                control.fireEvent('valuechanged', control);
            });
        }
        control.addListener('keyup', function () {
            control.delayedEvent.delay(control.keyDelay || 100); //give some time for multiple keypresses...
        }, control);
        control.addListener('spin', function(){
            control.delayedEvent.delay(control.keyDelay || 100);
        })
    },
    initAdapter : function(){
        this.valueBindings = glu.deepApplyIf({eventName : 'valuechanged'},this.valueBindings);
    }
});


/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.regAdapter('tabpanel', {
    extend : 'panel',

    applyConventions:function (config, viewmodel) {
        var itemName = glu.string(config.name).until('List');
        Ext.applyIf(config, {
            activeTab:glu.conventions.expression(itemName + 'WithFocus', {optional:true})
        });
        glu.provider.adapters.Container.prototype.applyConventions.apply(this, arguments);
    },

    /**
     * Can be either the view model itself or its index
     */
    activeTabBindings : {
        storeValueInComponentAs : '_activeIndex',
        setComponentProperty:function (value, oldValue, options, control) {
            if (value===undefined || value===-1) {
                return; //nothing to do ... can't really "deselect" within ExtJS
            }
            if (value.mtype) {
                control._activeItemValueType = 'viewmodel';
                value = control.items.findIndexBy(function(card){return card._vm == value;});
                if (value==-1) throw new Error("Could not find a item in card layout bound to the view model passed to activeItem");
            }
            control._changeOriginatedFromModel = true;
            control.setActiveTab(value);
        },
        transformInitialValue : function (value, config, viewmodel){
            if (value.mtype) {
                if (value.parentList === undefined) {
                    throw new Error("Attempted to set an activeTab to a view model that is not in a list.  You should always set an activeTab in the init().");
                }
                config._activeItemValueType = 'viewmodel';
                config._activeIndex = value.parentList.indexOf(value);
                //This is never going to work anyway because ExtJS doesn't care about activeTab when there are no items
                //And we haven't put the items in yet
                return -1;
            }
            return value;
        },
        eventName:'tabchangerequest',
        eventConverter:function (control, panel, idx) {
            return control._activeItemValueType==='viewmodel'?panel._vm:idx;
        }
    },

    afterCreate: function (control, viewmodel){
        glu.provider.adapters.Panel.prototype.afterCreate.apply(this, arguments);
        if (!control._bindingMap || control._bindingMap.activeTab===undefined) {
            return; //only instrument below if tracking active tab
        }
        control.valueSetTask = new Ext.util.DelayedTask(function () {});
        control.on('beforetabchange', function (tab, newpanel) {
            if (control._changeOriginatedFromModel) {
                delete control._changeOriginatedFromModel;
                return true;
            }
            var newIndex = tab.items.indexOf(newpanel);
            //a) set up a "request" and reject the change, so that the tab won't switch without passing through the view model
            control.valueSetTask.delay(1,function(){
                control.fireEvent('tabchangerequest', control, newpanel, newIndex);
            });
            return false;
        }, this);

        if( control._activeIndex !== undefined ){
            control.on('render', function(tabpanel){
                tabpanel._changeOriginatedFromModel = true;
                tabpanel.setActiveTab(tabpanel._activeIndex);
            });
        }
    }
});

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.textfield
 * @author Mike Gai
 * @extends glu.extjs.adapters.field
 *
 * A binder that adapts the textfield or its variants. Glu uses the keyup event in Ext 3.x to process the change, with a
 * 100 millisecond buffer to moderate the number of times the binding is updated.
 */
glu.regAdapter('textfield', {
    extend :'field',

    beforeCollect:function (config) {
        glu.provider.adapters.Field.prototype.beforeCollect.apply(this, arguments);
        config.enableKeyEvents = true;
    },

    /**
     * @cfg {Function} enterKeyHandler
     * A special GluJS convenience shortcut that handles the pressing of the "Enter" key when in the field
     */
    afterCreate:function (control, viewmodel) {
        glu.provider.adapters.Field.prototype.afterCreate.apply(this, arguments);
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
        control.addListener('keyup', function (t,e,o) {
            control.delayedEvent.delay(control.keyDelay || 100); //give some time for multiple keypresses...
        }, control);

        if (control.enterKeyHandler) {
            //special gluJS helper handler
            control.on('specialkey', function(f,e){
                if (e.getKey() == e.ENTER) {
                    control.fireEvent('textchanged',control); //force most recent
                    control.enterKeyHandler(control);
                }
            },null,{delay:110});
        }
    },
    initAdapter:function(){
        this.valueBindings = glu.deepApplyIf({eventName : 'textchanged'},this.valueBindings);
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.regAdapter('toolbar', {
    extend : 'container',
    defaultTypes : {
        items : 'button'
    },
    itemsBindings:{
        custom:function (context) {
//            context.control.itemTemplate = context.control.itemTemplate || function (item) {
//                var key = item.get('name') || item.get('itemId') || item.get('value');
//                return {
//                    xtype:'button',
//                    text:glu.conventions.localizeStart + key + glu.conventions.localizeEnd,
//                    value:key
//                }
//            };
            glu.provider.itemsHelper.bindItems(context, true);
        }
    }
});
/*
 * Copyright (C) 2012 by CoNarrative
 */
glu.provider.adapters.button.afterCreate = function (control) {
    //HACK: workaround for Ext 4.0.7 button bug in which toggle can only be called after render
    control.btnEl = {
        dom:{
            setAttribute:function () {
            }
        }
    };
}

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.panel
 * @author Mike Gai, Nick Tackes, Travis Barajas
 * @extends glu.extjs.adapters.container
 * A basic adapter for all things panel.
 *
 *
 */
glu.regAdapter('chart', {
    extend:'container',
    applyConventions:function (config, viewmodel) {
        glu.provider.adapters.Container.prototype.applyConventions.apply(this, arguments);
    },

    isChildArray:function (propName, value) {
        return propName === 'axes' || propName === 'series';
    },
    storeBindings:{
        suppressViewmodelUpdate:true
    }
});

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.grid4
 * @author Mike Gai, Nick Tackes
 * @extends glu.extjs.adapters.panel
 * The grid binder adds support for various selection and focus patterns,
 * as well as for basic grid "commands" like sorting.
 *
 * ## Basic Ext 4.x grid binding
 *
 *        sample = {
 *            models : {
 *                student :{fields:[{name:'id'},{name:'firstName'}]},
 *            },
 *            viewmodels : {
 *                assignment : {
 *                    studentList : {
 *                        mtype : 'glustore',
 *                        model : 'student'
 *                    },
 *                    openStudent : function() {
 *                         this.message.('Opening student ' + this.studentWithFocus.get('firstName'));
 *                    },
 *                    studentSelections : [],
 *                    studentWithFocus : {},
 *                    studentListIsCollapsed : false,
 *                    studentListIsDisabled : false,
 *                    studentListIsHidden : false
 *                }
 *            },
 *            views : {
 *                assignment : {
 *                    items : [{
 *                        xtype : 'grid',
 *                        name : 'studentList'
 *                    }]
 *                }
 *            }
 *        };
 *
 */

glu.regAdapter('grid', {
    extend:'panel',
    /**
     * @event itemdblclick
     * Fired after a selection change has occurred
     * @param {Ext.grid.Panel} this
     * @param {Ext.data.Model} selected The selected record
     *
     * **Convention if name is *item*List ** : @{open*Item*}
     */
    applyConventions:function (config, viewmodel) {
        var g = glu.conventions;
        var listname = config.name;
        var name = glu.string(listname).until('List');
        var upperName = glu.string(name).toPascalCase();
        var selectionModelProp = viewmodel[name + 'Selections'] ? name + 'Selections' : name + 'Selection';
        var pattern = {
            store:g.expression(listname),
            focus:g.expression(name + 'WithFocus', {optional:true}),   //not in ExtJS
            selected:g.expression(selectionModelProp, {optional:true}), //not in ExtJS
            listeners:{
                itemdblclick:g.expression('open' + upperName, {optional:true, up:true}),
                refreshdata:g.expression('refresh' + upperName, {optional:true, up:true})
            }
        };
        glu.deepApplyIf(config, pattern);
        glu.provider.adapters.Panel.prototype.applyConventions.apply(this, arguments);
        delete config.items; //even though a container in terms of expand/collapse, a grid cannot have items!
    },

    beforeCreate:function (config, viewmodel) {
        if (config.hasOwnProperty('selected')) {
            config._singleSelect = !glu.isArray(config.selected);
            //TODO: Check by name convention possibly
            //TODO: And also binding to other collections besides arrays would be nice
            if (Ext.getVersion().major > 3) {
                if (!config.selModel || config.selModel.mode === undefined) {
                    //auto-determine
                    config.selModel = config.selModel || {};
                    if (!config._singleSelect) {
                        config.selModel.mode = 'multi';
                    }
                }
            }
        }
        //walk through the columns collection and treat any strings as keys to doing auto-column generation
        if (!config.cm && !config.colModel && config.columns && config.store.recType) {
            var model = eval(config.store.ns + '.models.' + config.store.recType);
            var fields = model.fields;
            var columns = [];
            for (var i = 0; i < config.columns.length; i++) {
                var key = config.columns[i];
                if (!Ext.isString(key)) {
                    columns.push(key);
                    continue; //for now skip more fully fleshed out column definitions
                }
                var column = {
                    dataIndex:key,
                    header:glu.localize({ns:viewmodel.ns, viewmodel:config.store, key:key})
                    // width : autoWidth(key)
                };
                if (config.filterable) {
                    column.filter = {};
                }
                //check for custom renderer
                var fn = eval(config.store.ns + '.views.' + glu.string(config.store.recType).toPascalCase() + glu.string(key).toPascalCase() + 'ColumnRenderer');
                if (fn != null) {
                    column.header = '';
                    column.renderer = Ext.createDelegate(fn, viewmodel, [config.store.recType, key], true);
                }
                if (fields[i].width) {
                    column.width = fields[i].width;
                }
                columns.push(column);
            }
            config.columns = columns;
        }

        if( glu.isArray( config.columns ) ){
            for( var i = 0, len=config.columns.length; i < len; i++ ){
                var col = config.columns[i];
                if( col.header && col.header.indexOf(glu.conventions.localizeStart) == 0 && glu.symbol(col.header).endsWith(glu.conventions.localizeEnd)){
                    col.header = glu.localize({ns:viewmodel.ns, viewmodel:config.store, key:col.header});
                }
                if( col.editor && typeof(col.editor) == 'object' && col.editor.store && typeof(col.editor.store) == 'string' && col.editor.store.indexOf(glu.conventions.bindingSymbol) == 0){
                    var bindings = glu.provider.binder.collectBindings(col.editor, viewmodel);
                    glu.provider.binder.applyBindingsList(bindings);
                }
            }
        }

        var sm = config.sm || config.selModel;
        if (sm && sm.xtype == 'checkboxsm') {
            delete config.sm;
            delete config.selModel;
            delete sm.xtype;
            //have to early create so can add to column model
            config.sm = new Ext.grid.CheckboxSelectionModel(sm);
            if (!Ext.getVersion().major > 3) {
                config.sm.isColumn = true; //TODO: Figure out why I need to do this now?
                config.columns.unshift(config.sm);
            }
        }
        if (Ext.getVersion().major > 3) {
            config.columns = {
                items:config.columns,
                defaults:{
                    sortable:true,
                    width:120
                }
            }
        } else {
            config.cm = new Ext.grid.ColumnModel({
                columns:config.columns,
                defaults:{
                    sortable:true,
                    width:120
                }
            });
            delete config.columns;
        }
        glu.provider.adapters.Panel.prototype.beforeCreate.apply(this,arguments);
    },
    afterCreate:function (control, viewmodel) {
        var sm = control.getSelectionModel();
        if (!sm) return;
        if (!sm.delayedEvent) {
            sm.delayedEvent = new Ext.util.DelayedTask(function () {
                if (Ext.getVersion().major > 3) {
                    control.fireEvent('selectionsChanged', control, sm.getSelection())
                } else {
                    control.fireEvent('selectionsChanged', control, sm.getSelections());
                }
            });
        }
        sm.addListener('selectionchange', function () {
            sm.delayedEvent.delay(1); //hopefully will keep from firing twice...
        }, control);

        //override focus on Ext 4.x
        if (control.hasOwnProperty('focus')) {
            if (Ext.getVersion().major > 3) {
                var sm = control.getSelectionModel();
                sm.setLastFocusedActual = sm.setLastFocused;
                sm.setLastFocused = function (record, supressFocus) {
                    if (supressFocus) { //implicit/forced focus
                        this.setLastFocusedActual(record, true);
                    }
                    control.fireEvent('focuschangerequest', control, record);
                };
            }
        }
        glu.provider.adapters.Panel.prototype.afterCreate.apply(this,arguments);
    },

    sortBindings:{
        eventName:'sortrequest',
        eventConverter:function (cntrl, info) {
            return info;
        },
        setComponentProperty:function (value, oldValue, options, control) {
            //do nothing
        }
    },

    /**
     * @cfg {Ext.data.Store} store
     * The store for this grid.
     *
     * *One-time binding*
     *
     * **Convention**: @{*itemList*}
     */
    storeBindings:{
        suppressViewmodelUpdate:true
    },

    /**
     * @cfg {Array/Ext.data.Model/Ext.data.Record} selected
     * Currently selected item(s) in the grid.
     * The binding type is automatically determined by the supplied viewmodel property type.
     * It will be an array of Model/Records if the target is an array, otherwise a single Model/Record.
     * Selections currently cannot be bound to Lists, Maps, or Stores though that may in the future be a useful addition.
     * If the bound property is an array and multi-select / mode flag on the grid has not been configured,
     * it will also automatically configure the grid as multi-select.
     *
     * **Convention if name is *item*List **: @{*item*Selections} for an array  /  @{*item*Selection} for a single record
     */
    selectedBindings:{
        eventName:'selectionsChanged',
        eventConverter:function (g, e) {
            if (g._singleSelect) {
                return e.length > 0 ? e[e.length - 1] : null;
            } else {
                return e;
            }
        },
        customControlListener:function (config) {
            var grid = config.control;
            grid.on('s')
        },
        setComponentProperty:function (value, oldValue, options, control) {
            if (!control.getSelectionModel().onRowMouseDown) return; //meaning it must be descended from row model
            glu.log.info('selecting records on grid to ' + value.length + ' rows.');
            //a hack based on an internal...
            var sm = control.getSelectionModel();
            sm.select (value, false, true);
        }
    },

    /**
     * @cfg {Ext.data.Model/Ext.data.Record} focus
     * Item with current grid focus.
     * The focus is which row in the grid is the "current position". It's behavior
     * is determined by the underlying selection model; glu is simply surfacing it.
     * It is primarily used for master/detail patterns, where the detail shows the item
     * with focus, not necessarily the selection (which may be multiple).
     * In single-select mode, the item with focus corresponds to the item selection.
     * Focus is gained by "entering into" or selecting a row, and is not lost until
     * another row is selected (either by selecting one more in multi-select/simple,
     * or simply by selecting another in single-select). Deselecting a row does not
     * change the focus.
     *
     * **Convention if name is *item*List **: @{*item*WithFocus}
     */
    focusBindings:{
        eventName:'focuschangerequest',
        eventConverter:function (g, r) {
            return r;
        },
        setComponentProperty:function (value, oldValue, options, control) {
            control.getSelectionModel().setLastFocusedActual(value);
        }
    },

    //FOR GRIDFILTER PLUGIN
    /**
     * @cfg {Array} columnFilters
     * An array of filters corresponding to the Ext.ux.GridFilters plugin format
     *      {
     *      field : 'firstName',
     *      comparison : 'eq', (check this to make sure)
     *      value : 'Mi'
     *      }
     * The binding is two-way.
     * Since it is an array, the entire array is overwritten on each filter change.
     */
    columnFiltersBindings:{
        eventName:'filterupdate',
        eventConverter:function (gridfilter) {
            var raw = gridfilter.getFilterData();
            var actual = [];
            for (var i = 0; i < raw.length; i++) {
                var filter = raw[i];
                actual.push({field:filter.field, comparison:filter.data.comparison, value:filter.data.value});
            }
            return actual;
        },
        setComponentProperty:function (filters, oldValue, options, grid) {
            var filter, plugin = grid.filters;
            if (plugin.settingglu) return;
            plugin.applyingState = true;
            plugin.settingglu = true;
            plugin.clearFilters();
            for (var i = 0; i < filters.length; i++) {
                var src = filters[i];
                var key = src.field;
                filter = plugin.filters.get(key);
                if (!filter) {
                    continue;
                }
                filter.setValue(src.value);
                filter.setActive(true);
            }
            delete plugin.applyingState;
            delete plugin.settingglu;
        }
    }

    /**
     * @cfg items
     * @hide
     */
    /**
     * @cfg html
     * @hide
     */

});
Ext.reg('checkboxsm', Ext.grid.CheckboxSelectionModel);
Ext.reg('rowsm', Ext.grid.RowSelectionModel);

glu.regAdapter('treepanel', {
    extend:'grid'
});

/*
 * Copyright (C) 2012 by CoNarrative
 */
/**
 * @class glu.extjs.adapters.paging
 * @author Mike Gai, Nick Tackes
 * @extends glu.extjs.adapters.container
 *
 * The paging control has three basic functions within ExtJS
 *  - trigger a refresh
 *  - display total records and position therein
 *  - change the page number / start index
 * Within glu, all of these
 * The paging control is "intercepted" by the glu binder so that its typical behavior of changing the page number and
 * forcing an update of the store is managed by the view model instead of assumed.
 *
 *
 */

glu.regAdapter('pagingtoolbar', {
    extend : 'container',

    beforeCreate:function (config, viewmodel) {
        if (config.paging && config.paging.limit) {
            config.pageSize = config.pageSize || config.paging.limit;
        }
    },

    /**
     * @cfg {Function} refreshHandler
     *
     */
    //afterCreate is essentially a ExtJS plugin without the overhead
    afterCreate:function (control, viewmodel) {
        control.startIndex = control.startIndex || 0;
        //veto the pager changing anything...
        if (Ext.getVersion().major > 3) {
            control.addListener('beforechange', function (pager, page) {
                this.fireEvent('pagechanged', pager, page);
                return false;
            }, control);
        } else {
            control.addListener('beforechange', function (pager, params) {
                //this is called from doLoad();
                this.startIndex = params[this.getParams().start];
                this.fireEvent('startindexchanged', pager, this.startIndex);
                return false;
            }, control);
        }

        if (!control.refresh) {
            //Ext 4.x compatibility
            control.refresh = control.items.getByKey('refresh');
        }
        if (control.noRefresh || control.hideRefresh) {
            control.refresh.hide();
        }
        control.refresh.handler = function () {
            if (this.refreshHandler) {
                this.refreshHandler();
            } else {
                if (Ext.getVersion().major>3){
                    var page = this.store.currentPage;
                    this.store.loadPage(page);
                }
            }
        };
        control.setPageSize = function (value) {
            this.pageSize = value;
        };
        if (!(Ext.getVersion().major > 3)) {
            //Ext 4.0 track current page in the *store* not the pager control, so not necessary
            control.store.un('load', control.onLoad, control);
            control.actualOnLoad = control.onLoad;
            control.onLoad = function (store, r, o) {
                var keys = this.getParams();
                o.params = {};
                o.params[keys.start] = this.startIndex;
                //o.params[keys.start] = o.params[keys.start] || this.startIndex;
                // if (this.startIndex != o.params[keys.start]){
                // //TODO:pages have loaded out of order - actually now let the store have a little control and set the page to what it should be...
                // }
                this.actualOnLoad(store, r, o);
            };
            control.store.on('load', control.onLoad, control);
            control.onLoad(control.store, [], {});
        }

    },
    /**
     * @cfg {Ext.data.Store} store
     * The store for this pager.
     *
     * *One-time binding*
     *
     * **Convention**: @{*itemList*}
     */

    storeBindings:{
        suppressViewmodelUpdate:true
    },
    startIndexBindings:{
        eventName:'startindexchanged',
        eventConverter:function (pager, e) {
            return e;
        },
        setComponentProperty:function (value, oldValue, options, control) {
            //do nothing actually -- but will signal to glu that it is OK to set
        }
    },

    /**
     * @cfg {Integer} page
     *
     * The current page that this is set to.
     *
     * It is an unusual binding in that it doesn't update visually until after it receives a "load" event
     * from the store.
     *
     * *Two-way Binding*
     *
     * **Convention**: @{*itemList*Page}
     */
    pageBindings:{
        eventName:'pagechanged',
        eventConverter:function (pager, e) {
            return e;
        },
        setComponentProperty:function (value, oldValue, options, control) {
            //do nothing actually -- but will signal to glu that it is OK to set
        }
    },
    defaultTypes:{
        items:'button'
    }
});
