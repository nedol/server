import https from 'https';

import http from 'http';

import globaljs from './global';

import path from 'path';
import url from 'url';

let con_param = globaljs.con_param; //change every 8 min

String.prototype.replaceAll = function (search, replace) {
	return this.split(search).join(replace);
};

export default function HandleRequest(req, q, res) {}

// wget https://nodejs.org/dist/v9.7.0/node-v9.7.0-linux-x64.tar.x
//     tar xJf node-v9.7.0-linux-x64.tar.xz --strip 1
// rm node-v9.7.0-linux-x64.tar.xz
