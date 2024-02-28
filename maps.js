let tunersOnline = [];

$(document).ready(function () {

    getTuners();
    const panel = $('.panel');
    const tunerList = $('.panel-content-all');
    const currentTuner = $('.panel-content-current');

    $(".panel-sidebar").on("click", function () {
        if(currentTuner.hasClass('open')) {
            currentTuner.removeClass('open');
            tunerList.addClass('open');
        } else {
            panel.removeClass('open');
            tunerList.removeClass('open');
        }
    });

    $("#open-all-tuners").on("click", function () {
        $('.panel').addClass('open');
        $('.panel-content-current').removeClass('open');
        $('.panel-content-all').addClass('open');
        $('#tuner-search').val('');
        filterTuners("");
    });

    // Add event listener to the search input
    $('#tuner-search').on('input', function () {
        const searchTerm = $(this).val();
        filterTuners(searchTerm, 'name');
    });
});

function getTuners() {
    $.get("https://list.fmdx.pl/api/", function(data) {
    //$.get("./data.json", function(data) { // DEBUGGING PURPOSES
        tunersOnline = ('dataset' in data) ? data['dataset'] : [];
        initMap(tunersOnline);

        tunersOnline.forEach((tuner, index) => {
            tunerInfo = `<div class="tuner" data-index="${index}">
            <div class="tuner-flag"><span class="fi fi-${tuner.country}"></span></div>
                <div class="tuner-basic-info">
                    <h2>${tuner.name}</h2>
                    <p>${tuner.url}</p>
                </div>
                <div class="tuner-status"><div class="tuner-status-${tuner.status}"></div></div>
            </div>`;
            $('.tuner-list').append(tunerInfo);
        });

        $('.tuner').on('click', function () {
            const index = $(this).data('index');
            const marker = markers[index];
            const event = {
                preventDefault: function () {},
                stopPropagation: function () {}
            };
            onTunerClick(event, index);
        });

            
        var isDragging = false;

        $(".jvm-region").on("mousedown", function() {
            isDragging = false;
        }).on("mousemove", function() {
            isDragging = true;
        }).on("mouseup", function(event) {
            if (!isDragging) {
                var clickedElement = $(this);
                const searchBar = $('#tuner-search');
                searchBar.val('Country: ' + clickedElement.attr('data-code'));
                filterTuners(clickedElement.attr('data-code'), 'country');
                if (!$('.panel').hasClass('open')) {
                    $('#open-all-tuners').trigger('click');
                } else {
                    $('.panel-content-current').removeClass('open');
                    $('.panel-content-all').addClass('open');
                }
            }
        });             

        $("#receivers-online-count").text(tunersOnline.length);
    });
}

function filterTuners(searchTerm, type) {
    let searchData;
    $('.tuner').each(function () {
        
        if(type && type == 'country') {
            searchData = $(this).find('.tuner-flag span').attr('class');
        } else {
            searchData = $(this).find('.tuner-basic-info h2').text();
        }
        if (searchData.toLowerCase().includes(searchTerm.toLowerCase())) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
}

function initMap (tunersOnline) {
    /**
     * status: 2 = locked
     * status: 1 = unreachable
     * status: 0 = online
     */

    let processedCoordinates = [];

    markers = tunersOnline.map(tuner => {
        let fillColor;
        switch (tuner.status) {
            case 0:
            default:
                fillColor = '#ffee00'; // Orange
                break;
            case 1:
                fillColor = '#21bf63'; // Green
                break;
            case 2:
                fillColor = '#ff4747'; // Red
                break;
        }
    
        // Convert latitude and longitude to numbers
        const latitude = parseFloat(tuner.coords[0]);
        const longitude = parseFloat(tuner.coords[1]);
    
        // Adjust coordinates if necessary
        let newLatitude = latitude;
        let newLongitude = longitude;
    
        // Check for nearby markers
        for (const coord of processedCoordinates) {
            const [prevLat, prevLon] = coord;
            const latDiff = Math.abs(prevLat - latitude);
            const lonDiff = Math.abs(prevLon - longitude);
            if (latDiff < 0.075 && lonDiff < 0.075) {
                const randomDirection = Math.random() < 0.5 ? -1 : 1;
                const randomOffset = Math.random() * 0.075 * randomDirection;
                newLatitude = prevLat + randomOffset;
                newLongitude = prevLon + (0.075 - Math.abs(randomOffset)) * (Math.random() < 0.5 ? -1 : 1);
                break;
            }
        }
    
        processedCoordinates.push([newLatitude, newLongitude]);
    
        return {
            name: tuner.name,
            coords: [newLatitude.toString(), newLongitude.toString()],
            desc: tuner.desc,
            url: tuner.url,
            audioChannels: tuner.audioChannels,
            audioQuality: tuner.audioQuality,
            country: tuner.country,
            contact: tuner.contact,
            style: {
                fill: fillColor
            }
        };
    });
    
    const map = new jsVectorMap({
        selector: '#map',
        map: 'world',
        zoomOnScroll: true,
        zoomButtons: true,
        draggable: true,
        zoomMax: 48,
        markers: markers,
        markersSelectableOne: true,
        backgroundColor: '#262626',
        regionStyle: {
            initial: {
                fill: '#555',
                stroke: '#555',
                'stroke-width': 0.3,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
            }
        },
        onRegionTooltipShow(event, tooltip, code) {
        },
        onMarkerClick(event, markerIndex) {
            onTunerClick(event, markerIndex);
            
        },
        onMarkerTooltipShow(event, tooltip, markerIndex){
            const currentMarker = markers[markerIndex];
            const markerName = currentMarker.name || "Unknown";
            tooltip.text(
                `<h3>${markerName}</h3>`,
                true // Enables HTML
            );
        },
    });
}

function onTunerClick(event, markerIndex) {
    const currentMarker = markers[markerIndex];

    $('#current-tuner-country').html('<span class="fi fi-'+ currentMarker.country + '"></span>')
    $('#current-tuner-name').text(currentMarker.name);
    $('#current-tuner-desc').text(currentMarker.desc);
    $('#current-tuner-channels').text(currentMarker.audioChannels);
    $('#current-tuner-bitrate').text(currentMarker.audioQuality);
    if(currentMarker.contact?.length > 0) {
        $('#current-tuner-contact').text(currentMarker.contact);
    }
    $('.current-tuner-link').find('span').text(currentMarker.url);
    $('.current-tuner-link').attr('href', currentMarker.url);

    parseMarkdown();

    $('.panel').addClass('open');
    $('.panel-content-all').removeClass('open');
    $('.panel-content-current').addClass('open');
}

function parseMarkdown() {
    var input = escapeHtml($("#current-tuner-desc").text());
    var parsed = input;

    var grayTextRegex = /--(.*?)--/g;
    parsed = parsed.replace(grayTextRegex, '<span class="text-gray">$1</span>');

    var boldRegex = /\*\*(.*?)\*\*/g;
    parsed = parsed.replace(boldRegex, '<strong>$1</strong>');

    var italicRegex = /\*(.*?)\*/g;
    parsed = parsed.replace(italicRegex, '<em>$1</em>');

    var breakLineRegex = /\n/g;
    parsed = parsed.replace(breakLineRegex, '<br>');

    $("#current-tuner-desc").html(parsed);
}

function escapeHtml(text) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
