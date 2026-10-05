import { expect, test } from '@playwright/test';
import { mockAccountJourney, fillManualEvidence, expectNoRegistrationOverflow } from './helpers/registration';
for(const width of [390,768,1024,1280,1440]) {
  test(`approved identity requires complete name confirmation at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    const flow=await mockAccountJourney(page,{state:'identity_pending'});
    await page.goto('/register');
    await expect(page.getByRole('heading',{name:'Verify your identity',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Verify with Didit'})).toBeDisabled();
    await page.getByRole('checkbox',{name:/I consent to identity/}).check();
    await page.getByRole('button',{name:'Verify with Didit'}).click();
    await expect(page.getByRole('link',{name:/Continue in Didit/})).toHaveAttribute('href',/didit\.me/);
    await page.getByRole('button',{name:'Check verification status'}).click();
    await expect(page.getByRole('heading',{name:'Name on your verified ID'})).toBeVisible();
    await expect(page.getByText('Maria Isabel de la Cruz Santos',{exact:true})).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await page.getByRole('button',{name:'Confirm my legal name'}).click();
    await expect(page.getByRole('heading',{name:'Your account is ready'})).toBeVisible();
    expect(flow.requests.filter(item=>item.name==='account-identity-name')).toEqual([expect.objectContaining({body:expect.objectContaining({action:'confirm_name',confirmed:true})})]);
    await expectNoRegistrationOverflow(page);
  });
}
for(const [label,next] of [
  ['review',{state:'identity_review',nameIssue:'The overall decision needs review.'}],
  ['missing name',{state:'identity_review',nameIssue:'The verified name needs human review.'}],
  ['duplicate',{state:'identity_review',nameIssue:'Another account has a matching identity document.'}],
  ['declined',{state:'declined'}], ['abandoned',{state:'declined'}],
] as const) test(`${label} does not expose marketplace access`,async({page})=>{
  await mockAccountJourney(page,next);
  await page.goto('/register');
  await expect(page.getByRole('heading',{name:next.state==='declined'?'Verification needs another attempt':'Identity review pending'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Start booking services'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Confirm my legal name'})).toHaveCount(0);
});
test('a disputed legal name stays a correction request for human review',async({page})=>{
  const flow=await mockAccountJourney(page,{state:'name_pending',legalName:'Original Source Name',documentType:'passport',sessionId:'didit-owned'});
  await page.goto('/register');
  await page.getByText('My legal name is missing or incorrect',{exact:true}).click();
  await page.getByLabel('Requested legal name').fill('Requested Correct Name');
  await page.getByRole('button',{name:'Request name review'}).click();
  await expect(page.getByRole('heading',{name:'Identity review pending'})).toBeVisible();
  await expect(page.getByText('Name from ID: Original Source Name')).toBeVisible();
  await expect(page.getByText('Requested correction: Requested Correct Name')).toBeVisible();
  expect(flow.requests.some(item=>item.body.action==='confirm_name')).toBe(false);
});
test('manual fallback submits evidence for the existing confirmed account without credentials or address',async({page})=>{
  const flow=await mockAccountJourney(page,{state:'identity_pending'});
  await page.goto('/register');
  await page.getByRole('checkbox',{name:/I consent to identity/}).check();
  await page.getByRole('button',{name:'Submit manually'}).click();
  await fillManualEvidence(page);
  await page.getByRole('button',{name:'Submit for human review'}).click();
  await expect(page.getByRole('heading',{name:'Identity review pending'})).toBeVisible();
  const body=flow.requests.find(item=>item.name==='account-manual-review')?.body;
  expect(body).toMatchObject({fullName:'Manual User',documentType:'Postal ID',frontImage:{mimeType:'image/png'},acceptedIdentityTerms:true});
  expect(body).not.toHaveProperty('password'); expect(body).not.toHaveProperty('address');
});
test('cross-device return resumes the server-linked session without local signup data',async({page})=>{
  const flow=await mockAccountJourney(page,{state:'identity_in_progress',sessionId:'didit-owned',sessionUrl:'https://verification.didit.me/session/test'});
  await page.goto('/register?check_verification=true&status=Approved');
  await expect(page.getByRole('heading',{name:'Name on your verified ID'})).toBeVisible();
  expect(flow.requests.filter(item=>item.body.action==='create')).toHaveLength(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('trabawho.identitySignup.v1'))).toBeNull();
});
test('worker intent survives verification responses from older identity endpoints', async ({ page }) => {
  await mockAccountJourney(page, { state: 'identity_pending', signupRole: 'worker' });
  await page.goto('/register');
  await page.getByRole('checkbox', { name: /I consent to identity/ }).check();
  await page.getByRole('button', { name: 'Verify with Didit' }).click();
  await page.getByRole('button', { name: 'Check verification status' }).click();
  await page.getByRole('button', { name: 'Confirm my legal name' }).click();
  await expect(page.getByTestId('auth-task-panel').getByRole('link').last()).toHaveText('Offer services');
});

for (const signupRole of ['client', 'worker'] as const) test(`ready ${signupRole} resumes with the relevant next action`, async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'ready', signupRole });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Your account is ready', exact: true })).toBeVisible();
  const actions = page.getByTestId('auth-task-panel').getByRole('link');
  await expect(page.getByText(/To use the other role, sign out and register a separate account with a different email/)).toBeVisible();
  await expect(actions).toHaveCount(1);
  await expect(page.getByRole('link', { name: signupRole === 'worker' ? 'Start booking services' : 'Offer services', exact: true })).toHaveCount(0);
  await expect(actions.last()).toHaveText(signupRole === 'worker' ? 'Offer services' : 'Start booking services');
  await expect(actions.last()).toHaveAttribute('href', signupRole === 'worker' ? '/seller/onboarding' : '/dashboard');
  await page.reload();
  await expect(actions.last()).toHaveAttribute('href', signupRole === 'worker' ? '/seller/onboarding' : '/dashboard');
  expect(flow.requests.filter(item => item.body.action === 'create')).toHaveLength(0);
});
test('dashboard refresh redirects a pending account back to registration',async({page})=>{
  await mockAccountJourney(page,{state:'identity_review'});
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByRole('heading',{name:'Identity review pending'})).toBeVisible();
});
