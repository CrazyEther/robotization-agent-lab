import {defineConfig,devices} from '@playwright/test';
const port=18887;
export default defineConfig({
 testDir:'./tests/e2e',workers:1,fullyParallel:false,retries:0,reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:'+port,trace:'retain-on-failure',screenshot:'only-on-failure',
  ...(process.env.PLAYWRIGHT_EXECUTABLE?{launchOptions:{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}}:{channel:process.env.PLAYWRIGHT_CHANNEL??'chromium'})},
 webServer:{command:'npm run start',url:'http://127.0.0.1:'+port+'/api/v1/agent/health',env:{PORT:String(port)},timeout:45000,reuseExistingServer:false},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]
});
