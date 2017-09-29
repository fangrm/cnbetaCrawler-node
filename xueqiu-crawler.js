const https = require('https');
const fs = require('fs');
const cheerio = require('cheerio');

const dataSavePath = './xueqiuData'; // 文章存放路径

const fetchLimit = process.argv[2] || 50; // 数量限制

// 创建所需文件夹
if (!fs.existsSync(dataSavePath)) {
    fs.mkdirSync(dataSavePath);
}

// 计数器
let fetched = 0;
let page = 1;
let count = 20;
let token = '';

// 首次登陆时访问首页获取 token
let getToken = () => {
    return new Promise((resolve, reject) => {
        https.get('https://www.xueqiu.com', (res) => {
            if (res.statusCode === 200) {
                //resolve(res.headers['set-cookie']);
                token = res.headers['set-cookie'][1].split(/;/)[0] + ';';
                resolve(token);
            } else {
                console.log(res.statusCode);
                reject(res.statusCode);
            }
        });
    });
};

let getPage = (token) => {
    console.log('getPage');
    console.log(fetched);
    return new Promise((resolve, reject) => {
        let client = https.get({
            hostname: 'xueqiu.com',
            path: `/cubes/discover/rank/cube/list.json?market=cn&sale_flag=0&stock_positions=0&sort=best_benefit&category=12&profit=annualized_gain_rate&page=${page}&count=${count}`,
            headers: {
                'Cookie': token,
                'Referer': 'https://xueqiu.com/p/discover?action=money&market=cn&profit=annualized_gain_rate'
            }
        }, (res) => {
            if (res.statusCode === 302) {
                client.abort();
                //getPage();
            }
            let rawData = '';
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            res.on('end', () => {
                try {
                    let parsedData = JSON.parse(rawData);
                    //console.log(parsedData);
                    parsedData.list.forEach(async function(data) {
                        let pageUrl = 'https://xueqiu.com' + '/P/' + data.symbol;
                        await getData(pageUrl);
                    });
                    resolve(parsedData);
                    console.log(`第 ${page} 页数据获取完成`);
                    page++;
                    count = count*page;
                } catch (e) {
                    //reject(e);
                    console.log(`获取第 ${page} 用户信息失败`);
                    fetched++;
                }
            });
        }).on('error', (err) => {
            console.log('pageError: ' + err);
        });
    });
};

let getData = (pageUrl) => {
    return new Promise((resolve, reject) => {
        let client = https.get(pageUrl, (res) => {
            if (res.statusCode === 301) {
                client.abort();
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
                    savedContent($);
                    resolve(html);
                }
            });
        }).on('error', (err) => {
            //reject(err);
            console.log('dataError: ' + err);
        });
    });
};

let start = async function() {
    let token = await getToken();
    console.log('token: ' + token);
    while (fetched < fetchLimit) {
        await getPage(token);
    }
    console.log(`${fetched} 条数据获取完成`);
};

// 保存内容
let savedContent = ($) => {
    $('.stock').each((index, item) => {
        let stockId = $(item).attr('href').substring(3);
        let stockName = $(item).children('.stock-name').children('.name').text().trim();
        //console.log($(item).children('.stock-name').children('.name').text());
        let x = '   ' + stockName + '--' + stockId + '\n';
        if (stockName && stockId) {
            fs.appendFile('./xueqiuData/' + 'stockData' + '.txt', x, 'utf-8', (err) => {
                if (err) {
                    console.log(err);
                }
            });
        }
    });
};

console.log(`即将抓取 ${fetchLimit} 条数据`);
start();