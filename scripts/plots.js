/* Plotting Graphs using plotly
 * App: Variant viewer
 * file: plots.js
 * Author: Matthew Cumming
 * Date: June 2018
*/
var CSS_COLOR_NAMES = ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928'];

var plots = {};

(function () { 
	
	// to Store our dataframes
	this.data = {};

	// Get our datasources and assign them to properties
	this.getData = function(XHR_response) {
			
		this.data["cddPfam"] = XHR_response.response.data[0];
		this.data["variantMap"] = XHR_response.response.data[1];
		this.data["frequencyData"] = XHR_response.response.data[2];
		return this.data;
		
		
	};
	
	// Create the plot datasets and layout
	this.makePlots = function(destination) {

		// Convert zeros to null to avoid plotting
		var posLength = this.data.frequencyData.position.length;
		for (var i=0;i<posLength;i++) {
			if (this.data.frequencyData.av_freq[i] == 0) {
				this.data.frequencyData.av_freq[i] = null;
			};
		};
		
		// Generate an Array of Custom bar labels to show on hover
		let barLabels = [];
		let freqLength = this.data.frequencyData.av_freq.length;
		for (i=0; i<freqLength; i++) {
			barLabels.push( 'Mean Frequency: ' + this.data.frequencyData.av_freq[i] + '<br>' +
						    '# of variants: ' + this.data.frequencyData.intraCount[i] + '<br>' + 
							'# of genes with variant: ' + this.data.frequencyData.interCount[i] + '<br>');
		};
		
		// Average Frequency Trace for Bar graph
		var bars = {
			x: this.data.frequencyData.position,
			y: this.data.frequencyData.av_freq,
			type: 'bar',
			name:'mean variant frequency',
			hoverinfo: 'text',
			text: barLabels
			
		};
		
		// labels for individual variant values
		let variantLength = this.data.variantMap.gene_name.length;
		let pointLabels = [];
		for (var i=0; i<variantLength; i++) {
			pointLabels.push('Gene name: ' + this.data.variantMap.gene_name[i] + '<br>' +
					'AGI id: ' + this.data.variantMap.key[i] + '<br>' +
					'Reference: ' + this.data.variantMap.original[i] + '<br>' +
					'Missense variant: ' + this.data.variantMap.variant[i] + '<br>' +
					'Genomic locus: ' + this.data.variantMap.pos[i] + '<br>' +
					'Frequency: ' + this.data.variantMap.freq[i] + '<br>');
		};

		// Individual variants point trace
		var points = {
			x: this.data.variantMap.position,
			y: this.data.variantMap.freq, 
			type: 'scatter',
			mode: 'markers',
			name: 'variant frequency',
			hoverinfo: 'text',
			//hoverlabel:       ,
			text: pointLabels,
			marker: {size: 4}
		};
		
		// Get the agi ids that are in my cddPfam table
		var uniqueNames = Array.from(new Set(this.data.cddPfam.agi));	
		// Create dummy values to plot the names at on the y axis
		var tickValues = Array.from(Array(uniqueNames.length).keys());
		
		// create an array of y positions corresponding to the uniqueNames
		var mapLength = this.data.variantMap.position.length;
		var yPositions = [];
		for (i=0; i<mapLength; i++) {
			yPositions.push(uniqueNames.indexOf(this.data.variantMap.key[i]));
		};

		// MSA plot trace
		var msa = {
			x: this.data.variantMap.position,
			y: yPositions, 
			type: 'scatter',
			name: 'Show MSA',
			mode: 'text',
			yaxis: 'y2',
			visible: 'legendonly',
			text: this.data.variantMap.value,
			textfont: {
				size: 10
			},
			hoverinfo: 'none'
		};
		
		// Domain overlay for MSA plot
		var domainTrace = [];
		var yHeight = [];
		let fillColors = [];
		
		// Generate a set of colors to plot domains with
		let domainNames = Array.from(new Set(this.data.cddPfam.domain));	
		for (i=0; i<this.data.cddPfam.start_pos.length; i++) {
			let y = domainNames.indexOf(this.data.cddPfam.domain[i])	
			fillColors.push(CSS_COLOR_NAMES[y]);
			
		};
		
		// Create an array of rectangles to plot as domain annotation
		for (i=0; i<this.data.cddPfam.start_pos.length; i++) {
			var yHeight = uniqueNames.indexOf(this.data.cddPfam.agi[i]);
			domainTrace.push({
				type: 'rect',
				xref: 'x', 
				yref: 'y2',
				x0: this.data.cddPfam.start_pos[i] - 0.5,
				x1: this.data.cddPfam.end_pos[i] - 0.5,
				y0: yHeight - 0.5,
				y1: yHeight + 0.5,
				fillcolor: fillColors[i],
				opacity: 0.3,
				line: {
					width: 0
				}
			});
		};
		
		// Dummy trace (not visible) to use for hovertext of domains
		

		let domainInfo = [];
		for (i=0; i<this.data.cddPfam.domain.length; i++) {
			domainInfo.push('CDD/PFAM domain: ' + this.data.cddPfam.domain[i] + '<br>' +
							'Start Position: ' + this.data.cddPfam.start_pos[i] + '<br>' +
							'End Position: ' + this.data.cddPfam.end_pos[i]);
		};
		
		let yPositionsHover = [];
		for (i=0; i<this.data.cddPfam.domain.length; i++) {
			yPositionsHover.push(uniqueNames.indexOf(this.data.cddPfam.agi[i]));
		};
		
		var domainHover = {
			x: this.data.cddPfam.start_pos,
			y: yPositionsHover, 
			type: 'scatter',
			yaxis: 'y2',
			mode: 'markers',
			opacity: 0,
			hovermode: 'closest',
			hoverdistance: 5,
			hoverinfo: 'text',
			text: domainInfo,
			showlegend: false

		};


		var layout = {
			plot_bgcolor: "#f9f9f9",
			showgrid: false,
			hoverdistance: 5,
			hovermode: 'closest',
			shapes: domainTrace,	
			margin: {
				l: 100,
				r: 175
			},
			xaxis: {
				//title: "Position",
				showticklabels: false,
				domain: [0, 1]
			},
			yaxis: {
				ticks: 'outside',	
				domain: [0.12, 1]
			},
			yaxis2: {
				domain: [0, 0.1],
				type: 'category',
				tickvals: tickValues,
				tickmode: 'array',
				ticktext: uniqueNames,
				showgrid: false
			}

		};
			
		var data = [bars, points, msa, domainHover];
		Plotly.plot(destination, data, layout);
};

	// Inject plots into plotPanel
	this.renderPlots = function(response, destination) {
		this.getData(response);
		this.makePlots(destination);
	};

}).apply(plots);


