const port = process.env.PORT || 5000;
const express = require('express')
const app = express()
const http = require('http')
const bodyParser = require('body-parser')
const server = http.createServer(app)
const _ = require('lodash')
const textract = require('textract')
const pdf_extract = require('pdf-text-extract')
const countWords = require("count-words")

// Express App setup
app.use(express.static(__dirname))
app.use(bodyParser.json())

// Send all traffic through this endpoint
app.all(['/url'], function(req, res, next) {
	// Define useful parameters
	var method = req.method.toLowerCase()
	var body = req.body
	var key = req.query.key
	var promises;

	console.log("body", body, "key", key, "query", req.query)
	// Handle request based on method type
	if (method == 'get') {
		// : is a list of filenames
		results = _.filter(
			[req.query.key], 
			(val)=>{return val})
		// : is a list of promises to find matches in the filename
		results = _.map(results, (location)=>{return file_search(key) })

		// Capture all promises and send to the client
		Promise.all(results).then(result=>{
			// Return all the search results
			res.json(result)
			
		}).catch(error=>res.status(404).json(error))
	}

})

// Begin server
server.listen(port, () => console.log(`App running on localhost:${port}`))



// File search api will combine both the textextract plugin with the string-search api
// first by converting all files in the directory to text representations
// then will use the text as an input to match req.params search strings against
// the result is either null or an array with the line number and text of match 
// eg: [ {line: 1, text: 'This is the string to search text in'} ]
function file_search( file ) 
{ 
	var file_extension = file.split('.')[file.split('.').length -1] || "unknown";
	var file_is_url = file.split('//')[0].search('htt') >= 0;

	return new Promise((resolve, reject)=> {
		// If the file_is_url then use async ajax call

		!file_is_url ? textract.fromFileWithPath( file, function( error, text_body ) {
			// get keywords by density in the text body
			keywords = get_keywords( text_body, file );

			// console.log("Keyword Density: ", keywords, text_body);
			if (!error) {
				// Debugging
				console.log(`No Errors for file: '${file}'.`)
				// Complete string search
				return resolve({ [file]: keywords })
		  	} 
		  	else {
		  		// Debugging
		  		// console.log(`Errors found in file: '${file}'. Matching text: ${word_match_query}`)

		  		if (!file_extension == 'unknown' || file_extension == 'pdf') {
		  			pdf_search( file, keywords, file )
		  				.then(r=>resolve(r))
						.then(r=>reject(r))
		  		} else {
		  			// Just try to do a basic filename match
		  			return resolve({ [file]: keywords })
		  		}
		  	}
		}) : null;



		file_is_url ? textract.fromUrl( file, function( error, text_body ) {
			// get keywords by density in the text body
			keywords = get_keywords( text_body, file );

			// console.log("Keyword Density: ", error, text_body, file, word_match_query);
			if (!error) {
				// Debugging
				console.log(`No Errors for file: '${file}'.`)
				// Complete resolve
				return resolve({ [file]: keywords })
		  	} 
		  	else {
		  		// Debugging
		  		// console.log(`Errors found in file: '${file}'. Matching text: ${word_match_query}`)

		  		if (!file_extension == 'unknown' || file_extension == 'pdf') {
		  			pdf_search( file, keywords )
		  				.then(r=>resolve(r))
						.then(r=>reject(r))
		  		} else {
		  			// Just try to do a basic filename match
		  			return resolve({ [file]: keywords })
		  		}
		  	}
		}) : null;

	})


}

function pdf_search( file, keywords ) 
{ 
	var file_extension = file.split('.')[1] || "unknown";
	return new Promise((resolve, reject)=>{
		pdf_extract(file, function(_error, text_body) {
		    if (!_error) {
		        // Try to process other files
		        console.log("Text Body", text_body)
		        return find_query_in_string( text_body, keywords)
		    } else {
		        // Debugging
		        console.log(`Could not process data`, _error);
		        return resolve({ [file]: keywords })
		    }
		})
	})
}


function get_keywords( text_body, file ) 
{ 
	// get keywords by density in the text body
	var tmp;
	var keywords;
	// console.log(`Searching for keywords using '${word_match_query}' as search term in file: '${file}'`, text_body)
	try { tmp = countWords(text_body); 
		keywords = Object.keys(tmp).map(k=>
			// Returning object eg: { word: { length: number } }
			({[k]: {length: tmp[k]}  }))
				// Filtering out special characters
				.filter(words=> !!Object.keys(words)[0].replace(/[^a-zA-Z ]/g, "") )
				// Filtering word length less than 2
				// .filter(words=> words[ Object.keys(words)[0] ].length > 2 ) // <---------------------- minimum keyword density limiter
				// Returning object eg: { word: length }
				.map(word=>(  {[ Object.keys(word)[0] ]: word[ Object.keys(word)[0] ].length }  ))
				// Formatting to object node eg { name: length }
				.reduce((p,c,i,a)=>{
					p[ Object.keys(c)[0] ] = c[ Object.keys(c)[0] ];
					return p;
				})

	} catch (e) { console.log(`Could not parse keywords @ path: ${file}`) }
	finally { return keywords || {} }
}