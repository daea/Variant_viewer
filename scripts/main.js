// Matthew Cumming - Provart Lab
// Summer 2018
// Sample Datasets for testing

alert("main is loaded");

var AGI_URL = "http://bar.utoronto.ca/eplant/cgi-bin/idautocomplete.cgi?species=Arabidopsis_thaliana&term=ABI3";
var DEFAULT_AGIS = "http://localhost:8000/web-projects/variant-viewer/scripts/data.json";

var agis;

$(document).ready(function() {
	
	$.get(DEFAULT_AGIS, function (data) {
		$('.agiSelector').select2({
			delay: 250,
			placeholder: "Start typing an AGI",
			minimumInputLength: 3,
			data: formatOptions(data),
			tags: true// default list to show 
		});
	});

	// To get the selected values in the <select>
	$('#sendAgis').click(function() {
		var inputted = $('.agiSelector').select2('data');	
		console.log(inputted);
		var submission = formatSelected(inputted);
		console.log(submission);
	});


	
});


function formatOptions(rawData) {
	var formattedData = [];
	for(var i = 0; i < rawData.length; i++) {
		formattedData.push({"id": i + 1, "text": rawData[i]});
	};
	console.log(formattedData);
	return formattedData;
	
}


function formatSelected(selected) {
	var submitArguments = [];
	for(var i=0; i< selected.length; i++) {
		var agi = selected[i].text.split("/")[0];
		if (verifyAgi(agi) === true) {
			submitArguments.push(selected[i].text.split("/")[0]);
		} else if (verifyAgi === false) {
			alert(agi + ": was not formatted correctly");
		}
	return submitArguments.join(',');
	}
}

function verifyAgi(agiId) {
	var re = /AT[0-9]G[0-9]+[.]?[0-9]?/;
	var result = re.test(agiId);
	return result;
}

/AT[0-9]G[0-9]+[.]?[0-9]?/
/*
(function ($) {
	$.fn.refreshDataSelect2 = function (data) {
		this.select2('data', data);
		// Update options
		var $select = $(this[1]);
		var options = data.map(function(item) {
			return '<option value="' + item.id + '">' + item.text + '</option>';
		});
        $select.html(options.join('')).change();
	};
})(jQuery);
*/
