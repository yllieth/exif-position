const fs = require('fs');
const JPEGDecoder = require('jpg-stream/decoder');
const isJpg = require('is-jpg');
const readChunk = require('read-chunk');
const options = require('commander');
const recursive = require('recursive-readdir');

options
	.option('-a, --all', 'Print all files, even if it\'s not a JPG file or if the picture does not have localization data.')
	.option('-d, --directory <folder>', 'Look for GPS coodinates for every files in this directory.')
	.option('-f, --file <file>', 'Look for GPS coodinates for the given file.')
	.option('-r, --recursive', 'Combined with -d option, it will look recusrively in the given directory.')
	.parse(process.argv);

function getCoordinates(ref, exifData) {
	if (ref && exifData) {
		let degres = exifData[0];
		let minutes = Math.trunc(exifData[1]);
		let seconds = ((exifData[1] - Math.floor(exifData[1])) * 60).toFixed(2);
		return ref + degres + 'º ' + minutes + '\' ' + seconds + '\"';
	} else {
		return null;
	}
}

function getAltitude(exifData) {
	if (exifData) {
		return exifData + 'm'
	} else {
		return null;
	}
}

function printCoordinates(path) {
	const filename = path.split('/')[path.split('/').length - 1];
	const buffer = readChunk.sync(path, 0, 3);

	if (isJpg(buffer)) {
		fs.createReadStream(path)
			.pipe(new JPEGDecoder)
			.on('meta', function(meta) {
				let timestamp = meta.exif.DateTimeOriginal.toISOString();

				if (options.all && (meta.gps.GPSLatitude === undefined || meta.gps.GPSLongitude === undefined)) {
					console.log(filename + '\t' + '--- NO LOCALIZATION DATA ---');
				}

				if (meta.gps.GPSLatitude !== undefined && meta.gps.GPSLongitude !== undefined) {
					let latitude = getCoordinates(meta.gps.GPSLatitudeRef, meta.gps.GPSLatitude);
					latitude = (latitude !== null) ? latitude + '\t\t' : '';
					
					let longitude = getCoordinates(meta.gps.GPSLongitudeRef, meta.gps.GPSLongitude);
					longitude = (longitude !== null) ? longitude + '\t\t' : '';
					
					let altitude = getAltitude(meta.gps.GPSAltitude);
					altitude = (altitude !== null) ? altitude : '';

					console.log(filename + '\t' + timestamp + '\t' + latitude + longitude + altitude);
				}
			});
	} else {
		if (options.all) {
			console.error(filename + '\t' + '--- NOT A JPG FILE ---');
		}
	}
}

function processDirectory(paths, error) {
	if (error) {
		console.error(error);
		process.exit(2);
	} else {
		paths.forEach(path => printCoordinates(path));
	}
}

if (options.directory) {
	let dirname = options.directory;

	if (options.recursive) {
		// filenames is an array of absolute paths
		recursive(dirname, (error, filenames) => processDirectory(filenames, error));
	} else {
		// filenames is an array of relative paths (directory path has to be added before to be constistant with the output of the recusrsive function)
		fs.readdir(dirname, (error, filenames) => processDirectory(filenames.map(filename => dirname + '/' + filename), error));
	}
} else if (options.file) {
	printCoordinates(options.file);
} else {
	console.error('Please use one of the following options : -d for a directory, -f for a single file');
	process.exit(1);
}
