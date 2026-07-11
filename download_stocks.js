const https = require('https');
const fs = require('fs');

console.log('Fetching TWSE...');
https.get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(`Downloaded ${json.length} stocks from TWSE OpenAPI`);
            const map = {};
            json.forEach(item => map[item.Code] = item.Name);
            
            // Now fetch TPEx (OTC)
            console.log('Fetching TPEx...');
            https.get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes', (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    try {
                        const json2 = JSON.parse(data2);
                        console.log(`Downloaded ${json2.length} stocks from TPEx OpenAPI`);
                        json2.forEach(item => map[item.SecuritiesCompanyCode] = item.CompanyName);
                        
                        // Save both
                        fs.writeFileSync('public/tw_stocks.json', JSON.stringify(map));
                        console.log('Saved to public/tw_stocks.json');
                    } catch(e) { console.error('TPEx Error:', e); }
                });
            }).on('error', err => console.log('TPEx Request Error:', err.message));
            
        } catch(e) { console.error('TWSE Error:', e); }
    });
}).on('error', err => console.log('TWSE Request Error:', err.message));
