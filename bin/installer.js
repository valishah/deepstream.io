'use strict';

const needle = require( 'needle' );
const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );
const AdmZip = require( 'adm-zip' );
const execSync = require( 'child_process' ).execSync;

const CONFIG_EXAMPLE_FILE = 'README.md';
const SYSTEM = {
	'linux': 'linux',
	'darwin': 'mac',
	'win32': 'windows'
};
const platform = SYSTEM[ os.platform() ];

const getWebUrl = function( repo ) {
	return `https://github.com/deepstreamIO/${repo}/releases`;
};

const downloadRelease = function( releases, type, name, version, outputDir, callback ) {
	const repo = `deepstream.io-${type}-${name}`;
	releases.filter( item => {
		if ( version == null ) {
			return true;
		}
		return item.tag_name === version || item.tag_name === 'v' + version;
	} );
	if ( releases.length === 0 ) {
		callback( new Error( `connector ${repo} ${version} not found, see ${getWebUrl( repo )}` ) );
	}
	version = releases[0].tag_name;
	const releaseForMachine = releases[0].assets.filter( item => item.name.indexOf( platform ) !== -1 );
	if ( releaseForMachine.length === 0 ) {
		callback( new Error( `relase for your platform not found, see ${getWebUrl( repo )}` ) );
	}
	if ( outputDir == null ) {
		outputDir = 'lib';
	}
	const downloadUrl = releaseForMachine[0].browser_download_url;
	const extension = path.extname( downloadUrl );
	const basename = path.basename( downloadUrl, extension ).replace( 'deepstream.io-', '' );
	const urlBase = 'https://github.com';
	const urlPath = downloadUrl.substr( urlBase.length );

	const outputFile = `${outputDir}/${basename}-${version}${extension}`;

	try {
		// ignore if already exists
		fs.mkdirSync( outputDir );
	} catch ( err ) {}

	console.log( 'downloading version ' + version );
	const outStream = fs.createWriteStream( outputFile );
	needle.get( 'https://github.com' + urlPath, {
		follow_max: 5,
		headers: {'User-Agent': 'nodejs-client'}
	} )
		.on( 'readable', function() {
			process.stdout.write( '.' );
		} )
		.on( 'end', function() {
			console.log( '\ndownload complete' );
			callback( null, {
				archive: outputFile,
				name: repo
			} );
		} )
		.pipe( outStream );
};



const fetchReleases = function( type, name, callback ) {
	const repo = `deepstream.io-${type}-${name}`;
	const urlPath = `/repos/deepstreamIO/${repo}/releases`;
	console.log( 'searching for ' + repo );
	needle.get( 'https://api.github.com' + urlPath, {
		headers: {'User-Agent': 'nodejs-client'}
	}, function( error, response ) {
		if ( error ) {
			return callback( error );
		}
		callback( null, response.body );
	} );

};

const extract = function( data, platform ) {
	var archivePath = data.archive;
	const outputParent = path.dirname( archivePath );
	var outPath = path.join( outputParent, data.name );
	if ( platform === 'linux'  ) {
		execSync( `mkdir -p ${outPath} && tar -xzf ${archivePath} -C ${outPath} ` );
	} else {
		extractZip( archivePath, outPath );
	}
	return outPath;
};

const extractZip = function( archivePath, outputDirectory ) {
	var zip = new AdmZip( archivePath );
	zip.extractAllTo( outputDirectory, true );
};

const showConfig = function( directory ) {
	var content = fs.readFileSync( path.join( directory, CONFIG_EXAMPLE_FILE ), 'utf8' );
	console.log( 'connector installed to ' + directory );
	console.log( 'you need to configure the connector in your deepstream configuration file' );
	console.log( 'here is an example:\n' + content );
};

module.exports = function( type, name, version, outputDirectory, callback ) {
	fetchReleases( type, name, function( error, releases ) {
		if ( error ) {
			return callback( error );
		}
		downloadRelease( releases, type, name, version, outputDirectory, function( error, result ) {
			if ( error ) {
				return callback( error );
			}
			var extractedDirectory = extract( result, platform );
			showConfig( extractedDirectory );
		} );
	} );
};
