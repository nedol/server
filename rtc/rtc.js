'use strict'
let md5 = require('md5.js');
let RTCItem = require('./RTCItem');
const fs = require('fs');

const utils = require('../utils');
let _ = require('lodash');

let log4js = require('log4js');
log4js.configure({
    appenders: { users: { type: 'file', filename: 'users.log' }},
    categories: { default: { appenders: ['users'], level: 'all' } }
});
const logger = log4js.getLogger('users');

global.rtcPull = {'user':{}, 'operator':{}};


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
            let that = this;
            res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            res.socket.q = q;

            res.socket.on('close', function (ev) {

            });

            res.socket.on('end', function (ev) {
                if(q.role==='operator' && global.rtcPull[q.role][q.trans][q.uid]) {
                    that.BroadcastOperatorStatus(q, 'close');
                    global.rtcPull[q.role][q.trans][q.uid].status = 'close';
                }
            });

            if(!global.rtcPull[q.role][q.trans])
                global.rtcPull[q.role][q.trans] = {};
            if(!global.rtcPull[q.role][q.trans][q.uid])
                global.rtcPull[q.role][q.trans][q.uid] = {};


            global.rtcPull[q.role][q.trans][q.uid].res = res;

            if(!global.rtcPull[q.role][q.trans][q.uid].email)
                global.rtcPull[q.role][q.trans][q.uid].email = q.email;


            if(!global.rtcPull[q.role][q.trans][q.uid].role)
                global.rtcPull[q.role][q.trans][q.uid].role = q.role;


            if(!global.rtcPull[q.role][q.trans][q.uid].status)
                global.rtcPull[q.role][q.trans][q.uid].status = q.status;


            if(!global.rtcPull[q.role][q.trans][q.uid].abonent)
                global.rtcPull[q.role][q.trans][q.uid].abonent = q.abonent;



            res.write(utils.formatSSE({
                msg:'sse',
                desc:global.rtcPull[q.role][q.trans][q.uid].desc,
                cand:global.rtcPull[q.role][q.trans][q.uid].cand,
                uid:global.rtcPull[q.role][q.trans][q.uid].uid,
                abonent:global.rtcPull[q.role][q.trans][q.uid].abonent,
                status:global.rtcPull[q.role][q.trans][q.uid].status,
                retry: 100
            }));

        }else {
            res.end();
            switch (q.func) {
                case 'log':
                    logger.info(q.func + " from " + q.role + ":" + q.text);
                    break;
                case 'check':
                    this.SetParams(req, q, global.rtcPull[q.role][q.trans][q.uid].res);

                    if(q.role==='operator') {

                        // var files;
                        // try {
                        //     files = fs.readdirSync('./rtc/html/');//not the same on server!!!!
                        // } catch (ex) {
                        //
                        // }
                        if(!global.rtcPull[q.role][q.trans][q.uid].res.finished)
                            global.rtcPull[q.role][q.trans][q.uid].res.write(utils.formatSSE(
                                {'diag': {
                                    status:global.rtcPull[q.role][q.trans][q.uid].status
                                }}));


                    }else if(q.role==='user'){
                        let cnt_queue = 0;
                        for (let uid in global.rtcPull[q.role][q.trans]) {
                            if (global.rtcPull[q.role][q.trans][uid].role==='user')
                                if(global.rtcPull[q.role][q.trans][uid].status==='call')
                                    if (global.rtcPull[q.role][q.trans][uid].uid === q.uid) {
                                        cnt_queue++;
                                    }
                        }
                        if(!global.rtcPull[q.role][q.trans][q.uid].res.finished)
                            global.rtcPull[q.role][q.trans][q.uid].res.write(utils.formatSSE({
                                email: q.email,
                                check: true,
                                queue: String(cnt_queue)
                            }));

                        this.SendOperatorStatus(q);
                    }


                    break;

                case 'offer':
                    //logger.info("func:"+q.func+" "+q.role+":"+q.uid);

                    this.SetParams(req, q, res);

                    if(q.role==='operator')
                        this.BroadcastOperatorStatus(q, 'offer');

                    break;

                case 'call':
                    //logger.info("func:"+q.func+" "+q.role+":"+q.uid);
                    this.SetParams(req, q, global.rtcPull[q.role][q.trans][q.uid].res);
                    this.HandleCall(req, q);

                    break;


                case 'status':
                    this.SetParams(req, q, global.rtcPull[q.role][q.trans][q.uid].res);
                    break;

                case 'close':

                    this.BroadcastOperatorStatus(q, 'close');
                    // if(global.rtcPull[q.role]['relay'][q.uid]) {
                    //     global.rtcPull[q.role]['relay'][q.uid].res.end(utils.formatSSE({close: true, uid: q.uid}));
                    //     global.rtcPull[q.role]['relay'][q.uid].status = 'close';
                    // }
                    if(global.rtcPull[q.role][q.trans][q.uid]) {
                        //global.rtcPull[q.role][q.trans][q.uid].res.end(utils.formatSSE({close: true, uid: q.uid}));
                        global.rtcPull[q.role][q.trans][q.uid].status = 'close';
                        global.rtcPull[q.role][q.trans][q.uid].abonent = null;
                    }
                    //global.rtcPull[q.role]['relay'][q.uid] = null;
                    //global.rtcPull[q.role][q.trans][q.uid] = null;
                    res.end();
                    break;
                case 'translate':
                    this.translate(q, res);
                    break;

                case 'datach':

                    this.SetParams(req, q, global.rtcPull[q.role][q.trans][q.uid].res);
                    this.HandleCall(req, q, global.rtcPull[q.role][q.trans][q.uid].res);
                    if (!global.rtcPull[q.role][q.trans][q.uid].res.finished)
                        global.rtcPull[q.role][q.trans][q.uid].res.write(utils.formatSSE({msg: 'empty'}));
                    break;
            }

        }
    }

    SendOperators(req, q , res){

        let operators = {};

        for(let trans in global.rtcPull) {
            for (let uid in global.rtcPull[q.role][trans]) {
                if(global.rtcPull[q.role][trans][uid]!=='operator')
                    continue;
                let email = global.rtcPull[q.role][trans][uid].email;

                var domain = email.split("@")[1];
                let req_dom = q.email.split("@")[1];
                let status = global.rtcPull[q.role][trans][uid].status;
                if (domain === req_dom) {
                    operators[uid] = {
                        trans:trans,
                        email: global.rtcPull[q.role][trans][uid].email,
                        status: status,
                        queue: global.queue[q.role][trans][global.rtcPull[q.role][trans][uid].uid]}
                }
            }
        }

        global.rtcPull[q.role][q.trans][q.uid].res.write(utils.formatSSE({operators: operators}));
    }

    SetParams(req, q, res){

        if(!global.rtcPull[q.role][q.trans][q.uid]){
            global.rtcPull[q.role][q.trans][q.uid] = new RTCItem(req, q);
        }

        global.rtcPull[q.role][q.trans][q.uid].origin = req.headers.origin;//

        if(q.uid)
            global.rtcPull[q.role][q.trans][q.uid].uid = q.uid;//
        if(q.email)
            global.rtcPull[q.role][q.trans][q.uid].email = q.email;//
        if(q.status)
            global.rtcPull[q.role][q.trans][q.uid].status = q.status;//
        if(q.desc) {
            global.rtcPull[q.role][q.trans][q.uid].desc =  q.desc;
        }
        if(q.cand) {
            global.rtcPull[q.role][q.trans][q.uid].cand = q.cand;
        }
        if(q.abonent)
            global.rtcPull[q.role][q.trans][q.uid].abonent = q.abonent;//

    }

    BroadcastOperatorStatus(q, status){

        let queue = 0;
        for (let uid in global.rtcPull['user'][q.trans]) {
            if (q.uid && global.rtcPull['user'][q.trans][uid].res.socket && global.rtcPull['user'][q.trans][uid].res.socket.writable){
                queue++;
            }
        }
        let role = (q.role ==='operator'?'user':'operator');

        let operators = {};
        operators[q.uid] = {
            role:q.role,
            trans: q.trans,
            email: (global.rtcPull[role][q.trans][q.uid]?global.rtcPull[role][q.trans][q.uid].email:''),
            status: status,
            queue:queue,
            desc: (status==='offer'?global.rtcPull[q.role][q.trans][q.uid].desc:''),
            cand: (status==='offer'?global.rtcPull[q.role][q.trans][q.uid].cand:'')
        }

        for (let uid in global.rtcPull[role][q.trans]) {
            if(global.rtcPull[role][q.trans][uid].abonent===q.uid)
                if (!global.rtcPull[role][q.trans][uid].res.finished) {
                    global.rtcPull[role][q.trans][uid].res.write(utils.formatSSE({operators:operators}));
                }
        }
    }

    SendOperatorStatus(q){
        if (global.rtcPull['operator'][q.trans][q.abonent]
            && global.rtcPull['operator'][q.trans][q.abonent].status==='offer'){
            let operator = {
                uid:q.abonent,
                trans:q.trans,
                email: global.rtcPull['operator'][q.trans][q.abonent].email,
                status: global.rtcPull['operator'][q.trans][q.abonent].status,
                desc: global.rtcPull['operator'][q.trans][q.abonent].desc,
                cand: global.rtcPull['operator'][q.trans][q.abonent].cand
            }
            if(!global.rtcPull[q.role][q.trans][q.uid].res.finished)
                global.rtcPull[q.role][q.trans][q.uid].res.write(utils.formatSSE({operator:operator}));
        }
    }

    SendQueueUsers(q, queue){
        for(let i in queue){
            let uid = queue[i];
            global.rtcPull[q.role][q.trans][uid].res.write(utils.formatSSE(
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
        for (let uid in global.rtcPull[q.role][q.trans]) {
            if (global.rtcPull[q.role][q.trans][uid].role==='user' && global.rtcPull[q.role][q.trans][uid].status==='call')
                if (global.rtcPull[q.role][q.trans][uid].uid === q.uid && global.rtcPull[q.role][q.trans][uid].res.socket.writable){
                    queue++;
                }
        }
        global.rtcPull[q.role][q.trans][uid].res.write(utils.formatSSE(
            {
                uid:uid,
                email: q.email,
                element: '.call-queue',
                html:String(queue),
                trans:q.trans
            }));

    }

    HandleCall(req, q, res){
        if(q.role === 'user'){
            if(q.status === 'offer') {
                if(!global.rtcPull['user'][q.trans][q.uid].res.finished &&
                    global.rtcPull['user'][q.trans][q.abonent].res.socket.writable) {
                    let remAr = {
                        "desc": global.rtcPull['operator'][q.trans][q.abonent].desc,
                        "cand": global.rtcPull['operator'][q.trans][q.abonent].cand,
                        "trans": q.trans,
                        "abonent": q.uid
                    }
                    global.rtcPull['user'][q.trans][q.uid].res.write(utils.formatSSE(remAr));
                }else{
                    let remAr = {
                        "trans": q.trans,
                        "abonent": q.uid,
                        status: 'close'
                    }
                    global.rtcPull['user'][q.trans][q.uid].res.write(utils.formatSSE(remAr));
                }
            }if(q.status === 'call'){
                if( !global.rtcPull['operator'][q.trans][q.abonent].abonent ||
                    global.rtcPull['operator'][q.trans][q.abonent].abonent===q.uid
                ) {
                    if (!global.rtcPull['operator'][q.trans][q.abonent].res.finished) {
                        //global.rtcPull['operator'][q.trans][q.abonent].abonent = q.uid;
                        let remAr = {
                            "desc": q.desc,
                            "cand": q.cand,
                            "trans": q.trans,
                            "abonent": q.uid
                        }
                        global.rtcPull['operator'][q.trans][q.abonent].res.write(utils.formatSSE(remAr));

                        if(q.desc){
                            for (let uid in global.rtcPull['user'][q.trans]) {
                                if(global.rtcPull['user'][q.trans][uid].abonent===q.abonent)
                                    if(uid !==q.uid)
                                        if (!global.rtcPull['user'][q.trans][uid].res.finished) {
                                            global.rtcPull['user'][q.trans][uid].res.write(utils.formatSSE({operators:{[q.abonent]:{trans:q.trans,status:'busy'}}}));
                                        }
                            }
                        }
                    }

                }
                global.rtcPull['user'][q.trans][q.uid].desc = '';
                global.rtcPull['user'][q.trans][q.uid].cand = '';

            }
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