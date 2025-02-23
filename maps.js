let tunersOnline = [];
let clustersByStatus = {};
let map; // Global map variable
let selectedMarker;
let markersGroup; // Feature group to hold all markers
let hideLocked = false;
let hideUnreachable = false;
let geojsonLayer;
let allMarkers = []; 

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
    $.get("./api/", function (data) {
    //$.get("./data.json", function (data) { // DEBUGGING PURPOSES
        tunersOnline = ('dataset' in data) ? data['dataset'] : [];
        initializeMap();
        addMarkersAndGeoJson(tunersOnline);
    });
}

function populateTunerList(tunersOnline, geojsonData) {
    // Clear existing content
    $('.tuner-list').empty();

    tunersOnline.forEach((tuner, index) => {
        const countryBoundary = geojsonData.features.find(feature => {
            return feature.properties?.ISO_A2?.toUpperCase() === tuner.country?.toUpperCase();
        });

        if (!countryBoundary) {
            console.warn(`No country boundary found for ${tuner.country}`);
            return; // Skip this tuner if no country boundary
        }

        const polygonCoords = countryBoundary.geometry.coordinates;
        let isInside = false;

        // Handle Polygon (single boundary) or MultiPolygon (multiple disjoint boundaries)
        if (countryBoundary.geometry.type === "Polygon") {
            if (polygonCoords[0].length >= 4) {
                const polygon = turf.polygon(polygonCoords);
                const point = turf.point([tuner.coords[1], tuner.coords[0]]);
                isInside = turf.booleanPointInPolygon(point, polygon);
            }
        } else if (countryBoundary.geometry.type === "MultiPolygon") {
            for (let i = 0; i < polygonCoords.length; i++) {
                const polygon = turf.polygon(polygonCoords[i]);
                const point = turf.point([tuner.coords[1], tuner.coords[0]]);
                if (turf.booleanPointInPolygon(point, polygon)) {
                    isInside = true;
                    break;
                }
            }
        }

        (tuner.country.includes("no") || tuner.country.includes("hr") || tuner.country.includes("pl") || tuner.country.includes("de")) ? isInside = true : null;

        if (!isInside) {
            //console.warn(`Tuner ${tuner.name} is outside valid boundaries.`);
            return;
        }

        // Add the tuner to the list if it passed the checks
        let tunerInfo = `<div class="tuner tuner-status-${tuner.status}" tabindex="0" data-index="${index}" data-search="${tuner.country} ${tuner.name} ${tuner.url} ${tuner.status} ${tuner.version} ${tuner.tuner}">
            <div class="tuner-flag"><span class="fi fi-${tuner.country}"></span></div>
            <div class="tuner-basic-info">
                <h2>${tuner.name}</h2>
                <p class="shorten">${tuner.url}</p>
            </div>
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
    const isSupporter = ((currentMarker.url).includes('fmtuner.org') ? true : false);

    $('.current-tuner-country').html('<span class="fi fi-'+ currentMarker.country + '"></span>')
    $('#current-tuner-name').text(currentMarker.name);
    $('#current-tuner-desc').text(currentMarker.desc);
    $('#current-tuner-supporter').css('display', isSupporter ? 'initial' : 'none');
    $('#current-tuner-location').css('display', currentMarker.countryName !== null ? 'block' : 'none');
    $('#current-tuner-city').text(currentMarker.city);
    let countryName = currentMarker.countryName;

    if (countryName) {
        if (countryName.startsWith("Russia")) {
            countryName = "Russia";
        } else if (countryName.startsWith("United Kingdom")) {
            countryName = "United Kingdom";
        }
    }
    $('#current-tuner-country-name').text(countryName);
    

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

    if(currentMarker.os.includes("Linux"))

    currentMarker.bwLimit?.length > 1 ? $('#current-tuner-limits').html('<strong>Tune limit: </strong>' + currentMarker.bwLimit) : $('#current-tuner-limits').html('<strong>Tune limit: </strong> None');
    currentMarker.version ? $('#current-tuner-version').text('FM-DX Webserver v' + currentMarker.version) : null;
    currentMarker.contact?.length > 0 ? $('#current-tuner-contact').text(currentMarker.contact) : $('#current-tuner-contact').text('No contact available.');
    if (currentMarker.os.includes("Linux") || currentMarker.os.includes("Windows")) {
        const icon = currentMarker.os.includes("Linux") 
            ? '<i class="fab fa-linux"></i> ' // Linux icon
            : '<i class="fab fa-windows"></i> '; // Windows icon
        
        currentMarker.os?.length > 0 
            ? $('#current-tuner-version').append('<br>[', icon, currentMarker.os, ']') 
            : null;
    }    

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

function resetHighlight(e) {
    const layer = e.target;
    if (!isMarkerHovered) {
        geojsonLayer.resetStyle(layer);
        layer.closeTooltip();
    }
}

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

function initializeMap() {
    if (!map) {
        map = L.map('map', {
            center: L.latLng(20, 10),
            zoom: 2.75,
            minZoom: 1,
            maxZoom: 10,
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0.1,
            zoomDelta: 1 
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
function addMarkersAndGeoJson(tuners) {
    const urlParams = new URLSearchParams(window.location.search);
    const countryCode = urlParams.get('country');

    fetch('https://fmdx.org/data/countries_simplified.geojson')
        .then(response => response.json())
        .then(geojsonData => {
            geojsonData.features.forEach(feature => {
                feature.properties.value = 1;
            });

            if (geojsonLayer) {
                map.removeLayer(geojsonLayer);
            }

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

            const statusTypes = ["0", "1", "2"];
            statusTypes.forEach(status => {
                const clusterGroup = L.markerClusterGroup({
                    maxClusterRadius: 8,
                    iconCreateFunction: function(cluster) {
                        return L.divIcon({
                            html: `<div class="marker marker-status-${status} flex-center" style="font-family: 'Titillium Web'">${cluster.getChildCount()}</div>`,
                            className: `marker marker-status-${status} flex-center`,
                            iconSize: [24, 24]
                        });
                    }
                });

                clusterGroup.on('clustermouseover', function(event) {
                    const cluster = event.layer;
                    const childMarkers = cluster.getAllChildMarkers();
                    const namesList = childMarkers
                        .map(marker => marker.options.tuner && marker.options.tuner.name)
                        .filter(name => name)
                        .join("<br>");
                    cluster.bindTooltip(namesList || "", {
                        permanent: false,
                        direction: "top",
                    }).openTooltip();
                });

                clusterGroup.on('clustermouseout', function(event) {
                    event.layer.closeTooltip();
                });

                clustersByStatus[status] = clusterGroup;
            });

            var markerPositions = [];
            tuners.forEach((tuner, index) => {
                if (tuner.coords && tuner.coords.length === 2) {
                    var latitude = parseFloat(tuner.coords[0]);
                    var longitude = parseFloat(tuner.coords[1]);
                    const isSupporter = tuner.url.includes('fmtuner.org');

                    if (!isNaN(latitude) && !isNaN(longitude)) {
                        // Find the matching country boundary using the country code
                        const countryBoundary = geojsonData.features.find(feature => {
                            return feature.properties?.ISO_A2?.toUpperCase() === tuner.country?.toUpperCase();
                        });

                        if (!countryBoundary) {
                            console.warn(`No country boundary found for ${tuner.country}`);
                            return; // Skip this marker if no country boundary
                        }

                        const polygonCoords = countryBoundary.geometry.coordinates;

                        // Check if the polygon coordinates are in a valid format
                        if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) {
                            console.warn(`Invalid coordinates for ${tuner.country}:`, polygonCoords);
                            return; // Skip this polygon if it has invalid coordinates
                        }

                        // Handle Polygon (single boundary) or MultiPolygon (multiple disjoint boundaries)
                        let isInside = false;
                        if (countryBoundary.geometry.type === "Polygon") {
                            // Single polygon
                            if (polygonCoords[0].length >= 4) {
                                const polygon = turf.polygon(polygonCoords);
                                const point = turf.point([longitude, latitude]);

                                if (turf.booleanPointInPolygon(point, polygon)) {
                                    isInside = true;
                                }
                            }
                        } else if (countryBoundary.geometry.type === "MultiPolygon") {
                            // Multiple polygons (MultiPolygon)
                            for (let i = 0; i < polygonCoords.length; i++) {
                                const polygon = turf.polygon(polygonCoords[i]);
                                const point = turf.point([longitude, latitude]);

                                if (turf.booleanPointInPolygon(point, polygon)) {
                                    isInside = true;
                                    break; 
                                }
                            }
                        }

                        (tuner.country.includes("no") || tuner.country.includes("hr") || tuner.country.includes("pl") || tuner.country.includes("de")) ? isInside = true : null;

                        /*if (!isInside) {
                            return; // Skip this marker if it’s not inside any of the polygons
                        }*/

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

                        var marker = L.marker([latitude, longitude], {
                            icon: L.divIcon({
                                className: 'marker marker-status-' + tuner.status,
                                iconSize: [12, 12],
                                iconAnchor: [8, 8]
                            }),
                            tunerStatus: tuner.status,
                            tuner: tuner,
                            keyboard: false
                        });

                        marker.bindTooltip(tuner.name + (isSupporter ? '<br><span style="display: block;font-size: 12px;font-weight: 300;text-align: center;margin: auto;">Supporter</span>' : ''), {
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

                        const statusClusterGroup = clustersByStatus[tuner.status] || clustersByStatus["unknown"];
                        statusClusterGroup.addLayer(marker);
                        allMarkers.push({ marker: marker, clusterGroup: statusClusterGroup });
                        markerPositions.push({ lat: latitude, lon: longitude });
                    }
                }
            });

            for (let status in clustersByStatus) {
                map.addLayer(clustersByStatus[status]);
            }

            filterMarkers();
            populateTunerList(tunersOnline, geojsonData);
            $('.receivers-button').css('z-index', 1000);

            hideLoader();

            if (countryCode) {
                zoomToCountry(countryCode.toUpperCase(), geojsonData);
            }
        })
        .catch(error => console.error('Error fetching GeoJSON data:', error));
}

function filterMarkers() {
    allMarkers.forEach(entry => {
        const { marker, clusterGroup } = entry;
        let shouldShow = true;

        if (hideLocked && marker.options.tunerStatus === 2) {
            shouldShow = false;
        }
        if (hideUnreachable && marker.options.tunerStatus === 0) {
            shouldShow = false;
        }

        if (shouldShow) {
            if (!clusterGroup.hasLayer(marker)) {
                console.log('Adding marker:', marker.options.tuner.name);
                clusterGroup.addLayer(marker);
            }
        } else {
            if (clusterGroup.hasLayer(marker)) {
                console.log('Removing marker:', marker.options.tuner.name);
                clusterGroup.removeLayer(marker);
            }
        }
    });

    Object.values(clustersByStatus).forEach(clusterGroup => {
        if (clusterGroup.getLayers().length > 0) {
            if (!map.hasLayer(clusterGroup)) {
                map.addLayer(clusterGroup);
            }
        } else {
            if (map.hasLayer(clusterGroup)) {
                map.removeLayer(clusterGroup);
            }
        }
    });
}

function zoomToCountry(countryCode, geojsonData) {
    const mainlandBounds = {
        "NL": [[50.5, 3.36], [53.6, 7.2]], // Mainland Netherlands
        "FR": [[41.3, -5.14], [51.1, 9.66]] // Mainland France
    };

    if (mainlandBounds[countryCode]) {
        const bounds = mainlandBounds[countryCode];
        map.fitBounds(bounds);

        filterTuners(countryCode.toLowerCase(), 'country');
        $('#tuner-search').val('Country: ' + countryCode);

        openMenu();
    } else {
        geojsonData.features.forEach(feature => {
            if (feature.properties.ISO_A2 === countryCode) {
                const bounds = L.geoJSON(feature).getBounds();
                map.fitBounds(bounds);

                filterTuners(countryCode.toLowerCase(), 'country');
                $('#tuner-search').val('Country: ' + countryCode);

                openMenu(); 
            }
        });
    }
}