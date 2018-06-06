var data = [{ id: "ABF3", text: "AT4G34000.1"},
			{ id: "ABF2", text: "AT1G45249.1"},
			{ id: "ABF1", text: "AT1G49720.1"},
			{ id: "ABF4", text: "AT3G19290.1"} 
	];





$(document).ready(function() {
	$('.agiSelector').select2({
		placeholder: "Start typing an AGI",
		data: data
	});

	$('#sendAgis').click( function() {
		var agis = $('.agiSelector').select2('data');
		var agiLength = agis.length;
		for (var i =0;i<agis.length;i++) {
			alert(agis[i].text);
		}
	});

});



