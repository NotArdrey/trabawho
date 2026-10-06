import { expect, test } from '@playwright/test';
import { expectNoRegistrationOverflow, fillRegistration, mockAccountJourney } from './helpers/registration';

for (const width of [390, 768, 1024, 1280, 1440]) test(`email confirmation precedes Didit and administrator review at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:900});
  const flow=await mockAccountJourney(page,null,{state:'identity_review',email:'person@example.com',legalName:'Verified Legal Person'});
  await page.goto('/register');
  await fillRegistration(page,'person@example.com','worker',false);
  await expect(page.getByRole('heading',{name:'Confirm your email',exact:true})).toBeFocused();
  await expect(page.getByRole('list',{name:'Account verification steps'}).locator('[aria-current="step"]')).toContainText('Email Verification');
  await expect(page.getByRole('button',{name:'Verify with Didit'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Submit manually'})).toHaveCount(0);
  await page.getByRole('button',{name:'Check email verification'}).click();
  await expect(page.getByRole('heading',{name:'Confirm your email',exact:true})).toBeVisible();
  expect(flow.requests.some(item=>item.name==='account-didit-session')).toBe(false);
  await expectNoRegistrationOverflow(page);
  await page.screenshot({path:test.info().outputPath(`email-pending-${width}.png`),fullPage:true});
  flow.confirmEmail();
  await page.getByRole('button',{name:'Check email verification'}).click();
  await expect(page.getByRole('heading',{name:'Verify your identity',exact:true})).toBeVisible();
  await expect(page.getByLabel('Complete name',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Verify with Didit'}).click();
  await expect(page.getByRole('button', { name: 'Check verification status' })).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Identity review pending',exact:true})).toBeVisible();
  await expect(page.getByText(/Once approved, sign in to use your account/)).toBeVisible();
  await expect(page.getByRole('checkbox',{name:/consent/})).toHaveCount(0);
  await expect(page.getByRole('list',{name:'Account verification steps'}).locator('[aria-current="step"]')).toContainText('Identity Review');
  await expect(page.getByRole('button',{name:'Confirm my legal name'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Confirm your email'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Offer services'})).toHaveCount(0);
  expect(flow.requests.find(item=>item.body.action==='create')?.body).toMatchObject({registrationVersion:4,signupRole:'worker'});
  expect(flow.requests.some(item=>['save_name','resend'].includes(String(item.body.action)))).toBe(false);
  expect(flow.requests.filter(item=>item.name==='account-didit-session').every(item=>!('password' in item.body))).toBe(true);
  expect(await page.evaluate(()=>JSON.stringify(sessionStorage))).not.toContain('Password123!');
  await expectNoRegistrationOverflow(page);
  await page.screenshot({path:test.info().outputPath(`draft-complete-${width}.png`),fullPage:true});
});

for (const exit of ['button','provider','callback']) test(`unfinished Didit ${exit} exit resets every field without restoring progress`,async({page})=>{
  await page.setViewportSize({width:390,height:900});
  const flow=await mockAccountJourney(page,null,{state:'identity_in_progress',sessionId:'didit-owned'});
  await page.context().route('https://verification.didit.me/**',route=>route.fulfill({contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin'},body:'<h1>Identity capture</h1>'}));
  await page.goto('/register');await fillRegistration(page);
  await page.getByRole('button',{name:'Verify with Didit'}).click();
  await page.getByRole('button',{name:'Continue in Didit'}).click();
  await expect(page.frameLocator('iframe[title="Didit identity verification"]').getByRole('heading',{name:'Identity capture'})).toBeVisible();
  await page.waitForTimeout(750);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoRegistrationOverflow(page);
  await page.screenshot({path:test.info().outputPath('didit-dialog-mobile.png'),fullPage:true});
  if (exit === 'button') await page.getByRole('button',{name:'Exit verification',exact:true}).click();
  else if (exit === 'provider') await page.frameLocator('iframe[title="Didit identity verification"]').locator('body')
    .evaluate(()=>window.parent.postMessage({type:'didit:cancelled'},'http://127.0.0.1:3000'));
  // Browser navigation avoids Chromium's public-to-localhost network restriction in this local fixture.
  else await page.frames().find(frame=>frame.url().includes('verification.didit.me'))!
    .goto('http://127.0.0.1:3000/register?didit_return=1&status=Cancelled',{waitUntil:'commit'});
  await expect(page.getByRole('heading',{name:'Create your account',exact:true})).toBeVisible();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
  await expect(page.getByRole('radio',{name:'Client: Book a service',exact:true})).not.toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(flow.requests.some(item=>item.body.action==='discard')).toBe(true);
  expect(await page.evaluate(()=>sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Create your account',exact:true})).toBeVisible();
});

test('a completed embedded Didit return checks the server and submits for admin review',async({page})=>{
  await mockAccountJourney(page,null,{state:'identity_review',email:'person@example.com'});
  await page.context().route('https://verification.didit.me/**',route=>route.fulfill({contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin'},body:'<h1>Identity capture</h1>'}));
  await page.goto('/register');await fillRegistration(page);
  await page.getByRole('button',{name:'Verify with Didit'}).click();
  await page.getByRole('button',{name:'Continue in Didit'}).click();
  const frame=page.frameLocator('iframe[title="Didit identity verification"]');
  await expect(frame.getByRole('heading',{name:'Identity capture'})).toBeVisible();
  await page.frames().find(item=>item.url().includes('verification.didit.me'))!
    .goto('http://127.0.0.1:3000/register?didit_return=1&status=Approved',{waitUntil:'commit'});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Identity review pending',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Start booking services'})).toHaveCount(0);
});


test('only messages from the active Didit frame can finish verification, and messages cannot approve it',async({page})=>{
  const flow=await mockAccountJourney(page,null,{state:'identity_in_progress',sessionId:'didit-owned',sessionUrl:'https://verification.didit.me/session/test'});
  await page.context().route('https://verification.didit.me/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Identity capture</h1>'}));
  await page.goto('/register');await fillRegistration(page);
  await page.getByRole('button',{name:'Verify with Didit'}).click();
  await page.getByRole('button',{name:'Continue in Didit'}).click();
  const frame=page.frameLocator('iframe[title="Didit identity verification"]');
  await expect(frame.getByRole('heading',{name:'Identity capture'})).toBeVisible();
  await page.evaluate(()=>{
    window.dispatchEvent(new MessageEvent('message',{origin:'https://verification.didit.me',source:window,data:{type:'didit:completed',status:'Approved'}}));
    window.dispatchEvent(new MessageEvent('message',{origin:'https://untrusted.example',source:document.querySelector('iframe')!.contentWindow,data:{type:'didit:cancelled'}}));
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(flow.requests.some(item=>item.body.action==='discard')).toBe(false);
  await frame.locator('body').evaluate(()=>window.parent.postMessage({type:'didit:completed',status:'Approved'},'http://127.0.0.1:3000'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Identity verification in progress',exact:true})).toBeVisible();
  expect(flow.requests.some(item=>item.body.action==='discard')).toBe(false);
  await expect(page.getByRole('link',{name:'Start booking services'})).toHaveCount(0);
});

test('stale saved progress and forged callback status cannot restore or approve registration',async({page})=>{
  const flow=await mockAccountJourney(page);
  await page.addInitScript(()=>sessionStorage.setItem('trabawho.pendingAccount.v2',JSON.stringify({userId:'stale',nonce:'old',email:'old@example.com'})));
  await page.goto('/register?status=Approved&verificationSessionId=forged');
  await expect(page.getByRole('heading',{name:'Create your account',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(flow.requests).toHaveLength(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
});

test('manual registration accepts IDs without expiration or a back side and waits for admin approval',async({page})=>{
  const flow=await mockAccountJourney(page);
  await page.goto('/register');await fillRegistration(page);
  await page.getByRole('button',{name:'Submit manually'}).click();
  await page.getByLabel('Name on ID',{exact:true}).fill('Manual Applicant');
  await page.getByLabel('Government document type').fill('National ID');
  await page.getByLabel('ID number',{exact:true}).fill('TEST-NATIONAL-123');
  await page.getByRole('checkbox',{name:'My ID has no expiration date'}).check();
  await page.getByRole('checkbox',{name:'My ID has no back side'}).check();
  for(const slot of ['front','selfie']) await page.locator(`#manual-${slot}-image`).setInputFiles({name:`${slot}.png`,mimeType:'image/png',buffer:Buffer.from('image')});
  await page.getByRole('button',{name:'Submit for human review'}).click();
  await expect(page.getByRole('heading',{name:'Identity review pending'})).toBeVisible();
  const submission=flow.requests.find(item=>item.name==='account-manual-review')?.body;
  expect(submission).toMatchObject({noExpiration:true,backNotApplicable:true,backImage:null,expiry:'',fullName:'Manual Applicant'});
  for(const field of ['video','address','password','serviceType']) expect(submission).not.toHaveProperty(field);
  await expect(page.getByRole('link',{name:'Start booking services'})).toHaveCount(0);
});
