/* Main flow control
 * App: Variant viewer
 * Author: Matt Cumming
 * Date: June 2018
*/


// Request URLs
var AGI_URL = "http://bar.utoronto.ca/eplant/cgi-bin/idautocomplete.cgi?species=Arabidopsis_thaliana&term=";
var PHP_URL = "scripts/plotVariants.php?locus=";

// Global AGI list
var queryAgis = [];

// Main Flow Control
window.addEventListener("load", function() {
	
	// global XHR object for autocomplete/ graphing
	window.hinterXHR = new XMLHttpRequest();
	window.graphXHR = new XMLHttpRequest();
	window.dataXHR = new XMLHttpRequest();

	// my autocomplete input field
	var agi_input = document.getElementById('agiInput');
	agi_input.addEventListener("keyup", function(event) {hinter(event)});

	// add genes to queryAgis
	var add_gene = document.getElementById('addAgi');
	add_gene.addEventListener('click', function(event) {addGene(agi_input)});

	// remove genes from queryAgis
	var activeGenes = document.getElementById('addedGenes');
	activeGenes.addEventListener("click", function(event) {removeGene(event)});
	
	var input_panel = document.getElementById("inputPanel");
	input_panel.addEventListener("click", function(event) {submitAgis(event)});

});

// Autocomplete function
function hinter(event) {
	var input = event.target;
	var huge_list = document.getElementById('huge_list');
	var min_characters = 2;
	if (input.value.length < min_characters) {
		return;
	} else {
		window.hinterXHR.abort();
		window.hinterXHR.onreadystatechange = function () {
			if (this.readyState == 4 && this.status == 200) {

				var response = JSON.parse( this.responseText );
				huge_list.innerHTML = "";
				response.forEach(function(item) {
					var option = document.createElement('option');
					option.value = item;
					huge_list.appendChild(option);
				});
			}
		};
		window.hinterXHR.open("GET", AGI_URL + input.value, true);
		window.hinterXHR.send();
	};
}

// Make sure that the selected AGI is from the list
// Might remove this to all splice isoforms...
function validateForm() {
	var input = document.getElementById('agiInput');
	var huge_list = document.getElementById('huge_list');
	for (var element of huge_list.children) {
		if (element.value == input.value) {		
			addGene(element.value);
			return true;
		}
	alert("name input is invalid");
	return false;
	}
}

// Add a gene to the Active Genes Panel
function addGene(input) {
	var addedGenes = document.getElementById('addedGenes');	
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
}

// Remove a Gene from the Active Genes Panel
function removeGene (event) {
	var listGroup = document.getElementById(event.target.id).parentElement.parentElement;
	console.log(listGroup);
	if (event.target.nodeName == 'A') {
		queryAgis = queryAgis.filter(function(e) { return e !== event.target.id });
		
		document.getElementById(event.target.id).parentElement.remove();
		if (queryAgis.length == 0) {
			listGroup.innerHTML = '<li class="list-group-item d-flex justify-content-between">You have not added any genes yet</li>';
		};
	} else {
		console.log("Not finding the element");
	};	

}

// Append <li> elements to the parent <ul> node in the Active Genes panel
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

// Only display the Submit button after the User has added one gene
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


// extract AGI ids from submitted AGI and format for submission to plotVariants.php
function extractId(value) {
	var re = /^AT[0-9]G[0-9]+([.]?[0-9]?)/i;
	var match = re.exec(value);
	//console.log(match);
	if (match[1].length > 0) {
		return(match[0].toUpperCase());
	} else {
		return(match[0].toUpperCase() + ".1");
	};
}


// Submit XHR to plotVariants.php backend script
function submitAgis(event) {
		if (event.target.nodeName == 'BUTTON' && event.target.id == 'sendAgis') {
		var listedAgis = [];
		for (var i=0; i < queryAgis.length; i++) {
			listedAgis.push(extractId(queryAgis[i]));
		};
		window.graphXHR.abort();
		window.graphXHR.onreadystatechange = function () {
			if (this.readyState == 4 && this.status == 200) {
			//	console.log("The GET request worked.");
				plots.renderPlots(graphXHR, 'graphPanel');
				
			}; 
		};
		window.graphXHR.responseType = "json";
		window.graphXHR.open("GET", PHP_URL + listedAgis.join(','), true);
		window.graphXHR.send();	
	} else {
		return ;	
		//console.log("Can't find the submit button");
	};
}


// Gene Structure Drawing in 
// Eplant.views.GeneInfoView.js
// Lines 99 - 483
