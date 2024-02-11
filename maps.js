
/**
 * status: 2 = locked
 * status: 1 = unreachable
 * status: 0 = online
 */

let tunersOnline = [];

/*const tunersOnline = [{
    name: 'Noobish\'s Tuner',
    coords: [50.356694, 15.924528],
    url: 'http://xdr.noobish.eu:42069',
    desc: 'QTH: Jaroměř, CZE 🇨🇿 [250m ASL]\n H: Körner 19.4 • V: 5 element yagi',
    audioChannels: '2',
    audioQuality: '192k',
    country: 'cz',
    status: 0 
}, {
    name: 'PE5PVB\'s online TEF6687 ',
    coords: [51.574589, 5.176961],
    url: 'http://pe5pvb.ddns.net:8888',
    desc: ',.-~´¨¯¨`·~-.¸-(_Oisterwijk - NL)_)-,.-~´¨¯¨`·~-.¸',
    audioChannels: '2',
    audioQuality: '192k',
    country: 'nl',
    status: 0 
}, {
    name: 'Płock',
    coords: [52.552625, 19.739757],
    url: 'http://konrad.fmdx.pl/tuner/',
    desc: '( ͡°( ͡° ͜ʖ( ͡° ͜ʖ ͡°)ʖ ͡°) ͡°)',
    audioChannels: '2',
    audioQuality: '192k',
    country: 'pl',
    status: 0 
}, {
    name: 'TGCFabian/NL13999 TEF6686 ',
    coords: [52.516808,6.083048],
    url: 'https://teftuner.tgcfabian.nl/',
    desc: 'Zwolle - The Netherlands | TEF6686 Built by PE5PVB | Antenna at 10M Ish',
    audioChannels: '2',
    audioQuality: '192k',
    country: 'nl',
    status: 0 
}, {
    name: 'NO2CW \'s TEF6686 Server ',
    coords: [26.004956,-80.372277],
    url: 'http://qsl.ddns.net:8080/',
    desc: 'Miami area FM Dial Vert Fld Dpl',
    audioChannels: '2',
    audioQuality: '192k',
    country: 'us',
    status: 0 
}, {
    name: 'hdx - Poznań',
    coords: [52.390013,16.894183],
    url: 'https://s5.fmdx.pl/tuner/',
    desc: 'test web server @ TEF6687',
    audioChannels: '2',
    audioQuality: '192k',
    country: 'pl',
    status: 0 
}, {
    name: 'Janovice FM DX',
    coords: [49.604974489069896,18.390792964717793],
    url: 'https://test.fm-tuner.nl/janovice/',
    desc: 'QTH: Janovice CZE [400m ASL] H: 7-EL Supersonic style | V: 3-el yagi ',
    audioChannels: '2',
    audioQuality: '192k',
    country: 'cz',
    status: 0 
}];*/

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

    $('.tuner').on('click', function () {
        const index = $(this).data('index');
        const marker = markers[index];
        const event = {
            preventDefault: function () {},
            stopPropagation: function () {}
        };
        onTunerClick(event, index);
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
    
        $("#receivers-online-count").text(tunersOnline.length);
        initMap();
    });
}

function initMap (tunersOnline) {
    markers = tunersOnline.map(tuner => {
        let fillColor;
        switch (tuner.status) {
            case 2:
                fillColor = '#ff5733'; // Red
                break;
            case 0:
                fillColor = '#ffa500'; // Orange
                break;
            case 1:
            default:
                fillColor = '#32cd32'; // Green
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

    $('.panel').addClass('open');
    $('.panel-content-all').removeClass('open');
    $('.panel-content-current').addClass('open');
}
