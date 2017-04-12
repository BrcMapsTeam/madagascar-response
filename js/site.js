var config = {
    affected: '#affected+households+idps',
    targeted: '#targeted',
    reached: '#reached',
    colors:['#ef8f8f','#9a181a','#841517','#ef8f8f','#6e1113','#580e0f','#420a0b','#2c0708'],
    dataNeedURL: 'https://proxy.hxlstandard.org/data.json?url=https%3A//data.humdata.org/dataset/94b6d7f8-9b6d-4bca-81d7-6abb83edae16/resource/3ed3635b-7cee-4fa1-aec6-6f0318886092/download/Assesment_data_CRM__05April2017.xlsx&strip-headers=on',
    data3WURL: 'https://proxy.hxlstandard.org/data.json?url=https%3A//docs.google.com/spreadsheets/d/1eJjAvrAMFLpO3TcXZYcXXc-_HVuHLL-iQUULV60lr1g/edit%23gid%3D0&strip-headers=on&force=on'
//'https://proxy.hxlstandard.org/data.json?select-query01-01=%23org%3DCRM&filter01=select&strip-headers=on&force=on&url=https%3A//docs.google.com/spreadsheets/d/1eJjAvrAMFLpO3TcXZYcXXc-_HVuHLL-iQUULV60lr1g/edit%23gid%3D0';
};


var map;
var info;
var admlevel = 1;
var overlays = [];
var colors = ['#4575b4', '#91bfdb', '#e0f3f8', '#fee090', '#fc8d59', '#d73027'];
var statsHash = {};
var statsWithNames = {};
var statsHash3WTargeted = {};
var statsHash3WReached = {};
var mergedData = [];
var breadcrumbspcode = ['MDG', '', '', ''];
var breadcrumbs = ['Madagascar', '', '', ''];
var adm_geoms = [];
var pcodelengths = [3, 5, 8, 11];
var admNames = ['Country', 'REGION', 'DISTRICT', 'COMMUNE'];


// CREATING MAP
function initDash() {
    map = L.map('hdx-ipc-map', {});

    L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.scrollWheelZoom.disable();

    info = L.control();

    info.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'ipc-info');
        return this._div;
    };

    info.addTo(map);

    var legend = L.control({ position: 'bottomright' });

    // LEGEND
    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend'),
        //[10, 100, 500, 5000, 10000]
            labels = ["10000 - 20000", "5001 - 10000", "501 - 5000", "101 - 500", "11 - 100", "0 - 10"];

        div.innerHTML = 'Number of<br />Affected Households<br />';
        for (var i = 0; i < labels.length; i++) {
            div.innerHTML +=
                '<i style="background:' + colors[i] + '"></i> ' + labels[5 - i] + '<br />';
        }

        return div;
    };

    legend.addTo(map);

    $('.loading').hide();
    $('.dash').show();

    addGeomToMap(adm_geoms[1]);
}

// creates data for each admin group 1,2, and 3 and puts it all in the same variable
//Keys is an array eg: ['#adm1+code','#adm2+code','#adm3+code'] , variable example: '#affected+households+idps'
function createStatsHash(data, keys, variable) {
    try {
        output = {};

        cf = crossfilter(data);

        cf.adm1Dim = cf.dimension(function (d) { return d[keys[0]] });
        cf.adm2Dim = cf.dimension(function (d) { return d[keys[1]] });
        cf.adm3Dim = cf.dimension(function (d) { return d[keys[2]] });

        var reduceSumVar = function (d) {
            if (isNaN(d[variable])) {
                return 0;
            } else {
                return d[variable];
            }
        };

        cf.adm1group = cf.adm1Dim.group().reduceSum(reduceSumVar);

        cf.adm1group.top(Infinity).forEach(function (d, i) {
            output[d.key] = {};
            output[d.key].mapValue = d.value;
            output[d.key].var = keys[0];
        });

        cf.adm2group = cf.adm2Dim.group().reduceSum(reduceSumVar);

        cf.adm2group.top(Infinity).forEach(function (d, i) {
            output[d.key] = {};
            output[d.key].mapValue = d.value;
            output[d.key].var = keys[1];
        });

        cf.adm3group = cf.adm3Dim.group().reduceSum(reduceSumVar);

        cf.adm3group.top(Infinity).forEach(function (d, i) {
            output[d.key] = {};
            output[d.key].mapValue = d.value;
            output[d.key].var = keys[2];
        });

        return output;
    } catch (e) { console.log("Error creating the Stats Hash (check inputs): ", e.message) }
}

// Creates the admin layers for the map 

function addGeomToMap(geom) {
    if (admlevel == 1) {
        overlays[1] = L.geoJson(geom, {
            style: styleGeom,
            onEachFeature: onEachFeature
        });
        overlays[1].addTo(map);
    }
    if (admlevel == 2) {
        overlays[2] = L.geoJson(geom, {
            style: styleGeom,
            onEachFeature: onEachFeature
        });
        overlays[2].addTo(map);
    }
    if (admlevel == 3) {
        overlays[3] = L.geoJson(geom, {
            style: styleGeom,
            onEachFeature: onEachFeature
        });
        overlays[3].addTo(map);
    }
    zoomToGeom(geom);

    function styleGeom(feature) {

        var values = [10, 100, 500, 5000, 10000];

        var value = 0;
        if (feature.properties['P_CODE'] in statsHash) {
            var value = statsHash[feature.properties['P_CODE']].mapValue;
        }

        var color = 0;

        values.forEach(function (v) {
            if (value > v) { color++ }
        });

        return {
            fillColor: colors[color],
            color: 'black',
            weight: 2,
            opacity: 1,
            fillOpacity: 1,
            class: 'adm'
        }
    }
}

// Function called on each feature when generating layers
// Sets breadcrumbs

function onEachFeature(feature, layer) {

    var value = 0;
    var panel = {};

    if (feature.properties['P_CODE'] in statsHash) {
        var value = statsHash[feature.properties['P_CODE']].mapValue;
        //console.log("feature.properties['P_CODE']]", statsHash[feature.properties['P_CODE']], feature.properties['P_CODE']);
    }
    var pcodelengths = [3, 5, 8, 11];
    var layerlevel = pcodelengths.indexOf(feature.properties['P_CODE'].length); //admNames[layerlevel]=REGION
    layer.on('click', function (e) {
        if (layerlevel == admlevel) {
            breadcrumbs[admlevel] = feature.properties[admNames[layerlevel]];
            breadcrumbspcode[admlevel] = e.target.feature.properties['P_CODE'];
            if (admlevel < 3) {
                overlays[admlevel].setStyle({
                    fillColor: "#999999",
                    color: "black",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.2
                });

                admlevel++;
                var newGeom = filterGeom(adm_geoms[admlevel], e.target.feature.properties['P_CODE'], pcodelengths[admlevel - 1]);
                addGeomToMap(newGeom);
            }
        } else {
            for (i = layerlevel + 1; i <= admlevel; i++) {
                map.removeLayer(overlays[i]);
                breadcrumbs[i] = '';
                breadcrumbspcode[i] = '';
            }
            breadcrumbs[layerlevel] = e.target.feature.properties[admNames[layerlevel]];
            breadcrumbspcode[layerlevel] = e.target.feature.properties['P_CODE'];
            admlevel = layerlevel + 1;
            var newGeom = filterGeom(adm_geoms[admlevel], e.target.feature.properties['P_CODE'], pcodelengths[admlevel - 1]);
            addGeomToMap(newGeom);
            panel.affected = value;
            panel.breadcrumbs = breadcrumbs;
        }
        showCharts();
    }); // End layer on click
    panel.breadcrumbspcode = breadcrumbspcode;
    panel.breadcrumbs = breadcrumbs;
    populateInfoPanel(panel);

    layer.on('mouseover', function () {
        $('.ipc-info').html('<p>' + feature.properties[admNames[layerlevel]] + '</p><p>Affected HouseHolds: ' + value + '</p>');
        //$('#panel-data').html("Total affected in "+ feature.properties[admNames[layerlevel]]+": " + value);
    });
    layer.on('mouseout', function () {
        $('.ipc-info').html('Hover for details');
    });

} // END onEachFeature


// Adding data on side panel, including breadcrumbs, and making breadcrumbs clickable

function populateInfoPanel(data) {
    //console.log(data);
    //var affected = statsHash[data.breadcrumbspcode[0]].affected;
    //$('#panel-data').html("Total affected in this area: " + affected);
    breadcrumbs.forEach(function (c, i) {
        if (i == 0) {
            $('#panel-breadcrumbs').html('<span id="bc' + i + '" class="hover-link">' + c + '</span>');
            $('#dataTable').css({ "display": "flex" });
        } else {
            if (c !== '') {
                $('#panel-breadcrumbs').append(' > <span id="bc' + i + '"class="hover-link">' + c + '</span>');
                $('#dataTable').css({ "display": "none" });
            }
            else {
                $("#bc" + i).remove();
            }
        }
        $('#bc' + i).on('click', function () {
            if (i+1 === admlevel) { return; } //if clicked on current level, nothing happens
            changeLayer(admlevel, i+1);
        });
    });
}

// Function checks whether the geom feature is inside "filter" and if not then doesn't add it to the newgeom
function filterGeom(geom, filter, length) {
    var newFeatures = [];
    var newgeom = jQuery.extend({}, geom); //creates new object from geom
    newgeom.features.forEach(function (f) {
        if (f.properties['P_CODE'].substring(0, length) == filter) {
            newFeatures.push(f);
        }
    });
    newgeom.features = newFeatures;
    return newgeom;
}

function zoomToGeom(geom) {
    var bounds = d3.geo.bounds(geom);
    map.fitBounds([[bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[1][0]]]);
}

function hxlProxyToJSON(input) {
    var output = [];
    var keys = []
    input.forEach(function (e, i) {
        if (i == 0) {
            e.forEach(function (e2, i2) {
                var parts = e2.split('+');
                var key = parts[0]
                if (parts.length > 1) {
                    var atts = parts.splice(1, parts.length);
                    atts.sort();
                    atts.forEach(function (att) {
                        key += '+' + att
                    });
                }
                keys.push(key);
            });
        } else {
            var row = {};
            e.forEach(function (e2, i2) {
                row[keys[i2]] = e2;
            });
            output.push(row);
        }
    });
    return output;
}

// Function sets new breadcrumbs depending on current layer and new layer
function setBreadcrumbs(currentLayer, newLayer) {
    // admin1=1, admin2=2
    for (i = newLayer; i < 4; i++) {
        breadcrumbs[i] = '';
        breadcrumbspcode[i] = '';
    }
}

// Function changes from layer to next layer
// currentLayer and newLayer are numbers and should be 1: country, 2: admin2 etc.
function changeLayer(currentLayer, newLayer) {
    console.log("!");
    map.removeLayer(overlays[currentLayer]);
    admlevel = newLayer;
    setBreadcrumbs(currentLayer, newLayer);
    var newGeom = filterGeom(adm_geoms[newLayer], breadcrumbspcode[newLayer-1], pcodelengths[newLayer-1]);
    //removing breadcrumbs
    addGeomToMap(newGeom);

    showCharts();
}

function createTable(headerNames) {
    try {
        var data = {};
        Object.keys(statsWithNames).forEach(function (c, i) {
            if (statsWithNames[c].var === "#adm1+name") {
                data[c] = statsWithNames[c].mapValue;
            }
        })
        //Creating headers for table
        var headers = "<tbody><tr>";
        headerNames.forEach(function(c, i){ 
            headers = headers.concat("<th>" + c + "</th>");
        });
        headers = headers.concat("</tr>");

        //Creating table

        var tableRows = "";
        Object.keys(data).forEach(function(c, i){
                tableRows = tableRows.concat("<tr><td>" + c + "</td>" + "<td>" + data[c] + "</td></tr>");
        })
        tableRows = tableRows.concat("</tbody>");

        //Adding table to code
        $("#dataTable").html(headers + tableRows);
    } catch (e) { console.log("Error creating the table: ", e.message) }
}

$('.dash').hide();

var dataNeedCall = $.ajax({
    type: 'GET',
    url: config.dataNeedURL,
    dataType: 'json',
});

var data3WCall = $.ajax({
    type: 'GET',
    url: config.data3WURL,
    dataType: 'json',
});

var geomadm1Call = $.ajax({
    type: 'GET',
    url: 'data/mdg_adm1.json',
    dataType: 'json',
});

var geomadm2Call = $.ajax({
    type: 'GET',
    url: 'data/mdg_adm2.json',
    dataType: 'json',
});

var geomadm3Call = $.ajax({
    type: 'GET',
    url: 'data/mdg_adm3.json',
    dataType: 'json',
});

//This function assumes data1 contains all the admin information 
//and merges the 3 datasets into a crossfilter friendly format

function mergeData(data1, data2, data3) {
    try {
        function transform(dataset, status) {
            var newData = [];
            Object.keys(dataset).forEach(function (c, i) {
                newData[i] = {};
                newData[i]['code'] = c;
                $.extend(newData[i], dataset[c]);
            })
            newData.forEach(function (c, i) {
                c["status"] = status;
            })
            return newData;
        };
        set1 = transform(data1, "affected");
        set2 = transform(data2, "targeted");
        set3 = transform(data3, "reached");
        set2.forEach(function (c, i) {
            set1.push(c);
        })
        set3.forEach(function (c, i) {
            set1.push(c);
        })

        return set1;
    } catch (e) { console.log("Couldn't merge the dataset from the sources: ", e)}
}

function createCharts(data) {
    try {
        var gapChart = dc.rowChart('#gapChart');
        var admin = dc.rowChart('#admin');
        var cf = crossfilter(data);

        var codeDimension = cf.dimension(function (d) { return d["code"]; });
        var statusDimension = cf.dimension(function (d) { return d["status"]; });
        var varDimension = cf.dimension(function (d) { return d["var"]; });
        var valueDimension = cf.dimension(function (d) { return d["mapValue"]; });

        var codeGroup = codeDimension.group();
        var statusGroup = statusDimension.group();
        var varGroup = varDimension.group();

        var values = statusGroup.reduceSum(function (d) {
            if (isNaN(d.mapValue)) {
                return 0;
            } else {
                return d.mapValue;
            }
        });
        var codeSum = codeGroup.reduceSum(function (d) {
            if (isNaN(d.mapValue)) {
                return 0;
            } else {
                return d.mapValue;
            }
        });

        gapChart.width($('#gapChart').width())
            .dimension(statusDimension)
            .group(values)
            .elasticX(true)
            .height(150)
            .data(function (group) {
                return group.top(15);
            })
            .labelOffsetY(13)
            //.colors(config.colors)
            //.colorDomain([0, 7])
            //.colorAccessor(function (d, i) { return 3; })
            .xAxis().ticks(5);

        admin.width($('#admin').width())
            .dimension(codeDimension)
            .group(codeSum)
            .elasticX(true)
            .data(function (group) {
                return group.top(10);
            })
            .height(320)
            .labelOffsetY(13)
            //.colors(config.colors)
            //.colorDomain([0, 7])
            //.colorAccessor(function (d, i) { return 3; })
            .xAxis().ticks(5);


        dc.renderAll();

    } catch (e) { console.log("Error generating the chart:", e) }
}

function filterData(data, code, variableName) {
    var newData = [];
    data.forEach(function (c, i) {
        if (c[variableName] === code) {
            newData.push(c);
        }
    })
    //console.log(newData);
    return newData;
}


//function showsCharts depending on admin level
function showCharts() {
    var adminName = '';
    breadcrumbs.forEach(function (c, i) {
        if (c !== '') {
            adminName = c;
        };
    })

    if (adminName === 'Madagascar') {
        var dataAdminM = filterData(mergedData, '#adm1+name', 'var');
        console.log("d=", mergedData);
        createCharts(dataAdminM);
    } else {
        var dataAdmin = filterData(mergedData, adminName, 'code');
        createCharts(dataAdmin);
    }
}

$.when(dataNeedCall, data3WCall, geomadm1Call, geomadm2Call, geomadm3Call).then(function (dataNeedArgs, data3WArgs, geomadm1Args, geomadm2Args, geomadm3Args) {
    data = hxlProxyToJSON(dataNeedArgs[0]);
    data3w = hxlProxyToJSON(data3WArgs[0]);
    adm_geoms[1] = topojson.feature(geomadm1Args[0], geomadm1Args[0].objects.mdg_adm1);
    adm_geoms[2] = topojson.feature(geomadm2Args[0], geomadm2Args[0].objects.mdg_adm2);
    adm_geoms[3] = topojson.feature(geomadm3Args[0], geomadm3Args[0].objects.mdg_adm3);
    //data = "Array of Objects in the following format: array[1] = #sector: "MDG1"

    statsHash = createStatsHash(data, ['#adm1+code', '#adm2+code', '#adm3+code'], config.affected);
    statsWithNames = createStatsHash(data, ['#adm1+name', '#adm2+name', '#adm3+name'], config.affected);
    statsHash3WTargeted = createStatsHash(data3w, ['#adm1+name', '#adm2+name', '#adm3+name'], config.targeted);
    statsHash3WReached = createStatsHash(data3w, ['#adm1+name', '#adm2+name', '#adm3+name'], config.reached);
    mergedData = mergeData(statsWithNames, statsHash3WTargeted, statsHash3WReached);
    initDash();
    console.log(mergedData);
    showCharts();

    // Return Top level button
    $('#reinit').click(function (e) {
        if (admlevel === 2) {
            changeLayer(2, 1); //change from layer 2 to layer 1
        }
        else if (admlevel === 3) {
            changeLayer(3, 1);
        }
        else { }
    });
});
