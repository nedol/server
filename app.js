import HandleRequest from './server/server.js';
import qs from 'querystring';
import url from 'url';
import express from 'express';
let app = express();
import http from 'http';

function processPost(request, response, callback) {
	var queryData = '';
	if (typeof callback !== 'function') return null;

	if (request.method == 'POST') {
		request.on('data', function (data) {
			queryData += data;
			if (queryData.length > 1e9) {
				//LIMIT!
				queryData = '';
			}
		});

		request.on('end', function () {
			if (queryData.length > 0) {
				request.post = JSON.parse(queryData);
				callback(request, response);
			}
		});
	} else {
		response.writeHead(405, { 'Content-Type': 'text/plain' });
		response.end();
	}
}

var node = http.createServer(function (req, res) {
	// res.writeHead(200, {'Content-Type': 'application/json'});
	// res.end('test');
	// return;
	res.setHeader('Access-Control-Allow-Origin', '*');
	// Request methods you wish to allow
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	// Request headers you wish to allow
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('Access-Control-Allow-Credentials', true);

	if (req.method == 'POST') {
		processPost(req, res, function (req, res) {
			HandleRequest(req, req.post, res);
		});
	} else {
		var q = url.parse(req.url, true).query;

		// res.writeHead(200, {'Content-Type': 'application/json'});
		// res.end(JSON.stringify({'test get':q.func}));
		// return;

		HandleRequest(req, q, res);
	}
});

node.listen(3000);
console.log('server listening on port 3000');
