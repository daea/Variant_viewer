//Matthew Cumming - Provart Lab
// Summer 2018
// Sample Datasets for testing

//alert("main is loaded");

var AGI_URL = "http://bar.utoronto.ca/eplant/cgi-bin/idautocomplete.cgi?species=Arabidopsis_thaliana&term=";

var mySource = ["At1G34000.1", "AT2G49720.1", "AT1G45249.1"];

// Document is loaded?
window.addEventListener("load", function() {
	
	// my input field
	var agi_input = document.getElementById('agiInput');
	
	// when a user lifts a key, trigger the hinter() function
	agi_input.addEventListener("keyup", function(event) {hinter(event)});

	// global XMLHttpRequest (json request) object
	window.hinterXHR = new XMLHttpRequest();
});

// the autocomplete part
function hinter(event) {
	// this is our input field
	var input = event.target;
	// this is the datalist element (options)
	var huge_list = document.getElementById('huge_list');
	// minimum number of characters typed into the field
	var min_characters = 3;
	// check to see how many characters are typed in the box
	
	if (input.value.length < min_characters) {
		return;
	} else {
		// if we are waiting on a request and they type another letter
		// stop that request, (this is the global object we made above)	
		window.hinterXHR.abort();
		
		// callback function
		window.hinterXHR.onreadystatechange = function () {
			// readystate = 0 unsent, 1 = opened, 2 = headers received, 3 = loading
			// 4 means it's done, status 200 means success
			if (this.readystate == 4 && this.status == 200) {

				// create a JSON response object
				var response = JSON.pars( this.responseText );
				
				// empty the datalist element of options
				huge_list.innerHTML = "";

				//iterate over the response object attributes (options)
				response.forEach(function(item) {
					// create an option for each attribute
					var option = document.createElement('option');
					// item is the attribute, set the option value to item
					option.value = item;
					// add a child option to the huge_list element
					huge_list.appendChild(option);
				});
			}
		};
		window.hinterXHR.open("GET", AGI_URL + input.value, true);
		window.hinterXHR.send();
	}
}


					


















/*
$(document).ready(function() {
	
	var myAGIs = new Bloodhound ({
		datumTokenizer: Bloodhound.tokenizers.obj.whitespace,
		queryTokenizer: Bloodhound.tokenizers.whitespace,
		local: mySource
	});
	console.log(myAGIs);	
	
	$('#AGItypeahead').typeahead({
		hint: true,
		minLength: 1, 
		highlight: true
	},
	{
		name: 'mySource',
		source: myAGIs
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

// Regular expression for AGI's /AT[0-9]G[0-9]+[.]?[0-9]?/
*/
