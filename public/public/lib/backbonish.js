glu.mreg('backbonish',{
    initMixin:function(){
        this.__id = _.uniqueId('gluvm-');
        this.on('propertychanged',this.propChange, this);
        if (this.mtype === 'list') {
            //do list stuff here...
            this.get = this.getById;
//            this.on('added',function(){this.fireEvent(),this})
        }
        var originalOn = _.bind(this.on, this);
        var me = this;
        this.on = function(evtName, listener, scope) {
            var eventName=evtName;
            if (evtName.indexOf('change:')==0 && evtName.indexOf('\.')>-1) {
                //a "deep listen". Convert form change:foo.bar -> foo.change:bar (glu normal)
                var tokens = evtName.split('\.');
                tokens[0]=tokens[0].substring(7); //strip 'change:'
                tokens[tokens.length-1]='change:' + tokens[tokens.length-1];
                this.on(tokens.join('.'), function(model,value,oldValue) {
                    //intercept and change the origin of the event to the top-level model for stick-it
                    listener.call(this,me,value,oldValue);
                }, scope);
                return;
            }
            if (scope && scope.cid) { //means the scope is the view itself...
                //make it a graph observable so we can pull the plug all at once later
                if (!scope._ob) {
                    scope._ob = new glu.GraphObservable({node:scope});
                }
                if (!scope[me.__id]){
                    scope._ob.attach(me.__id, me);
                }
                scope._ob.on(me.__id + '.' + eventName, listener, scope);
            } else {
                //just plain
                originalOn.apply(scope || window, arguments);
            };
        }
    },
    propChange:function(name, value, oldvalue){
        this.fireEvent('change:' + name.toLowerCase(), this, value, oldvalue);
        this.fireEvent('change', this, name, value, oldvalue);
    },
    /**
     * This is Backbone telling us to stop sending events to the view. We'll disconnect by the view name
     * @param name
     * @param callback
     * @param view
     */
    off:function(name,callback, view){
        view._ob.detach(this.__id);
    },

    /**
     * Invokes callbacks associated to the event name per Backbone. Really just an external way to fire the event.
     * @param name
     */
    trigger:function(name){
        var args = [name].concat(_.rest(arguments,1));
        this.fireEvent.apply(this, args);
    }
});