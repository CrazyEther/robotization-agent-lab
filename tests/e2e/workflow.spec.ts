import {test,expect} from '@playwright/test';

async function chooseRobot(page:import('@playwright/test').Page){
 await page.goto('/');
 await page.getByRole('button',{name:'Создать проект'}).first().click();
 await page.getByRole('button',{name:'Перейти к роботам'}).click();
 await page.getByRole('textbox',{name:'Поиск роботов'}).fill('MiR250');
 await page.getByRole('button',{name:/Добавить в транспортный сценарий/}).click();
 await expect(page.getByRole('heading',{name:/Здесь робот/})).toBeVisible();
 await page.getByRole('button',{name:'Настроить симуляцию'}).click();
 await expect(page.getByTestId('agent-studio')).toBeVisible();
}

test('object → robot → layout → live simulation without external SimPy',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await chooseRobot(page);
 await page.getByTestId('agent-run').click();
 await expect(page.getByTestId('agent-results')).toBeVisible({timeout:30000});
 await expect(page.getByTestId('agent-floor')).toBeVisible();
 await expect(page.getByTestId('agent-route').first()).toBeVisible();
 await expect(page.getByText('ENGINE / SIMCORE-PROCESS 4')).toBeVisible();
 await expect(page.getByText(/Вычислительный сервис SimPy не подключён/)).toHaveCount(0);
 await page.getByRole('combobox',{name:'Поток'}).selectOption('poisson');
 await expect(page.getByTestId('agent-results')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('CSV catalog lists 187 models and shows original claims without fake verification',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Маркетплейс'}).first().click();
 await page.getByRole('button',{name:/Каталог CSV/}).click();
 await expect(page.getByText(/187 моделей \/ 223 исходных записей/)).toBeVisible();
 await page.getByRole('textbox',{name:'Поиск по CSV'}).fill('Ronavi H1500');
 await expect(page.locator('.ris-csv-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Все характеристики и кейсы'}).click();
 await expect(page.getByRole('dialog')).toContainText('Восток-Сервис');
 await expect(page.getByRole('dialog')).toContainText('валюта не указана');
 await expect(page.getByRole('dialog')).toContainText('не являются независимо проверенными');
 await page.getByRole('button',{name:'Закрыть карточку'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});test('simulation API remains explicit about unavailable legacy Python service',async({request})=>{
 const response=await request.post('/api/v1/ris/experiment',{data:{scenario:{},replications:5}});
 expect(response.status()).toBe(422);
 const health=await request.get('/api/v1/agent/health');
 expect(health.status()).toBe(200);
 expect((await health.json()).engine).toBe('simcore-process');
});

test('mobile: catalog and agent studio remain reachable',async({page,isMobile})=>{
 if(!isMobile)return;
 await page.goto('/');
 await page.getByRole('button',{name:'Создать проект'}).first().click();
 await page.getByRole('navigation',{name:'Этапы проекта'}).getByRole('button',{name:/Маркетплейс/}).click();
 await page.getByRole('button',{name:/Каталог CSV/}).click();
 await expect(page.getByRole('textbox',{name:'Поиск по CSV'})).toBeVisible();
 await page.getByRole('navigation',{name:'Этапы проекта'}).getByRole('button',{name:/Моделирование/}).click();
 await expect(page.getByTestId('agent-studio')).toBeVisible();
});
