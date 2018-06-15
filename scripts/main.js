//Matthew Cumming - Provart Lab
// Summer 2018
// Sample Datasets for testing


var AGI_URL = "http://bar.utoronto.ca/eplant/cgi-bin/idautocomplete.cgi?species=Arabidopsis_thaliana&term=";
var queryAgis = [];

// Document is loaded?
window.addEventListener("load", function() {
	
	// my input field
	var agi_input = document.getElementById('agiInput');
	
	// when a user lifts a key, trigger the hinter() function
	agi_input.addEventListener("keyup", function(event) {hinter(event)});

	// when a user clicks addGenes trigger the addGene function
	var add_gene = document.getElementById('addAgi');
	add_gene.addEventListener('click', function(event) {addGene(agi_input)});

	// global XMLHttpRequest (json request) object
	window.hinterXHR = new XMLHttpRequest();

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
		}
	});
	
});

// the autocomplete part
function hinter(event) {
	// this is our input field
	var input = event.target;
	// this is the datalist element (options)
	var huge_list = document.getElementById('huge_list');
	// minimum number of characters typed into the field
	var min_characters = 5;
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
	}
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
	if (queryAgis.length == 0) {
		addedGenes.innerHTML = '';	
		createListElement(input);
		queryAgis.push(input.value);
		addSubmitButton();
	} else if (queryAgis.length == 10) {
		alert("You have entered the maximum number of genes.");
	} else if (queryAgis.includes(input.value) == true) {
		alert("That gene is already included in the list.");
	} else	{
		createListElement(input);		
		queryAgis.push(input.value);
	}
	console.log(queryAgis);	
}


function createListElement(input) {
	var Agi = document.createElement('li');
	Agi.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
	//Agi.classList.add("list-group-item-dark");
	// add text to the list itm
	Agi.appendChild(document.createTextNode(input.value));
	Agi.innerHTML += "<a href='#' id='" + input.value + "' class='badge badge-pill badge-danger'>Remove</a>";
	// add the item as an element to the addedGenes <ul>
	addedGenes.appendChild(Agi);
}

function addSubmitButton() {
	var input_panel = document.getElementById('inputPanel');
	var submitAgis = document.createElement('button');
	submitAgis.type = 'submit';
	submitAgis.classList.add("btn", "btn-secondary");
	submitAgis.innerHTML = 'Submit';
	input_panel.appendChild(submitAgis);
}
