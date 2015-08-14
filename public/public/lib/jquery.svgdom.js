/* http://keith-wood.name/svg.html
 jQuery DOM compatibility for jQuery SVG v1.4.5.
 Written by Keith Wood (kbwood{at}iinet.com.au) April 2009.
 Dual licensed under the GPL (http://dev.jquery.com/browser/trunk/jquery/GPL-LICENSE.txt) and
 MIT (http://dev.jquery.com/browser/trunk/jquery/MIT-LICENSE.txt) licenses.
 Please attribute the author if you use it. */

(function ($) { // Hide scope, no $ conflict

    $.svg = {
        isSVGElem: function(node) {
            return (node.nodeType == 1 && node.namespaceURI == $.svg.svgNS);
        },
        svgNS:'http://www.w3.org/2000/svg'
    };
    /* Support adding class names to SVG nodes. */
    $.fn.addClass = function (origAddClass) {
        return function (classNames) {
            classNames = classNames || '';
            return this.each(function () {
                if ($.svg.isSVGElem(this)) {
                    var node = this;
                    $.each(classNames.split(/\s+/), function (i, className) {
                        var classes = (node.className ? node.className.baseVal : node.getAttribute('class'));
                        if ($.inArray(className, classes.split(/\s+/)) == -1) {
                            classes += (classes ? ' ' : '') + className;
                            (node.className ? node.className.baseVal = classes :
                                node.setAttribute('class', classes));
                        }
                    });
                }
                else {
                    origAddClass.apply($(this), [classNames]);
                }
            });
        };
    }($.fn.addClass);

    /* Support removing class names from SVG nodes. */
    $.fn.removeClass = function (origRemoveClass) {
        return function (classNames) {
            classNames = classNames || '';
            return this.each(function () {
                if ($.svg.isSVGElem(this)) {
                    var node = this;
                    $.each(classNames.split(/\s+/), function (i, className) {
                        var classes = (node.className ? node.className.baseVal : node.getAttribute('class'));
                        classes = $.grep(classes.split(/\s+/),function (n, i) {
                            return n != className;
                        }).
                            join(' ');
                        (node.className ? node.className.baseVal = classes :
                            node.setAttribute('class', classes));
                    });
                }
                else {
                    origRemoveClass.apply($(this), [classNames]);
                }
            });
        };
    }($.fn.removeClass);

    /* Support toggling class names on SVG nodes. */
    $.fn.toggleClass = function (origToggleClass) {
        return function (className, state) {
            return this.each(function () {
                if ($.svg.isSVGElem(this)) {
                    if (typeof state !== 'boolean') {
                        state = !$(this).hasClass(className);
                    }
                    $(this)[(state ? 'add' : 'remove') + 'Class'](className);
                }
                else {
                    origToggleClass.apply($(this), [className, state]);
                }
            });
        };
    }($.fn.toggleClass);

    /* Support checking class names on SVG nodes. */
    $.fn.hasClass = function (origHasClass) {
        return function (className) {
            className = className || '';
            var found = false;
            this.each(function () {
                if ($.svg.isSVGElem(this)) {
                    var classes = (this.className ? this.className.baseVal :
                        this.getAttribute('class')).split(/\s+/);
                    found = ($.inArray(className, classes) > -1);
                }
                else {
                    found = (origHasClass.apply($(this), [className]));
                }
                return !found;
            });
            return found;
        };
    }($.fn.hasClass);


    /* Add numeric only properties. */
    $.extend($.cssNumber, {
        'stopOpacity':true,
        'strokeMitrelimit':true,
        'strokeOpacity':true
    });

    /* Support retrieving CSS/attribute values on SVG nodes. */
    if ($.cssProps) {
        $.css = function (origCSS) {
            return function (elem, name, extra) {
                var value = (name.match(/^svg.*/) ? $(elem).attr($.cssProps[name] || name) : '');
                return value || origCSS(elem, name, extra);
            };
        }($.css);
    }

    /* Determine if any nodes are SVG nodes. */
    function anySVG(checkSet) {
        for (var i = 0; i < checkSet.length; i++) {
            if (checkSet[i].nodeType == 1 && checkSet[i].namespaceURI == $.svg.svgNS) {
                return true;
            }
        }
        return false;
    }





})(jQuery);
