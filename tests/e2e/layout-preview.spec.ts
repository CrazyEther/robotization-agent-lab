import {test,expect} from '@playwright/test';
test('editable industrial cell drives same agent simulation and scenario-based ROI',async({page})=>{
 const responses:number[]=[];page.on('response',r=>{if(r.url().includes('/api/'))responses.push(r.status());});
 await page.goto('/?preview=layout');
 await expect(page.getByTestId('agent-studio')).toBeVisible();
 await page.getByTestId('load-shop').click();
 await expect(page.getByLabel('Ширина помещения')).toHaveValue('55');
 await expect(page.getByLabel('Высота помещения')).toHaveValue('34');
 await expect(page.getByTestId('agent-charger')).toBeVisible();
 await expect(page.getByTestId('agent-machine')).toHaveCount(2);
 await page.getByTestId('fill-finance-example').click();
 await page.getByTestId('agent-run').click();
 await expect(page.getByTestId('agent-results')).toBeVisible({timeout:30_000});
 await expect(page.getByTestId('npv-value')).not.toHaveText('Недостаточно данных');
 await expect(page.locator('.ras-finance-summary')).toContainText('ROI / 5 лет');
 await expect(page.getByTestId('agent-robot')).toHaveCount(4);
 await expect(page.locator('.ras-charge-note')).toContainText('зарядок');
 const map=page.getByTestId('agent-floor');const box=await map.boundingBox();expect(box).not.toBeNull();
 const first=page.getByTestId('agent-machine').first();const before=await first.getAttribute('transform');
 await first.scrollIntoViewIfNeeded();
 const bounds=await first.boundingBox();expect(bounds).not.toBeNull();
 if(bounds){
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+17,bounds.y+bounds.height/2+10,{steps:6});await page.mouse.up();
 }
 await expect(page.getByTestId('agent-results')).toHaveCount(0);
 await page.getByTestId('agent-run').click();
 await expect(page.getByTestId('agent-results')).toBeVisible({timeout:30_000});
 await expect(page.getByTestId('npv-value')).not.toHaveText('Недостаточно данных');
 expect(responses.filter(s=>s>=400)).toEqual([]);
});
