/* 
 * Gene Overview with D3
 * App: Variant viewer
 * file: overview.js
 * Author: Matthew Cumming
 * Date: June 2018
*/

var overview = {};

(function () { 
	
	this.data = {};
	this.destination = '';
	this.tableId = '#structureTable';

	this.addStructure = function(response, destination) {

		if (d3.select(this.tableId).empty() == true) {
			
			this.destination = '#' + destination;
			this.initTable(this.destination);
			this.makePlots(response, this.tableId);
		
		} else if (d3.select(this.tableId).empty() == false) {
			this.makePlots(response, this.tableId);
		
		} else {
			d3.select(this.destination)
				.append('p')
				.text('An Error occurred while fetching gene isoforms.');
		};
	};

	this.removeStructure = function(gene) {
		let toRemove = '.' + gene.substring(0, gene.indexOf('.'));
		if (d3.select(this.tableId).empty() == true) {
			;
		} else if (d3.select(this.tableId).empty() == false) {
			d3.selectAll(toRemove).remove()
		} else {
			d3.select(this.destination)
				.append('p')
				.text('An error occurred while removing the gene');
		};
	};

	// Make the intial table to population with structures
	this.initTable = function(destination) {
		
		let table = d3.select(destination)
			.append('table')
			.classed('table-hover', true)
			.attr('id', this.tableId.replace('#', ''));
		
		let thead = table.append('thead').append('tr');
		
		thead
			.selectAll('th')
			.data(["Isoform Id", "Isoform Structure"])
			.enter()
			.append('th')
			.classed('border-bottom', true)
			.classed('text-center', true)
			.append('h5')
			.classed('text-middle', true)
			.append('strong')
			.text(function(d) { return d; })
		return table;
	}

	// Create the isoform plots
	this.makePlots = function(XHR, destinationTable) {
	
		let table = d3.select(destinationTable);
		let data = JSON.parse(XHR.response);
		if (data.wasSuccessful == true && data.error == null) {		

			// Should only have one gene per request
			let geneStart = data.features[0].start;
			let geneEnd   = data.features[0].end;
			let gene      = data.features[0].uniqueID;

			let geneHeader = table.append('tr')
				.classed(gene, true)

			geneHeader.append('td')	
				.style('padding-top', '6px')
				.style('padding-bottom', '0')
				.style('text-align', 'left')
				.append('h6')
				.append('strong')
				.text(gene);
			
			// Iterate over the Isoforms (by mRNA)
			data.features[0].subfeatures
				.sort(function(a,b) {
					let foo = a.uniqueID;
					let bar = b.uniqueID;
					return parseInt(foo.substring(foo.indexOf('.') + 1, foo.length)) 
						- parseInt(bar.substring(bar.indexOf('.') + 1, bar.length))
				});
			
			let isoformsLength = data.features[0].subfeatures.length;
			for (let i=0; i<isoformsLength; i++) {
				let isoform =  data.features[0].subfeatures[i];
				let geneSection = table.append('tbody')
					.classed(gene, true);
				let row = geneSection.append('tr');
				row.append('td').text(isoform.uniqueID);
				let structure = row.append('td');
				let container = structure.append('div');
				
				let w = 600;
				let h = 20;

				// Scale for converting genomic coordinates to plot values
				let xscale = d3.scaleLinear()
								.domain([geneStart, geneEnd])
								.range([0, w]);

				let plot = container.append('svg')
					.attr('height', h)
					.attr('width', w)
				
				let tooltip = d3.select("body")
					.append('div')
					.style('position', 'absolute')
					.style('z-index', "10")
					.style("visibility", "hidden")
					.style("background-color", "orange")
					.style("padding", "4px")
					.style("border-radius", "4px")
					.style("font-size", "12px");
	

				// Gene Locus	
				plot.selectAll('rect')	
					.data([ [geneStart, geneEnd, "Gene"] ])	
					.enter()
					.append('rect')
					.attr('x', function(d) {
						return xscale(d[0]);
					})
					.attr('y', (h / 2) + ((h/10)/2) )
					.attr('width', function(d) {
						return xscale(d[1]) - xscale(d[0]);
					})
					.attr('height', h / 10)
					.attr('fill', '#000000')
					.on('mouseover', function (d) {
						
						return tooltip.style('visibility', 'visible')
								.html("<strong>Feature Type:</strong> " + d[2] + 
									"<br><strong>Feature Start:</strong> " + d[0] +
									"<br><strong>Feature End: </strong>" + d[1]);
					})
					.on('mousemove', function (d) {
						return tooltip.style('top', (event.pageY-10) +"px").style("left", (event.pageX+10)+"px");})
					.on('mouseout', function (d) {return tooltip.style('visibility', 'hidden');});
				
				// Sort the features
				let layerOrder = [	"exon",
									"CDS",
									"five_prime_UTR", 
									"three_prime_UTR" 

				];
				isoform.subfeatures.sort(function (a,b) {
					return layerOrder.indexOf(a.type) - layerOrder.indexOf(b.type);
				});

				// Colours of features
				let colorPalette = [ 
					"#388659",  // Darkish green
					"#427AA1", // Darkish blue
					"#52AA5E",  // Brighter green
					"#3AAED8", // Lighter muted blue
					"#2BD9FE", // Light blue
				];

				let featureLength = isoform.subfeatures.length;
				for (let j=0; j<featureLength; j++) {
					if (isoform.subfeatures[j].type == "three_prime_UTR" || isoform.subfeatures[j].type == "five_prime_UTR") {
						let featLength = xscale(isoform.subfeatures[j].end) -  xscale(isoform.subfeatures[j].start);	
						plot
							.append('rect')
							.attr('x', xscale(isoform.subfeatures[j].start))
							.attr('y', h / 4)
							.attr('width', featLength)
							.attr('height', h/3)
							.attr('fill', colorPalette[3])
							.on('mouseover', function () {
								return tooltip.style('visibility', 'visible')
									.html("<strong>Feature Type:</strong> " + isoform.subfeatures[j].type + 
										"<br><strong>Feature Start:</strong> " + isoform.subfeatures[j].start +
										"<br><strong>Feature End: </strong>" + isoform.subfeatures[j].end);
							})
							.on('mousemove', function () {
								return tooltip.style('top', (event.pageY-10) +"px").style("left", (event.pageX+10)+"px");})
							.on('mouseout', function () {return tooltip.style('visibility', 'hidden');});
				



					} else if (isoform.subfeatures[j].type == "exon") {
						let featLength = xscale(isoform.subfeatures[j].end) -  xscale(isoform.subfeatures[j].start);	
						plot
							.append('rect')
							.attr('x', xscale(isoform.subfeatures[j].start))
							.attr('y', h / 4)
							.attr('width', featLength)
							.attr('height', h)
							.attr('fill', colorPalette[2])
							.on('mouseover', function () {
								return tooltip.style('visibility', 'visible')
									.html("<strong>Feature Type:</strong> " + isoform.subfeatures[j].type + 
										"<br><strong>Feature Start:</strong> " + isoform.subfeatures[j].start +
										"<br><strong>Feature End: </strong>" + isoform.subfeatures[j].end);
							})
							.on('mousemove', function () {
								return tooltip.style('top', (event.pageY-10) +"px").style("left", (event.pageX+10)+"px");})
							.on('mouseout', function () {return tooltip.style('visibility', 'hidden');});
				


					} else if (isoform.subfeatures[j].type == "CDS") {
				
						let featLength = xscale(isoform.subfeatures[j].end) -  xscale(isoform.subfeatures[j].start);	
						plot
							.append('rect')
							.attr('x', xscale(isoform.subfeatures[j].start))
							.attr('y', h / 4)
							.attr('width', featLength)
							.attr('height', h)
							.attr('fill', colorPalette[1])
							.on('mouseover', function () {
								return tooltip.style('visibility', 'visible')
									.html("<strong>Feature Type:</strong> " + isoform.subfeatures[j].type + 
										"<br><strong>Feature Start:</strong> " + isoform.subfeatures[j].start +
										"<br><strong>Feature End: </strong>" + isoform.subfeatures[j].end);
							})
							.on('mousemove', function () {
								return tooltip.style('top', (event.pageY-10) +"px").style("left", (event.pageX+10)+"px");})
							.on('mouseout', function () {return tooltip.style('visibility', 'hidden');});
				

					} else {
						;
					};
				
				};
			};

		} else {
			
			d3.select(destinationTable)
				.append('td')
				.text('An error occurred while rendering the plot');
		};
	};

}).apply(overview);

