window.addEventListener('load', () => {
	document.querySelector('a-scene').addEventListener('enter-vr', function () {
	   	document.querySelector('#camera').setAttribute('camera','active:false');
	   	document.querySelector('#ocean').parentNode.removeChild(document.querySelector('#ocean'));
	   	document.querySelector('#camera-vr').setAttribute('camera','active:true');
	});
	document.querySelector('a-scene').addEventListener('exit-vr', function () {
	   	document.querySelector('#camera').setAttribute('camera','active:true');
	   	document.querySelector('#camera-vr').setAttribute('camera','active:false');
	});
});

