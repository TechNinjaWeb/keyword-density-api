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

var NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');
var fs = require('fs');

var credentials = {
  "url": "https://gateway.watsonplatform.net/natural-language-understanding/api",
  "username": "711a654d-96b5-48bb-a5fc-36cd7fcaa35c",
  "password": "YevSCD8Gwnz1"
}

var nlu = new NaturalLanguageUnderstandingV1({
  username:     credentials.username,
  password:     credentials.password,
  version_date: NaturalLanguageUnderstandingV1.VERSION_DATE_2017_02_27
});
 

// Express App setup
app.use(express.static(__dirname))
app.use(bodyParser.json())

// Send all traffic through this endpoint
app.all(['/url'], function(req, res, next) {
	// Define useful parameters
	var method = req.method.toLowerCase()
	var body = req.body
	var key = req.query.key
	var sort = req.query.sort
	var promises;

	// get keys from file
	file_search(key, sort)
		.then(keywords=>res.json(keywords))
		.catch(errors=>res.status(404).json(errors));

})

// Send all traffic through this endpoint
app.all(['/nlp'], function(req, res, next) {
	textract.fromFileWithPath( './peg.pdf', function( error, file_data ) {
		nlu.analyze({
		    'html': file_data, // Buffer or String
		    'features': {
		        'concepts': {},
		        'keywords': {},
		    }
		}, function(err, response) {
		    if (err) {
		        console.error(err);
		        res.status(404).json(response)
		    } else {
		        console.log(JSON.stringify(response, null, 2));
		        res.json(response)
		    }
		});
	})
})

// Begin server
server.listen(port, () => console.log(`App running on localhost:${port}`))



// File search api will combine both the textextract plugin with the string-search api
// first by converting all files in the directory to text representations
// then will use the text as an input to match req.params search strings against
// the result is either null or an array with the line number and text of match 
// eg: [ {line: 1, text: 'This is the string to search text in'} ]
function file_search( file, sort ) 
{ 
	var file_extension = file.split('.')[file.split('.').length -1] || "unknown";
	var file_is_url = file.split('//')[0].search('htt') >= 0;
	var sort_order = !!sort ? sort.toLowerCase() === 'asc' ? 1 : -1 : null;

	return new Promise((resolve, reject)=> {
		
		// If the file_is_url then use async ajax call
		!file_is_url ? textract.fromFileWithPath( file, function( error, text_body ) {
			// get keywords by density in the text body
			keywords = get_keywords( text_body, file );
			!!sort ? keywords = 
				Object.keys(keywords)
					.map(k=>k)
					.sort((k1, k2)=> (k1 > k2) ? (1 * sort_order) : (k1 < k2) ? (-1 * sort_order) : 0)
					.map(k=>({ [k]: keywords[k] }))
						.reduce((p,c,i,a)=>{
						p[ Object.keys(c)[0] ] = c[ Object.keys(c)[0] ];
						return p;
					}) : null;

			if (!error) return resolve({ [file]: keywords })
		  	else reject({ [file]: keywords })
		}) : null;



		file_is_url ? textract.fromUrl( file, function( error, text_body ) {
			// get keywords by density in the text body
			keywords = get_keywords( text_body, file );
			!!sort ? keywords = 
				Object.keys(keywords)
					.map(k=>k)
					.sort((k1, k2)=> (k1 > k2) ? (1 * sort_order) : (k1 < k2) ? (-1 * sort_order) : 0)
					.map(k=>({ [k]: keywords[k] }))
					.reduce((p,c,i,a)=>{
						p[ Object.keys(c)[0] ] = c[ Object.keys(c)[0] ];
						return p;
					}) : null;

			if (!error) return resolve({ [file]: keywords })
		  	else reject({ [file]: keywords })
		}) : null;

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