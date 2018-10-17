(function(){
    /* global dw,d3,_,numeral */

    dw.visualization.register('d3-bars', {

        type: function() { return 'bars'; },

        render: function(el) {

            var vis = this,
                size = vis.size(),
                dataset = vis.dataset,
                theme = vis.theme();

            var cm = vis.colorMap();

            initNumeralLocales(vis.chart().locale());

            var f_key = d3.f('key');

            var mode = vis.type(),
                groupBy = vis.axes().groups,
                rangeOrArrow = mode == 'range-plot' || mode == 'arrow-plot',
                colorBy = vis.axes().colors || vis.axes().labels,
                barColumns = mode == 'bars' ? vis.axes().bars :
                    mode == 'bars-bullet' ? [vis.axes().bars, vis.axes().bars2] :
                    rangeOrArrow ? [vis.axes().start, vis.axes().end] :
                    vis.axes()['bars-multiple'];

            if (!_.isArray(barColumns)) barColumns = [barColumns];

            var labelBy = vis.axes().labels,
                labelByColumn = vis.dataset.column(labelBy),
                rules = vis.get('rules') && (mode != 'dot-plot' && mode != 'range-plot' && mode != 'arrow-plot'),
                sortBars = vis.get('sort-bars', 'keep'),
                colorBackground = mode == 'dot-plot' || vis.get('background') && (mode == 'bars' || mode == 'bars-split'),
                thicker = vis.get('thick') && !rangeOrArrow && mode != 'dot-plot',
                stackPercentages = mode == 'bars-stacked' && vis.get('stack-percentages', false),
                showOriginalValues = false,
                // showOriginalValues = stackPercentages && vis.get('label-orig-values', false),
                valueLabels = !vis.get('hide-value-labels', false) && mode != 'bars-bullet' && !rangeOrArrow,
                valueLabelFmt = stackPercentages ? function(d) { return d === null ? '' : numeral(d*0.01).format(d < 5 ? '0.[0]%' : '0%'); } : valueLabels || mode == 'dot-plot' || rangeOrArrow || mode == 'bars-bullet' ?
                        vis.getFormat('value-label-format', vis.dataset.column(barColumns[0])) : null,
                valueLabelFormat = (function() {
                    if (stackPercentages) return function(d) {
                        return numeral(d.value*0.01).format(d.value < 5 ? '0.[0]%' : '0%');
                    };
                    if (valueLabels || mode == 'dot-plot' || rangeOrArrow || mode == 'bars-bullet') {
                        var formats = {};
                        barColumns.forEach(function(bc) {
                            formats[bc] = vis.getFormat('value-label-format', vis.dataset.column(bc));
                        });
                        return function(d,i) {
                            return formats[d.column || barColumns[0]](d.value, i);
                        };
                    }
                    return function(d) { return d.value; };
                })(),
                swapLabels = mode == 'bars' && vis.get('swap-labels'),
                valueLabelAlign = vis.get('value-label-alignment', 'left'),
                labelAlign = vis.get('label-alignment', 'left'),
                blockLabels = vis.get('block-labels', false) && mode != 'bars-split' && mode != 'dot-plot' && mode != 'bars-bullet',
                mirrorBars = vis.get('mirror-bars', false) && mode == 'bars-split' && barColumns.length == 2,
                independentScales = vis.get('independent-scales') && !mirrorBars && mode == 'bars-split',
                compactGroupLabel = vis.get('compact-group-labels') && (mode == 'bars-split' || mode == 'dot-plot'),
                customRange = vis.get('custom-range', []).filter(function(d) {
                    return d !== '';
                }),
                barLabelFmt = labelByColumn.type() == 'date' ? vis.getFormat('date-label-format', labelByColumn) : _.identity,
                colorKey = mode != 'bars-split' && vis.get('show-color-key') ? vis.get('color-key', {}) : null,
                colorKeyByColumn = mode == 'bars-stacked' || mode == 'dot-plot',
                split = 0.4,
                resortBars = mode != 'bars' && vis.get('resort-bars'),
                resortBarsBy = vis.get('sort-by'),
                resortBarsAsc = vis.get('sort-asc'),
                displayGrid = (mode == 'bars-stacked' && vis.get('force-grid', false) && !blockLabels) || mode == 'dot-plot' || mode == 'bars-bullet' || rangeOrArrow,
                customGrid = (vis.get('custom-grid-lines') || '').trim();

            if (groupBy) labelAlign = 'left';

            customGrid = customGrid.length ? customGrid.split(',').map(Number) : [];

            // make sure bars always start at zero
            if (mode != 'dot-plot' && !rangeOrArrow) {
                customRange = customRange.concat(0);
            }

            if (colorKeyByColumn && vis.get('show-color-key')) {
                colorKey = {};
                barColumns.forEach(function(d,i) {
                    colorKey[d] = {
                        color: colorByColumn({ column: d }, i),
                        label: vis.dataset.column(d).title()
                    };
                });
            }

            var $chart = d3.select(el.get(0)),
                data = vis.dataset.list();

            var MAX_NUMBER_OF_BARS = 500;

            if (data.length > MAX_NUMBER_OF_BARS) {
                data = data.slice(0, MAX_NUMBER_OF_BARS);
                vis.notify('We <b>truncated your dataset to the first '+MAX_NUMBER_OF_BARS+' rows</b>. Bar chars work best with fewer than 50 bars.');
            }

            data.forEach(function(d, i) { d._row = i; });

            if (resortBars) {
                data = data.sort(d3[(resortBarsAsc ? 'a' : 'de') + 'scendingKey'](function(d) {
                    if (isNaN(d[resortBarsBy])) return resortBarsAsc ? Number.MAX_VALUE : -Number.MAX_VALUE;
                    return d[resortBarsBy];
                }));
            }

            if (stackPercentages) {
                data.forEach(function(row) {
                    var rowSum = 0;
                    barColumns.forEach(function(bc) {
                        rowSum += row[bc];
                    });
                    // keep original values
                    row.__origValues = {};
                    barColumns.forEach(function(bc) {
                        row.__origValues[bc] = row[bc];
                        row[bc] *= 100/rowSum;
                    });
                });
            }

            if (rangeOrArrow && vis.get('sort-arrows', 'keep') != 'keep') {
                var sort_index = vis.get('sort-arrows') == 'start' ? barColumns[0] :
                    vis.get('sort-arrows') == 'end' ? barColumns[1] :
                    vis.get('sort-arrows') == 'diff' ? '__diff' : '__change';
                if (sort_index == '__diff') data.forEach(function(d) {
                    d.__diff = d[barColumns[1]] - d[barColumns[0]];
                });
                if (sort_index == '__change') data.forEach(function(d) {
                    d.__change = ((d[barColumns[1]] - d[barColumns[0]]) / d[barColumns[0]]);
                });
                data = data.sort(function(a,b) {
                    return a[sort_index] - b[sort_index];
                });
            }
            if (rangeOrArrow && vis.get('reverse-order')) data.reverse();

            var divergingMode = divergingColors();

            $chart
                .classed('bc-hr', rules)
                .classed('bc-color-bg', colorBackground)
                .classed('bc-label-block', blockLabels)
                .classed('bc-label-align-left', labelAlign == 'left')
                .classed('bc-label-align-right', labelAlign == 'right')
                .classed('bc-mirror-bars', mirrorBars)
                .classed('bc-stacked-diverging', divergingMode)
                .classed('bc-grid-lines', displayGrid)
                .classed('bc-hide-dots', mode == 'range-plot' && vis.get('range-ends', 'circle') != 'circle')
                .classed('bc-range-end-lines', mode == 'range-plot' && vis.get('range-ends', 'circle') == 'line')
                .classed('bc-range-end-none', mode == 'range-plot' && vis.get('range-ends', 'circle') == 'none')
                .classed('bc-thick', thicker);

            if (divergingMode) $chart.classed('bc-stacked-diverging-'+barColumns.length, true);

            var grouped = !groupBy ? [{ key: '', values: data }] :
                    d3.nest().key(d3.f(groupBy)).entries(data);

            if (mode == 'bars' && sortBars != 'keep') {
                // sort values in each group
                grouped.forEach(function(g) {
                    g.values = g.values
                        .sort(d3[sortBars == 'asc' ? 'ascendingKey' : 'descendingKey'](function(d) {
                            if (isNaN(d[vis.axes().bars])) return sortBars == 'asc' ? Number.MAX_VALUE : -Number.MAX_VALUE;
                            return d[vis.axes().bars];
                        }));
                });
            }

            var extent = _.flatten(barColumns.map(function(bc) { return _.pluck(data, bc); }));

            if (mode == 'bars-stacked') {
                extent = [d3.max(data.map(function(row) {
                    return d3.sum(barColumns.map(function(bc) { return row[bc]; }));
                }))];
            }
            var s, bulletColors;

            if (mode == 'bars-bullet') {
                bulletColors = {
                    inner: d3.lab(getColor('color-bars2', theme.colors.palette[0])),
                    outer: d3.lab(getColor('color-bars', theme.colors.palette[0])),
                };

                // bulletColors.inner.l = Math.min(50, bulletColors.inner.l);
                // bulletColors.outer.l = Math.max(80, bulletColors.outer.l);
                bulletColors.inner = d3.lab(bulletColors.inner)+'';
                bulletColors.outer = d3.lab(bulletColors.outer)+'';
            }

            if (colorKey) {
                if (mode == 'range-plot') {

                    // we'll add the key later

                } else {
                    var swatches = [];

                    _.each(colorKey, function(key, id) {
                        if (key.hide || !key.label) return;
                        key.id = id;
                        key.index = swatches.length;
                        if (colorKeyByColumn) {
                            // overwrite color
                            var keyindex = vis.keys().indexOf(key.id);
                            if (keyindex == -1) keyindex = vis.colorKeys().indexOf(id);
                            key.color = cm(vis.autocolor(keyindex, id, theme));
                        }
                        key.index = vis.colorKeys().indexOf(key.id);
                        if (mode == 'bars-bullet') {
                            if (id == 'bars2') key.color = bulletColors.inner;
                            if (id == 'bars') key.color = bulletColors.outer;
                        }
                        if (key.label) swatches.push(key);
                    });

                    // sort swatches by index
                    swatches = swatches.sort(d3.ascendingKey('index'));

                    if (swatches.length) {
                        s = $chart.append('div.bc-color-key')
                            .selectAll('.bc-swatch')
                            .data(swatches)
                            .enter()
                            .append('div.bc-swatch');

                        s.append('div.bc-color.dw-'+ (mode == 'dot-plot' ? "circle" : "rect"))
                            .style('background', d3.f('color', cm));

                        var swatch_lbl = s.append('div.bc-label.label');
                        if (colorKeyByColumn) {
                            swatch_lbl.attr('data-column', d3.f('id'))
                                .attr('data-row', -1);
                        } else {
                            swatch_lbl.attr('data-key', function(d) {
                                return 'metadata.visualize.color-key.'+d.id+'.label';
                            });
                        }
                        swatch_lbl.append('span').html(d3.f('label'));
                    }
                }
            }

            var rangeExtent = extent.concat(customGrid);
            if ((mode != 'dot-plot' && !rangeOrArrow) || vis.get('range-extent', 'nice') == 'custom') {
                rangeExtent = rangeExtent.concat(customRange);
            }

            var barScale = d3.scale.linear()
                .domain(d3.extent(rangeExtent))
                .range([0, 100]);

            if (mode == 'dot-plot' || rangeOrArrow) {
                // add 7px margin to both sides
                barScale.range([(800/size[0]), 100 - (800/size[0])]);
                if (vis.get('range-extent', 'nice') == 'nice') barScale.nice();
                // extend domain to make some room for labels
                if (vis.get('range-value-labels') != 'none' && !customRange.length) {
                    var _ext = d3.extent(extent),
                        _ext_w = _ext[1] - _ext[0],
                        _ext_s = _ext_w / (size[0] * 0.7),
                        _ext_pad = 70;
                    barScale.domain(d3.extent(
                        barScale.domain()
                        .concat([
                            _ext[0] - _ext_pad * _ext_s,
                            _ext[1] + _ext_pad * _ext_s
                        ])
                        .concat(rangeExtent)
                    ));
                }
            }

            var $group = $chart.append('div.bc-groups')
                .selectAll('div.bc-group')
                .data(grouped)
                .enter()
                .append('div.bc-group');

            if (independentScales) {
                // independent scales for split bars
                barScale = {};
                barColumns.forEach(function(c) {
                    barScale[c] = d3.scale.linear()
                        .domain(d3.extent(_.pluck(data, c).concat(customRange)))
                        .range([0, 100]);
                });
            }

            if (!compactGroupLabel) $group.filter(function(d) { return d.key != 'null'; })
                .append('div.bc-group-title.label')
                .attr('data-column', groupBy)
                .attr('data-row', function(g) { return _.pluck(g.values, '_row').join(','); })
                .append('span')
                .html(f_key);

            var $groupcontent = $group.append('div.bc-group-content');

            if (mode == 'bars-split') {
                // add key
                var bl = $groupcontent.append('div.bc-split-label');
                if (compactGroupLabel) {
                    bl.append('div.bc-row-label.label.bc-compact-group-label')
                        .attr('data-column', groupBy)
                        .attr('data-row', function(g) { return _.pluck(g.values, '_row').join(','); })
                        .append('span')
                        .html(f_key); // empty label
                } else {
                    bl.append('div.bc-row-label.label')
                        .append('span'); // empty label
                }

                bl.append('div.bc-bars')
                    .selectAll('div.bc-split')
                    .data(barColumns)
                    .enter()
                    .append('div.bc-split.label')
                    .style('width', (100 / barColumns.length) + '%')
                    .attr('data-column', function(d) { return d; })
                    .attr('data-row', '-1')
                    .append('span')
                    .html(function(d) { return vis.dataset.column(d).title(); });
            }

            var $row = $groupcontent
                .selectAll('div.bc-row')
                .data(d3.f('values'))
                .enter()
                .append('div.bc-row')
                .classed('bc-row-highlight', function(d) {
                    var key = '' + vis.chart().columnFormatter(vis.axes(true).labels)(d[labelBy]);
                    var hl = vis.get('highlighted-series', []);
                    return hl.indexOf(key) > -1;
                });

            if (swapLabels) {
                if (valueLabels) {
                    $row.append('div.bc-row-label.label')
                    .append('span')
                    .html(d3.f(barColumns[0], valueLabelFmt));
                }
            } else {
                $row.append('div.bc-row-label.label')
                    .attr('data-column', labelBy)
                    .attr('data-row', d3.f('_row'))
                    .append('span')
                    .html(d3.f(labelBy, barLabelFmt));
            }

            var $bars, $bar;

            function customColorByGroup(d) {
                var val = dataset.column(colorBy).raw(d._row);
                d._color = getColor('color-bars', theme.colors.palette[0]);
                val = dw.utils.purifyHtml(val, '');
                if (vis.get('custom-colors', {})[val]) {
                    d._color = vis.get('custom-colors', {})[val];
                }
                return d._color;
            }

            if (mode == 'bars') {

                $bars = $row.append('div.bc-bars');

                $bar = $bars.append('div.bc-bar-bg.dw-rect')
                    .filter(function(d) { return !isNaN(d[barColumns[0]]); })
                    .append('div.bc-bar-inner.dw-rect')
                    .style('left', function(d) {
                        d.value = d[barColumns[0]];
                        return barScale(Math.min(0, d.value)) + '%';
                    }).style('right', function(d) {
                        return (100 - barScale(Math.max(0, d.value))) + '%';
                    }).style('background', d3.f(customColorByGroup, cm));

            } else if (mode == 'bars-split') {

                $bars = $row.append('div.bc-bars')
                    .selectAll('div.bc-split')
                    .data(function(row) {
                        return barColumns.map(function(col) {
                            return { column: col, value: row[col] };
                        });
                    })
                    .enter()
                    .append('div.bc-split')
                    .style('width', (100 / barColumns.length) + '%')
                    .append('div.bc-split-inner');

                $bar = $bars.append('div.bc-bar-bg.dw-rect')
                    .filter(function(d) { return !isNaN(d.value); })
                    .append('div.bc-bar-inner.dw-rect')
                    .each(function(d) {
                        var scale = independentScales ? barScale[d.column] : barScale;
                        d.__left = scale(Math.min(0, d.value)) + '%';
                        d.__right = (100 - scale(Math.max(0, d.value))) + '%';
                    })
                    .style('left', function(d, i) {
                        return mirrorBars && !i ? d.__right : d.__left;
                    }).style('right', function(d, i) {
                        return mirrorBars && !i ? d.__left : d.__right;
                    }).style('background', function(c,i){return cm(colorByColumn(c,i));})
                    .attr('title', valueLabelFormat);

                $chart.selectAll('.bc-split')
                    .style('padding-right', vis.get('space-between-cols', 10) + 'px');
                $chart.selectAll('.bc-bars')
                    .style('margin-right', -1 * vis.get('space-between-cols', 10) + 'px');

            } else if (mode == 'bars-stacked') {

                $bars = $row.append('div.bc-bars');

                $bar = $bars.append('div.bc-bar-bg.dw-rect')
                    .selectAll('div.bc-bar-inner')
                    .data(function(row) {
                        var offset = 0;
                        return barColumns.map(function(col) {
                            var o = offset;
                            offset += isNaN(row[col]) ? 0 : row[col];
                            return {
                                column: col,
                                value: showOriginalValues ? row.__origValues[col] : row[col],
                                offset: o
                            };
                        }).filter(function(d) { return !isNaN(d.value); });
                    })
                    .enter()
                    .append('div.bc-bar-inner.dw-rect')
                    .style('left', function(d) {
                        return barScale(d.offset) + '%';
                    }).style('right', function(d) {
                        return (100 - barScale(d.offset + d.value)) + '%';
                    }).style('background', function(c,i){return cm(colorByColumn(c,i));});

            } else if (mode == 'bars-bullet') {

                $bars = $row.append('div.bc-bars');

                $bar = $bars.append('div.bc-bar-bg.dw-rect')
                    .selectAll('div.bc-bar-inner')
                    .data(function(row) {
                        return barColumns.map(function(col, i) {
                            return { type: i ? 'inner' : 'outer', row: row, column: col, value: row[col] };
                        }).filter(function(d) { return !isNaN(d.value); });
                    })
                    .enter()
                    .append('div.bc-bar-inner.dw-rect')
                    .classed('bc-bullet-inner', function(d) { return d.type == 'inner'; })
                    .style('left', function(d) {
                        return barScale(Math.min(0, d.value)) + '%';
                    }).style('right', function(d) {
                        return (100 - barScale(Math.max(0, d.value))) + '%';
                    })
                    .style('background', function(d) {
                        return cm(bulletColors[d.type]);
                    });


            } else if (mode == 'dot-plot') {

                $bars = $row.append('div.bc-bars');

                $bar = $bars.append('div.bc-bar-bg.dw-rect')
                    .selectAll('div.bc-bar-inner')
                    .data(function(row) {
                        return barColumns.map(function(col) {
                            return { column: col, value: row[col] };
                        });
                    })
                    .enter()
                    .append('div.bc-bar-inner.dw-circle')
                    .style('margin-left', function(d) {
                        return "-5px";
                    })
                    .style('left', function(d) {
                        return barScale(d.value) + '%';
                    })
                    .style('background', function(c,i){return cm(colorByColumn(c,i));})
                    .filter(function(d) { return isNaN(d.value); })
                    .style('display', 'none');

                // bar
                if (barColumns.length > 1 && vis.get('highlight-range')) {

                    var rangeBar = $bars.select('.bc-bar-bg')
                        .insert('div.bc-dot-diff.dw-rect', '.bc-bar-inner')
                        .each(function(row) {
                            var values = barColumns.map(function(bc) {
                                    return barScale(row[bc]);
                                }),
                                vmin = d3.min(values),
                                vmax = d3.max(values);
                            row._bar0min = vmin < vmax;
                            row._min = vmin + '%';
                            row._max = (100 - vmax) + '%';
                        })
                        .style('left', d3.f('_min'))
                        .style('right', d3.f('_max'));

                    // var colorRangeBy = vis.get('color-range-by', 'neutral');
                    // if (colorRangeBy != 'neutral') {
                    //     rangeBar.style('background', colorRangeBy != 'gradient' ? function(d) {
                    //         var col = barColumns[
                    //             (d._bar0min && colorRangeBy == 'min') ||
                    //             (!d._bar0min && colorRangeBy == 'max') ? 0 : 1];
                    //         return colorByColumn({ column: col });
                    //     } : function(d) {
                    //         return '-webkit-gradient(linear, left top, right top, color-stop(0%, '+
                    //                 colorByColumn({ column: barColumns[d._bar0min ? 0 :1] })+'), '+
                    //                 // 'color-stop(50%, #ddd), '+
                    //                 'color-stop(100%, '+
                    //                 colorByColumn({ column: barColumns[d._bar0min ? 1 :0] })+')';
                    //     });
                    // }
                }


            } else if (mode == 'arrow-plot') {

                $bars = $row.append('div.bc-bars');

                var bar_bg = $bars.append('div.bc-bar-bg');

                $bars.append('div.bc-bar-bg-line.dw-line');

                $bar = bar_bg
                    .selectAll('div.bc-bar-inner')
                    .data(function(row) {
                        return barColumns.map(function(col) {
                            return { column: col, value: row[col] };
                        });
                    })
                    .enter()
                    .append('div.bc-bar-inner.dw-circle')
                    .style('margin-left', '-5px')
                    .style('left', function(d) {
                        return barScale(d.value) + '%';
                    })
                    .style('background', function(c,i){return cm(colorByColumn(c,i));})
                    // .filter(function(d) { return isNaN(d.value); })
                    .style('display', 'none');

                $bars.select('.bc-bar-bg')
                    .insert('div.bc-arrow.dw-arrow', '.bc-bar-inner')
                    .each(function(row) {
                        var v1 = row[barColumns[0]],
                            v2 = row[barColumns[1]];
                        if (isNaN(v1) && !isNaN(v2)) v1 = v2;
                        else if (!isNaN(v1) && isNaN(v2)) v2 = v1;
                        var x1 = barScale(v1),
                            x2 = barScale(v2);
                        row._bar0min = x1 < x2;
                        row._diff = v2 - v1;
                        row._change = (v2 - v1) / v1;
                        row._min = Math.min(x1, x2) + '%';
                        row._max = (100 - Math.max(x1, x2)) + '%';
                        row._direction = x1 < x2 ? 'right' : x1 > x2 ? 'left' : 'none';
                    })
                    .style('background', d3.f(customColorByGroup, cm))
                    .classed('bc-arrow-left', function(d) { return d._direction == 'left'; })
                    .classed('bc-arrow-right', function(d) { return d._direction == 'right'; })
                    .classed('bc-arrow-none', function(d) { return d._direction == 'none'; })
                    .style('left', d3.f('_min'))
                    .style('right', d3.f('_max'))
                    .append('div')
                    .style('border-color', d3.f('_color', cm));

            } else if (mode == 'range-plot') {

                $bars = $row.append('div.bc-bars');

                var bar_bg2 = $bars.append('div.bc-bar-bg');

                $bars.append('div.bc-bar-bg-line.dw-line');

                var rangeEndMode = vis.get('range-ends', 'circle');

                // dots
                $bar = bar_bg2
                    .selectAll('div.bc-bar-inner.dw-'+(rangeEndMode == 'circle' ? 'circle' : 'rect'))
                    .data(function(row) {
                        return barColumns.map(function(col) {
                            return { column: col, value: row[col] };
                        });
                    })
                    .enter()
                    .append('div.bc-bar-inner.dw-'+(rangeEndMode == 'circle' ? 'circle' : 'rect'))
                    .style('margin-left', function() {
                        return rangeEndMode == 'circle' ? "-5px" : '-1px';
                    })
                    .style('left', function(d) {
                        return barScale(d.value) + '%';
                    })
                    .style('background', function(d) {
                        var dir = d.column == barColumns[0] ? 'start' : 'end',
                            col = vis.get('range-'+dir+'-color', 0);
                        if (_.isNumber(col)) return cm(theme.colors.palette[col]);
                        return cm(col);
                    })
                    .filter(function(d) { return isNaN(d.value); })
                    .style('display', 'none');

                // bars
                var rangeBar2 = $bars.select('.bc-bar-bg')
                    .insert('div.bc-range.dw-rect', '.bc-bar-inner')
                    .each(function(row) {
                        var v1 = barScale(row[barColumns[0]]),
                            v2 = barScale(row[barColumns[1]]);
                        if (isNaN(v1) && !isNaN(v2)) v1 = v2;
                        else if (!isNaN(v1) && isNaN(v2)) v2 = v1;
                        row._bar0min = v1 < v2;
                        row._diff = row[barColumns[1]] - row[barColumns[0]];
                        row._change = (row[barColumns[1]] - row[barColumns[0]]) / row[barColumns[0]];
                        row._min = Math.min(v1, v2) + '%';
                        row._max = (100 - Math.max(v1, v2)) + '%';
                        row._direction = v1 < v2 ? 'end' : 'start';
                    })
                    .style('background', function(d) {
                        var col;
                        function getCol(c) {
                            return cm(_.isNumber(c) ? theme.colors.palette[c] : c);
                        }
                        var rangeColorMode = vis.get('range-color', 'fixed'),
                            colorLow = getCol(vis.get('range-'+(d._direction == 'start' ? 'end' : 'start')+'-color', 0)),
                            colorHigh = getCol(vis.get('range-'+d._direction+'-color', 0));
                        if (rangeColorMode == 'fixed') {
                            return getCol(vis.get('fixed-range-color', '#cccccc'));
                        } else if (rangeColorMode == 'lowest') {
                            return colorLow;
                        } else if (rangeColorMode == 'highest') {
                            return colorHigh;
                        } else if (rangeColorMode == 'gradient') {
                            var colorI = d3.interpolateLab(colorLow, colorHigh);
                            var colors = [0,0.2,0.4,0.6,0.8,1].map(function(i) {
                                return cm(colorI(i))+' '+(i*100)+'%';
                            });
                            return 'linear-gradient(to right, '+colors.join(', ')+')';
                        }
                    })
                    .style('left', d3.f('_min'))
                    .style('right', d3.f('_max'))
                    .append('div')
                    .style('border-color', d3.f('_color', cm));

            }

            // value labels
            var arrLbl = vis.get('range-value-labels', 'none');
            if ((mode == 'arrow-plot' || mode == 'range-plot') && arrLbl != 'none') {
                if (arrLbl == 'start' || arrLbl == 'both') {
                    $bars
                        .append('div.label.bc-range-value')
                        .style('left', function(d) {
                            return d._direction == 'left' || d._direction == 'start' || d._direction == 'none' ?
                                (100 - d._max.replace('%',''))+'%' : 'auto';
                        })
                        .style('right', function(d) {
                            return d._direction == 'right' || d._direction == 'end' ?
                                (100 - d._min.replace('%',''))+'%' : 'auto';
                        })
                        .classed('bc-lbl-left', function(d) { return d._direction == 'right' || d._direction == 'end'; })
                        .classed('bc-lbl-right', function(d) { return d._direction == 'left' || d._direction == 'start'; })
                        .append('span.inner')
                        .style('color', mode == 'arrow-plot' ? d3.f('_color', makeLabelColorLegible, cm) : cm(makeLabelColorLegible(getColor('range-start-color',0))))
                        .html(d3.f(barColumns[0], valueLabelFmt));
                }

                if (arrLbl == 'end' || arrLbl == 'both' || arrLbl == 'diff' || arrLbl == 'change') {
                    $bars
                        .append('div.label.bc-range-value')
                        .style('left', function(d) {
                            return d._direction == 'right' || d._direction == 'end' || d._direction == 'none'?
                                (100 - d._max.replace('%',''))+'%' : 'auto';
                        })
                        .style('right', function(d) {
                            return d._direction == 'left' || d._direction == 'start' ?
                                (100 - d._min.replace('%',''))+'%' : 'auto';
                        })
                        .classed('bc-lbl-left', function(d) { return d._direction == 'left' || d._direction == 'start'; })
                        .classed('bc-lbl-right', function(d) { return d._direction == 'right' || d._direction == 'end' || d._direction == 'none'; })
                        .append('span.inner')
                        // .style('color', d3.f('_color'))
                        .style('color', mode == 'arrow-plot' ? d3.f('_color', makeLabelColorLegible, cm): cm(makeLabelColorLegible(getColor('range-end-color',1))))
                        .html(arrLbl == 'diff' ? d3.f('_diff', diffLabelFmt) :
                              arrLbl == 'change' ? d3.f('_change', pctChangeFmt) :
                                d3.f(barColumns[1], valueLabelFmt));
                }
            }



            if (valueLabels && !swapLabels) {
                $bar.append('div.bc-bar-label.label')
                    .append('span')
                    .html(valueLabelFormat);
            } else if (swapLabels) {
                // put bar labels inside bars, and make them edi
                $bar.append('div.bc-bar-label.label')
                    .attr('data-column', labelBy)
                    .attr('data-row', d3.f('_row'))
                    .append('span')
                    .html(d3.f(labelBy, barLabelFmt));
            }

            // compute maximum label width
            var maxLabelWidth = 0;
            $groupcontent.selectAll('.bc-row-label span, .bc-compact-group-label span')
                .each(function() {
                    maxLabelWidth = Math.max(maxLabelWidth, this.getBoundingClientRect().width);
                });
            // add a little margin
            if (maxLabelWidth > 0) maxLabelWidth += 10;

            var labelWidth = (100 * maxLabelWidth / size[0]) + '%',
                barWidth = (100 * (size[0] - maxLabelWidth + (mode == 'bars-split' ? +vis.get('space-between-cols', 10)-4 : 0)) / size[0]) + '%';

            // and resize labels and bars to fix exactly
            $groupcontent.selectAll('.bc-row-label')
                .style('width', labelWidth);

            $groupcontent.selectAll('.bc-bars')
                .style('width', barWidth);

            // align group labels with bars if bar labels are right aligned
            if (labelAlign == 'right' && mode != 'bars-bullet' && mode != 'dot-plot') {
                $group.selectAll('div.bc-group-title.label')
                    .style('padding-left', labelWidth);
            }

            if (valueLabelAlign == 'right') {
                $bar.selectAll('div.bc-bar-label').style('float', 'right');
            }

            // decide which labels should be inverted
            $bar.selectAll('div.bc-bar-label')
                .classed('inverted', function(d, i) {
                    var lblw = d3.select(this).select('span').node()
                            .getBoundingClientRect().width+5,
                        barw = this.parentNode.getBoundingClientRect().width,
                        barbgw = this.parentNode.parentNode.getBoundingClientRect().width,
                        col = d._color;
                    if (lblw > barw) {
                        // mode == 'bars-split'
                        if (barbgw - barw > lblw) {
                            if (mode == 'bars-split' && mirrorBars && !barColumns.indexOf(d.column)) {
                                d3.select(this)
                                    .style('margin-left', (0-lblw-5) + 'px')
                                    .style('padding-right', (4+barw) + 'px');
                            } else {
                                if (mode != 'bars-stacked') {
                                    d3.select(this)
                                        .style('margin-left', barw + 'px');
                                } else {
                                    // trick doesn't work with stacked bars
                                    d3.select(this).style('display', 'none');
                                }
                            }
                        }
                        return false;
                    }
                    return d3.lab(col).l < 70;
                });

            // eventually, we add grid lines
            if (displayGrid) {
                var grid = $groupcontent
                    .each(function(d) {
                        var bbox = this.getBoundingClientRect();
                        d._h = bbox.height + 'px';
                    })
                    .insert('div.bc-grid', '.bc-row')
                    .style('height', d3.f('_h'))
                    .style('width', barWidth)
                    .style('left', labelWidth)
                    .selectAll('.bc-grid-line')
                    .data(customGrid.length ? customGrid :
                        barScale.domain()[0] === 0 && barScale.domain()[1] == 100 ? [0,25,50,75,100] :
                        barScale.ticks(size[0] / 100))
                    .enter()
                    .append('div.bc-grid-line.dw-rect')
                    .classed('bc-grid-line-left', function(d) { return barScale(d) < 0.4; })
                    .classed('bc-grid-line-right', function(d) { return barScale(d)>97; })
                    .style('left', function(d) {
                        return barScale(d) + '%';
                    })
                    .style('background-color', function(d) {
                        if (mode == 'bars-stacked') {
                            if (barScale(d) === 0 || barScale(d) == 100) return 'transparent';
                            return theme.colors.background;
                        }
                        return 'auto';
                    })
                    .append('div.bc-grid-label.label')
                    .append('span')
                    .text(valueLabelFmt);
            }

            // direct labels for range and arrow plots
            if ((mode == 'range-plot' && vis.get('show-color-key')) ||
                (mode == 'arrow-plot' && vis.get('show-arrow-key'))) {
                var first_values = barColumns.map(function(d, i) {
                    return {
                        label: dataset.column(d).title(),
                        value: grouped[0].values[0][d],
                        x: barScale(grouped[0].values[0][d]),
                        column: d
                    };
                }).sort(d3.ascendingKey('x'));

                var diff = Math.abs(first_values[0].x - first_values[1].x)/100 * size[0];

                first_values.forEach(function(d,i) {
                    d.align = diff > 10010 ? 'center' : (i ? 'left' : 'right');
                    d.width = '100px';
                    // console.log(d.x, 50/size[0]*100);
                    d.left = d.align == 'center' ? (d.x - 50/size[0]*100)+'%' : i ? d.x + '%' : 'auto';
                    d.right = d.align == 'center' ? 'auto' : i ? 'auto' : (100-d.x) + '%';
                    d.class = 'bc-direct-key-col label align-'+d.align;
                });

                var gc = $chart.select('.bc-group .bc-group-content');
                var key_height = 0;

                var dk = gc.append('div.bc-direct-key')
                    .style('width', barWidth)
                    .style('left', labelWidth);

                var lc = dk.selectAll('div.bc-direct-key-col')
                    .data(first_values).enter()
                    .append('div.bc-direct-key-col.label')
                    .style('left', d3.f('left'))
                    .style('right', d3.f('right'))
                    .style('width', d3.f('width'))
                    .style('text-align', d3.f('align'))
                    .attr('class', d3.f('class'))
                    .attr('data-column', d3.f('column'))
                    .attr('data-row', -1);

                var ls = lc.append('span').html(d3.f('label'));
                if (mode == 'range-plot' && (vis.get('range-value-labels') != 'none' || vis.get('range-ends', 'circle') != 'none')) {
                    ls.style('color', function(d) {
                        var dir = d.column == barColumns[0] ? 'start' : 'end',
                            col = vis.get('range-'+dir+'-color', 0);
                        if (_.isNumber(col)) col = theme.colors.palette[col];
                        // make sure color is not too bright/dark
                        return cm(makeLabelColorLegible(col));
                    });
                }
                lc.append('i.bc-vline').html('|');

                lc.each(function() {
                    key_height = Math.max(key_height, 10+this.getBoundingClientRect().height);
                });

                dk.style('top', (-key_height+5)+'px');
                lc.style('bottom', -(key_height-10)+'px');
                gc.style('margin-top', groupBy ? '0px' : (key_height)+'px');

                // check if the label is outside the view
                lc.select('span')
                    .style('position', 'relative')
                    .style('left', function() {
                        var b = this.getBoundingClientRect(),
                            width = size[0]-10,
                            overlap = width - b.left - b.width;
                        if (overlap < 0) {
                            return overlap+'px';
                        }
                        return 0;
                    });
            }

            vis.renderingComplete();

            function divergingColors() {
                if (mode != 'bars-stacked') return false;
                var colors = barColumns.map(function(k, i) {
                    return d3.lab(colorByColumn({column:k}, i)).l;
                });
                var k = colors.length;
                if (k < 3) return false;
                var left = colors.slice(0, Math.ceil(k/2));
                var right = colors.slice(Math.floor(k/2)).reverse();
                // check that left is going down, and right is going up
                if (left[0] == left[1]) return false;
                var asc = left[1] > left[0];
                for (var i=0; i<left.length-1;i++) {
                    if ((asc && left[i+1] <= left[i]) ||
                        (!asc && left[i+1] >= left[i]) ||
                        (asc && right[i+1] <= right[i]) ||
                        (!asc && right[i+1] >= right[i])) return false;
                }
                return true;
            }

            function colorByColumn(d,i) {
                d._color = vis.autocolor(i, d.column, theme);
                return d._color;
            }

            function getColor(key, def) {
                return vis.getColor(key, def, theme);
            }

            function pctChangeFmt(v) {
                return numeral(v).format('+0'+(v < 0.01 ? '.[0]' : '')+'%');
            }

            function diffLabelFmt(v) {
                var s = valueLabelFmt(v);
                if (v > 0) return '+'+s;
                return s;
            }

            function makeLabelColorLegible(color) {
                var bg_l = d3.hcl(theme.colors.background).l,
                    bg_whiteish = bg_l > 50,
                    lbl_lab = d3.hcl(color);
                if (bg_whiteish) lbl_lab.l = Math.min(bg_l - 35, lbl_lab.l);
                else lbl_lab.l = Math.max(bg_l + 40, lbl_lab.l);
                return lbl_lab+'';
            }


        },

        init: function(svg) {
            this.svg = svg.node();
            // darawrapper legacy stuff to get snapshots working
            this.__canvas = {
                w: +svg.attr('width'),
                h: +svg.attr('height'),
                lpad: 10,
                rpad: 10
            };
        },

        _svgCanvas: function() { return this.svg; },

        getFormat: function(key, column) {
            if (!column) return _.identity;
            var vis = this,
                colFmt = vis.chart().get('metadata.data.column-format', {})[column.name()] || {},
                fmt = column.type() == 'number' ?
                    function(n, simple) {
                        if (isNaN(n) || n === null) return '';
                        var fmt = vis.get(key) || '0.[00]';
                        var s = numeral(fmt.indexOf('%') > -1 ? 0.01 * n : n)
                            .divide(Math.pow(10, colFmt['number-divisor'] || 0))
                            .format(fmt);
                        return simple ? s : (colFmt['number-prepend'] || '') + s + (colFmt['number-append'] || '');
                    } :
                    column.type() == 'date' ?
                    function(d) { return moment(d).format(vis.get(key) || 'YYYY'); } :
                    _.identity;
            return function(v) {
                if (column.type() == 'date') return _.isDate(v) ? fmt(v) : v;
                return fmt(v);
            };
        },

        colorKeys: function() {
            var vis = this,
                axes = vis.axes(true),
                colorBy = axes.colors || axes.labels;

            if (colorBy) {
                var fmt = vis.chart().columnFormatter(colorBy),
                    keys = [];
                colorBy.each(function(val) {
                    keys.push(String(fmt(val)));
                });
                return _.unique(keys);
            }
            return [];
        },

        keys: function() {
            var vis = this,
                axes = vis.axes(true);

            if (axes.labels) {
                var fmt = vis.chart().columnFormatter(axes.labels),
                    keys = [];
                axes.labels.each(function(val) {
                    keys.push(String(fmt(val)));
                });
                return _.unique(keys);
            }
            return [];
        },

        autocolor: function(i, key, theme) {
            var color = this.getColor('color-bars', theme.colors.palette[0], theme);

            var col = d3.hcl(color);
            col.l = [50, 70, 90, 35, 85, 15][i % 6];
            color = d3.hcl(col);

            key = dw.utils.purifyHtml(key, '');

            if (this.get('custom-colors', {})[key]) {
                color = this.get('custom-colors', {})[key];
            }
            return color+'';
        },

        getColor: function(key, def, theme) {
            var c = this.get(key, def);
            if (_.isNumber(c)) return theme.colors.palette[c];
            return c;
        },

        getCenter: function() {
            return [1,2];
        }

    });

    function initNumeralLocales(chart_locale) {
        var locales = {
            'de-DE': [',','.','k','m','b','t','€'],
            'de-AT': 'de-DE',
            'it-IT': 'de-DE',
            'es-ES': 'de-DE',
            'de-CH': ['.','\'','k','m','b','t','€'],
            'fr-FR': [',',' ','k','m','b','t','€'],
            'fr-CH': 'de-CH',
            'da-DK': 'de-DE',
            'nb-NO': [',',' ','k','m','b','t','€'],
            'se-SE': [',',' ','k','m','b','t','€']
        };
        _.each(locales, function(l, k) {
            if (_.isString(l)) l = locales[l];
            numeral.language(k, {
                delimiters: { thousands: l[1], decimal: l[0] },
                abbreviations: { thousand: l[2], million: l[3], billion: l[4], trillion: l[5] },
                ordinal: function (number) { return '.'; }, currency: { symbol: l[6] }
            });
        });

        try {
            numeral.language(chart_locale);
        } catch (ex) {
            try {
                numeral.language(chart_locale.split(/[\-_]/)[0]);
            } catch (ex) {
                numeral.language('en');
            }
        }
    }

}).call(this);
