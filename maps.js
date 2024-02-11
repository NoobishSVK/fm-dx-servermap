
/**
 * status: 2 = locked
 * status: 1 = unreachable
 * status: 0 = online
 */

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
    });

    function filterTuners(searchTerm) {
        $('.tuner').each(function () {
            const tunerName = $(this).find('.tuner-basic-info h2').text();
            if (tunerName.toLowerCase().includes(searchTerm.toLowerCase())) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    }

    // Add event listener to the search input
    $('#tuner-search').on('input', function () {
        const searchTerm = $(this).val();
        filterTuners(searchTerm);
    });
});

function getTuners() {
    $.get("https://list.fmdx.pl/api/", function(data) {
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

        $("#receivers-online-count").text(tunersOnline.length);
    });
}

function initMap (tunersOnline) {
    markers = tunersOnline.map(tuner => {
        let fillColor;
        switch (tuner.status) {
            case 0:
            default:
                fillColor = '#ffa500'; // Orange
                break;
            case 1:
                fillColor = '#32cd32'; // Green
                break;
            case 2:
                fillColor = '#ff5733'; // Red
                break;
        }

        return {
            name: tuner.name,
            coords: tuner.coords,
            desc: tuner.desc,
            url: tuner.url,
            audioChannels: tuner.audioChannels,
            audioQuality: tuner.audioQuality,
            country: tuner.country,
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
        markers: markers,
        markersSelectableOne: true,
        backgroundColor: '#333',
        regionStyle: {
            initial: {
                fill: '#666'
            }
        },
        onRegionTooltipShow(event, tooltip, code) {
            event.preventDefault();
            tooltip.hide();
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
    $('#current-tuner-link').attr('href', currentMarker.url);

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

    var breakLineRegex = /\\n/g;
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
