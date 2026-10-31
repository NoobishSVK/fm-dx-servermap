let tunersOnline = [];
let clustersByStatus = {};
let map; // Global map variable
let selectedMarker;
let hideAvailable = false;
let hideLocked = false;
let hideUnreachable = false;
let geojsonLayer;
let allMarkers = [];


const tunerDevices = {
    tef: 'TEF668x',
    xdr: 'Sony XDR',
    sdr: 'SDR (RTL-SDR or AirSpy)',
    si47xx: 'SkyWorks Si473x'
};

const countryNameToISO = {
    "France": "FR",
    "Norway": "NO"
};

const loader = $('#loader');

$(document).ready(function () {

    // Initialize settings from local storage
    hideAvailable = localStorage.getItem('hideAvailable') === 'true';
    hideLocked = localStorage.getItem('hideLocked') === 'true';
    hideUnreachable = localStorage.getItem('hideUnreachable') === 'true';

    $('#hide-locked').toggleClass('low-opacity', hideLocked);
    $('#hide-unreachable').toggleClass('low-opacity', hideUnreachable);
    $('#hide-available').toggleClass('low-opacity', hideAvailable); 

    // Register event listeners for checkboxes
    $('#hide-available').on('click', function () {
        hideAvailable = !hideAvailable;
        localStorage.setItem('hideAvailable', hideAvailable);
        $(this).toggleClass('low-opacity', hideAvailable);
        filterMarkers();
    });

    $('#hide-locked').on('click', function () {
        hideLocked = !hideLocked;
        localStorage.setItem('hideLocked', hideLocked);
        $(this).toggleClass('low-opacity', hideLocked);
        filterMarkers();
    });

    $('#hide-unreachable').on('click', function () {
        hideUnreachable = !hideUnreachable;
        localStorage.setItem('hideUnreachable', hideUnreachable);
        $(this).toggleClass('low-opacity', hideUnreachable);
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

    $(".open-tuners").on("click", function () {
        openMenu();
        $('#tuner-search').val('');
        filterTuners("");
    });

    $('.discover-tuners').on('click', function() {
        const visibleMarkers = allMarkers
            .filter(({ marker, clusterGroup }) => map.hasLayer(clusterGroup) && clusterGroup.hasLayer(marker))
            .map(({ marker }) => marker);
    
        if (visibleMarkers.length === 0) {
            alert('No visible markers to discover!');
            return;
        }
    
        const randomIndex = Math.floor(Math.random() * visibleMarkers.length);
        const randomMarker = visibleMarkers[randomIndex];
        const latLng = randomMarker.getLatLng();
    
        if (selectedMarker && selectedMarker !== randomMarker) {
            selectedMarker.closeTooltip();

        }
    
        selectedMarker = randomMarker;
    
        map.flyTo(latLng, 8, {
            duration: 0.35
        });
    
        map.once('moveend', function() {
            randomMarker.fire('click');
        });
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
            
            // Check if the button clicked is the .open-tuners button
            if (focusedButton.is('.open-tuners')) {
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
    $('.panel-content-all').addClass('open');
}

function getTuners() {
    $.get("./api/", function (data) {
    //$.get("./data.json", function (data) { // DEBUGGING PURPOSES
        tunersOnline = ('dataset' in data) ? data['dataset'] : [];
        initializeMap();
        addMarkersAndGeoJson(tunersOnline);
    });
}

function populateTunerList(tunersOnline) {
    // Clear existing tuners, keeping the .no-content placeholder
    $('.tuner-list .tuner').remove();

    // Server fields come from third-party owners, so escape everything
    const html = tunersOnline.map((tuner, index) => {
        const e = v => escapeHtml(String(v ?? ''));
        return `<div class="tuner tuner-status-${e(tuner.status)}" tabindex="0" data-index="${index}" data-search="${e(`${tuner.country} ${tuner.name} ${tuner.url} ${tuner.status} ${tuner.version} ${tuner.tuner}`)}">
            <div class="tuner-bg-flag fi fi-${e(tuner.country)}"></div>            <div class="tuner-basic-info">
                <h2>${e(tuner.name)}</h2>
                <p class="shorten">${e(tuner.url)}</p>
            </div>
        </div>`;
    }).join('');
    $('.tuner-list').append(html);

    filterTuners(""); // fills the list's status counters even if the list is never opened via the bottom bar

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
        if ($(e.target).is('input, textarea')) return; // don't hijack keys while typing
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

    $('.tuner').on('focus', function() {
        $(this).addClass('focused');
    }).on('blur', function() {
        $(this).removeClass('focused');
    });

    var countStatus0 = tunersOnline.filter(tuner => tuner.status === 0).length;
    var countStatus1 = tunersOnline.filter(tuner => tuner.status === 1).length;
    var countStatus2 = tunersOnline.filter(tuner => tuner.status === 2).length;

    $('.status0-count-dash').text(countStatus0);
    $('.status1-count-dash').text(countStatus1);
    $('.status2-count-dash').text(countStatus2);
    $('.status-total-count-dash').text(countStatus0 + countStatus1 + countStatus2);
}

function onTunerClick(index) {
    const currentMarker = tunersOnline[index];
    const isSupporter = ((currentMarker.url).includes('fmtuner.org') ? true : false);

    $('.current-tuner-header-flag').attr('class', 'current-tuner-header-flag fi fi-' + currentMarker.country);
    $('#current-tuner-name').text(currentMarker.name);
    $('#current-tuner-desc').text(currentMarker.desc);
    $('#current-tuner-supporter').css('display', isSupporter ? 'flex' : 'none');
    $('#current-tuner-location').css('display', currentMarker.countryName !== null ? 'block' : 'none');
    $('#current-tuner-city').text(currentMarker.city);
    $('#current-tuner-sponsor-url').css('display', currentMarker.sponsor_url.length > 0 ? 'block' : 'none');
    $('#current-tuner-sponsor-url').attr('href', currentMarker.sponsor_url);
    $('#current-tuner-sponsor-image').attr('src', currentMarker.sponsor_image);
    $('#current-tuner-sponsor-image').attr('alt', currentMarker.sponsor_url);
    $('#current-tuner-sponsor-image').attr('title', currentMarker.sponsor_url);
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

    $('#current-tuner-device').text(currentMarker.tuner ? (tunerDevices[currentMarker.tuner] || 'TEF668x') : 'Unknown');

    $('#current-tuner-limits').text(currentMarker.bwLimit?.length > 1 ? currentMarker.bwLimit : 'None');
    currentMarker.version ? $('#current-tuner-version').text('FM-DX Webserver v' + currentMarker.version) : null;
    currentMarker.contact?.length > 0 ? $('#current-tuner-contact').text(currentMarker.contact) : $('#current-tuner-contact').text('No contact available.');
    if (currentMarker.os.includes("Linux") || currentMarker.os.includes("Windows") || currentMarker.os.includes("Darwin")) {
        function getOsIcon(os) {
            if (os.includes("Linux")) {
                return '<i class="fab fa-linux"></i> ';
            } else if (os.includes("Darwin")) {
                return '<i class="fab fa-apple"></i> ';
            } else {
                return '<i class="fab fa-windows"></i> ';
            }
        }
        
        const icon = getOsIcon(currentMarker.os);
        
        currentMarker.os?.length > 0 
            ? $('#current-tuner-version').append('<br>[', icon, document.createTextNode(currentMarker.os), ']')
            : null;
    }    

    $('#current-tuner-bitrate').text(currentMarker.audioQuality);

    $('.current-tuner-link').find('span').text(currentMarker.url);
    $('.current-tuner-link').attr('href', currentMarker.url);
    $('.panel-current-connect').attr('class', 'panel-current-connect tuner-status-' + currentMarker.status);

    parseMarkdown();

    $('.panel').addClass('open');
    $('.panel-content-all').removeClass('open');
    $('.panel-content-current').addClass('open');
}

// Function to style the GeoJSON layer
function style() {
    return {
        fillColor: '#555',
        weight: 3.5,
        opacity: 1,
        color: '#222',
        fillOpacity: 1
    };
}

let isMarkerHovered = false; // Flag to indicate if a marker is hovered
let hoveredCountry = null;

// Function to highlight countries on hover (tooltip is bound once in onEachFeature)
function highlightFeature(e) {
    hoveredCountry = e.target;
    e.target.setStyle({
        weight: 5,
        dashArray: '',
        fillOpacity: 0.7,
    });
}

function resetHighlight(e) {
    if (hoveredCountry === e.target) hoveredCountry = null;
    if (!isMarkerHovered) {
        geojsonLayer.resetStyle(e.target);
    }
}

function getCountryCode(props) {
    const countryCode = props["ISO3166-1-Alpha-2"];
    // some countries dont have a code, so we gotta check the full names
    return (!countryCode || countryCode === -99) ? (countryNameToISO[props.name] || 'unknown') : countryCode;
}

function onCountryClick(e) {
    const countryCode = getCountryCode(e.target.feature.properties);

    filterTuners(countryCode, 'country');
    $('#tuner-search').val('Country: ' + countryCode);
    if (!$('.panel').hasClass('open')) {
        openMenu();
    } else {
        $('.panel-content-current').removeClass('open');
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
            zoomDelta: 1,
            preferCanvas: true // draw country polygons on one canvas instead of thousands of SVG paths
        });

        var bounds = L.latLngBounds([
            [-90, -250], // South-West coordinates
            [90, 250]    // North-East coordinates
        ]);

        map.setMaxBounds(bounds);

        map.getContainer().addEventListener('mousemove', function (e) {
            if (hoveredCountry && hoveredCountry.isTooltipOpen()) {
                hoveredCountry.getTooltip().setLatLng(map.mouseEventToLatLng(e));
            }
        });

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

    fetch('countries.pbf')
        .then(response => response.arrayBuffer())
        .then(buf => {
            const geojsonData = geobuf.decode(new Pbf(buf));

            if (geojsonLayer) {
                map.removeLayer(geojsonLayer);
            }

            const serversPerCountry = {};
            tuners.forEach(tuner => {
                const code = String(tuner.country ?? '').toLowerCase();
                serversPerCountry[code] = (serversPerCountry[code] || 0) + 1;
            });

            geojsonLayer = L.geoJson(geojsonData, {
                style: style,
                onEachFeature: function (feature, layer) {
                    const code = String(getCountryCode(feature.properties)).toLowerCase();
                    const count = serversPerCountry[code] || 0;
                    layer.bindTooltip(`<div class="tuner-tooltip-flag fi fi-${escapeHtml(code)}"></div>
                        <h2>${escapeHtml(String(feature.properties.name ?? ''))}</h2>
                        <p>${count ? count + (count === 1 ? ' server' : ' servers') : 'No servers'}</p>`, {
                        sticky: true,
                        direction: 'top',
                        className: 'tuner-tooltip country-tooltip'
                    });
                    layer.on({
                        mouseover: highlightFeature,
                        mouseout: resetHighlight,
                        click: onCountryClick
                    });
                }
            }).addTo(map);

            const statusTypes = ["0", "1", "2", "unknown"];
            statusTypes.forEach(status => {
                const clusterGroup = L.markerClusterGroup({
                    maxClusterRadius: 8,
                    iconCreateFunction: function(cluster) {
                        return L.divIcon({
                            html: `<div class="marker marker-status-${status} flex-center" style="font-family: 'Titillium Web'">${cluster.getChildCount()}</div>`,
                            className: `marker marker-status-${status} flex-center`,
                            iconSize: [24, 24],
                            tooltipAnchor: [0, -20]
                        });
                    }
                });

                clusterGroup.on('clustermouseover', function(event) {
                    const cluster = event.layer;
                    const childMarkers = cluster.getAllChildMarkers();
                    const namesList = childMarkers
                        .map(marker => marker.options.tuner && marker.options.tuner.name)
                        .filter(name => name)
                        .map(escapeHtml)
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
                                iconAnchor: [8, 8],
                                tooltipAnchor: [-2, -16]
                            }),
                            tunerStatus: tuner.status,
                            tuner: tuner,
                            keyboard: false
                        });

                        const e = v => escapeHtml(String(v ?? ''));
                        const details = [tuner.city, tuner.tuner ? (tunerDevices[tuner.tuner] || 'TEF668x') : null].filter(Boolean).map(e).join(' · ');
                        marker.bindTooltip(`<div class="tuner-tooltip-flag fi fi-${e(tuner.country)}"></div>
                            ${tuner.sponsor_image ? `<img class="tuner-tooltip-sponsor" src="${e(tuner.sponsor_image)}" alt="">` : ''}
                            <div>
                                <h2>${e(tuner.name)}</h2>
                                ${details ? `<p>${details}</p>` : ''}
                                ${isSupporter ? '<p class="tuner-tooltip-supporter"><i class="fa-solid fa-star"></i> Supporter</p>' : ''}
                            </div>`, {
                            permanent: false,
                            direction: 'top',
                            className: 'tuner-tooltip tuner-status-' + e(tuner.status)
                        });

                        marker.on('click', function () {onTunerClick(index);});
                        marker.on('mouseover', function () {isMarkerHovered = true;});
                        marker.on('mouseout', function () {isMarkerHovered = false;});

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
            populateTunerList(tunersOnline);

            hideLoader();

            if (countryCode) {
                zoomToCountry(countryCode.toUpperCase(), geojsonData);
            }
        })
        .catch(error => console.error('Error fetching GeoJSON data:', error));
}

function filterMarkers() {
    // Collect changes per group, then apply them in one batch (one re-cluster per group instead of per marker)
    const changes = new Map();
    allMarkers.forEach(({ marker, clusterGroup }) => {
        const status = marker.options.tunerStatus;
        const shouldShow = !((hideAvailable && status === 1) || (hideLocked && status === 2) || (hideUnreachable && status === 0));

        if (!changes.has(clusterGroup)) changes.set(clusterGroup, { add: [], remove: [] });
        const isShown = clusterGroup.hasLayer(marker);
        if (shouldShow && !isShown) changes.get(clusterGroup).add.push(marker);
        if (!shouldShow && isShown) changes.get(clusterGroup).remove.push(marker);
    });
    changes.forEach(({ add, remove }, clusterGroup) => {
        if (remove.length) clusterGroup.removeLayers(remove);
        if (add.length) clusterGroup.addLayers(add);
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
        "FR": [[41.3, -5.14], [51.1, 9.66]], // Mainland France
        "US": [[24.4, -125.0], [49.4, -66.9]] // Contiguous USA (excludes Alaska, Hawaii, territories)
    };

    if (mainlandBounds[countryCode]) {
        const bounds = mainlandBounds[countryCode];
        map.fitBounds(bounds);

        filterTuners(countryCode.toLowerCase(), 'country');
        $('#tuner-search').val('Country: ' + countryCode);

        openMenu();
    } else {
        geojsonData.features.forEach(feature => {
            if (feature.properties["ISO3166-1-Alpha-2"] === countryCode) {
                const bounds = L.geoJSON(feature).getBounds();
                map.fitBounds(bounds);

                filterTuners(countryCode.toLowerCase(), 'country');
                $('#tuner-search').val('Country: ' + countryCode);

                openMenu(); 
            }
        });
    }
}