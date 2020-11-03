'use strict'
let D2D = require('./d2d')

let Email = require( "../email/email");
let moment = require('moment');

let _ = require('lodash');
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

module.exports = class Deliver extends D2D{

    constructor(){
        super()
    }

    UpdProfile(q, res) {

        let that = this;

        var sql =  "SELECT del.*"+
            " FROM  deliver as del"+
            " WHERE del.uid='"+q.uid+"' AND del.psw='"+q.psw+"'";

        this.mysql_con.query(sql, function (err, result) {
            if (err)
                throw err;
            res.writeHead(200, {'Content-Type': 'application/json'});
            if (result.length > 0) {
                let values, sql;
                if(q.profile.avatar.length<IMG_SIZE_LIMIT && q.profile.thmb.length<IMG_SIZE_LIMIT) {
                    that.replaceImg_2(q.profile.avatar, function (avatar) {
                        that.replaceImg_2(q.profile.thmb, function (thmb) {
                            q.profile.avatar = avatar;
                            q.profile.thmb = thmb;
                            q.profile.email = result[0].email;
                            values = [JSON.stringify(q.profile), result[0].tariff, q.uid, q.psw];
                            sql = "UPDATE deliver SET  profile=?, tariff=? WHERE  uid=? AND psw=?";
                            this.mysql_con.query(sql, values, function (err, result) {
                                if (err) {
                                    throw err;
                                }

                                res.end(JSON.stringify({values:values}));
                            });
                        });
                    });
                }else{
                    res.end(JSON.stringify({"err":"Превышен размер изображения"}));
                    return;
                }
            }
        });
    }

    OnClickUserProfile(li){

        $('#profile_container').css('display','block');
        $('#profile_container iframe').attr('src',"../src/profile/profile.customer.html");
        $('#profile_container iframe').off();
        $('#profile_container iframe').on('load',function () {
            $('#profile_container iframe')[0].contentWindow.InitProfileUser();

            $('.close_browser',$('#profile_container iframe').contents()).on('touchstart click', function (ev) {
                $('#profile_container iframe')[0].contentWindow.profile_cus.Close();
                $('#profile_container').css('display', 'none');
            });
        });
        this.MakeDraggableCarousel($( "#profile_container" ));
        $( "#profile_container" ).resizable({});



        //this.MakeDraggableCarousel($('body', $('#profile_container iframe').contents()));

    }

    UpdateOffer(q, res){
        let that = this;
        let now = moment().format('YYYY-MM-DD h:mm:ss');
        let sql =
            "SELECT of.*, del.suppliers as suppliers" +
            " FROM  deliver as del, offers as of"+
            " WHERE of.supuid=del.uid AND del.uid='"+q.uid+"' AND del.psw='"+q.psw +"'"+
            " AND of.date=DATE_FORMAT('"+q.date+"','%Y-%m-%d') AND of.published IS NOT NULL AND of.deleted IS NULL"+
            " ORDER BY of.id DESC";

        this.mysql_con.query(sql, function (err, sel) {
            if (err) {
                throw err;
            }
            let values;
            if(sel.length>0) {
                if (q.dict && q.offer) {// && result[0].obj_data.length<q.dict.length){
                    let offer = urlencode.decode(q.offer);

                    that.replaceImg(offer,function (offer) {
                        values = [offer, q.location[1], q.location[0], q.radius, sel[0].id];
                        let sql_upd = "UPDATE offers SET data=?, latitude=?, longitude=?, radius=? WHERE id=?";
                        that.updateOfferDB(q, res, sel, sql_upd, values, now);
                    });
                }
                if(sel[0].prolong>0){
                    let date = moment(q.date).add(sel[0].prolong, 'days').format('YYYY-MM-DD');

                    let sql_ins = "REPLACE INTO offers SET ";
                    for(let key in sel[0]){
                        if(key==='id')
                            continue;
                        if(key==='date')
                            sql_ins += key+"='"+date+"',";
                        else
                            sql_ins += key+"='"+sel[0][key]+"',";
                    }
                    sql_ins = sql_ins.replace(/,(\s+)?$/, '');
                    this.mysql_con.query(sql_ins,function (err, sel) {
                        if (err) {
                            throw err;
                        }
                    });
                }

            }else {
                let offer = urlencode.decode(q.offer);
                that.replaceImg(offer,function (offer) {
                    values = [offer,q.uid,JSON.stringify(q.categories), q.location[0].toFixed(6),q.location[1].toFixed(6), q.date];
                    sql = 'REPLACE INTO offers SET data=?, supuid=?,categories=?, longitude=?, latitude=?, date=?';
                    try {
                        that.updateOfferDB(q, res, sel[0], sql, values, now);
                    }catch(ex){

                    }
                });
            }

        });
    }

    updateOfferDB(q, res, sel, sql, values,now){
        let that = this;
        this.mysql_con.query(sql, values, function (err, result) {
            if (err) {
                throw err;
            }
            if (!res._header)
                res.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            let of_obj = JSON.parse(values[0]);
            let owners;
            if(sel) {
                owners = sel.suppliers ? JSON.parse(sel.suppliers) : '';
                for (let ar in of_obj) {
                    owners = _.union(owners, _.map(of_obj[ar], 'owner'));
                }
            }
            values = [q.dict, JSON.stringify(owners),q.uid];
            sql = "UPDATE deliver SET dict=?, suppliers=?  WHERE uid=?";
            setTimeout(function () {
                this.mysql_con.query(sql, values, function (err, res_1){
                    that.BroadcastOffer(q, res, function () {
                        if (!res._header)
                            res.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                        if (res.writable)
                            res.end(JSON.stringify({result: result,published:now}));
                    });
                });
            },100);

        });
    }

    BroadcastOffer(q, res, cb){

        let sql = " SELECT sup.uid as uid" +
            " FROM supplier as sup" +
            " WHERE" +
            " sup.uid<>\'"+q.uid+"\'"+
            " AND SPLIT_STR(sup.region,',',1)<\'"+q.location[1]+"\' AND SPLIT_STR(sup.region,',',2)>'"+q.location[1]+"\'"+
            " AND SPLIT_STR(sup.region,',',3)<\'"+q.location[0]+"\' AND SPLIT_STR(sup.region,',',4)>'"+q.location[0]+"\'"+
            " UNION" +
            " SELECT cus.uid as uid" +
            " FROM customer as cus" +
            " WHERE " +
            " SPLIT_STR(cus.region,',',1)<'"+q.location[1]+ "' AND SPLIT_STR(cus.region,',',2)>'"+q.location[1]+"\'"+
            " AND SPLIT_STR(cus.region,',',3)<'"+q.location[0]+ "' AND SPLIT_STR(cus.region,',',4)>'"+q.location[0]+"\'";

        this.mysql_con.query(sql, function (err, sel) {
            if (err) {
                throw err;
            }
            if (!res._header)
                res.writeHead(200, "OK", {'Content-Type': 'text/plain'});

            if(sel.length>0){
                for(let r in sel){
                    let sse = resObj[sel[r].uid];
                    if(sse){
                        sse.write(utils.formatSSE({"func":"supupdate","obj":q}));
                    }
                }
            }
            if(cb) {
                cb();
            }else{
                res.end(JSON.stringify({func: 'sharelocation', result: sel.length}));
            }
        });
    }

    UpdateOrder(q, res){
        let that = this;
        let status;
        let now = moment().format('YYYY-MM-DD h:mm:ss');
        let sql =
            "SELECT ord.*"+ //, tar.options as tariff"+ // cus.email as cusuid,  DATE_FORMAT(of.date,'%Y-%m-%d') as date" +
            " FROM  supplier as sup, customer as cus, orders as ord" +
            //", tariff as tar"+
            " WHERE sup.uid=ord.supuid  AND ord.supuid=\'"+q.supuid+"\'  AND ord.cusuid=\'"+q.cusuid+"\'" +
            " AND cus.psw='"+q.psw+"'" +
            //" AND cus.tariff=tar.id AND tar.applicant='c'" +
            " AND cus.uid=ord.cusuid AND ord.date='"+q.date+"'" +
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
                    delete q.uid;
                    delete q.func;
                    delete q.proj;
                    resObj[q.supuid].write(utils.formatSSE({func: 'ordered', order: q}));
                }
                res.end(JSON.stringify({result: result, published:now}));

            });
        });
    }

    ApproveOrder(q,res){
        let now = moment().format('YYYY-MM-DD h:mm:ss');
        let values = [q.date.split('T')[0],q.period, q.supuid, q.cusuid, q.title, JSON.stringify(q.data)];
        let sql = "REPLACE INTO approved SET date=?, period=?, supuid=?, cusuid=?, title=?, data=?";
        this.mysql_con.query(sql, values, function (err, result) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            if(global.resObj[q.cusuid] && global.resObj[q.cusuid].connection.writable) {
                delete q.uid; delete q.func;delete q.proj;delete q.psw;
                global.resObj[q.cusuid].write(utils.formatSSE({func: 'approved', order: q}));
            }
            res.end(JSON.stringify({result: result, approved:now}));

        });

    }

    UpdateOrderStatus(q, res){
        let that = this;
        let sql =
            "SELECT ord.*,  DATE_FORMAT(of.date,'%Y-%m-%d') as date" +
            " FROM  supplier as sup, offers as of, customer as cus, orders as ord"+
            " WHERE sup.email=\'"+q.supuid+"\' AND sup.uid=\'"+q.uid+"\'" +
            " AND of.sup_uid=sup.uid AND cus.email=ord.cusuid AND ord.cusuid='"+q.cusuid+"' AND ord.date='"+q.date+"'" +
            " AND ord.date=\'"+q.date.split('T')[0]+"\'"+
            " ORDER BY of.id DESC";

        this.mysql_con.query(sql, function (err, sel) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            let values, sql;
            if(sel.length>0) {
                values = [ q.status, sel[0].id];

                sql = "UPDATE orders SET status=? WHERE id=?";
            }
            this.mysql_con.query(sql, values, function (err, result) {
                if (err) {
                    res.end(JSON.stringify({err: err}));
                    return;
                }
                res.end(JSON.stringify({result: result}));

                if(global.resObj[q.cusuid] && global.resObj[q.cusuid].connection.writable) {
                    sel[0].status = q.status;
                    global.resObj[q.cusuid].write(utils.formatSSE({func:'updateorderstatus',order:sel[0]}));
                }
            });
        });
    }

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

    SettingsSupplier(q, res, cb){
        let that = this;
        let sql = " SELECT *"+
            " FROM  supplier as sup"+
            " WHERE sup.uid = '"+ q.supuid+"' AND sup.psw = '"+q.psw+"'";

        this.mysql_con.query(sql, function (err, result) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});

            that.replaceImg_2(q.profile.avatar,function (path) {
                q.profile.avatar = path;
                let values = [JSON.stringify(q.profile)];
                sql = " UPDATE   supplier  SET  profile=?"+
                    " WHERE supplier.uid = '" + q.uid+"'";
                this.mysql_con.query(sql, values,function (err, result) {
                    if (err) {
                        throw err;
                    }
                    res.end();
                });
            });
        });
    }

    ShareLocation(q, res, cb){

        let sql = " SELECT sup.email as email" +
            " FROM supplier as sup" +
            " WHERE" +
            " SPLIT_STR(sup.region,',',1)<\'"+q.location[1]+"\' AND SPLIT_STR(sup.region,',',2)>'"+q.location[1]+"\'"+
            " AND SPLIT_STR(sup.region,',',3)<\'"+q.location[0]+"\' AND SPLIT_STR(sup.region,',',4)>'"+q.location[0]+"\'"+
            " UNION" +
            " SELECT cus.email as email" +
            " FROM customer as cus" +
            " WHERE " +
            " SPLIT_STR(cus.region,',',1)<'"+q.location[1]+ "' AND SPLIT_STR(cus.region,',',2)>'"+q.location[1]+"\'"+
            " AND SPLIT_STR(cus.region,',',3)<'"+q.location[0]+ "' AND SPLIT_STR(cus.region,',',4)>'"+q.location[0]+"\'";

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

    GetOrder(q, res) {

        // let sql =
        //     "SELECT ord.*, sup.dict" +
        //     " FROM orders as ord, supplier as sup, approved as appr" +
        //     " WHERE ord.supuid=sup.uid " +
        //     " AND sup.uid='" + q.uid+"' AND sup.psw='"+q.psw +"'"+
        //     " AND (ord.date='"+q.date+"'"+
        //     " OR ord.data NOT LIKE CONCAT('%',appr.title, '%') " +
        //     " AND DAY(appr.date)=DAY(NOW()))";

         let sql=
             " SELECT ord.*, sup.dict  " +
             " FROM orders as ord, deliver as del, supplier as sup " +
             " WHERE ord.supuid=del.uid " +
             " AND del.suppliers LIKE CONCAT('%',sup.uid , '%')  " +
             " AND del.uid='" + q.uid+"'"+
             " AND del.psw='"+q.psw +"'"+
             " AND ord.date='"+q.date.split('T')[0]+"'"+
             " UNION" +
             " SELECT ord.*,NULL " +
             " FROM  orders as ord,  approved as appr  " +
             " WHERE  " +
             " ord.date='"+q.date.split('T')[0]+"'" +
             " AND appr.date=ord.date"+
             " AND ord.data NOT LIKE CONCAT('%',appr.title, '%') ";


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

    GetApproved(q, res) {

        let sql =
            "SELECT appr.* " +
            " FROM supplier as sup, approved as appr" +
            " WHERE sup.uid='"+q.uid +"' AND appr.supuid=sup.uid"+
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

    GetOffers(q, res) {
        let sql = " SELECT off.*, sup.profile as profile,sup.dict as dict"+
            " FROM  deliver as del, supplier as sup, offers as off"+
            " WHERE del.uid = '"+ q.uid+"' AND del.psw = '"+q.psw+"'" +
            " AND  LOCATE(sup.uid,del.suppliers)>0" +
            " AND off.supuid=sup.uid" +
            " AND off.date='"+ q.date.split('T')[0]+"'"+
            " UNION" +
            " SELECT off.*, NULL, del.dict as dict"+
            " FROM  deliver as del,  offers as off"+
            " WHERE del.uid = '"+ q.uid+"' AND del.psw = '"+q.psw+"'" +
            " AND off.supuid=del.uid" +
            " AND off.date>='"+ q.date.split('T')[0]+"'";
        this.mysql_con.query(sql, function (err, result) {
            if (err) {
                throw err;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({offer:result}));
        });
    }
}