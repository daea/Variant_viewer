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

	// add a gene overview to the destination table
	this.addStructure = function(data, destination, tableId = 0) {
		
		// Optional custom table Id 
		if (tableId !=0) {
			this.tableId = '#' + tableId;
		} else {
			;
		};

		// If its the first gene, init the table
		if (d3.select(this.tableId).empty() == true) {
			
			this.destination = '#' + destination;
			this.initTable(this.destination);
			this.makePlots(data, this.tableId);
		
		} else if (d3.select(this.tableId).empty() == false) {
			this.makePlots(data, this.tableId);
		
		} else {
			d3.select(this.destination)
				.append('p')
				.text('An Error occurred while fetching gene isoforms.');
		};
	};


	this.removeStructure = function(gene) {
		
		// need the base gene name for removal
		let toRemove = '.' + gene.substring(0, gene.indexOf('.'));
		
		// reset the table
		if (d3.select(this.tableId).empty() == true) {
			this.destination.innerHTML = '';
		
		// there is still a gene in the table
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
			.attr('width', '100%')
			.attr('id', this.tableId.replace('#', ''));
	
		let thead = table.append('thead').append('tr');
		
		thead
			.append('th')
			.classed('border-bottom', true)
			.classed('text-left', true)
			.append('h5')
			.classed('text-left', true)
			.append('strong')	
			.text("ISOFORM");
		
		thead
			.append('th')
			.classed('border-bottom', true)
			.classed('text-center', true)
			.append('h5')
			.classed('text-center', true)
			.append('strong')	
			.text("ISOFORM STRUCTURE")
		return table;
	}

	// Create the isoform plots
	this.makePlots = function(data, destinationTable) {
		
		let table = d3.select(destinationTable);
		if (data.wasSuccessful == true && data.error == null) {		

			// Should only have one gene per request
			let geneStart = data.features[0].start;
			let geneEnd   = data.features[0].end;
			let gene      = data.features[0].uniqueID;

			let geneHeader = table.append('tr')
				.classed(gene, true)

			geneHeader.append('td')	
				.classed('geneHeader', true)
				.append('h6')
				.append('strong')
				.text(gene)
			
			let sizeGuide = geneHeader
				.append('td')
				.style('padding', '10px')
				.append('div')
				.classed('progress', true)
				.append('div')
				.classed('progress-bar', true)
				.classed('progress-bar-striped', true)
				.classed('bg-success', true)
				.attr('role', 'progressbar')
				.style('width', '100%')
				.attr('aria-valuemin', "0")
				.attr('aria-valuemax', "100")
				.attr('aria-valuenow', "100")
				;
		
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
				row.append('td')
					.text(isoform.uniqueID)
					.style("width", '120px');
				let structure = row.append('td');
				let container = structure.append('div');
					
				let w = parseInt(container.style('width'));
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
					.on('mousemove', () => {
						return tooltip.style('top', (d3.event.pageY-10) +"px").style("left", (d3.event.pageX+10)+"px");})
					.on('mouseout', () => {
						return tooltip.style('visibility', 'hidden');});
				
				// Sort the features
				let layerOrder = [	"exon",
									"CDS",
									"five_prime_UTR", 
									"three_prime_UTR" 

				];
				isoform.subfeatures.sort(function (a,b) {
					return layerOrder.indexOf(a.type) - layerOrder.indexOf(b.type);
				});
				
				let renderPlotFeature = function (feat, colorIndex, heightAdjust) {
					
					// Colours of features
					let colorPalette = [ 
						"#388659",  // Darkish green
						"#427AA1", // Darkish blue
						"#52AA5E",  // Brighter green
						"#3AAED8", // Lighter muted blue
						"#2BD9FE", // Light blue
					];


					let featureLength = xscale(feat.end) - xscale(feat.start);	
				
					plot
						.append('rect')
						.attr('x', xscale(feat.start))
						.attr('y', h / 4)
						.attr('width', featureLength)
						.attr('height', h/ heightAdjust)
						.attr('fill', colorPalette[colorIndex])
						.on('mouseover', () => {
							tooltip.style('visibility', 'visible')
								.html("<strong>Feature Type:</strong> " + feat.type + 
									"<br><strong>Feature Start:</strong> " + feat.start +
									"<br><strong>Feature End: </strong>" + feat.end);
						})
						.on('mousemove', () => {
							 tooltip
								.style('top', (d3.event.pageY-10) +"px")
								.style("left", (d3.event.pageX+10)+"px");
						})
						.on('mouseout',() => {
							tooltip.style('visibility', 'hidden');
						});
				};
			
				for (const feat of isoform.subfeatures) {
					
					if (feat.type == "three_prime_UTR" || feat.type == "five_prime_UTR") {
						 
						renderPlotFeature(feat, 3, 3);

					} else if (feat.type == "exon") {
					
						renderPlotFeature(feat, 2, 1);

					} else if (feat.type == "CDS") {
		
						renderPlotFeature(feat, 1, 1);

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

