

module.exports = class RTCItem {

    constructor(req, q, res) {
        this.email = q.email;
        this.call = q.call;
        this.role = q.role;//user/owner
        this.status = q.status;//connect/wait/completed
        this.desc = q.desc;//store local desc
        this.cand = q.cand;//
    }

}