const fs = require('fs');
const iconv = require('iconv-lite');

// Simulation of parseStockTransactionCSV logic
const csvBuffer = fs.readFileSync('C:\\Users\\USER\\Desktop\\財務管理\\交易明細0530.CSV');
const csvText = iconv.decode(csvBuffer, 'big5');

const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

const findColumnIndex = (keywords) => {
    for (const keyword of keywords) { 
        const index = headers.findIndex(header => header.includes(keyword)); 
        if (index !== -1) return index; 
    }
    return -1;
};

const columnMap = { 
    date: findColumnIndex(['成交日期']), 
    symbol: findColumnIndex(['股票代號']), 
    name: findColumnIndex(['股票名稱', '商品名稱', '商品']), 
    side: findColumnIndex(['買賣別', '買賣']) 
};

console.log('Headers:', headers);
console.log('Column Map:', columnMap);

const results = [];
for (let i = 1; i < lines.length && i < 10; i++) {
    const line = lines[i];
    if (line.includes('小計') || line.includes('總計')) continue;
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    const symbol = parts[columnMap.symbol]?.trim().replace(/"/g, '');
    const name = columnMap.name !== -1 ? parts[columnMap.name]?.trim().replace(/"/g, '') : undefined;
    
    results.push({ symbol, name });
}

console.log('Sample parsed names:', results);
