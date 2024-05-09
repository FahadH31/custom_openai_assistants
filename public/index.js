$(document).ready(function () {
    $('#uploadFile').change(function () {
        $('#uploadLinks').prop('required', false); // Disable URL input
    });

    $('#uploadLinks').change(function () {
        $('#uploadFile').prop('required', false); // Disable file input
    });

    // Ensure data options are selected appropriately before form submission
    $('form').submit(function () {
        if (!$('#uploadFile').val() && !$('#uploadLinks').val()) {
            alert('Please choose either a file or provide a URL.');
            return false; // Prevent form submission
        }
        else if ($('#uploadFile').val() && $('#uploadLinks').val()) {
            alert('Please provide only a URL, or only a file.');
            return false; // Prevent form submission
        }
    });
});