'use strict'
let D2D = require('./d2d')

let Email = require( "../email/email");
let moment = require('moment');

let utils = require('../utils');
let fs = require('fs');
var md5 = require('md5');
const shortid = require('shortid');
// var isJSON = require('is-json');
var urlencode = require('urlencode');
const translate = require('google-translate-api');//ISO 639-1
var intersection = require('array-intersection');

var requrl = '';

const IMG_SIZE_LIMIT = 500000;

module.exports = class Customer extends D2D{

    constructor(){
        super()
    }



    ConfirmEmail(q, res) {

        let that = this;
        let sql = "SELECT user.*" +
            " FROM "+q.user.toLowerCase()+" as user" +
            " WHERE (user.email='"+q.profile.email+"') AND user.email<>''";

        this.mysql_con.query(sql, function (err, result) {
            if (err)
                throw err;

            function insertUser(uid, psw,q) {

                let values = [uid, psw, q.profile.email, JSON.stringify(q.profile)];
                let sql = "INSERT INTO " + q.user.toLowerCase() + " SET  uid=?, psw=?, email=?, profile=?";
                // if(!res._header)
                //     res.writeHead(200, {'Content-Type': 'application/json'});
                // res.end(JSON.stringify(sql));
                // return;
                that.mysql_con.query(sql, values, function (err, result) {

                    if (err) {
                        res.end(JSON.stringify({err: 'Неверные данные'}));
                        return;
                    } else {
                        res.end(JSON.stringify({res: result}));
                    }
                });
            }

            if (result.length > 0) {

                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({"err": "указанный email адрес используется в системе"}));

            } else {
                let psw = shortid.generate();
                let uid = md5(new Date()+q.profile.email);

                res.writeHead(200, {'Content-Type': 'application/json'});
                if(q.profile.avatar) {
                    that.replaceImg_2(q.profile.avatar, function (avatar) {
                        q.profile.avatar = avatar;
                        insertUser(uid, psw,q);
                    });
                }else{
                    insertUser(uid, psw,q);
                }


            }
        });
    }

    UpdProfile(q, res) {

        let that = this;

        var sql =  "SELECT cus.*"+
            " FROM  customer as cus"+
            " WHERE cus.uid='"+q.uid+"' AND cus.psw='"+q.psw+"'";
        // if (!res._header)
        //     res.writeHead(200, {'Content-Type': 'application/json'});
        // res.end(JSON.stringify(sql));
        // return;
        this.mysql_con.query(sql, (err, result)=> {
            if (err)
                throw err;

            if (result.length > 0) {
                let values, sql;
                if(q.profile.avatar && q.profile.avatar.length<IMG_SIZE_LIMIT){
                    that.replaceImg_2(q.profile.avatar, function (avatar) {
                        q.profile.avatar = avatar;
                        if(result[0].email)
                            q.profile.email = result[0].email;
                        values = [JSON.stringify(q.profile), q.uid, q.psw];
                        sql = "UPDATE customer SET   profile=? WHERE uid=? AND psw=?";
                        setTimeout(function () {
                            that.mysql_con.query(sql, values, function (err, result) {
                                if (err) {
                                    throw err;
                                }
                                if (!res._header)
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify({profile: q.profile}));
                            });
                        },100);
                    });
                }else{
                    res.end(JSON.stringify({"err":"Превышен размер изображения"}));
                }
            }else{

                let psw = shortid.generate();

                let values = [JSON.stringify(q.profile), q.uid,psw];
                sql = "INSERT INTO  customer SET profile=?, uid=?, psw=?";

                that.mysql_con.query(sql, values, function (err, result) {
                    if (err) {
                        throw err;
                    }
                    if (!res._header)
                        res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({profile: q.profile, psw:psw, result:result}));
                });
            }
        });
    }


    RegUser(q, res) {

        let that = this;

        var sql =  "SELECT user.*, COUNT(em.email) as em_cnt"+
            " FROM "+q.user.toLowerCase()+" as user, (SELECT email FROM "+q.user.toLowerCase()+" WHERE email='"+q.profile.email+"') as em"+
            " WHERE  uid='"+q.uid+"' AND psw='"+q.psw+"'";


        this.mysql_con.query(sql, function (err, result) {
            if (err) {
                throw err;
            }

            res.writeHead(200, {'Content-Type': 'application/json'});
            if (result.length === 0) {
                res.end(JSON.stringify({"err": "Аккаунт не используется в системе"}));
                return;
            } else {
                if(result[0].em_cnt>0){
                    res.end(JSON.stringify({"err": "Email уже используется в системе"}));
                    return;
                }
                let values, sql;
                if(result[0].profile)
                    if(JSON.parse(result[0].profile).email===q.profile.email) {
                        that.replaceImg_2(q.profile.avatar, function (avatar) {
                            that.replaceImg_2(q.profile.thmb, function (thmb) {
                                q.profile.avatar = avatar;
                                q.profile.thmb = thmb;
                                values = [q.profile.email, JSON.stringify(q.profile), result[0].id];
                                sql = "UPDATE  " + q.user.toLowerCase() + "  SET  email=?, profile=? WHERE id=?";
                                this.mysql_con.query(sql, values, function (err, res_upd) {

                                    if (err) {
                                        res.end(JSON.stringify({err: err}));
                                        return;
                                    }
                                    res.end(JSON.stringify({id: result[0].id}));
                                });
                            });
                        });
                    }
            }
        });
    }

    UpdateOrder(q, res){
        let that = this;
        let status;
        let now = moment().format('YYYY-MM-DD h:mm:ss');
        let sql =
            "SELECT ord.*"+ //, tar.options as tariff"+ // cus.email as cusuid,  DATE_FORMAT(of.date,'%Y-%m-%d') as date" +
            " FROM  customer as cus, orders as ord" +
            //", tariff as tar"+
            " WHERE ord.supuid='"+q.supuid+"'  AND ord.cusuid='"+q.cusuid+"'" +
            " AND cus.psw=\""+q.psw+"\"" +
            //" AND cus.tariff=tar.id AND tar.applicant=\"c\"" +
            " AND cus.uid=ord.cusuid AND ord.date=\""+q.date+"\"" +
            " ORDER BY ord.id DESC";

        this.mysql_con.query(sql, function (err, sel) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            let values, sql;
            if(sel.length>0) {
                values = [JSON.stringify(q.data), q.comment, q.period, q.address, now, sel[0].id];
                sql = 'UPDATE orders SET data=?, comment=?, period=?, address=?, published=? WHERE id=?';
            }else {
                values = [q.cusuid, q.supuid, JSON.stringify(q.data), q.comment,q.address, q.date, q.period,now];
                sql = 'INSERT INTO orders SET cusuid=?, supuid=?, data=?, comment=?, address=?, date=?, period=?, published=?';
            }
            this.mysql_con.query(sql, values, function (err, result) {
                if (err) {
                    res.end(JSON.stringify({err: err}));
                    return;
                }

                if(global.resObj[q.supuid] && global.resObj[q.supuid].connection.writable) {
                    delete q.uid; delete q.func; delete q.proj;
                    resObj[q.supuid].write(utils.formatSSE({func: 'ordered', order: q}));
                }
                res.end(JSON.stringify({result: result, published:now}));

            });
        });
    }

    UpdateOrderStatus(q, res){
        let that = this;
        let sql =
            "SELECT ord.*,  DATE_FORMAT(of.date,'%Y-%m-%d') as date" +
            " FROM  supplier as sup, offers as of, customer as cus, orders as ord"+
            " WHERE sup.email='"+q.supuid+"' AND sup.uid='"+q.uid+"'" +
            " AND of.sup_uid=sup.uid AND cus.email=ord.cusuid AND ord.cusuid=\""+q.cusuid+"\" AND ord.date=\""+q.date+"\"" +
            " AND ord.date='"+q.date+"'"+
            " ORDER BY of.id DESC";

        this.mysql_con.query(sql, function (err, sel) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            if (err) {
                res.end(JSON.stringify({err: err}));
                return;
            }
            let values, sql;
            if(sel.length>0) {
                values = [ q.status, sel[0].id];

                sql = "UPDATE orders SET status=? WHERE id=?";
            }
            this.mysql_con.query(sql, values, function (err, result) {
                if (err) {
                    throw err;
                }

                res.end(JSON.stringify({result: result}));

                if(global.resObj[q.cusuid] && global.resObj[q.cusuid].connection.writable) {
                    sel[0].status = q.status;
                    global.resObj[q.cusuid].write(utils.formatSSE({func:'updateorderstatus',order:sel[0]}));
                }
            });
        });
    }


//     GetSuppliers(q, res){
//
// //////////////////////////////////////////////////////////////////////////////////////////////////////
//         let sql = " SELECT " +
//             " '"+q.date.split('T')[0]+"' as date, of.categories as cats, " +
//             " of.latitude as lat, of.longitude as lon, of.radius, of.data as data, " +
//             " of.published as published, of.deleted as deleted,"+
//             " sup.uid as uid, sup.dict as dict, sup.profile as profile, sup.rating as rating, " +
//             " apprs.totals as apprs"+//общее кол-во подтверждений
//             " FROM  supplier as sup, promo, offers as of," +
//             " (" +
//             " SELECT COUNT(*) as  totals" +
//             " FROM supplier as sup, approved as appr" +
//             " WHERE appr.supuid=sup.uid" +
//             " AND appr.date='"+q.date.split('T')[0]+"'" +
//             " ) AS apprs"+
//             " WHERE sup.uid = of.supuid"+
//             " AND LCASE(sup.promo)=LCASE(promo.code)"+
//             " AND of.latitude>="+ q.areas[0] +" AND of.latitude<="+q.areas[1] +
//             " AND of.longitude>=" + q.areas[2] + " AND of.longitude<=" +q.areas[3]+
//             " AND (of.date='"+q.date.split('T')[0]+"' OR " +
//             " (sup.prolong=1 AND (SELECT id  FROM offers WHERE supuid LIKE sup.uid ORDER BY date DESC LIMIT 1)= of.id))" +
//             " AND of.published IS NOT NULL AND of.deleted IS NULL " +
//             " UNION" +
//             " SELECT '"+q.date.split('T')[0]+"' as date, of.categories as cats, " +
//             " of.latitude as lat, of.longitude as lon, of.radius, of.data as data, " +
//             " of.published as published, of.deleted as deleted,"+
//             " del.uid as uid, del.dict as dict, del.profile as profile, del.rating as rating, " +
//             " apprs.totals as apprs"+//общее кол-во подтверждений" +
//             " FROM  deliver as del, offers as of," +
//             " (" +
//             " SELECT COUNT(*) as  totals" +
//             " FROM deliver as del, approved as appr" +
//             " WHERE appr.supuid=del.uid" +
//             " AND appr.date='"+q.date.split('T')[0]+"'" +
//             " ) AS apprs"+
//             " WHERE del.uid = of.supuid"+
//             " AND of.latitude>="+ q.areas[0] +" AND of.latitude<="+q.areas[1] +
//             " AND of.longitude>=" + q.areas[2] + " AND of.longitude<=" +q.areas[3]+
//             " AND (of.date='"+q.date.split('T')[0]+"' OR del.prolong=1)" +
//             " AND of.published IS NOT NULL AND of.deleted IS NULL";
//
//
//         // if (!res._header)
//         //     res.writeHead(200, {'Content-Type': 'application/json'});
//         // res.end(JSON.stringify(sql));
//         // return;
//         this.mysql_con.query(sql, function (err, result) {
//             if (err) {
//                 throw err;
//             }
//             res.writeHead(200, {'Content-Type': 'application/json'});
//
//             let now = moment().format('YYYY-MM-DD');
//             sql = "UPDATE "+ q.user+" SET region='"+q.areas.toString()+"', date='"+now+"' WHERE uid='"+q.uid+"'";
//
//             that.mysql_con.query(sql, function (err, result) {
//                 if (err) {
//                     throw err;
//                 }
//             });
//
//             if(result.length>0) {
//                 for(let i in result) {
//                     let cats = JSON.parse(result[i].cats);
//
//                     if (intersection(cats, q.categories).length > 0) {
//
//                     }else{
//                         delete result[i];
//                     }
//                 }
//
//                 res.write(urlencode.encode(JSON.stringify(result)));
//             }
//
//             res.end();
//         });
//     }

    GetRating(q, res, cb){
        let sql = " SELECT sup.rating as rating"+
            " FROM  supplier as sup"+
            " WHERE sup.uid = '"+ q.supuid+"'";

        this.mysql_con.query(sql, function (err, result) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            try {
                let rating = JSON.parse(result[0].rating);
                res.end(JSON.stringify({rating: rating.value}));

            }catch(ex){
                res.end();
            }

        });
    }

    RateSupplier(q, res, cb){
        let sql = " SELECT sup.rating as rating"+
            " FROM  supplier as sup"+
            " WHERE sup.uid = '"+ q.supuid+"'";

        this.mysql_con.query(sql, function (err, result) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            try {
                let rating = {};
                if(result[0].rating) {
                    rating = JSON.parse(result[0].rating);
                    rating[q.cusuid] = q.value;

                }else{
                    rating[q.cusuid]=q.value;
                }

                let sum = 0, cnt = 0;
                for (let k in rating) {
                    if(k==='value')
                        continue;
                    sum += parseFloat(rating[k]);
                    cnt++;
                }

                rating.value = (sum/cnt).toFixed(1);

                sql = " UPDATE   supplier  SET rating='" + JSON.stringify(rating) +"'"+
                    " WHERE supplier.uid = '" + q.supuid+"'";
                this.mysql_con.query(sql, function (err, result) {
                    if (err) {
                        throw err;
                    }
                    res.end(JSON.stringify({rating: (sum/cnt).toFixed(1)}));
                });
            }catch(ex){
                res.end();
            }

        });
    }

    ShareLocation(q, res, cb){

        let sql = " SELECT sup.email as email" +
            " FROM supplier as sup" +
            " WHERE" +
            " SPLIT_STR(sup.region,',',1)<'"+q.location[1]+"' AND SPLIT_STR(sup.region,',',2)>'"+q.location[1]+"'"+
            " AND SPLIT_STR(sup.region,',',3)<'"+q.location[0]+"' AND SPLIT_STR(sup.region,',',4)>'"+q.location[0]+"'"+
            " UNION" +
            " SELECT cus.email as email" +
            " FROM customer as cus" +
            " WHERE " +
            " SPLIT_STR(cus.region,',',1)<'"+q.location[1]+ "' AND SPLIT_STR(cus.region,',',2)>'"+q.location[1]+"'"+
            " AND SPLIT_STR(cus.region,',',3)<'"+q.location[0]+ "' AND SPLIT_STR(cus.region,',',4)>'"+q.location[0]+"'";

        this.mysql_con.query(sql, function (err, result) {
            if (err) {
                throw err;
            }
            if (!res._header)
                res.writeHead(200, "OK", {'Content-Type': 'text/plain'});

            if(result.length>0){
                for(let r in result){
                    let sse = resObj[result[r].email];
                    if(sse){
                        sse.write(utils.formatSSE({"func":"sharelocation","email":q.supuid,"location":q.location}));
                    }
                }
            }
            if(cb) {
                cb();
            }else{
                res.end(JSON.stringify({func: 'sharelocation', result: result.length}));
            }
        });
    }

    GetApproved(q, res) {

        let sql =
            "SELECT appr.* " +
            " FROM customer as cus, approved as appr" +
            " WHERE cus.uid='"+q.uid +"' AND appr.cusuid=cus.uid"+
            " AND appr.date='"+q.date+"'";

        this.mysql_con.query(sql, function (err, result) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});

            if(result && result.length>0){
                res.write(JSON.stringify(result));
            }
            res.end();
        });
    }


}