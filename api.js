const socks = require("socks");
const request = require("request").defaults({jar: true});
const cheerio = require("cheerio");
const qs = require("querystring");

const urls = {
    main: "http://kinozal.tv",
    download: "http://dl.kinozal.tv"
};

const searchParameterMap = {
    title: "s",
    year: "d"
};

const conv = new require("iconv").Iconv("windows-1251", "utf8");

function KinozalTvApi(_username, _password, _socksProxy) {
    this.username = _username;
    this.password = _password;
    this.socksAgent = _socksProxy ? new socks.Agent({proxy: _socksProxy}, false, false) : null;
}

KinozalTvApi.prototype.authenticate = function () {
    let data = qs.stringify({username: this.username, password: this.password, returnto : ""});
    return new Promise((resolve, reject) => {
        request(            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": data.length
                },
                url: urls.main + "/takelogin.php",
                method: "POST",
                encoding: "binary",
                body: data,
                followAllRedirects: true,
                jar: this.cookie,
                agent: this.socksAgent
            }, (err, response, body) => err || response.statusCode !== 200 ? reject(err || "error: " + (response || response.statusCode)) : resolve(null)
        )
    });
};

KinozalTvApi.prototype.getTop = function () {
    return new Promise((resolve, reject) => {
        let query = {w: 1};
        request({
            url: urls.main + "/top.php?" + qs.stringify(query),
            encoding: "binary",
            jar: this.cookie,
            agent: this.socksAgent
        }, (err, response, body) => {
            if (err) {
                reject(err)
            }
            let $ = cheerio.load(conv.convert(new Buffer(body, "binary"), {decodeEntities: true}).toString());
            resolve($("div#main div.content div.bx2 div.mn1_content div.bx1.stable a").map((i, e) => {
                return {
                    id: parseInt($(e).attr("href").split("=")[1]),
                    url: urls.main + $(e).attr("href"),
                    title: $(e).attr("title")
                }
            }).get());
        });
    });
};

KinozalTvApi.prototype.search = function (parameters) {
    return new Promise((resolve, reject) => {
            let query = {t: 1};
            Object.keys(parameters).filter(key => searchParameterMap.hasOwnProperty(key)).map(key => {
                query[searchParameterMap[key]] = parameters[key]
            });
            request({
                url: urls.main + "/browse.php?" + qs.stringify(query),
                encoding: "binary",
                jar: this.cookie,
                agent: this.socksAgent
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                }
                let $ = cheerio.load(conv.convert(new Buffer(body, "binary"), {decodeEntities: true}).toString());
                resolve($("div#main div.content div.bx2_0 table.t_peer.w100p tbody tr.bg td.nam a").map((i, e) => {
                    return {
                        id: parseInt($(e).attr("href").split("=")[1]),
                        url: urls.main + $(e).attr("href"),
                        title: $(e).html(),
                        size: $(e).parent().next().next().html(),
                        seeds: parseInt($(e).parent().next().next().next().html())
                    }
                }).get());
            })
        }
    )
};

KinozalTvApi.prototype.getDetail = function(id)  {
    return new Promise((resolve, reject) => {
        let query = {id: id};
        request({
            url: urls.main + "/details.php?" + qs.stringify(query),
            encoding: "binary",
            jar: this.cookie,
            agent: this.socksAgent
        }, (err, response, body) => {
            if (err) {
                reject(err);
            } else {
                //console.log(conv.convert(new Buffer(body, "binary"), {decodeEntities: true}).toString());
                let $ = cheerio.load(conv.convert(new Buffer(body, "binary"), {decodeEntities: true}).toString());
                let div = $("html body div#main div.content div.mn_wrap");
                let detail = {
                    id: id,
                    url: $(div).find("div h1 a.r1").attr("href"),
                    title: $(div).find("div h1 a.r1").html(),
                    img: $(div).find("div.mn1_menu ul.men.w200 li.img a img.p200").attr("src"),
                    description: $(div).find("div.mn_wrap div.mn1_content div.bx1.justify p").html(),
                    specs: $(div).find("div.mn1_content div.bx1 div#tabs.justify.mn2.pad5x5").html()
                };
                resolve(detail);
            }
        });
    });
};

KinozalTvApi.prototype.downloadTorrent = (id) => {
    return new Promise((resolve, reject) => {
        try {
            resolve(request({
                url: urls.download + "/download.php?id=" + id,
                followAllRedirects: true,
                jar: this.cookie,
                agent: this.socksAgent
            }));
        } catch (err) {
            reject(err)
        }
    });
};


/**
 *
 * Workaround - https://github.com/cheeriojs/cheerio/issues/866
 */
let cheerio_html = cheerio.prototype.html;

cheerio.prototype.html = function wrapped_html() {
    let result = cheerio_html.apply(this, arguments);

    if (typeof result === "string") {
        result = result.replace(/&#x([0-9a-f]{1,6});/ig, function (entity, code) {
            code = parseInt(code, 16);

            // don"t unescape ascii characters, assuming that all ascii characters
            // are encoded for a good reason
            if (code < 0x80) return entity;

            return String.fromCodePoint(code)
        })
    }

    return result
};

module.exports = module.exports = KinozalTvApi;