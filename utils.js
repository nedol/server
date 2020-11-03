'use strict'
let http = require('http');
let https = require('https');

module.exports = {

    formatSSE(str){
        return 'data: '+ JSON.stringify(str) +'\n'+',retry: 100'+ '\n\n';
    },

    getParameterByName: function (name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
    },

    toJSONLocal: function (date) {
    var local = new Date(date);
    local.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return local.toJSON().slice(0, 10);
    },

    QueryMethod : function (protocol,options, postData, res, cb) {
        let http_;
        if(protocol==='http')
            http_ = http;
        else if(protocol==='https')
            http_ = https;
    var req = http_.request(options, function (res) {
        console.log('Status: ' + res.statusCode);
        console.log('Headers: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (body) {
            console.log('Body: ' + body);
            cb(body, res);
        });
    });
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        cb('error', res);
    });
    // write data to request body
    if (postData)
        req.write(postData);
    req.end();

    },

    Parse:function (result) {
        try {
            return JSON.parse(result);
        } catch (e) {
            throw e;
        }
    },
    HTML:function(){
        var x,mnem=
            {34:"quot",38:"amp",39:"apos",60:"lt",62:"gt",402:"fnof",
            338:"OElig",339:"oelig",352:"Scaron",353:"scaron",
            376:"Yuml",710:"circ",732:"tilde",8226:"bull",8230:"hellip",
            8242:"prime",8243:"Prime",8254:"oline",8260:"frasl",8472:"weierp",
            8465:"image",8476:"real",8482:"trade",8501:"alefsym",8592:"larr",
            8593:"uarr",8594:"rarr",8595:"darr",8596:"harr",8629:"crarr",
            8656:"lArr",8657:"uArr",8658:"rArr",8659:"dArr",8660:"hArr",
            8704:"forall",8706:"part",8707:"exist",8709:"empty",8711:"nabla",
            8712:"isin",8713:"notin",8715:"ni",8719:"prod",8721:"sum",
            8722:"minus",8727:"lowast",8730:"radic",8733:"prop",8734:"infin",
            8736:"ang",8743:"and",8744:"or",8745:"cap",8746:"cup",8747:"int",
            8756:"there4",8764:"sim",8773:"cong",8776:"asymp",8800:"ne",
            8801:"equiv",8804:"le",8805:"ge",8834:"sub",8835:"sup",8836:"nsub",
            8838:"sube",8839:"supe",8853:"oplus",8855:"otimes",8869:"perp",
            8901:"sdot",8968:"lceil",8969:"rceil",8970:"lfloor",8971:"rfloor",
            9001:"lang",9002:"rang",9674:"loz",9824:"spades",9827:"clubs",
            9829:"hearts",9830:"diams",8194:"ensp",8195:"emsp",8201:"thinsp",
            8204:"zwnj",8205:"zwj",8206:"lrm",8207:"rlm",8211:"ndash",
            8212:"mdash",8216:"lsquo",8217:"rsquo",8218:"sbquo",8220:"ldquo",
            8221:"rdquo",8222:"bdquo",8224:"dagger",8225:"Dagger",8240:"permil",
            8249:"lsaquo",8250:"rsaquo",8364:"euro",977:"thetasym",978:"upsih",982:"piv"},
            tab=("nbsp|iexcl|cent|pound|curren|yen|brvbar|sect|uml|"+
                "copy|ordf|laquo|not|shy|reg|macr|deg|plusmn|sup2|sup3|"+
                "acute|micro|para|middot|cedil|sup1|ordm|raquo|frac14|"+
                "frac12|frac34|iquest|Agrave|Aacute|Acirc|Atilde|Auml|"+
                "Aring|AElig|Ccedil|Egrave|Eacute|Ecirc|Euml|Igrave|"+
                "Iacute|Icirc|Iuml|ETH|Ntilde|Ograve|Oacute|Ocirc|Otilde|"+
                "Ouml|times|Oslash|Ugrave|Uacute|Ucirc|Uuml|Yacute|THORN|"+
                "szlig|agrave|aacute|acirc|atilde|auml|aring|aelig|ccedil|"+
                "egrave|eacute|ecirc|euml|igrave|iacute|icirc|iuml|eth|ntilde|"+
                "ograve|oacute|ocirc|otilde|ouml|divide|oslash|ugrave|uacute|"+
                "ucirc|uuml|yacute|thorn|yuml").split("|");
        for(x=0;x<96;x++)mnem[160+x]=tab[x];
        tab=("Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|"+
            "Lambda|Mu|Nu|Xi|Omicron|Pi|Rho").split("|");
        for(x=0;x<17;x++)mnem[913+x]=tab[x];
        tab=("Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega").split("|");
        for(x=0;x<7;x++)mnem[931+x]=tab[x];
        tab=("alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|"+
            "lambda|mu|nu|xi|omicron|pi|rho|sigmaf|sigma|tau|upsilon|phi|chi|"+
            "psi|omega").split("|");
        for(x=0;x<25;x++)mnem[945+x]=tab[x];
        return {
            encode:function(text){
                return text.replace(/[\u00A0-\u2666<>\&]/g,function(a){
                    return "&"+(mnem[a=a.charCodeAt(0)]||"#"+a)+";"
                })
            },
            decode:function(text){
                return text.replace(/\&#?(\w+);/g,function(a,b){
                    if(Number(b))return String.fromCharCode(Number(b));
                    for(x in mnem){
                        if(mnem[x]===b)return String.fromCharCode(x);
                    }
                })
            }
        }
    },
    getObjects: function(obj, key, val) {
        var objects = [];
        for (var i in obj) {
            if (!obj.hasOwnProperty(i)) continue;
            if (typeof obj[i] == 'object') {
                objects = objects.concat(getObjects(obj[i], key, val));
            } else if (i == key && obj[key] == val) {
                objects.push(obj);
            }
        }
        return objects;
    }


}