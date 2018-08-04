/* Main flow control
 * App: Variant viewer
 * Author: Matt Cumming
 * Date: June 2018
*/


// Request URLs
var AGI_URL       = "http://bar.utoronto.ca/eplant/cgi-bin/idautocomplete.cgi?species=Arabidopsis_thaliana&term=";
var PHP_URL       = "scripts/plotVariants.php?locus=";
let STRUCTURE_URL = "http://bar.utoronto.ca/webservices/bar_araport/gene_structure_by_locus.php?locus=";
let DEFAULT_AGI   = "At2g18790";
// Global AGI list
var queryAgis = [];

var introPanel = '';

let geneRequests = [];
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
	
	// submit genes and return msa with variants
	var input_panel = document.getElementById("inputPanel");
	input_panel.addEventListener("click", function(event) {submitAgis(event)});

	// add initial gene structure
	initSplashPanelStruct(DEFAULT_AGI);
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

// Add a gene to the Active Genes Panel
function addGene(input) {

	let agi = extractId(input.value);
	let addedGenes = document.getElementById('addedGenes');
	
	// Did extractId return an agi?
	if (agi == false) {
		alert("That is not a valid selection");
	} else {
		if ( queryAgis.length >= 10) {
			// too many genes active
			alert("You have entered the maximum number of genes.");
		} else if ( queryAgis.includes(agi) == true) {
			// gene isoform exists in list
			alert("That gene is already included in the list.");
		} else if ( input.value.length == 0) {
			// input box is empty
			alert("Please enter a gene in the search box.");
		} else if ( queryAgis.length == 0 && input.value.length != 0) {
			// First gene, text box not empty

				// First Gene, Remove the dialog box
				addedGenes.innerHTML = '';
				// remove the splash text
				introPanel = document.getElementById("graphPanel").innerHTML;
				document.getElementById("graphPanel").innerHTML = '';
				// create a list node containing the description in the input box (if selected)
				createListElement(input);

				queryAgis.push(agi);
					varData
						.getStructureData(agi)
						.then( data =>
							overview.addStructure(data, "graphPanel")
						);
					varData
						.getData(agi)
						.then( () => varData.retrieveFormattedData(agi))
						.then( data => console.log(data) )
						.catch(e => console.log(e));
						
				addSubmitButton();	

		} else if ( queryAgis.length < 10 && input.value.length != 0) {
			let gene = agi.substring(0, agi.indexOf('.'));
			let genes = queryAgis.map( x => x.substring(0, x.indexOf('.')));

			if (genes.includes(gene)) {
				createListElement(input);		
				queryAgis.push(agi);
			} else if (!genes.includes(gene)) {
				createListElement(input);		
				queryAgis.push(agi);
		
			varData
				.getStructureData(agi)
				.then( data =>
					overview.addStructure(data, "graphPanel")
				);	
			} else {
				;
			};

		} else {
			alert("The gene could not be successfully added to the list.");
		};
	};
}

// Remove a Gene from the Active Genes Panel
function removeGene (event) {
	
	if (document.getElementById(event.target.id) == null) {
		;
	} else {
		var listGroup = document.getElementById(event.target.id).parentElement.parentElement;
		if (event.target.nodeName == 'A') {
			queryAgis = queryAgis.filter(function(e) { return e !== event.target.id });	
			document.getElementById(event.target.id).parentElement.remove();
			
			// Only remove the structure if all the isoforms have been removed from queryAgis
			if (queryAgis.map(agi => agi.substring(0, agi.indexOf('.')))
					.includes(extractId(event.target.id).substring(0, extractId(event.target.id).indexOf('.')))) {
				;	
			} else {		
				overview.removeStructure(extractId(event.target.id));
			};	
			if (queryAgis.length == 0) {
				listGroup.innerHTML = '<li class="list-group-item d-flex justify-content-between">You have not added any genes yet</li>';
				document.getElementById("graphPanel").innerHTML = introPanel;
			};
		} else {
			console.log("Not finding the element");
		};	
	};
}

// Append <li> elements to the parent <ul> node in the Active Genes panel
function createListElement(input) {
	var Agi = document.createElement("li");
	Agi.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
	Agi.appendChild(document.createTextNode(input.value));
	Agi.innerHTML += "<a href='#' id='" + extractId(input.value) + "' class='badge badge-pill badge-danger'>Remove</a>";
	addedGenes.appendChild(Agi);
}

// Only display the Submit button after the User has added one gene
function addSubmitButton() {
	var exists = document.getElementById('sendAgis');
	if (typeof(exists) == "object" && exists == null) {
		var input_panel = document.getElementById("activeGenes");
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
	if (match != null) {
		if (match[1].length > 0) {
			return(match[0].toUpperCase());
		} else {	
			return(match[0].toUpperCase() + ".1");
		};
	} else {
		return false;
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

// GET structure data for gene models
function getGeneModels(agi) {
	let structureXHR = new XMLHttpRequest();
	structureXHR.onreadystatechange = function () {
		if (this.readyState == 4 && this.status == 200) {
			// here is where we add the plots to the graphPanel	
			overview.addStructure(structureXHR, 'graphPanel');
		};
	};
	structureXHR.open("GET", STRUCTURE_URL + agi.substr(0, agi.indexOf('.')), true);
	structureXHR.send();	
};

// Initial Gene Model Plot
function initSplashPanelStruct (DEFAULT_AGI) {
	varData.getStructureData(extractId(DEFAULT_AGI))
				.then( data =>
					overview.addStructure(data, "splash", "splashStructure")
				);
};
