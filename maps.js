let tunersOnline = [];
let map; // Global map variable
let selectedMarker;
let markersGroup; // Feature group to hold all markers
let hideLocked = false;
let hideUnreachable = false;

$(document).ready(function () {
    // Initialize settings from local storage
    hideLocked = localStorage.getItem('hideLocked') === 'true';
    hideUnreachable = localStorage.getItem('hideUnreachable') === 'true';

    // Set the checkbox states based on the local storage
    $('#hide-locked').prop('checked', hideLocked);
    $('#hide-unreachable').prop('checked', hideUnreachable);

    // Register event listeners for checkboxes
    $('#hide-locked').on('change', function () {
        hideLocked = $(this).is(':checked');
        localStorage.setItem('hideLocked', hideLocked);
        filterMarkers();
    });

    $('#hide-unreachable').on('change', function () {
        hideUnreachable = $(this).is(':checked');
        localStorage.setItem('hideUnreachable', hideUnreachable);
        filterMarkers();
    });

    getTuners();
    const panel = $('.panel');
    const tunerList = $('.panel-content-all');
    const currentTuner = $('.panel-content-current');

    $(".panel-sidebar").on("click", function () {
        if (currentTuner.hasClass('open')) {
            currentTuner.removeClass('open');
            tunerList.addClass('open');
        } else {
            panel.removeClass('open');
            tunerList.removeClass('open');
        }
    });

    $("#open-all-tuners").on("click", function () {
        openMenu();
        $('#tuner-search').val('');
        filterTuners("");
    });

    $("#open-settings").on("click", function () {
        openSettings();
        $('#tuner-search').val('');
        filterTuners("");
    });

    $('#tuner-search').on('input', function () {
        const searchTerm = $(this).val();
        filterTuners(searchTerm, 'name');
    });
});

function openMenu() {
    $('.panel').addClass('open');
    $('.panel-content-current').removeClass('open');
    $('.panel-content-settings').removeClass('open');
    $('.panel-content-all').addClass('open');
}

function openSettings() {
    $('.panel').addClass('open');
    $('.panel-content-current').removeClass('open');
    $('.panel-content-all').removeClass('open');
    $('.panel-content-settings').addClass('open');
}

function getTuners() {
    $.get("./api", function (data) {
    //$.get("./data.json", function (data) { // DEBUGGING PURPOSES
        tunersOnline = ('dataset' in data) ? data['dataset'] : [];
        initializeMap();
        addMarkersAndGeoJson(tunersOnline);
        populateTunerList(tunersOnline);
    });
}

function populateTunerList(tunersOnline) {
    tunersOnline.forEach((tuner, index) => {
        let tunerInfo = `<div class="tuner" data-index="${index}" data-search="${tuner.country} ${tuner.name} ${tuner.url} ${tuner.status} ${tuner.version} ${tuner.tuner}">
            <div class="tuner-flag"><span class="fi fi-${tuner.country}"></span></div>
            <div class="tuner-basic-info">
                <h2>${tuner.name}</h2>
                <p class="shorten">${tuner.url}</p>
            </div>
            <div class="tuner-status"><div class="tuner-status-${tuner.status}"></div></div>
        </div>`;
        $('.tuner-list').append(tunerInfo);
    });

    $('.tuner').on('click', function () {
        const index = $(this).data('index');
        onTunerClick(index);
    });

    var countStatus0 = tunersOnline.filter(function (tuner) {
        return tuner.status === 0;
    }).length;

    var countStatus1 = tunersOnline.filter(function (tuner) {
        return tuner.status === 1;
    }).length;

    var countStatus2 = tunersOnline.filter(function (tuner) {
        return tuner.status === 2;
    }).length;

    $('#status0-count').text(countStatus0);
    $('#status1-count').text(countStatus1);
    $('#status2-count').text(countStatus2);
}

function onTunerClick(index) {
    const currentMarker = tunersOnline[index];

    $('#current-tuner-country').html('<span class="fi fi-'+ currentMarker.country + '"></span>')
    $('#current-tuner-name').text(currentMarker.name);
    $('#current-tuner-desc').text(currentMarker.desc);
    
    currentMarker.audioChannels == 2 ? $('#current-tuner-channels').text('Stereo') : $('#current-tuner-channels').text('Mono');

    if(currentMarker.tuner) {
        switch(currentMarker.tuner) {
            case 'tef': $('#current-tuner-device').html('<strong>Device: </strong> TEF668x'); break;
            case 'xdr': $('#current-tuner-device').html('<strong>Device: </strong> Sony XDR'); break;
            case 'sdr': $('#current-tuner-device').html('<strong>Device: </strong> SDR (RTL-SDR or AirSpy)'); break;
        }
    } else {
        $('#current-tuner-device').empty();
    }

    currentMarker.bwLimit?.length > 1 ? $('#current-tuner-limits').html('<strong>Tune limit: </strong>' + currentMarker.bwLimit) : $('#current-tuner-limits').html('<strong>Tune limit: </strong> None');
    currentMarker.version ? $('#current-tuner-version').text('Webserver version v' + currentMarker.version) : null;
    currentMarker.contact?.length > 0 ? $('#current-tuner-contact').text(currentMarker.contact) : $('#current-tuner-contact').text('No contact available.');
    currentMarker.os?.length > 0 ? $('#current-tuner-version').append('<br>(',currentMarker.os,')') : null;

    $('#current-tuner-bitrate').text(currentMarker.audioQuality);

    let linkToTuner = currentMarker.url + '?';

    // Parameter names
    const params = [
        'theme',
        'signalUnits',
        'noPlugins',
        'psUnderscores',
        'disableBackground'
    ];
    
    // Array to hold query strings
    const queryStrings = [];
    
    // Loop through the parameters
    params.forEach(param => {
        const value = localStorage.getItem(param);
        if (value && (param !== 'theme' || value !== 'none')) {
            queryStrings.push(`${param}=${value}`);
        }
    });
    
    // Join the query strings with '&' and append to the base URL
    linkToTuner += queryStrings.join('&');

    $('.current-tuner-link').find('span').text(currentMarker.url);
    $('.current-tuner-link').attr('href', linkToTuner);
    $('.current-tuner-status').html('<div class="tuner-status-' + currentMarker.status + '"></div>')

    parseMarkdown();

    $('.panel').addClass('open');
    $('.panel-content-all').removeClass('open');
    $('.panel-content-settings').removeClass('open');
    $('.panel-content-current').addClass('open');
}

// Function to get color based on some data value
function getColor() {
    return '#555';
}

// Function to style the GeoJSON layer
function style(feature) {
    return {
        fillColor: getColor(feature.properties.value),
        weight: 2.5,
        opacity: 1,
        color: '#222',
        fillOpacity: 1
    };
}

// Function to highlight countries on hover and show tooltip with country name
function highlightFeature(e) {
    const layer = e.target;

    // Set the style for the hovered layer
    layer.setStyle({
        weight: 5,
        dashArray: '',
        fillOpacity: 0.7,
    });

    // Bind tooltip to layer with country name and update position on mousemove
    const tooltip = L.tooltip({
        permanent: false,
        direction: 'top',
        className: 'country-tooltip',
        offset: L.point(0, 0)
    })
    .setContent(layer.feature.properties.ADMIN);

    // Update tooltip position on mousemove
    layer.on('mousemove', function(ev) {
        tooltip.setLatLng(ev.latlng);
    });

    layer.bindTooltip(tooltip).openTooltip(e.latlng);
}

// Function to reset the style of the countries and remove the tooltip
function resetHighlight(e) {
    const layer = e.target;
    geojsonLayer.resetStyle(layer);
    layer.closeTooltip();
}

// Function to handle country clicks
function onCountryClick(e) {
    const countryCode = e.target.feature.properties.ISO_A2; // Assuming ISO A2 code is used
    filterTuners(countryCode, 'country');
    $('#tuner-search').val('Country: ' + countryCode);
    if (!$('.panel').hasClass('open')) {
        openMenu();
    } else {
        $('.panel-content-current').removeClass('open');
        $('.panel-content-settings').removeClass('open');
        $('.panel-content-all').addClass('open');
    }
}

// Function to initialize the map
function initializeMap() {
    if (!map) {
        // Create the map with initial settings
        map = L.map('map', {
            zoom: 1.5,
            minZoom: 1.5,
            maxZoom: 10,
            center: [20, 0],
            zoomControl: true,
            attributionControl: false
        });

        // Define the bounds for the map
        var bounds = L.latLngBounds([
            [85, -180], // South-West coordinates
            [-85, 180]  // North-East coordinates
        ]);

        // Restrict panning to the defined bounds
        map.setMaxBounds(bounds);

        // Ensure the map is initially centered and zoomed properly
        map.setView([50, 20], 1.5);

        // Optional: Prevent panning out of bounds after dragging
        map.on('moveend', function() {
            // Check if the map's current bounds are within the set bounds
            if (!bounds.contains(map.getBounds())) {
                // Adjust the map's center to stay within bounds
                var newCenter = map.getCenter();
                if (!bounds.contains(newCenter)) {
                    var lat = Math.max(Math.min(newCenter.lat, bounds.getNorth()), bounds.getSouth());
                    var lng = Math.max(Math.min(newCenter.lng, bounds.getEast()), bounds.getWest());
                    map.setView([lat, lng], map.getZoom());
                }
            }
        });
    }
}

// Function to add markers and GeoJSON to the map
function addMarkersAndGeoJson(tuners) {
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(response => response.json())
        .then(geojsonData => {
            // Add a "value" property to each GeoJSON feature for choropleth styling
            geojsonData.features.forEach(feature => {
                feature.properties.value = 1;
            });

            // Add GeoJSON layer with style and event handlers
            geojsonLayer = L.geoJson(geojsonData, {
                style: style,
                onEachFeature: function (feature, layer) {
                    layer.on({
                        mouseover: highlightFeature,
                        mouseout: resetHighlight,
                        click: onCountryClick
                    });
                }
            }).addTo(map);

            markersGroup = L.featureGroup(); // Create a feature group to hold all markers
            var markerPositions = []; // To store the positions of existing markers

            tuners.forEach((tuner, index) => {
                if (tuner.coords && tuner.coords.length === 2) {
                    var latitude = parseFloat(tuner.coords[0]);
                    var longitude = parseFloat(tuner.coords[1]);
                    if (!isNaN(latitude) && !isNaN(longitude)) {
                        let adjusted = false;
                        let attempts = 0;

                        while (!adjusted && attempts < 10) {
                            let tooClose = markerPositions.some(pos => isTooClose(latitude, longitude, pos.lat, pos.lon));

                            if (tooClose) {
                                const { offsetLat, offsetLon } = getRandomOffset();
                                latitude += offsetLat;
                                longitude += offsetLon;
                                attempts++;
                            } else {
                                adjusted = true;
                            }
                        }

                        var originalClass = 'marker marker-status-' + tuner.status;

                        var marker = L.marker([latitude, longitude], {
                            icon: L.divIcon({
                                className: originalClass,
                                iconSize: [12, 12],
                                iconAnchor: [8, 8]
                            }),
                            tunerStatus: tuner.status // Store the tuner status with the marker
                        });

                        // Bind a tooltip to display the marker name on hover
                        marker.bindTooltip(tuner.name, {
                            permanent: false,
                            direction: 'top'
                        });

                        marker.on('click', function () {
                            onTunerClick(index);
                        });

                        markersGroup.addLayer(marker);
                        markerPositions.push({ lat: latitude, lon: longitude });
                    }
                }
            });

            if (markersGroup.getLayers().length > 0) {
                map.fitBounds(markersGroup.getBounds());
                markersGroup.addTo(map);
            }

            filterMarkers(); // Apply initial filter

            $('.receivers-button').css('z-index', 1000);
        })
        .catch(error => console.error('Error fetching GeoJSON data:', error));

    $(document).on('click', function (event) {
        if (!$(event.target).closest('.marker').length && $(event.target).closest('.panel-sidebar').length || event.target == $('.panel-sidebar')) {
            if (selectedMarker) {
                selectedMarker.setIcon(L.divIcon({
                    className: selectedMarker.options.icon.options.originalClass,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                }));
                selectedMarker = null;
                $('.panel').removeClass('open');
            }
        }
    });
}


function filterMarkers() {
    markersGroup.eachLayer(function (marker) {
        let shouldShow = true;

        if (hideLocked && marker.options.tunerStatus === 2) {
            shouldShow = false;
        }
        if (hideUnreachable && marker.options.tunerStatus === 0) {
            shouldShow = false;
        }

        if (shouldShow) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });
}

// Utility functions to handle marker position adjustment
function isTooClose(lat1, lon1, lat2, lon2, threshold = 0.001) {
    const latDiff = Math.abs(lat1 - lat2);
    const lonDiff = Math.abs(lon1 - lon2);
    return latDiff < threshold && lonDiff < threshold;
}

function getRandomOffset() {
    const maxOffset = 0.01; // Adjust the maximum offset as needed
    const offsetLat = (Math.random() - 0.5) * maxOffset;
    const offsetLon = (Math.random() - 0.5) * maxOffset;
    return { offsetLat, offsetLon };
}
