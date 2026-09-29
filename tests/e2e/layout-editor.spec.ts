import {test,expect} from '@playwright/test';
test('catalog flows directly into the single editable map, opaque obstacles can be edited and removed',async({page})=>{
 await page.goto('/?preview=layout');
 await expect(page.getByRole('navigation',{name:'Этапы проекта'}).getByRole('button')).toHaveCount(3);
 await page.getByTestId('load-shop').click();
 const map=page.getByTestId('agent-floor');
 const original=page.getByTestId('layout-obstacle');
 await expect(original).toHaveCount(6);
 const first=original.first().locator('rect');
 expect(await first.getAttribute('width')).toBe('4');
 expect(await first.getAttribute('height')).toBe('10');
 const geometry=await first.boundingBox();
 expect(geometry).not.toBeNull();expect(geometry!.width).toBeGreaterThan(20);expect(geometry!.height).toBeGreaterThan(50);
 await page.getByRole('button',{name:'Стеллаж',exact:true}).click();
 await map.scrollIntoViewIfNeeded();
 const surface=await map.boundingBox();expect(surface).not.toBeNull();
 // Place a rack in the central transport aisle, between source and first operation.
 await page.mouse.click(surface!.x+surface!.width*.22,surface!.y+surface!.height*.52);
 await expect(original).toHaveCount(7);
 const added=original.last().locator('rect');
 expect(await added.getAttribute('width')).toBe('3');
 expect(await added.getAttribute('height')).toBe('6');
 const style=await added.evaluate(el=>({fill:getComputedStyle(el).fill,opacity:getComputedStyle(el).opacity}));
 expect(style.fill).not.toBe('none');expect(style.fill).not.toBe('rgba(0, 0, 0, 0)');
 expect(style.opacity).toBe('1');
 const bbox=await added.boundingBox();expect(bbox!.width).toBeGreaterThan(25);
 await expect(page.getByTestId('selected-layout-object')).toBeVisible();
 await page.getByLabel('Параметр w').fill('5');
 await expect(added).toHaveAttribute('width','5');
 await page.getByTestId('agent-run').click();
 await expect(page.getByTestId('agent-results')).toBeVisible({timeout:30000});
 await page.getByTestId('selected-layout-object').getByRole('button',{name:'Удалить объект'}).click();
 await expect(original).toHaveCount(6);
 await expect(page.getByTestId('agent-results')).toHaveCount(0);
 await page.getByTestId('agent-run').click();
 await expect(page.getByTestId('agent-results')).toBeVisible({timeout:30000});
});
test('clicks on robots or existing objects must not create new obstacles',async({page})=>{
 await page.goto('/?preview=layout');
 await page.getByTestId('load-shop').click();
 await page.getByRole('button',{name:'Препятствие',exact:true}).click();
 await page.getByTestId('layout-obstacle').first().click();
 await expect(page.getByTestId('layout-obstacle')).toHaveCount(6);
 await page.getByTestId('agent-run').click();
 await expect(page.getByTestId('agent-results')).toBeVisible();
});

test('catalog selection opens the real editable facility instead of a dead two-point plan',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:/Оценить роботизацию/}).first().click();
 await page.getByRole('button',{name:/Перейти к роботам/}).click();
 await page.getByRole('button',{name:/Добавить в транспортный сценарий/}).first().click();
 await expect(page.getByTestId('agent-studio')).toBeVisible();
 await expect(page.getByRole('toolbar',{name:'Редактор производственной планировки'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Этапы проекта'}).getByRole('button')).toHaveCount(3);
 await expect(page.getByRole('button',{name:'Стеллаж',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Запустить модель'})).toBeVisible();
});
