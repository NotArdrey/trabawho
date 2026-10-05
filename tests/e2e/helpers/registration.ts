import { expect, type Page } from '@playwright/test';
export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export type JourneyState = { state: string; signupRole?: 'client' | 'worker'; signupName?: string; email?: string; legalName?: string; documentType?: string; sessionId?: string; sessionUrl?: string; nameIssue?: string; requestedName?: string };
export async function mockAccountJourney(page: Page, initial: JourneyState | null = null, next: JourneyState = {state:'name_pending',legalName:'Maria Isabel de la Cruz Santos',documentType:'passport',sessionId:'didit-owned'}) {
  let state = initial;
  let signupRole = initial?.signupRole;
  const requests: { name: string; body: Record<string, unknown> }[] = [];
  if (initial) await page.addInitScript(() => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiry = Math.floor(Date.now()/1000)+3600;
    localStorage.setItem('sb-dczhfpcfqlygpbqjctwf-auth-token', JSON.stringify({ access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:'account-test',exp:expiry,role:'authenticated'})}.test`,refresh_token:'test',expires_at:expiry,expires_in:3600,token_type:'bearer',user:{id:'account-test',email:'person@example.com',email_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{registration_version:2}} }));
  });
  await page.route('**/functions/v1/**', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({status:204,headers:corsHeaders}); return; }
    const body = route.request().postDataJSON() as Record<string,unknown>; const name=route.request().url().split('/').pop() || '';
    requests.push({name,body});
    if(name==='account-registration' && body.action==='create') {
      signupRole = body.signupRole === 'worker' ? 'worker' : 'client';
      state = { state: 'email_pending', email: String(body.email), signupRole };
    }
    if(name==='account-registration' && body.action==='save_name') state = { ...state, state: 'email_pending', signupName: String(body.signupName) };
    if(name==='account-didit-session') state=body.action==='get_session'?next:{state:'identity_in_progress',sessionId:'didit-owned',sessionUrl:'https://verification.didit.me/session/test'};
    if(name==='account-identity-name') state=body.action==='request_correction'?{...state,state:'identity_review',requestedName:String(body.requestedName),nameIssue:'Applicant requested a correction.'}:{state:'ready'};
    if(name==='account-manual-review') state={state:'identity_review',nameIssue:'Manual evidence needs review.'};
    await route.fulfill({headers:corsHeaders,json:{...state,...(name === 'account-registration' && signupRole ? { signupRole } : {}),...(body.action==='create'?{pendingAccount:{userId:'account-test',nonce:'recovery-test'},emailDelivery:{sent:true}}:{})}});
  });
  return {requests,setState:(value:JourneyState)=>{state=value;}};
}
export async function fillRegistration(page: Page, email = 'person@example.com', signupRole: 'client' | 'worker' = 'client') {
  await page.getByRole('radio', { name: signupRole === 'worker' ? 'Worker: Offer services' : 'Client: Book a service', exact: true }).check();
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Password123!');
  await page.getByLabel('Confirm password',{exact:true}).fill('Password123!');
  await page.getByRole('checkbox',{name:'I agree to the Terms and Conditions',exact:true}).check();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await fillSignupName(page);
}
export async function fillSignupName(page: Page, name = 'Maria Isabel de la Cruz Santos') {
  await page.getByLabel('Complete name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Continue to email', exact: true }).click();
}
export async function fillManualEvidence(page: Page) {
  await page.getByLabel('Name on ID',{exact:true}).fill('Manual User');
  await page.getByLabel('Government document type').fill('Postal ID');
  await page.getByLabel('ID number',{exact:true}).fill('POSTAL-1234567');
  await page.getByLabel('ID expiry date (if shown)').fill('2099-12-31');
  for(const part of ['front','back','selfie']) await page.locator(`#manual-${part}-image`).setInputFiles({name:`${part}.png`,mimeType:'image/png',buffer:Buffer.from('image')});
}
export async function expectNoRegistrationOverflow(page: Page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
}
