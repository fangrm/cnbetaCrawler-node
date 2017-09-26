const http = require('http');
const fs = require('fs');
const cheerio = require('cheerio');

const startId = '655515';
const articleSavePath = './data'; // 文章存放路径
const imgSavePath = './img'; // 图片存放路径
const fetchLimit = process.argv[2] || 50;

// 创建所需文件夹
if (!fs.existsSync(articleSavePath)) {
    fs.mkdirSync(articleSavePath);
}
if (!fs.existsSync(imgSavePath)) {
    fs.mkdirSync(imgSavePath);
}

// 计数器
let fetched = 0;

let getNext = (_csrf, op) => {
    let syncUrl = 'http://www.cnbeta.com/comment/read';
    return new Promise((resolve, reject) => {
        if (!_csrf || !op) {
            return reject(`getNext() param error: _csrf: ${_csrf}, op: ${op}`);
        } else {
            syncUrl += '?_csrf=' + encodeURIComponent(_csrf) + '&op=' + encodeURIComponent(op);
            http.get(syncUrl, (res) => {
                let resChunk = '';
                res.setEncoding('utf-8');
                res.on('data', (chunk) => {
                    resChunk += chunk;
                });
                res.on('end', () => {
                    try {
                        let json = JSON.parse(resChunk);
                        let lastId = json.result.neighbor.last;
                        resolve(lastId);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        }
    });
};

// 保存内容
let savedContent = ($, news_title) => {
    $('.article-content p').each((index, item) => {
        let x = $(item).text().trim();
        if (x) {
            debugger;
            x = '   ' + x + '\n';
            fs.appendFile('./data/' + news_title + '.txt', x, 'utf-8', (err) => {
               if (err) {
                   console.log(err);
               }
            });
        }
    });
};

// 保存图片
let savedImg = ($, news_title) => {
    $('.article-content img').each((index, item) => {
        let img_src = $(item).attr('src');
        let img_filename = news_title + '---' + index + img_src.match(/\.[^.]+$/)[0];
        http.get(img_src, (res) => {
            let imgData = '';
            res.setEncoding("binary");
            res.on("data", (chunk) => {
                imgData += chunk;
            });
            res.on("end", () => {
                fs.writeFile(imgSavePath + '/' + img_filename, imgData, "binary", (err) => {
                    if (err) {
                        console.log(err);
                    }
                });
            });
        });
    });
};

// 抓取信息
let fetchPage = (x, fullpath) => {
    if (fetched > fetchLimit) {
        fetched = 0;
        console.log(`已完成抓取 ${fetchLimit} 条数据`);
        return process.exit();
    }
    let articleUrl = fullpath || `http://www.cnbeta.com/articles/tech/${x}.htm`;
    let client = http.get(articleUrl, (res) => {
        if (res.statusCode === 301) {
            if (res.headers.location) {
                fetchPage(null, res.headers.location);
            } else {
                console.log('fetchPage() reLocated. ', articleUrl);
            }
            return client.abort();
        }
        let html = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => {
            html += chunk;
        });
        res.on('end', () => {
            if (html) {
                fetched++;
                const $ = cheerio.load(html);
                //const time = $('.cnbeta-article .title .meta span:first-child').text().trim();
                let news_title = $('.cnbeta-article .title h1').text().trim().replace(/\//g, '-');
                if (news_title.length > 48) {
                    news_title = news_title.slice(0, 40);
                }
                savedContent($, news_title);
                try {
                    savedImg($, news_title);
                } catch (e) {
                    console.log('无法获取图片');
                }

                console.log(`got: ${news_title} url: ${articleUrl}`);

                // 抓取下一篇
                let _csrf = $('meta[name="csrf-token"]').attr('content');
                let opStr = html.match(/{SID:[^{}]+}/)[0];
                let op = '1,';
                op += opStr.match(/SID:"([^"]+)"/)[1] + ',' + opStr.match(/SN:"([^"]+)"/)[1];
                getNext(_csrf, op).then((lastId) => {
                    fetchPage(lastId, null);
                }).catch((err) => {
                    console.log(err);
                });
            } else {
                console.log('fetchPage() failed. ', articleUrl)
            }
        });
    }).on('error', (err) => {
        console.log(err);
    });
};

console.log(`即将抓取 ${fetchLimit} 条数据`);
fetchPage(startId);