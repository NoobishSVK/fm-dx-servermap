let tunersOnline = [];
let map; // Global map variable
let selectedMarker;
let markersGroup; // Feature group to hold all markers
let hideLocked = false;
let hideUnreachable = false;
const loader = $('#loader');

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

    showLoader();  // Show loader when fetching tuners
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

    $(".leaflet-control a").each(function() {
        $(this).attr("tabindex", "-1");
    });
    
    $(document).keydown(function(event) {
        if (event.key === 'Enter') {
          const focusedButton = $(':focus');
          
          if (focusedButton.hasClass('button')) {
            // Trigger click on the focused button
            focusedButton.click();
            
            // Check if the button clicked is the #open-all-tuners button
            if (focusedButton.is('#open-all-tuners')) {
              // Delay focusing on the .tuner-list to allow it to appear
              setTimeout(function() {
                $('.tuner-list').focus();
              }, 100); // 100 milliseconds delay (adjust as needed)
            }
          }
        }
      });
      
      
});

function showLoader() {
    loader.show();
}

function hideLoader() {
    loader.hide();
}

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
    // Clear existing content
    $('.tuner-list').empty();

    tunersOnline.forEach((tuner, index) => {
        let tunerInfo = `<div class="tuner" tabindex="0" data-index="${index}" data-search="${tuner.country} ${tuner.name} ${tuner.url} ${tuner.status} ${tuner.version} ${tuner.tuner}">
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

    // Add keyboard navigation
    let currentFocusIndex = -1;

    function setFocus(index) {
        $('.tuner').removeClass('focused');
        if (index >= 0 && index < $('.tuner').length) {
            $('.tuner').eq(index).addClass('focused').focus();
            currentFocusIndex = index;
        }
    }

    $(document).on('keydown', function (e) {
        const tuners = $('.tuner');
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocus((currentFocusIndex + 1) % tuners.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocus((currentFocusIndex - 1 + tuners.length) % tuners.length);
                break;
            case 'Enter':
                if (currentFocusIndex >= 0 && currentFocusIndex < tuners.length) {
                    const index = tuners.eq(currentFocusIndex).data('index');
                    onTunerClick(index);
                }
                break;
        }
    });

    // Ensure the focused class and styles
    $('.tuner').on('focus', function() {
        $(this).addClass('focused');
    }).on('blur', function() {
        $(this).removeClass('focused');
    });

    var countStatus0 = tunersOnline.filter(tuner => tuner.status === 0).length;
    var countStatus1 = tunersOnline.filter(tuner => tuner.status === 1).length;
    var countStatus2 = tunersOnline.filter(tuner => tuner.status === 2).length;

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

let isMarkerHovered = false; // Flag to indicate if a marker is hovered

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
    if (!isMarkerHovered) {
        geojsonLayer.resetStyle(layer);
        layer.closeTooltip();
    }
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
            center: L.latLng(20, 20),
            zoom: 2,
            minZoom: 1,
            maxZoom: 10,
            zoomControl: true,
            attributionControl: false
        });

        var bounds = L.latLngBounds([
            [-90, -250], // South-West coordinates
            [90, 250]    // North-East coordinates
        ]);

        map.setMaxBounds(bounds);


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
// Declare geojsonLayer at a scope that is accessible throughout the function
let geojsonLayer;

function addMarkersAndGeoJson(tuners) {
    fetch('https://fmdx.org/data/countries_simplified.geojson')
        .then(response => response.json())
        .then(geojsonData => {

            // Add a "value" property to each GeoJSON feature for choropleth styling
            geojsonData.features.forEach(feature => {
                feature.properties.value = 1;
            });

            // Remove existing GeoJSON layer if it exists
            if (geojsonLayer) {
                map.removeLayer(geojsonLayer);
            }

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
                            tunerStatus: tuner.status, // Store the tuner status with the marker
                            keyboard: false // Disable keyboard interaction for this marker
                        });

                        // Bind a tooltip to display the marker name on hover
                        marker.bindTooltip(tuner.name, {
                            permanent: false,
                            direction: 'top'
                        });

                        marker.on('click', function () {
                            onTunerClick(index);
                        });

                        marker.on('mouseover', function () {
                            isMarkerHovered = true;
                        });

                        marker.on('mouseout', function () {
                            isMarkerHovered = false;
                        });

                        markersGroup.addLayer(marker);
                        markerPositions.push({ lat: latitude, lon: longitude });
                    }
                }
            });

            // Add markers to the map only if there are markers to show
            if (markersGroup.getLayers().length > 0) {
                markersGroup.addTo(map);
            }

            filterMarkers(); // Apply initial filter

            $('.receivers-button').css('z-index', 1000);

            // Call zoomToCountry here after GeoJSON is loaded
            const urlParams = new URLSearchParams(window.location.search);
            const countryParam = urlParams.get('country');
            if (countryParam) {
                zoomToCountry(countryParam.toUpperCase(), geojsonData);
            } else {
                // Only fitBounds to markers if no country is specified in the URL
                if (markersGroup.getLayers().length > 0) {
                    map.fitBounds(markersGroup.getBounds());
                }
            }

            hideLoader();
        })
        .catch(error => console.error('Error fetching GeoJSON data:', error));
}

function zoomToCountry(countryCode, geojsonData) {
    let countryFound = false;

    // Define specific bounding boxes for mainland regions
    const mainlandBounds = {
        "NL": [[50.5, 3.36], [53.6, 7.2]], // Mainland Netherlands
        "FR": [[41.3, -5.14], [51.1, 9.66]] // Mainland France
    };

    // If the country is Netherlands or France, zoom to predefined mainland bounds
    if (mainlandBounds[countryCode]) {
        const bounds = mainlandBounds[countryCode];
        console.log('Zooming to bounds:', bounds); // Debugging output
        map.fitBounds(bounds);

        // Filter tuners by the country code
        filterTuners(countryCode.toLowerCase(), 'country');
        $('#tuner-search').val('Country: ' + countryCode);

        openMenu();  // Open the menu with tuners from that country

        countryFound = true;
    } else {
        // Default behavior: zoom to the country's full bounding box
        geojsonData.features.forEach(feature => {
            if (feature.properties.ISO_A2 === countryCode) {
                const bounds = L.geoJSON(feature).getBounds();
                console.log('Zooming to bounds from GeoJSON:', bounds); // Debugging output
                map.fitBounds(bounds);

                // Filter tuners by the country code
                filterTuners(countryCode.toLowerCase(), 'country');
                $('#tuner-search').val('Country: ' + countryCode);

                openMenu();  // Open the menu with tuners from that country

                countryFound = true;
            }
        });
    }
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