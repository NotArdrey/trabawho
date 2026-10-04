import { expect, test } from '@playwright/test';
import { corsHeaders, fillRegistration, mockAccountJourney, expectNoRegistrationOverflow } from './helpers/registration';
for(const width of [390,768,1024,1280,1440]) test(`base account defers identity and service details at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const flow=await mockAccountJourney(page);
  await page.goto('/register');
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  for(const label of ['Identity document','Name on ID','Specific service address','Account Type']) await expect(page.getByLabel(label,{exact:true})).toHaveCount(0);
  await fillRegistration(page);
  await expect(page.getByRole('heading',{name:'Confirm your email',exact:true})).toBeVisible();
  expect(flow.requests.filter(item=>item.name==='account-didit-session')).toHaveLength(0);
  const stored=await page.evaluate(()=>JSON.stringify(sessionStorage));
  expect(stored).not.toContain('Password123!'); expect(stored).not.toContain('password');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Confirm your email',exact:true})).toBeVisible();
  await expectNoRegistrationOverflow(page);
});
test('field validation prevents malformed email, short password, and missing terms submission',async({page})=>{
  const flow=await mockAccountJourney(page); await page.goto('/register');
  await page.getByLabel('Email',{exact:true}).fill('invalid');
  await page.getByLabel('Password',{exact:true}).fill('short');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  expect(flow.requests).toHaveLength(0);
  await page.getByLabel('Email',{exact:true}).fill('person@example.com');
  await page.getByLabel('Password',{exact:true}).fill('Password123!');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  expect(flow.requests).toHaveLength(0);
});
test('email delivery failure preserves the account with resend and change-email recovery',async({page})=>{
  await page.route('**/functions/v1/account-registration',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:corsHeaders});
    const body=route.request().postDataJSON() as Record<string,unknown>;
    return route.fulfill({headers:corsHeaders,json:{state:'email_pending',email:body.email || 'person@example.com',pendingAccount:{userId:'pending',nonce:'capability'},emailDelivery:{sent:body.action!=='create'}}});
  });
  await page.goto('/register'); await fillRegistration(page);
  await expect(page.getByRole('alert')).toContainText('account was created');
  await page.getByRole('button',{name:'Resend confirmation email',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Confirmation email requested');
  await page.getByRole('button',{name:'Change email',exact:true}).click();
  await page.getByLabel('New email address').fill('correct@example.com');
  await page.getByRole('button',{name:'Save email and resend'}).click();
  await expect(page.getByText('Open the confirmation link sent to correct@example.com.',{exact:false})).toBeVisible();
});
for(const url of ['/#register','/#identity-register']) test(`legacy entry ${url} opens the same base-account journey`,async({page})=>{
  await mockAccountJourney(page); await page.goto(url);
  await expect(page.getByRole('heading',{name:'Create account',exact:true})).toBeVisible();
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
});
