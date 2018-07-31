/* 
 * Data requests for Variant Viewer
 * Matt Cumming
 * Provart Lab 
 * July 2018
 *
 */ 


let varData = {};

(function () {

	// Internal URLS and 1001g URLS
	const STRUCTURE_URL = "http://bar.utoronto.ca/webservices/bar_araport/gene_structure_by_locus.php?locus=";
	const VARIANT_BASE_URL = "http://tools.1001genomes.org/api/v1.1/effects.json?type=snps;accs=all;gid=";

	const VARIANT_END_URL  = ";effect=missense_variant";
	const PROT_URL = "http://bar.utoronto.ca/webservices/bar_araport/get_protein_sequence_by_identifier.php?locus=";
	
	const CDD_URL  = "http://bar.utoronto.ca/eplant/cgi-bin/CDDannot.cgi";
	const PFAM_URL = "http://bar.utoronto.ca/eplant/cgi-bin/PfamAnnot.cgi";

	let structures = {};
	let rawData = {};
	let errors = {};


	// Final return functions
	retrieveRawData = function (agi) {
		return rawData[agi];
	};

	retrieveStructure = function (agi) {
		return structures[agi];
	};

	// Access functions after init
	this.retrieveError = function (agi) {
		return errors[agi];
	};

	this.retrieveAllData = function () {
		return { structures, rawData, errors };
	};


	// XHR Request Functions
	this.getStructureData = function (agi) {
		let gene = agi.substr(0, agi.indexOf('.'));
		errors[agi] = [];

		return fetch(STRUCTURE_URL + gene)
			.then(res  => res.json())
			.then(data => structures[agi] = data)
			.catch(e    => {
				errors[agi].push(e);
				structures[agi] = {"error": e};
			})
			.then(() => retrieveStructure(agi));		
	};

	// Variants, Protein Sequence, PFAM, CDD
	this.getData = function (agi) {
	
		// Init empty agi object
		rawData[agi] = {};

		let polymorphRequest = fetch(VARIANT_BASE_URL + agi + VARIANT_END_URL)
			.then(res => res.json());

		let proteinRequest = fetch(PROT_URL + agi)
			.then(res => res.json());

		return Promise
			.all([polymorphRequest, proteinRequest])
			.then( 
				function(values) {
					rawData[agi]["variants"]    = values[0];
					rawData[agi]["proteinSeq"]  = values[1];

					let reqInfo =  {
						method: "POST",
						headers: {
							'Accept': 'application/json',
							'Content-Type': 'application/x-www-form-urlencoded' 
							},
						body: "FASTAseq=" + rawData[agi].proteinSeq.result[0].sequence
					};
	
					fetch(CDD_URL, reqInfo)
						.then(res => res.json())
						.then(data => rawData[agi]["cddData"] = data)
						.catch(e => { 
							errors[agi].push(e)
							rawData[agi]["cddData"] = { "error": e};
						});
	
					fetch(PFAM_URL, reqInfo)
						.then(res => res.json())
						.then(data => rawData[agi]["pfamData"] = data)
						.catch(e => {
							errors[agi].push(e);
							rawData[agi]["pfamData"] = { "error": e};
						});
				}
			)
			.catch(e => {
				errors[agi].push(e);
				rawData[agi]["variants"] = { "error": e};
				rawData[agi]["proteinSeq"] = { "error": e};
			})
			.then( () => retrieveRawData(agi));
	};

}).apply(varData);
