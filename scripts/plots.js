/* Plotting Graphs using plotly
 * App: Variant viewer
 * file: plots.js
 * Author: Matthew Cumming
 * Date: June 2018
*/

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
	this.frequencyPlot = function(destination) {
		var posLength = this.data.frequencyData.position.length;
		for (var i=0;i<posLength;i++) {
			if (this.data.frequencyData.av_freq[i] == 0) {
				this.data.frequencyData.av_freq[i] = null;
			};
		};
		var bars = {
			x: this.data.frequencyData.position,
			y: this.data.frequencyData.av_freq,
			type: 'bar'
		};

		var points = {
			x: this.data.variantMap.position,
			y: this.data.variantMap.freq, 
			type: 'scatter',
			mode: 'markers'
		};
	
		var data = [bars, points];
		Plotly.plot(destination, data);
	};

	this.domainPlot = function() {
		//--- make the plots here --- 
	};
	

	// Inject plots into plotPanel
	this.renderPlots = function(response, destination) {
		this.getData(response);
		this.frequencyPlot(destination);
	};

}).apply(plots);




