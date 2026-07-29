$("#open-details").on("click", function () {
    $(".details-tab").slideToggle(250);

    $(".openradio-logo").toggleClass("open");
    $(this).toggleClass("open");
});