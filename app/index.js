/**
 * Main JS file for project.
 */

// Define globals that are added through the js.globals in
// the config.json file, here like this:
// /* global _ */

// Utility functions, such as Pym integration, number formatting,
// and device checking

//import utilsFn from './utils.js';
//utilsFn({ });


// Import local ES6 modules like this:
//import utilsFn from './utils.js';

// Or import libraries installed with npm like this:
// import module from 'module';

// Utilize templates on the client.  Get the main content template.
//import Content from '../templates/_index-content.svelte.html';
//
// Get the data parts that are needed.  For larger data points,
// utilize window.fetch.  Add the build = true option in the buildData
// options.
//import content from '../content.json';
// OR: let content = await (await window.fetch('./assets/data/content.json')).json();
//
// const app = new Content({
//   target: document.querySelector('.main-app-container'),
//   data: {
//     content
//   }
// });
import * as d3 from 'd3';
import * as c3 from 'c3';

//klobuchart
function klobuChart() {

    var padding = {
        top: 20,
        right: 60,
        bottom: 20,
        left: 80,
    };

    var dcand = ["Klobuchar", "Smith", "Walz", "Ellison"];
    var rcand = ["Newberger", "Housley", "Johnson", "Wardlow"];

    var klobuChart = c3.generate({
        bindto: "#klobuChart",
        padding: padding,
        data: {
            columns: [
                ['DEM', 0.56, 0.47, 0.45],
                ['GOP', 0.33, 0.41, 0.39],
                ['IND', 0.11, 0.12, 0.16]
            ],
            type: 'bar',
            labels: {
                format: {
                    'DEM': function (v, id, i, j) { return d3.format('.0%')(v) + " " + dcand[i]; },
                    'GOP': function (v, id, i, j) { return d3.format('.0%')(v) + " " + rcand[i]; },
                    'IND': function (v, id, i, j) { return d3.format('.0%')(v) + " other"; }
                }
            }
        },
        legend: {
            show: false
        },
        tooltip: {
            show: false
        },
        color: {
            pattern: ['#3585BC', '#d34A44', "#8b62a8"]
        },
        axis: {
            rotated: true,
            y: {
                max: 1,
                min: 0,
                padding: {
                    bottom: 0
                },
                tick: {
                    count: 4,
                    values: [0, 0.25, 0.50, 0.75, 1],
                    format: d3.format('.0%')
                }
            },
            x: {
                type: 'category',
                categories: ['Senate', 'Senate Special', 'Governor']
            }
        },
        grid: {
            y: {
                lines: [{
                    value: 0.5,
                    text: '',
                    position: 'start',
                    class: 'powerline'
                }]
            }
        }

    });

    d3.selectAll(".c3-target-DEM")
        .selectAll(".c3-bar, .c3-texts")
        .attr("transform", "translate(0, -5)");

    d3.selectAll(".c3-target-IND")
        .selectAll(".c3-bar, .c3-texts")
        .attr("transform", "translate(0, 5)");

}

klobuChart();


//generic ballot chart
function chartBallot(dataT) {

    var x = [];
    var rep = [];
    var dem = [];

    x[0] = "x";
    rep[0] = "GOP";
    dem[0] = "DEM";

    for (var i = 1; i <= dataT.length; i++) {
        x[i] = dataT[i - 1].date;
        rep[i] = dataT[i - 1].rep / 100;
        dem[i] = dataT[i - 1].dem / 100;
    }

    var padding = {
        top: 20,
        right: 60,
        bottom: 20,
        left: 60,
    };

    var formatTime = d3.timeFormat("%B %d, %Y");

    var chartBallot = c3.generate({
        bindto: "#chartBallot",
        padding: padding,
        data: {
            x: 'x',
            columns: [
                x,
                dem,
                rep
            ],
            types: {
                'DEM Seats': 'line',
                'GOP Seats': 'line',
                'IND Seats': 'line'
            }
        },
        point: {
            show: true,
            r: function(d) {
                if (d.x == "10-24-2018") {
                    return 6;
                } else {
                    return 2.5;
                }
            }
        },
        color: {
            pattern: ['#3F88C5', '#8C1B17', "#bbbbbb"]
        },
        legend: {
            show: false
        },
        axis: {
            y: {
                max: 0.75,
                min: 0,
                padding: {
                    bottom: 0,
                    top: 0
                },
                tick: {
                    count: 4,
                    values: [0, 0.25, 0.50, 0.75],
                    format: d3.format('.0%')
                }
            },
            x: {
                type: "timeseries",
                padding: {
                    right: 0,
                    left: 0
                },
                tick: {
                    format: "%m-%d-%Y",
                    // values: [1854,1880,1900,1920,1940,1960,1980,2000,2020],
                    count: 6,
                    multiline: false
                }
            }
        },
        grid: {
            focus: {
                show: false
            }
        },
        regions: [{
            axis: 'x',
            start: 2010,
            end: 2018,
            class: 'hottest'
        }, ],
        tooltip: {
            contents: function(d, defaultTitleFormat, defaultValueFormat, color) {
               

                return '<div class="chart-tooltip"><div>' + formatTime(d[0].x) + '</div></div>' +
                    '<div class="chart-tooltip d4"><span class="tooltip-label">' + d[0].id + ':</span>' +
                    '<span class="tooltip-value">' + defaultValueFormat(d[0].value) + '</span>' +
                    '</div><div class="chart-tooltip r3"><span class="tooltip-label">' + d[1].id + ':</span>' +
                    '<span class="tooltip-value">' + defaultValueFormat(d[1].value) + '</span>' +
                    '</div>';
            }
        }
    });

}

//prez popularity chart
function chartPoll(container, data) {

    d3.select(container).selectAll(".pollstack")
        .data(data).enter().append("div")
        .attr("class", function(d, i) {
            return "pollstack";
        })
        .on("click", function(d) {

        })
        .html(function(d) {

            var color = "r3";
            var color2 = "#5BBF48";

            if (d.party == "D") {
                color = "d4";
            }
            if (d.approval < 0.50) {
                color2 = "#E07242";
            }

            return '<div class="column prez ' + color + '">' + d.president + ' ' + d.year + '</div><div class="column" style="color:' + color2 + '">' + d3.format(".0%")(d.approval) + '</div><div class="column chartCol ' + color + '">' + d.party + d3.format("+")(d.house_loss) + '</div><div class="column chartCol ' + color + '">' + d.party + d3.format("+")(d.mnhouse_loss) + '</div>';
        });

}


var data;

function loadData(data) {
    chartPoll("#approvalSpill", data);
}

$.ajax({
    url: './data/approval.json',
    async: false,
    dataType: 'json',
    success: function(response) {
        data = response.approval;
        loadData(data);
    }
});

function loadDataT(data) {
    chartBallot(data);
}

var dataT;
$.ajax({
    url: './data/ballot.json',
    async: false,
    dataType: 'json',
    success: function(response) {
        dataT = response.results;
        console.log(dataT);
        loadDataT(dataT);
    }
});