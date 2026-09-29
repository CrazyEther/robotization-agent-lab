import {test,expect} from '@playwright/test';

async function chooseRobot(page:import('@playwright/test').Page){
 await page.goto('/');
 await page.getByRole('button',{name:'Создать проект'}).first().click();
 await page.getByRole('button',{name:'Перейти к роботам'}).click();
 await page.getByRole('textbox',{name:'Поиск роботов'}).fill('MiR250');
 await page.getByRole('button',{name:/Добавить в транспортный сценарий/}).click();
 await expect(page.getByRole('toolbar',{name:'Редактор производственной планировки'})).toBeVisible();
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

test('robot catalog shows referenced prices and use cases without import jargon',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Маркетплейс'}).first().click();
 await page.getByRole('button',{name:/Все решения/}).click();
 await expect(page.getByText('187 моделей')).toBeVisible();
 await page.getByRole('textbox',{name:'Поиск по каталогу'}).fill('Ronavi H1500');
 await expect(page.locator('.ris-csv-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Характеристики и применение'}).click();
 await expect(page.getByRole('dialog')).toContainText('Восток-Сервис');
 await expect(page.getByRole('dialog')).toContainText('2 160 000');
 await expect(page.getByRole('dialog')).toContainText('100 роботов');
 await expect(page.getByRole('dialog')).not.toContainText('CSV');
 await expect(page.getByRole('dialog')).not.toContainText('валюта не указана');
 await expect(page.getByRole('dialog')).not.toContainText('Атрибутировано');
 await expect(page.getByRole('dialog').getByRole('link',{name:/Первоисточник|Условия у поставщика/}).first()).toHaveAttribute('href',/https:\/\//);
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
 await page.getByRole('button',{name:/Все решения/}).click();
 await expect(page.getByRole('textbox',{name:'Поиск по каталогу'})).toBeVisible();
 await page.getByRole('navigation',{name:'Этапы проекта'}).getByRole('button',{name:/моделирование/i}).click();
 await expect(page.getByTestId('agent-studio')).toBeVisible();
});
