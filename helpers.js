
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

    var linkRegex = /\[([^\]]+)]\(([^)]+)\)/g;
    parsed = parsed.replace(linkRegex, '<a href="$2">$1</a>');

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

// Function to check if two coordinates are too close
function isTooClose(lat1, lon1, lat2, lon2, threshold = 0.025) {
    // Simple Euclidean distance approximation
    return Math.abs(lat1 - lat2) < threshold && Math.abs(lon1 - lon2) < threshold;
}

// Function to generate random offsets
function getRandomOffset(maxOffset = 0.025) {
    const offsetLat = (Math.random() - 0.025) * 2 * maxOffset;
    const offsetLon = (Math.random() - 0.025) * 2 * maxOffset;
    return { offsetLat, offsetLon };
}

function filterTuners(searchTerm, type) {
    let anyVisible = false;
    let statusCounts = {
        0: 0, // Unreachable
        1: 0, // Available
        2: 0  // Locked
    };

    $('.tuner').each(function () {
        let searchData;
        if (type && type == 'country') {
            let countryClass = $(this).find('.tuner-flag span').attr('class');
            searchData = countryClass.split('fi-')[1]; // Extract string after "fi-"
        } else {
            searchData = $(this).data('search');
        }

        if (searchData.toLowerCase().includes(searchTerm.toLowerCase())) {
            $(this).show();
            anyVisible = true;

            // Update status counts
            if ($(this).hasClass('tuner-status-0')) {
                statusCounts[0]++;
            } else if ($(this).hasClass('tuner-status-1')) {
                statusCounts[1]++;
            } else if ($(this).hasClass('tuner-status-2')) {
                statusCounts[2]++;
            }            
        } else {
            $(this).hide();
        }
    });

    if (!anyVisible) {
        $('.no-content').show();
    } else {
        $('.no-content').hide();
    }

    // Update the status counts in the table
    $('.status0-count').text(statusCounts[0]);
    $('.status1-count').text(statusCounts[1]);
    $('.status2-count').text(statusCounts[2]);
}
