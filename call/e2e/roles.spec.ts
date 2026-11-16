import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('dev')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/cases')
  await expect(page).toHaveURL(/\/login$/)
})

test('brand shows the Beverly b with the product name, and no Callpoint', async ({ page }) => {
  await signIn(page, 'agent@x.test')
  await expect(page.getByText('Beverly Call', { exact: true }).first()).toBeVisible()
  await expect(page.locator('img.bmark').first()).toBeVisible()
  await expect(page.getByText('Callpoint')).toHaveCount(0)
})

test('an agent lands on the call screen and cannot open admin', async ({ page }) => {
  await signIn(page, 'agent@x.test')
  await expect(page).toHaveURL(/\/call$/)
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/call$/)
})

test('call chips open detail modals and no "viewing as" chip is on the call screen', async ({ page }) => {
  await signIn(page, 'agent@x.test')
  await expect(page.getByText('Musa Garba').first()).toBeVisible()
  await expect(page.getByText(/Viewing as/)).toHaveCount(0)
  await page.getByRole('button', { name: /open ticket/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Open cases' })
  await expect(dialog).toContainText('EX-2041')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: /^NGN|Bill account/ }).click()
  await expect(page.getByRole('dialog', { name: 'Wallet' })).toContainText('5,000')
})

test('the notification bell shows only real events: a new agent has none', async ({ page }) => {
  await signIn(page, 'agent@x.test')
  await page.getByRole('button', { name: 'Notifications' }).click()
  await expect(page.getByText('You are all caught up.')).toBeVisible()
})

test('a supervisor can switch the agents list between cards and table', async ({ page }) => {
  await signIn(page, 'sup@x.test')
  await page.goto('/wall')
  await expect(page.getByRole('listitem', { name: /Chidi Okafor/ })).toBeVisible()
  await page.getByRole('button', { name: 'Table view' }).click()
  await expect(page.getByRole('row', { name: /Chidi Okafor/ })).toBeVisible()
  await page.getByRole('button', { name: 'Card view' }).click()
  await expect(page.getByRole('listitem', { name: /Chidi Okafor/ })).toBeVisible()
})

test('a supervisor can resolve an escalation only with a note', async ({ page }) => {
  await signIn(page, 'sup@x.test')
  await page.goto('/cases')
  await page.getByRole('row', { name: /EX-2040/ }).click()
  await page.getByRole('button', { name: 'Resolve' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Add what fixed it' })).toBeVisible()
  await page.getByLabel('Resolution note').fill('Token re-issued')
  await page.getByRole('button', { name: 'Resolve' }).click()
  await expect(page.getByRole('row', { name: /EX-2040/ })).toContainText('Done')
})

test('an admin sees the audit log, retention proof and connection health', async ({ page }) => {
  await signIn(page, 'admin@x.test')
  await page.goto('/admin')
  await expect(page.getByText('Retention proof')).toBeVisible()
  await expect(page.getByText('Audit log')).toBeVisible()
  await expect(page.getByText('Connections')).toBeVisible()
  await expect(page.getByText('Database').first()).toBeVisible()
})

test('wallet details come from Beverly’s data: balance, held and available', async ({ page }) => {
  await signIn(page, 'agent@x.test')
  await expect(page.getByText('Musa Garba').first()).toBeVisible()
  await page.getByRole('button', { name: /^NGN/ }).click()
  const d = page.getByRole('dialog', { name: 'Wallet' })
  await expect(d).toContainText('On hold')
  await expect(d).toContainText('Available')
  await expect(d).toContainText('3,000')
})

test('the language choice is Beverly’s four, with native names, and no Pidgin interface', async ({ page }) => {
  await signIn(page, 'agent@x.test')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  const options = await page.getByLabel('Language').locator('option').allTextContents()
  expect(options).toEqual(['English', 'Yorùbá (Yoruba)', 'Hausa', 'Igbo'])
})

test('an agent works a Beverly support ticket: take it, reply, add an internal note', async ({ page }) => {
  await signIn(page, 'agent@x.test')
  await page.goto('/tix')
  await expect(page.getByRole('row', { name: /TKT-2026-00001/ })).toBeVisible()
  await page.getByRole('row', { name: /TKT-2026-00001/ }).click()
  await page.getByRole('button', { name: 'Take it' }).click()
  await expect(page.getByRole('button', { name: 'Release' })).toBeVisible()
  await page.getByLabel('Message', { exact: true }).fill('Checking your payment now')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Checking your payment now')).toBeVisible()
  await page.getByLabel('Message', { exact: true }).fill('Vend log shows a timeout')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Vend log shows a timeout')).toBeVisible()
  await expect(page.getByText('Internal', { exact: true }).first()).toBeVisible()
})
