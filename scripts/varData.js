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
	this.formattedData = {};

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

	this.retrieveAllFormattedData = function() {
		return this.formattedData;
	};

	// XHR Request Functions
	this.getStructure = function (agi) {
		let gene = agi.substr(0, agi.indexOf('.'));
			
		// Init empty agi object
		rawData[agi] = {"errors": []};	

		return fetch(STRUCTURE_URL + gene)
			.then(res  => {
				if (res.ok) {
					return res.json();
				};
				throw new Error("There was an issue retrieving structures for that Isoform");
			})
			.then(data => {
				rawData[agi]["structures"] = data;
				return data;
		});		
	};

	// Variants, Protein Sequence, PFAM, CDD
	this.getData = function (agi) {

		const delay = function(ms) {
			return new Promise(resolve => setTimeout(resolve, ms));
		};

		let polymorphRequest = fetch(VARIANT_BASE_URL + agi)
			.then(response => {
				if (response.ok) {
					//1001g api returns 500 if there are no results
					if (response.status == 500) {
						throw new Error(`There are no variants available for that isoform
							please submit the AGI id to PolyMorph1001 and check that it 
							is available`);
					};					
					return response.json();
				};
				throw new Error("There was an error fetching the variants data");
			});

		let proteinRequest = fetch(PROT_URL + agi)
			.then(response => { 
				if (response.ok) {
					return response.json();
				};
				throw new Error("There was an error fetching the protein sequence for that isoform");
			}).then(data => {
				if (data.result[0].length > 0) {
					return data;
				};
				throw new Error("There was an error fetching the protein sequence for that isoform");
			});

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
							throw new Error("Error retrieving CDD data.");
						})
						.then(data => {
							if (Object.keys(data).length == 0) {
								throw new Error("No CDD domains available for that isoform");
							};	
							rawData[agi]["cddData"] = data;
						})
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
							throw new Error("Error retrieving CDD data.");
						})
						.then(data => {
							if (Object.keys(data).length == 0) {
								throw new Error("No PFAM domains available for that isoform")
							};
							rawData[agi]["pfamData"] = data;
						})
						.catch(e => {
							rawData[agi]["errors"].push(e);
							rawData[agi]["pfamData"] = {"NoDomains": true};
						});	
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
			}, {});
		tempData.variants = formattedVariants;
		return tempData;
	};

	this.flattenFormattedData = function() {
		let exportData = [];
		let re = /^([A-Z])([0-9]+)/i;
		Object.entries(this.retrieveAllFormattedData()).forEach(([agi,records]) => {

			// ['cddData', 'AGI_ID', 'DOMAIN', 'RESIDUE', 'LOCATION']
			if (records.cddData !== undefined &&
				Object.entries(records.cddData).length > 0 && 
				records.cddData["NoDomains"] === undefined) {

    				Object.entries(records.cddData).forEach(([domain, location]) => {
       					location.split(',').forEach( (site) => {
         					let match = re.exec(location);
         					if (match != null) {
           					exportData.push(['cddData', agi, domain, match[1], match[2]]);
       						};
        				})
      				})
  			} else {
        		exportData.push(['cddData', agi, 'NoDomains']);
    		};

    		// ['pfamData','agi','domain','Expect', 'PfamAnnot', 'domainName', 'endIndex', 'startIndex']
    		if (records.pfamData !== undefined &&
   				Object.entries(records.pfamData).length > 0 && 
    			records.pfamData["NoDomains"] === undefined) {

    				Object.entries(records.pfamData).forEach(([domain, data]) => {
    					exportData.push(['pfamData',
                        	agi,
	                        domain, 
	                        data.Expect, 
	                        data.PfamAnnot, 
	                        data.domainName, 
	                        data.endIndex, 
	                        data.startIndex]);
      				})
   			} else {
    			exportData.push(['pfamDomain', agi, 'NoDomains']);
    		};

		    // ['proteinSeq', 'length', 'sequence']
		    if (records.proteinSeq !== undefined) {
		    	exportData.push(['proteinSeq', 
					agi, 
		            records.proteinSeq.result[0].length, 
		            records.proteinSeq.result[0].sequence]);
		    } else {
		    	exportData.push(['proteinSeq', agi, 'No Sequence retrieved']);
		    };

		    // ['variants', 'agi', data, count, ecotypes]
		    if (records.variants !== undefined) {
		    	Object.entries(records.variants).forEach( ([agi, positionList]) => {
		    		Object.entries(positionList).forEach( ([position, change]) => {
		    			Object.entries(change).forEach( ([change, datum]) => {
							exportData.push( ['variants', agi]
								.concat(datum.data)
								.concat([datum.count, datum.ecotypes]));
		          })
		        })
		      });
		    } else {
		    	exportData.push(['variants', agi, 'No Variants']);
		    };
		});
		return exportData;
	};


	this.exportData = function(filetype) {

		if (filetype == 'csv') {

			let properties = {type: "data:text/csv;charset=utf-8"};
			let csvContent = '';	
			this.flattenFormattedData().forEach(function(rowArray){
				let row = rowArray.join(",");
				csvContent += row + "\r\n";
			});	

			try {
				file = new File([csvContent], "data.csv", properties);
			} catch (e) {
				file = new Blob([csvContent], properties);
			};
			let url = URL.createObjectURL(file);
			window.open(url);
			return true;

		} else if (filetype == 'json') {

			let file;
			let properties = {type: 'application/json'}; // Specify the file's mime-type.
			try {
				// Specify the filename using the File constructor, but ...
				file = new File([JSON.stringify(this.retrieveAllFormattedData())], "data.json", properties);
			} catch (e) {
				// ... fall back to the Blob constructor if that isn't supported.
				file = new Blob([JSON.stringify(this.retrieveAllFormattedData())], properties);
			};
			let url = URL.createObjectURL(file);
			window.open(url);
			return true;
		}; 
	};

}).apply(varData);




