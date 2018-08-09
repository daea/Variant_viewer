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

	let rawData = {};


	// Final return functions
	retrieveData = function (agi) {
		return rawData[agi];
	};

	retrieveStructure = function (agi) {
		return rawData[agi].structures;
	};

	// Access functions after init
	this.retrieveError = function (agi) {
		return rawData[agi]["errors"];
	};

	this.retrieveAllData = function () {
		return rawData;
	};

	// XHR Request Functions
	this.getStructure = function (agi) {
		let gene = agi.substr(0, agi.indexOf('.'));
			
		// Init empty agi object
		rawData[agi] = {"errors": []};	

		return fetch(STRUCTURE_URL + gene)
			.then(res  => res.json())
			.then(data => rawData[agi]["structures"] = data)
			.then(() => retrieveStructure(agi));		
	};

	// Variants, Protein Sequence, PFAM, CDD
	this.getData = function (agi) {

		const delay = function(ms) {
			return new Promise(resolve => setTimeout(resolve, ms));
		};

		let polymorphRequest = fetch(VARIANT_BASE_URL + agi)
			.then(response => {
				if (response.ok) {
					return response.json();
				} else if (response.status == 500) {
					throw new Error("There are no variants available for that isoform")
				};
				throw new Error("There was an error fetching the variants data")
			})
			.catch(error => rawData[agi]["errors"].push(error));

		let proteinRequest = fetch(PROT_URL + agi)
			.then(response => { 
				if (response.ok) {
					return response.json();
				};
				throw new Error("There was an error fetching the variants data");
			})
			.catch(error => rawData[agi]["errors"].push(error));

		return Promise
			.all([polymorphRequest, proteinRequest])
			.then(values => {
				
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
						.then(response => {
							// Continue here
							if (response.ok) {
								return response.json();
							};
							throw new Error("Error retrieving CDD data. Response was not 200-299");}
						)
						.then(data => rawData[agi]["cddData"] = data)
						.catch(e => { 
							rawData[agi]["errors"].push(e);
							rawData[agi]["cddData"] = {"NoDomains": true};
						});
	
					fetch(PFAM_URL, reqInfo)
						.then(response => {
							// Continue here
							if (response.ok) {
								return response.json();
							};
							throw new Error("Error retrieving CDD data. Response was not 200-299");}
						)
						.then(data => rawData[agi]["pfamData"] = data)
						.catch(e => {
							rawData[agi]["errors"].push(e);
							rawData[agi]["pfamData"] = {"NoDomains": true};
						});
				}
			)
			.catch(e => {
				rawData[agi]["errors"].push(e);
			});
	};

	this.retrieveVariants = function (agi) {
			
		let tempData = retrieveData(agi);
		// build nested data structure variants = { AGI: { Position { SNP_Change { data: [], counts, ecotypes}}}}
		let formattedVariants = tempData.variants.data 
			.reduce((data, datum) => {
				if (datum[12] in data) {
					if (datum[1] in data[datum[12]]) {
						if (datum[7] in data[datum[12]][datum[1]]) {
							data[datum[12]][datum[1]][datum[7]].count++;
							data[datum[12]][datum[1]][datum[7]].ecotypes.push(datum[2]);
						} else {
							data[datum[12]][datum[1]][datum[7]] = {
								"data":	datum,
								"count": 1,
								"ecotypes": [ datum[2] ]	
							};
						};
					} else {
						data[datum[12]][datum[1]] = {};
						data[datum[12]][datum[1]][datum[7]] = {
							"data":	datum,
							"count": 1,
							"ecotypes": [ datum[2] ]	
						};
					};
				} else {
					data[datum[12]] = {};
					data[datum[12]][datum[1]] = {};
					data[datum[12]][datum[1]][datum[7]] = {
						"data":	datum,
						"count": 1,
						"ecotypes": [ datum[2] ]
					};
				};
				return data;
			}, {})
		tempData.variants = formattedVariants;
		return tempData;
	};

}).apply(varData);








