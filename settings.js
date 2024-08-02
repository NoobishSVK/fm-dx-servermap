/**
* Themes
* @param main color
* @param main-bright color
* @param text color
* @param background filter color
*/
const themes = {
    theme1: [ 'rgb(32, 34, 40)', 'rgb(88, 219, 171)', 'rgb(255, 255, 255)', 'rgb(11, 12, 14)' ], // Retro (Default)
    theme2: [ 'rgb(21, 32, 33)', 'rgb(203, 202, 165)', 'rgb(255, 255, 255)', 'rgb(7, 11, 12)' ], // Cappuccino
    theme3: [ 'rgb(18, 18, 12)', 'rgb(169, 255, 112)', 'rgb(255, 255, 255)', 'rgb(6, 6, 4)' ], // Nature
    theme4: [ 'rgb(12, 28, 27)', 'rgb(104, 247, 238)', 'rgb(255, 255, 255)', 'rgb(4, 10, 9)' ], // Ocean
    theme5: [ 'rgb(23, 17, 6)', 'rgb(245, 182, 66)', 'rgb(255, 255, 255)', 'rgb(8, 6, 2)' ], // Terminal
    theme6: [ 'rgb(33, 9, 29)', 'rgb(250, 82, 141)', 'rgb(255, 255, 255)', 'rgb(12, 3, 10)' ], // Nightlife
    theme7: [ 'rgb(13, 11, 26)', 'rgb(128, 105, 250)', 'rgb(255, 255, 255)', 'rgb(5, 4, 7)' ], // Blurple
    theme8: [ 'rgb(252, 186, 3)', 'rgb(0, 0, 0)', 'rgb(0, 0, 0)', 'rgb(252, 186, 3)' ], // Construction
    theme9: [ 'rgb(0, 0, 0)', 'rgb(204, 204, 204)', 'rgb(255, 255, 255)', 'rgb(0, 0, 0)' ], // AMOLED
    none: [ 'rgb(0, 0, 0)', 'rgb(204, 204, 204)', 'rgb(255, 255, 255)', 'rgb(0, 0, 0)' ],
};

// Signal Units
const signalUnits = {
    dbf: ['dBf'],
    dbuv: ['dBµV'],
    dbm: ['dBm'],
};

$(document).ready(() => {
    const themeSelector = $('#theme-selector');
    const savedTheme = localStorage.getItem('theme');
    const savedUnit = localStorage.getItem('signalUnits');
    
    if (savedTheme && themes[savedTheme]) {
        setTheme(savedTheme);
        themeSelector.find('input').val(themeSelector.find('.option[data-value="' + savedTheme + '"]').text());
    }
    
    themeSelector.on('click', '.option', (event) => {
        const selectedTheme = $(event.target).data('value');
        setTheme(selectedTheme);
        themeSelector.find('input').val($(event.target).text()); // Set the text of the clicked option to the input
        localStorage.setItem('theme', selectedTheme);
    });
    
    const signalSelector = $('#signal-selector');

    if (localStorage.getItem('signalUnits')) {
        signalSelector.find('input').val(signalSelector.find('.option[data-value="' + savedUnit + '"]').text());
    }
    
    signalSelector.on('click', '.option', (event) => {
        const selectedSignalUnit = $(event.target).data('value');
        signalSelector.find('input').val($(event.target).text()); // Set the text of the clicked option to the input
        localStorage.setItem('signalUnits', selectedSignalUnit);
    });

    /* PS Underscores */
    var psUnderscores = localStorage.getItem("psUnderscores");
    if (psUnderscores) {
        $("#ps-underscores").prop("checked", JSON.parse(psUnderscores));
        localStorage.setItem("psUnderscores", psUnderscores);
    }
    
    $("#ps-underscores").change(function() {
        var isChecked = $(this).is(":checked");
        localStorage.setItem("psUnderscores", isChecked);
    });

    /* Background */
    var noBackground = localStorage.getItem("disableBackground");
    if (noBackground) {
        $("#no-background").prop("checked", JSON.parse(noBackground));
        localStorage.setItem("disableBackground", noBackground);
    }
    
    $("#no-background").change(function() {
        var isChecked = $(this).is(":checked");
        localStorage.setItem("disableBackground", isChecked);
    });

    /* Plugins */
    var noPlugins = localStorage.getItem("noPlugins");
    if (noPlugins) {
        $("#no-plugins").prop("checked", JSON.parse(noPlugins));
        localStorage.setItem("noPlugins", noPlugins);
    }
    
    $("#no-plugins").change(function() {
        var isChecked = $(this).is(":checked");
        localStorage.setItem("noPlugins", isChecked);
    });
    
});

function setTheme(themeName) {
    const themeColors = themes[themeName];
    if (themeColors) {
        // Extracting the RGBA components from themeColors[2] for --color-text-2
        const rgbaComponentsText = themeColors[2].match(/(\d+(\.\d+)?)/g);
        const opacityText = parseFloat(rgbaComponentsText[3]);
        const newOpacityText = opacityText * 0.75;
        const textColor2 = `rgba(${rgbaComponentsText[0]}, ${rgbaComponentsText[1]}, ${rgbaComponentsText[2]})`;

        // Extracting the RGBA components from themeColors[0] for background color
        const rgbaComponentsBackground = themeColors[3].match(/(\d+(\.\d+)?)/g);
        const backgroundOpacity = 0.75;
        const backgroundColorWithOpacity = `rgba(${rgbaComponentsBackground[0]}, ${rgbaComponentsBackground[1]}, ${rgbaComponentsBackground[2]}, ${backgroundOpacity})`;

        $(':root').css('--color-main', themeColors[0]);
        $(':root').css('--color-main-bright', themeColors[1]);
        $(':root').css('--color-text', themeColors[2]);
        $(':root').css('--color-text-2', textColor2);
        $('#wrapper-outer').css('background-color', backgroundColorWithOpacity);
    }
}