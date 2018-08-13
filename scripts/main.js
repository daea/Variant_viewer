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

	d3.select("#exportJSON").on('click', () => varData.exportData('json'));
	d3.select('#exportCSV').on('click', () => varData.exportData('csv'));
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
				// global list to track active AGIs
				queryAgis.push(agi);
				renderOverview(agi);		
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
				renderOverview(agi);		
					
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

	let currentElement = d3.select("#addedGenes")	
		.append('li')
		.classed('list-group-item', true)
		.classed('d-flex', true)
		.classed('justify-content-between', true)
		.classed('align-items-center', true)
		.text(input.value)

	currentElement
		.append('a')
		.attr('href', '#')
		.attr('id', extractId(input.value))
		.classed('badge badge-pill badge-danger', true)
		.text('Remove')

}

// Only display the Submit button after the User has added one gene
function addSubmitButton() {
	let exists = d3.select("#sendAgis");
	if (!exists.empty()) {
		return ;
	};
	let submitDest = d3.select('#activeGenes')
		.append('div');	

	submitDest
		.append('button')
		.attr('id', 'sendAgis')
		.attr('type', 'submit')
		.classed('btn', true)
		.classed('btn-secondary', true)
		.text("Submit");

	submitDest
		.append('div')
		.classed('progress', true)
		.append('div')
		.attr('id', 'submitProgress')
		.classed('progress-bar', true)
		.classed('progress-bar-striped', true)
		.classed('progress-bar-animated', true)
		.classed('bg-warning', true)
		.attr('role', 'progressbar')
		.style('width', '100%')
		.attr('aria-valuemin', "0")
		.attr('aria-valuemax', "100")
		.attr('aria-valuenow', "100")
		.text('Aligning Proteins')
		.classed('font-weight-bold', true)
		.classed('text-dark', true);
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
		d3.select('#submitProgress')
			.style('visibility', 'visible');
		var listedAgis = [];
		for (var i=0; i < queryAgis.length; i++) {
			listedAgis.push(extractId(queryAgis[i]));
		};
		window.graphXHR.abort();
		window.graphXHR.onreadystatechange = function () {
			if (this.readyState == 4 && this.status == 200) {
				plots.renderPlots(graphXHR, 'graphPanel');				
			}; 
		};
		window.graphXHR.responseType = "json";
		window.graphXHR.open("GET", PHP_URL + listedAgis.join(','), true);
		window.graphXHR.send();

	} else {
		return ;	
	};
}

// Initial Gene Model Plot
function initSplashPanelStruct (DEFAULT_AGI) {
	varData.getStructure(extractId(DEFAULT_AGI))
				.then( data => overview.addStructure(data, "splash", "splashStructure"));
};

function renderOverview (agi) {
// request the structures from the BAR and draw our structure table	
	varData
		.getStructure(agi)
		.then( data => {
			overview.addStructure(data, "graphPanel", "graphPanelStructure");
			overview.changeProgress(agi, 'loading');
		})
		.catch(error => alert(error));

	// retrieve variant data from 1001 and pfam / cdd data
	switchInput('disable');	
	varData
		.getData(agi)
		.then( (data) => {
			if (varData.retrieveAllData()[agi].errors.length > 0) {
				overview.changeProgress(agi, 'warning');
			} else {
				overview.changeProgress(agi, 'success');
				varData.formattedData[agi] = varData.retrieveVariants(agi);
			};
		})
		.then( () => overview.renderVariants(varData.retrieveFormattedData(agi), overview.tableId))
		.catch(error => {
			console.log(error);
				overview.changeProgress(agi, 'error');
				alert(`There was an error retrieving variants for that isoform from PolyMorph 1001. Please submit the isoform to Polymorph1001 to ensure that there are variant records available.`);
			}
		).then(() => switchInput('enable'));
};

function switchInput(status) {
	if (status == "disable") {
		d3.select('#agiInput').property('disabled', true);
	} else {
		d3.select('#agiInput').property('disabled', false);
	};
};

