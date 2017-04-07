function initDash(){
    map = L.map('hdx-ipc-map',{});

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

    var legend = L.control({position: 'bottomright'});

    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend'),
            labels = ['0 - 19','20 - 39','40 - 59','60 - 79','80 - 99','100'];

        div.innerHTML = 'Percent (%) of<br />medical centers reached<br />';
        for (var i = 0; i < labels.length; i++) {
            div.innerHTML +=
                '<i style="background:' + colors[i] + '"></i> ' + labels[5-i] +'<br />';
        }

        return div;
    };

    legend.addTo(map); 

    $('.loading').hide();
    $('.dash').show();   

    addGeomToMap(adm_geoms[1]);

}

function createStatsHash(data){
    output = {};

    cf = crossfilter(data);

    cf.adm1Dim = cf.dimension(function(d){return d['#adm1+code']});
    cf.adm2Dim = cf.dimension(function(d){return d['#adm2+code']});
    cf.adm3Dim = cf.dimension(function(d){return d['#adm3+code']});

    cf.adm1group = cf.adm1Dim.group().reduceSum(function(d){
        return d['#affected+households+idps'];
    });

    cf.adm1group.top(Infinity).forEach(function(d,i){
        output[d.key] = {};
        output[d.key].mapValue = d.value;
    });

    cf.adm2group = cf.adm2Dim.group().reduceSum(function(d){
        return d['#affected+households+idps'];
    });

    cf.adm2group.top(Infinity).forEach(function(d,i){
        output[d.key] = {};
        output[d.key].mapValue = d.value;
    });

    cf.adm3group = cf.adm3Dim.group().reduceSum(function(d){
        return d['#affected+households+idps'];
    });

    cf.adm3group.top(Infinity).forEach(function(d,i){
        output[d.key] = {};
        output[d.key].mapValue = d.value;
    });        

    return output;
}

function addGeomToMap(geom){
    if(admlevel==1){
        overlays[1] = L.geoJson(geom,{
            style:styleGeom,
            onEachFeature: onEachFeature
        });
        overlays[1].addTo(map);
    }
    if(admlevel==2){
        overlays[2] = L.geoJson(geom,{
            style:styleGeom,
            onEachFeature: onEachFeature
        });
        overlays[2].addTo(map);
    }
    if(admlevel==3){
        overlays[3] = L.geoJson(geom,{
            style:styleGeom,
            onEachFeature: onEachFeature
        });
        overlays[3].addTo(map);
    }

    zoomToGeom(geom);
    
    function styleGeom(feature){

        var values = [10,100,500,5000,10000];

        var value = 0;
        if(feature.properties['P_CODE'] in statsHash){
            var value = statsHash[feature.properties['P_CODE']].mapValue;
        }
        
        var color = 0

        values.forEach(function(v){
            if(value>v){color++}
        });

        return {
            fillColor: colors[color],
            color: 'black',
            weight: 2,
            opacity: 1,
            fillOpacity: 1,
            class:'adm'
        }
    }
}

function onEachFeature(feature,layer){

    var value = 0;
    if(feature.properties['P_CODE'] in statsHash){
        var value = statsHash[feature.properties['P_CODE']].mapValue;
    }
    var pcodelengths = [3,5,8,11];
    var layerlevel = pcodelengths.indexOf(feature.properties['P_CODE'].length);
    layer.on('click',function(e){
        if(layerlevel==admlevel){
            breadcrumbs[admlevel] = feature.properties[admNames[layerlevel]];
            breadcrumbspcode[admlevel] = e.target.feature.properties['P_CODE'];
            if(admlevel<3){
                overlays[admlevel].setStyle({
                    fillColor: "#999999",
                    color: "black",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.2
                });
                
                admlevel++;          
                var newGeom = filterGeom(adm_geoms[admlevel],e.target.feature.properties['P_CODE'],pcodelengths[admlevel-1]);                
                addGeomToMap(newGeom);
            }
        } else {
            for(i=layerlevel+1;i<=admlevel;i++){
                map.removeLayer(overlays[i]);
                breadcrumbs[i] ='';
                breadcrumbspcode[i] ='';
            }
            breadcrumbs[layerlevel] = e.target.feature.properties[admNames[layerlevel]];
            breadcrumbspcode[layerlevel] = e.target.feature.properties['P_CODE'];
            admlevel = layerlevel+1;
            var newGeom = filterGeom(adm_geoms[admlevel],e.target.feature.properties['P_CODE'],pcodelengths[admlevel-1]);
            addGeomToMap(newGeom);

        }

        var panel = {}
        panel.affected = value;
        panel.breadcrumbs = breadcrumbs;
        populateInfoPanel(panel);         
    });

    layer.on('mouseover',function(){
        $('.ipc-info').html('<p>'+feature.properties[admNames[layerlevel]]+'</p><p>Affected HouseHolds: '+value+'</p>');
    });
    layer.on('mouseout',function(){
        $('.ipc-info').html('Hover for details');
    });
}

function populateInfoPanel(data){
    var pcodelengths = [3,5,8,11];
    $('#panel-data').html(data.affected);
    breadcrumbs.forEach(function(c,i){
        if(i==0){
            $('#panel-breadcrumbs').html('<span id="bc'+i+'">'+c+'</span>');
        } else {
            if (c!==''){
                $('#panel-breadcrumbs').append('<span id="bc'+i+'"> > '+c+'</span>');
            }
        }
        $('#bc'+i).on('click',function(){
            for(j=i+1;j<=admlevel;j++){
                map.removeLayer(overlays[j]);
                breadcrumbs[j] ='';
                breadcrumbspcode[j] ='';
            }
            var newGeom = filterGeom(adm_geoms[i+1],breadcrumbspcode[i],pcodelengths[i]);
            addGeomToMap(newGeom);
        });
    });
}

function filterGeom(geom,filter,length){
    var newFeatures = [];
    var newgeom = jQuery.extend({}, geom);
    newgeom.features.forEach(function(f){
        if(f.properties['P_CODE'].substring(0,length)==filter){
            newFeatures.push(f);
        }    
    });
    newgeom.features = newFeatures;
    return newgeom;
}

function zoomToGeom(geom){
    var bounds = d3.geo.bounds(geom);
    map.fitBounds([[bounds[0][1],bounds[0][0]],[bounds[1][1],bounds[1][0]]]);
}

function hxlProxyToJSON(input){
    var output = [];
    var keys=[]
    input.forEach(function(e,i){
        if(i==0){
            e.forEach(function(e2,i2){
                var parts = e2.split('+');
                var key = parts[0]
                if(parts.length>1){
                    var atts = parts.splice(1,parts.length);
                    atts.sort();
                    atts.forEach(function(att){
                        key +='+'+att
                    });
                }
                keys.push(key);
            });
        } else {
            var row = {};
            e.forEach(function(e2,i2){
                row[keys[i2]] = e2;
            });
            output.push(row);
        }
    });
    return output;
}

$('.dash').hide();

var map;
var info;
var admlevel=1;
var overlays = [];
var data, data3W;
var colors = ['#4575b4','#91bfdb','#e0f3f8','#fee090','#fc8d59','#d73027'];
var statsHash = {};
var breadcrumbs= ['Madagascar','','',''];
var breadcrumbspcode= ['Mdg','','',''];

var adm_geoms = [];

var admNames = ['Country','REGION','DISTRICT','COMMUNE'];

var dataNeedURL = 'https://proxy.hxlstandard.org/data.json?url=https%3A//data.humdata.org/dataset/94b6d7f8-9b6d-4bca-81d7-6abb83edae16/resource/3ed3635b-7cee-4fa1-aec6-6f0318886092/download/Assesment_data_CRM__05April2017.xlsx&strip-headers=on';
// change for new data
var data3WURL = 'https://proxy.hxlstandard.org/data.json?select-query01-01=%23org%3DCRM&filter01=select&strip-headers=on&force=on&url=https%3A//docs.google.com/spreadsheets/d/1eJjAvrAMFLpO3TcXZYcXXc-_HVuHLL-iQUULV60lr1g/edit%23gid%3D0';


var dataNeedCall = $.ajax({
    type: 'GET',
    url: dataNeedURL,
    dataType: 'json',
});

var data3WCall = $.ajax({
    type: 'GET',
    url: data3WURL,
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

$.when(dataNeedCall, data3WCall, geomadm1Call, geomadm2Call, geomadm3Call).then(function(dataNeedArgs, data3WArgs, geomadm1Args, geomadm2Args, geomadm3Args){
        data = hxlProxyToJSON(dataNeedArgs[0]);
        data3w = hxlProxyToJSON(data3WArgs[0]);
        adm_geoms[1] = topojson.feature(geomadm1Args[0],geomadm1Args[0].objects.mdg_adm1);
        adm_geoms[2] = topojson.feature(geomadm2Args[0],geomadm2Args[0].objects.mdg_adm2);
        adm_geoms[3] = topojson.feature(geomadm3Args[0],geomadm3Args[0].objects.mdg_adm3);
        console.log(data);
        statsHash = createStatsHash(data);
        initDash();


        $('#reinit').click(function(e){
            map.removeLayer(overlay2);
            map.removeLayer(overlay3);
            admlevel =1;
            addGeomToMap(adm1_geom);

        });     
});