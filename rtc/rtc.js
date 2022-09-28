'use strict'
var md5 = require('md5.js');
var RTCItem = require('./RTCItem');
var fs = require('fs');

const utils = require('../utils');


var log4js = require('log4js');
log4js.configure({
    appenders: { users: { type: 'file', filename: 'users.log' }},
    categories: { default: { appenders: ['users'], level: 'all' } }
});
const logger = log4js.getLogger('users');

global.rtcPull = {'all':{},
    'relay':{}};
global.queue = {'all':{},
    'relay':{}}

global.resAr = [];

module.exports = class RTC {

    constructor() {

    }


    dispatch(req, q , res) {
        if(q.content){
            fs.readFile(q.content, 'utf8', function(err, contents) {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({'html':contents}));
            });
        }
        else if(q.sse){
            res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            if(!global.rtcPull['all'][q.uid])
                global.rtcPull['all'][q.uid] = {};
            if(!global.rtcPull['relay'][q.uid])
                global.rtcPull['relay'][q.uid] = {};
            global.rtcPull['all'][q.uid].res = res;
            global.rtcPull['relay'][q.uid].res = res;

            if(!global.rtcPull['all'][q.uid].email)
                global.rtcPull['all'][q.uid].email = q.email;
            if(!global.rtcPull['relay'][q.uid].email)
                global.rtcPull['relay'][q.uid].email = q.email;

            if(!global.rtcPull['all'][q.uid].role)
                global.rtcPull['all'][q.uid].role = q.role;
            if(!global.rtcPull['relay'][q.uid].role)
                global.rtcPull['relay'][q.uid].role = q.role;


            res.write(utils.formatSSE({msg:'sse'}));

        }else {
            res.end();
            switch (q.func) {
                case 'log':
                    logger.info(q.func + " from " + q.role + ":" + q.text);
                    break;
                case 'check':

                    if (!global.rtcPull['all'][q.uid].status)
                        global.rtcPull['all'][q.uid].status = q.status;
                    if (!global.rtcPull['relay'][q.uid].status)
                        global.rtcPull['relay'][q.uid].status = q.status;
                    if(q.role==='operator') {

                        var files;
                        try {
                            files = fs.readdirSync('./rtc/html/');//not the same on server!!!!
                        } catch (ex) {

                        }

                        global.rtcPull[q.trans][q.uid].res.write(utils.formatSSE({'html': files}));


                    }else if(q.role==='user'){
                        let cnt_queue = 0;
                        for (let uid in global.rtcPull[q.trans]) {
                            if (global.rtcPull[q.trans][uid].role==='user')
                                if(global.rtcPull[q.trans][uid].status==='call')
                                    if (global.rtcPull[q.trans][uid].uid === q.uid) {
                                        cnt_queue++;
                                    }
                        }
                        global.rtcPull[q.trans][q.uid].res.write(utils.formatSSE({
                            email: q.email,
                            check: true,
                            queue: String(cnt_queue)
                        }));

                        this.SendOperatorStatus(q, q.abonent);
                    }


                    break;

                case 'offer':
                    //logger.info("func:"+q.func+" "+q.role+":"+q.uid);

                    this.SetParams(req, q);

                    this.HandleCall(req, q);

                    this.BroadcastOperatorStatus(q, 'offer');

                    break;

                case 'call':
                    //logger.info("func:"+q.func+" "+q.role+":"+q.uid);
                    this.SetParams(req, q);
                    this.HandleCall(req, q);

                    break;


                case 'status':
                    this.SetParams(req, q);
                    break;

                case 'close':

                    this.BroadcastOperatorStatus(q, 'close');
                    global.rtcPull['relay'][q.uid].res.end(utils.formatSSE({close: true,uid:q.uid}));
                    global.rtcPull['all'][q.uid].res.end(utils.formatSSE({close: true,uid:q.uid}));
                    let uid = global.rtcPull['all'][q.uid].uid || global.rtcPull['relay'][q.uid].uid;

                    global.rtcPull['relay'][q.uid].status = 'close';
                    global.rtcPull['all'][q.uid].status = 'close';

                    if(global.queue['all'][uid])
                        global.queue['all'][uid][q.uid].status = 'close';
                    if(global.queue['relay'][uid])
                        global.queue['relay'][uid][q.uid].status = 'close';

                    break;
                case 'translate':
                    this.translate(q, res);
                    break;

                case 'datach':

                    this.SetParams(req, q, global.rtcPull[q.trans][q.uid].res);
                    this.HandleCall(req, q, global.rtcPull[q.trans][q.uid].res);
                    if (!global.rtcPull[q.trans][q.uid].res.finished)
                        global.rtcPull[q.trans][q.uid].res.write(utils.formatSSE({msg: 'empty'}));
                    break;
            }

        }
    }

    SendOperators(req, q , res){

        let operators = {};

        for(let trans in global.rtcPull) {
            for (let uid in global.rtcPull[trans]) {
                if(global.rtcPull[trans][uid]!=='operator')
                    continue;
                let email = global.rtcPull[trans][uid].email;

                var domain = email.split("@")[1];
                let req_dom = q.email.split("@")[1];
                let status = global.rtcPull[trans][uid].status;
                if (domain === req_dom) {
                    operators[uid] = {
                        trans:trans,
                        email: global.rtcPull[trans][uid].email,
                        status: status,
                        queue: global.queue[trans][global.rtcPull[trans][uid].uid]}
                }
            }
        }

        global.rtcPull[q.trans][q.uid].res.write(utils.formatSSE({operators: operators}));
    }

    SetParams(req, q){

        if(!global.rtcPull[q.trans][q.uid]){
            global.rtcPull[q.trans][q.uid] = new RTCItem(req, q);
        }

        global.rtcPull[q.trans][q.uid].origin = req.headers.origin;//

        if(q.uid)
            global.rtcPull[q.trans][q.uid].uid = q.uid;//
        if(q.abonent)
            global.rtcPull[q.trans][q.uid].abonent= q.abonent;//
        if(q.email)
            global.rtcPull[q.trans][q.uid].email = q.email;//
        if(q.status)
            global.rtcPull[q.trans][q.uid].status = q.status;//
        if(q.desc)
            global.rtcPull[q.trans][q.uid].desc = q.desc;//store local desc
        if(q.cand)
            global.rtcPull[q.trans][q.uid].cand = q.cand;//

        if(q.role==='user') {
            if (!global.queue[q.trans]) {
                global.queue[q.trans] = {};
            }
            if (!global.queue[q.trans][q.uid]) {
                global.queue[q.trans][q.uid] = [];
            }
            global.queue[q.trans][q.uid].push(q.uid);
        }
    }

    BroadcastOperatorStatus(q, status){
        let queue = 0;
        for (let uid in global.rtcPull[q.trans]) {
            if (global.rtcPull[q.trans][uid].role==='user')
                if (global.rtcPull[q.trans][uid].uid === q.uid && global.rtcPull[q.trans][uid].res.socket.writable){
                    queue++;
                }
        }

        if(q.role==='operator') {
            let operators = {};
            operators[q.uid] = {
                trans:'all',
                email: global.rtcPull['all'][q.uid].email,
                status: status,
                queue:queue
            }
            for (let uid in global.rtcPull['all']) {
                if (!global.rtcPull['all'][uid].res.finished) {
                    global.rtcPull['all'][uid].res.write(utils.formatSSE({operators:operators}));
                }
            }
        }
    }


    SendOperatorStatus(q, abonent){
        if (global.rtcPull['operator'][q.trans][abonent]
            && global.rtcPull['operator'][q.trans][abonent].status!=='close'){
            let operator = {
                trans:q.trans,
                email: global.rtcPull['operator'][q.trans][abonent].email,
                status: global.rtcPull['operator'][q.trans][abonent].status
            }
            global.rtcPull[q.role][q.trans][q.uid].res.write(utils.formatSSE({operator:operator}));
        }
    }

    SendQueueUsers(q, queue){
        for(let i in queue){
            let uid = queue[i];
            global.rtcPull[q.trans][uid].res.write(utils.formatSSE(
                {
                    uid:uid,
                    email: q.email,
                    element: '.call-queue',
                    html:i,
                    trans:q.trans
                }));
        }
    }

    SendQueueOperator(uid, q){
        let queue = 0;
        for (let uid in global.rtcPull[q.trans]) {
            if (global.rtcPull[q.trans][uid].role==='user' && global.rtcPull[q.trans][uid].status==='call')
                if (global.rtcPull[q.trans][uid].uid === q.uid && global.rtcPull[q.trans][uid].res.socket.writable){
                    queue++;
                }
        }
        global.rtcPull[q.trans][uid].res.write(utils.formatSSE(
            {
                uid:uid,
                email: q.email,
                element: '.call-queue',
                html:String(queue),
                trans:q.trans
            }));

    }

    HandleCall(req, q, res) {

        let remAr = {};
        let caller = global.rtcPull[q.trans][q.uid];
        if (!caller)
            return;
        let abonent = global.rtcPull[q.trans][caller.peer];
        if (abonent && (abonent.peer === q.uid)) {
            if (caller.desc) {
                remAr = {
                    "desc": caller.desc,
                    "cand": caller.cand,
                    "trans": q.trans,
                    "abonent": q.uid
                }
                abonent.res.write(utils.formatSSE(remAr));
                caller.desc = null;
                caller.cand = null;
            } else if (caller.msg) {
                remAr = {
                    "msg": caller.msg
                }
                abonent.res.write(utils.formatSSE(remAr));
            }
        } else {

            if (q.role === 'operator') {
                if (global.queue[q.trans][q.uid] && global.queue[q.trans][q.uid].length > 0) {
                    let uid = global.queue[q.trans][q.uid][0];
                    global.queue[q.trans][q.uid].splice(0, 1);

                    this.Peer(caller, q, uid);
                }
            } else if (q.role === 'user') {
                for (let uid in global.rtcPull[q.trans]) {

                    if (!global.rtcPull[q.trans][uid].res || global.rtcPull[q.trans][uid].res.finished) {
                        delete global.rtcPull[q.trans][uid];
                        continue;
                    }

                    if (uid === q.uid)
                        continue;
                    if (q.call)
                        if (q.call !== global.rtcPull[q.trans][uid].uid) {
                            continue;
                        }

                    if (q.phone)
                        if (q.phone !== global.rtcPull[q.trans][uid].phone)
                            continue;

                    if (global.rtcPull[q.trans][uid].peer)
                        if (global.rtcPull[q.trans][uid].peer !== q.uid) {
                            continue;
                        }

                    if (uid !== q.abonent)
                        continue;

                    this.SendQueueUsers(q, global.queue[q.trans][q.uid]);
                    global.queue[q.trans][q.uid].splice(0, 1);
                    //this.SendQueueOperator(uid,q, global.queue[q.trans][q.email].length);

                    this.Peer(caller, q, uid);

                    if (global.rtcPull[q.trans][uid].desc === 'offer' && q.desc && q.cand) {
                        remAr = {
                            "desc": q.desc,
                            "cand": q.cand,
                            "trans": q.trans,
                            "abonent": uid
                        }
                        global.rtcPull[q.trans][uid].res.write(utils.formatSSE(remAr));

                        global.rtcPull[q.trans][q.uid].peer = uid;
                        global.rtcPull[q.trans][uid].peer = q.uid;

                        global.rtcPull[q.trans][q.uid].status = 'busy';
                        global.rtcPull[q.trans][uid].status = 'busy';

                        this.BroadcastOperatorStatus(q, 'busy');
                    }
                }
            }
        }
    }

    Peer(caller,q,uid) {

            if (global.rtcPull[q.trans][uid].desc && global.rtcPull[q.trans][uid].cand) {
                let remAr = {
                    "desc": global.rtcPull[q.trans][uid].desc,
                    "cand": global.rtcPull[q.trans][uid].cand,
                    "trans": q.trans,
                    "abonent": uid
                }

                caller.res.write(utils.formatSSE(remAr));

                global.rtcPull[q.trans][q.uid].peer = uid;
                global.rtcPull[q.trans][uid].peer = q.uid;

                global.rtcPull[q.trans][q.uid].status = 'busy';
                global.rtcPull[q.trans][uid].status = 'busy';
                this.BroadcastOperatorStatus(q, 'busy');

            }

    }

    translate(q, res){

        let data = JSON.parse(q.data);
        let to = q.to;
        let cnt = 0;

        var curriedDoWork = function(obj,trans) {
            cnt++;
            console.log(trans.text + obj.key);
            obj.data[obj.key][obj.to] = trans.text;
            obj.data[obj.key][trans.from.language.iso] = obj.src;
            if(obj.length===cnt) {
                obj.res.end(JSON.stringify(obj.data));
            }

        };

        for(let w=0; w<Object.keys(data).length; w++) {
            let key = Object.keys(data)[w];
            let from = Object.keys(data[key])[0];
            let obj = {res:res,key:key, data:data, to:to, from:from, src:data[key][from],length:Object.keys(data).length};
            //https://github.com/matheuss/google-translate-api

            new translate(data[key][from], {to: to}).then(curriedDoWork.bind(null, obj),function (ev) {
                console.log(ev);
            });

        }

    }

}
