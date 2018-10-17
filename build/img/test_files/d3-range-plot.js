
(function(){


    dw.visualization.register('d3-range-plot', 'd3-bars', {

        type: function() { return 'range-plot'; },

        keys: function() {
            return [this.axes().start, this.axes().end];
        },

        colorKeys: function() {
            return [this.axes().start, this.axes().end];
        }

    });


}).call(this);
