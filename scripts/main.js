//Matthew Cumming - Provart Lab
// Summer 2018
// Sample Datasets for testing


var AGI_URL = "http://bar.utoronto.ca/eplant/cgi-bin/idautocomplete.cgi?species=Arabidopsis_thaliana&term=";
var queryAgis = [];

// Document is loaded?
window.addEventListener("load", function() {
	
	// global hint object for autocomplete dropdown
	window.hinterXHR = new XMLHttpRequest();
	window.graphXHR = new XMLHttpRequest();
	// my input field
	var agi_input = document.getElementById('agiInput');
	agi_input.addEventListener("keyup", function(event) {hinter(event)});

	// add genes to queryAgis
	var add_gene = document.getElementById('addAgi');
	add_gene.addEventListener('click', function(event) {addGene(agi_input)});

	// remove genes from queryAgis
	var activeGenes = document.getElementById('addedGenes');
	activeGenes.addEventListener("click", (event) => {
		if (event.target.nodeName == 'A') {	
			queryAgis = queryAgis.filter(function(e) { return e !== event.target.id });
			document.getElementById(event.target.id).parentElement.remove();
			if (queryAgis.length == 0) {
			activeGenes.innerHTML = '<li class="list-group-item">You have not added any genes yet</li>';
			};
		} else {
			console.log("Not finding the element");
		};	
	});
	
	var input_panel = document.getElementById("inputPanel");
	input_panel.addEventListener("click", (event) => {
		if (event.target.nodeName == 'BUTTON' && event.target.id == 'sendAgis') {
			submitAgis(queryAgis);	
		} else {
				console.log("Can't find the submit button");
		};
	});


});

// the autocomplete part
function hinter(event) {
	// this is our input field
	var input = event.target;
	// this is the datalist element (options)
	var huge_list = document.getElementById('huge_list');
	// minimum number of characters typed into the field
	var min_characters = 2;
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
			if (this.readyState == 4 && this.status == 200) {

				// create a JSON response object
				var response = JSON.parse( this.responseText );

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
	};
}


function validateForm() {
	// Get the input element
	var input = document.getElementById('agiInput');
	// Get the datalist
	var huge_list = document.getElementById('huge_list');

	// If we find the input inside out list, we submit the form
	for (var element of huge_list.children) {
		if (element.value == input.value) {		
			return true;
			addGene(element.value);
		}
	alert("name input is invalid");
	return false;
	}
}


function addGene(input) {
	var addedGenes = document.getElementById('addedGenes');	
	console.log(input.value.length);	
	if ( queryAgis.length >= 10) {
	
		alert("You have entered the maximum number of genes.");
	
	} else if ( queryAgis.includes(input.value) == true) {
	
		alert("That gene is already included in the list.");
	
	} else if ( input.value.length == 0) {
	
		alert("Please enter a gene in the search box.");
	
	} else if ( queryAgis.length == 0 && input.value.length != 0) {
	
		addedGenes.innerHTML = '';	
		createListElement(input);
		queryAgis.push(input.value);
		addSubmitButton();
	
	} else if ( queryAgis.length < 10 && input.value.length != 0) {
	
		createListElement(input);		
		queryAgis.push(input.value);
	} else {
		alert("The gene could not be successfully added to the list.");
	};
	

	console.log(queryAgis);
}


function createListElement(input) {
	var Agi = document.createElement("li");
	Agi.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
	//Agi.classList.add("list-group-item-dark");
	// add text to the list itm
	Agi.appendChild(document.createTextNode(input.value));
	Agi.innerHTML += "<a href='#' id='" + input.value + "' class='badge badge-pill badge-danger'>Remove</a>";
	// add the item as an element to the addedGenes <ul>
	addedGenes.appendChild(Agi);
}



function addSubmitButton() {
	var exists = document.getElementById('sendAgis');
	if (typeof(exists) == "object" && exists == null) {
		var input_panel = document.getElementById("inputPanel");
		var submitAgis = document.createElement("button");
		submitAgis.id = "sendAgis";
		submitAgis.type = "submit";
		submitAgis.classList.add("btn", "btn-secondary");
		submitAgis.innerHTML = "Submit";
		input_panel.appendChild(submitAgis);
	};
}

function submitAgis(Agis) {
	var listedAgis = [];
	for (var i=0; i < Agis.length; i++) {
		listedAgis.push(extractId(Agis[i]));
	};
	window.graphXHR.abort();
	window.graphXHR.onreadystatechange = function () {
		if (this.readyState == 4 && this.status == 200) {
			// do stuff with our php response
			console.log("The POST request worked.");
		}; 
	};
	window.graphXHR.open("POST", PHP_URL, true);
	window.graphXHR
}

function extractId(value) {
	var re = /^AT[0-9]G[0-9]+[.]?[0-9]?/i;	
	var match = re.exec(value);
	return(match[0]);
}

// Gene Structure Drawing in 
// Eplant.views.GeneInfoView.js
// Lines 99 - 483
