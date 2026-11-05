const { chromium } = require('./.qa/node_modules/playwright-core');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5001/patient/index.html');
 await page.waitForSelector('.service-card');
 await page.screenshot({path:'.qa/desktop.png',fullPage:true});
 console.log(JSON.stringify({title:await page.title(),services:await page.locator('.service-card').count(),errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
 await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
