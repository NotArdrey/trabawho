import { expect, test } from '@playwright/test';
import { expectNoRegistrationOverflow, fillRegistration, mockAccountJourney } from './helpers/registration';

for (const width of [390, 768, 1024, 1280, 1440]) test(`Didit approval finishes V3 registration with inbox instructions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:900});
  const flow=await mockAccountJourney(page,null,{state:'email_pending',email:'person@example.com',legalName:'Verified Legal Person'});
  await page.goto('/register');
  await fillRegistration(page,'person@example.com','worker');
  await expect(page.getByLabel('Complete name',{exact:true})).toHaveCount(0);
  await page.getByRole('checkbox',{name:/I consent to identity/}).check();
  await page.getByRole('button',{name:'Verify with Didit'}).click();
  await page.getByRole('button',{name:'Check verification status'}).click();
  await expect(page.getByRole('heading',{name:'Registration complete',exact:true})).toBeVisible();
  await expect(page.getByText('Verified name: Verified Legal Person',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Go to sign in'})).toHaveAttribute('href','/sign-in');
  await expect(page.getByRole('button',{name:'Confirm my legal name'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Confirm your email'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Offer services'})).toHaveCount(0);
  expect(flow.requests.find(item=>item.body.action==='create')?.body).toMatchObject({registrationVersion:3,signupRole:'worker'});
  expect(flow.requests.some(item=>['save_name','resend'].includes(String(item.body.action)))).toBe(false);
  expect(flow.requests.filter(item=>item.name==='account-didit-session').every(item=>!('password' in item.body))).toBe(true);
  expect(await page.evaluate(()=>JSON.stringify(sessionStorage))).not.toContain('Password123!');
  await expectNoRegistrationOverflow(page);
  await page.screenshot({path:test.info().outputPath(`draft-complete-${width}.png`),fullPage:true});
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
  await page.getByRole('checkbox',{name:'I consent to manual review of my ID and selfie.'}).check();
  await page.getByRole('button',{name:'Submit for human review'}).click();
  await expect(page.getByRole('heading',{name:'Identity review pending'})).toBeVisible();
  const submission=flow.requests.find(item=>item.name==='account-manual-review')?.body;
  expect(submission).toMatchObject({noExpiration:true,backNotApplicable:true,backImage:null,expiry:'',fullName:'Manual Applicant'});
  for(const field of ['video','address','password','serviceType']) expect(submission).not.toHaveProperty(field);
  flow.setState({state:'email_pending',email:'person@example.com'});
  await expect(page.getByRole('heading',{name:'Registration complete'})).toBeVisible({timeout:12000});
  await expect(page.getByRole('link',{name:'Start booking services'})).toHaveCount(0);
});
