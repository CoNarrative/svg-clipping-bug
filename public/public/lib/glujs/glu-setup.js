//    Ext.ModelManager = {getModel:function(){}};
Ext.grid = Ext.grid || {};
Ext.Ajax = Ext.Ajax || {};
Ext.selection = Ext.selection || {};
Ext.Loader.config.enabled=false;
//    Ext.fly = Ext.fly || {addCls:function(){}};
Ext.applyIf (Ext.ClassManager.classes,{
    'proxy.ajax':function(){},
    'Ext.data.Store':function(){},
    'Ext.panel.Panel':function(){},
    'Ext.Container':function(){},
    'Ext.Component':function(){}
});